import type { Point } from './alappuzha-map';
import type { LivePeer, LiveStatus } from './world-presence';
import type { VehicleKind } from './road-vehicles';

export type MapPlayer = {
  id: string;
  name: string;
  position: Point;
  heading: number;
  vehicle: VehicleKind | null;
};
export function mapPlayers(
  peers: Map<string, LivePeer>,
  status: LiveStatus,
  project: (point: Point) => Point,
  now: number,
): MapPlayer[] {
  if (status !== 'online') return [];
  return [...peers.values()].filter((peer) => now - peer.receivedAt < 15000).map(({ packet }) => {
    const p = project([packet.lon, packet.lat]);
    return { id: packet.id, name: packet.name, position: [p[0] * 1000, p[1] * 1000], heading: packet.heading, vehicle: packet.vehicle };
  });
}
