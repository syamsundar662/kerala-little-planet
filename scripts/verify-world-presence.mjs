import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const code = ts.transpileModule(
  fs.readFileSync('app/world-presence.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { createWorldPresence, nearbyRooms, validPacket } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
let now = 10000;
const original = globalThis.performance;
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => now },
  configurable: true,
});
const rooms = new Map();
class Channel {
  constructor(room, options) {
    this.room = room;
    this.id = options.config.presence.key;
    this.handlers = [];
    this.data = null;
    this.ready = false;
  }
  on(type, filter, fn) {
    this.handlers.push({ type, event: filter.event, fn });
    return this;
  }
  subscribe(callback) {
    this.callback = callback;
    queueMicrotask(() => {
      if (!rooms.has(this.room)) rooms.set(this.room, new Set());
      rooms.get(this.room).add(this);
      this.ready = true;
      callback('SUBSCRIBED');
      this.sync();
    });
    return this;
  }
  sync() {
    for (const c of rooms.get(this.room) ?? [])
      for (const h of c.handlers) if (h.type === 'presence') h.fn();
  }
  presenceState() {
    return Object.fromEntries(
      [...(rooms.get(this.room) ?? [])]
        .filter((c) => c.data)
        .map((c) => [c.id, [c.data]]),
    );
  }
  async track(data) {
    this.data = { ...data };
    this.sync();
    return 'ok';
  }
  async untrack() {
    this.data = null;
    this.sync();
    return 'ok';
  }
  async send(message) {
    for (const c of rooms.get(this.room) ?? [])
      if (c !== this)
        for (const h of c.handlers)
          if (h.type === 'broadcast' && h.event === message.event)
            h.fn({ payload: message.payload });
    return 'ok';
  }
}
const client = {
  channel: (name, options) => new Channel(name, options),
  removeChannel: async (c) => {
    rooms.get(c.room)?.delete(c);
    c.sync();
  },
};
const a = createWorldPresence(client, 'session-player-a', 'Explorer A'),
  b = createWorldPresence(client, 'session-player-b', 'Explorer B');
const pose = { lon: 76.319, lat: 9.51, heading: 0, speed: 0, vehicle: null };
try {
  a.update(pose);
  b.update({ ...pose, lon: 76.321 });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(a.status, 'online');
  assert.equal(b.status, 'online');
  assert.equal(a.peers.size, 1);
  assert.equal(b.peers.size, 1);
  now += 200;
  a.update({ ...pose, heading: 0.4, speed: 12, vehicle: 'car' });
  assert.equal(b.peers.get('session-player-a').packet.vehicle, 'car');
  assert.equal(b.peers.get('session-player-a').packet.heading, 0.4);
  a.idle();
  assert.equal(
    b.peers.get('session-player-a').packet.speed,
    0,
    'Backgrounding publishes stationary state',
  );
  const packet = b.peers.get('session-player-a').packet;
  assert.ok(!validPacket({ ...packet, lon: NaN }));
  assert.ok(!validPacket({ ...packet, vehicle: 'jet' }));
  assert.ok(!validPacket({ ...packet, speed: 1e9 }));
  const home = [...rooms.get(nearbyRooms(pose.lon, pose.lat).home)].find(
    (c) => c.id === 'session-player-a',
  );
  await home.send({
    event: 'move',
    payload: { ...packet, seq: packet.seq - 1, speed: 99 },
  });
  assert.equal(
    b.peers.get('session-player-a').packet.speed,
    0,
    'Out-of-order packet ignored',
  );
  now += 1500;
  a.update({ ...pose, lon: 76.322 });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    b.peers.size,
    1,
    'Crossing cell boundary does not duplicate player',
  );
  now += 1500;
  a.update({ ...pose, lon: 80 });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(b.peers.size, 0, 'Distant player leaves nearby presence');
  now += 1500;
  a.update(pose);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(b.peers.size, 1);
  a.dispose();
  assert.equal(b.peers.size, 0, 'Disconnect removes live user');
  assert.equal(new Set(nearbyRooms(179.999, 0).rooms).size, 9);
  assert.equal(new Set(nearbyRooms(-180, 0).rooms).size, 9);
  console.log(
    'PASS: two-client join, movement and vehicle sync, idle, malformed/stale packet rejection, cell crossing, distant leave, disconnect and longitude wrap.',
  );
} finally {
  a.dispose();
  b.dispose();
  Object.defineProperty(globalThis, 'performance', {
    value: original,
    configurable: true,
  });
}
