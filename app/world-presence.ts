import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { VehicleKind } from './road-vehicles';

export type PlayerPose = {
  lon: number;
  lat: number;
  heading: number;
  speed: number;
  vehicle: VehicleKind | null;
};
export type PlayerPacket = PlayerPose & {
  id: string;
  name: string;
  seq: number;
};
export type LivePeer = {
  packet: PlayerPacket;
  previous: PlayerPacket;
  receivedAt: number;
  interval: number;
};
export type LiveStatus =
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'unconfigured';
const PREFIX = 'open-world:nearby:v1:',
  CELL = 0.02;
export function nearbyRooms(lon: number, lat: number) {
  const x = Math.floor((lon + 180) / CELL),
    y = Math.floor((lat + 90) / CELL),
    rooms: string[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const row = y + dy;
      if (row >= 0 && row < 9000)
        rooms.push(`${PREFIX}${(x + dx + 18000) % 18000}:${row}`);
    }
  return { home: `${PREFIX}${x % 18000}:${Math.min(y, 8999)}`, rooms };
}
export function validPacket(value: unknown): value is PlayerPacket {
  if (!value || typeof value !== 'object') return false;
  const p = value as PlayerPacket;
  return (
    typeof p.id === 'string' &&
    p.id.length >= 8 &&
    p.id.length <= 64 &&
    typeof p.name === 'string' &&
    p.name.length <= 24 &&
    Number.isFinite(p.lon) &&
    p.lon >= -180 &&
    p.lon <= 180 &&
    Number.isFinite(p.lat) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    Number.isFinite(p.heading) &&
    Math.abs(p.heading) < 1e6 &&
    Number.isFinite(p.speed) &&
    Math.abs(p.speed) <= 100 &&
    Number.isSafeInteger(p.seq) &&
    p.seq >= 0 &&
    (p.vehicle === null || ['bus', 'car', 'bike', 'lorry'].includes(p.vehicle))
  );
}
// Presence tracks membership. Motion goes over throttled Broadcast, never database writes.
export function createWorldPresence(
  client: SupabaseClient,
  id: string,
  name: string,
) {
  const channels = new Map<
      string,
      {
        channel: RealtimeChannel;
        ready: boolean;
        retry?: ReturnType<typeof setTimeout>;
        failures: number;
      }
    >(),
    members = new Set<string>();
  const peers = new Map<string, LivePeer>();
  let home = '',
    latest: PlayerPacket | undefined,
    seq = 0,
    disposed = false;
  let status: LiveStatus = 'connecting',
    lastSent = 0,
    lastTrack = 0,
    timer: ReturnType<typeof setInterval> | undefined;
  const accept = (packet: unknown) => {
    if (!validPacket(packet) || packet.id === id || !members.has(packet.id))
      return;
    const old = peers.get(packet.id);
    if (old && packet.seq <= old.packet.seq) return;
    if (!old && peers.size >= 80) return;
    const now = performance.now();
    peers.set(packet.id, {
      packet,
      previous: old?.packet ?? packet,
      receivedAt: now,
      interval: Math.max(50, Math.min(1000, old ? now - old.receivedAt : 100)),
    });
  };
  const sync = () => {
    members.clear();
    const initial: PlayerPacket[] = [];
    for (const entry of channels.values())
      if (entry.ready)
        for (const [key, states] of Object.entries(
          entry.channel.presenceState<PlayerPacket>(),
        )) {
          if (key === id) continue;
          const p = states[0];
          if (validPacket(p) && p.id === key) {
            members.add(key);
            initial.push(p);
          }
        }
    for (const key of peers.keys()) if (!members.has(key)) peers.delete(key);
    initial.forEach(accept);
  };
  const transmit = () => {
    const entry = channels.get(home);
    if (disposed || !latest || !entry?.ready) return;
    const now = performance.now(),
      interval = Math.abs(latest.speed) > 0.05 ? 120 : 1000;
    if (now - lastSent >= interval) {
      lastSent = now;
      latest = { ...latest, seq: ++seq };
      void entry.channel.send({
        type: 'broadcast',
        event: 'move',
        payload: latest,
      });
    }
    if (now - lastTrack > 5000) {
      lastTrack = now;
      void entry.channel.track(latest);
    }
  };
  function subscribe(room: string, failures = 0) {
    const channel = client.channel(room, {
      config: { presence: { key: id }, broadcast: { self: false } },
    });
    const entry: {
      channel: RealtimeChannel;
      ready: boolean;
      retry?: ReturnType<typeof setTimeout>;
      failures: number;
    } = { channel, ready: false, failures };
    channels.set(room, entry);
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('broadcast', { event: 'move' }, ({ payload }) => accept(payload))
      .subscribe((state) => {
        if (disposed || channels.get(room) !== entry) return;
        entry.ready = state === 'SUBSCRIBED';
        if (entry.ready) {
          entry.failures = 0;
          clearTimeout(entry.retry);
        }
        if (entry.ready && room === home && latest) {
          status = 'online';
          lastTrack = performance.now();
          void channel.track(latest);
          lastSent = 0;
          transmit();
        } else if (!entry.ready) {
          if (room === home) status = 'reconnecting';
          sync();
          clearTimeout(entry.retry);
          entry.retry = setTimeout(
            () => {
              if (disposed || channels.get(room) !== entry) return;
              channels.delete(room);
              void client.removeChannel(channel);
              subscribe(room, entry.failures);
            },
            Math.min(15000, 2000 * 2 ** entry.failures++),
          );
        }
      });
  }
  return {
    peers,
    get status() {
      return status;
    },
    update(pose: PlayerPose) {
      if (disposed) return;
      latest = { ...pose, id, name: name.slice(0, 24), seq: ++seq };
      if (!validPacket(latest)) return;
      const region = nearbyRooms(pose.lon, pose.lat);
      if (region.home !== home) {
        const old = channels.get(home);
        if (old?.ready) void old.channel.untrack();
        home = region.home;
        const want = new Set(region.rooms);
        for (const [room, entry] of channels)
          if (!want.has(room)) {
            channels.delete(room);
            clearTimeout(entry.retry);
            void client.removeChannel(entry.channel);
          }
        for (const room of want) if (!channels.has(room)) subscribe(room);
        const own = channels.get(home);
        status = own?.ready ? 'online' : 'connecting';
        if (own?.ready) void own.channel.track(latest);
        sync();
        lastSent = 0;
      }
      transmit();
      if (!timer)
        timer = setInterval(() => {
          transmit();
          const now = performance.now();
          for (const [key, p] of peers)
            if (now - p.receivedAt > 15000) peers.delete(key);
        }, 1000);
    },
    idle() {
      if (latest) {
        latest = { ...latest, speed: 0, seq: ++seq };
        lastSent = 0;
        transmit();
      }
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      for (const e of channels.values()) {
        clearTimeout(e.retry);
        void e.channel.untrack();
        void client.removeChannel(e.channel);
      }
      channels.clear();
      peers.clear();
      members.clear();
    },
  };
}
