import * as T from 'three';
import { createAvatar } from './player-avatar';
import { createWorldNameLabel } from './world-name-label';
import { createRainUmbrella } from './rain-umbrella';
import { createRoadVehicle, vehicleSpecs, type VehicleKind } from './road-vehicles';
import { createWheelRoll } from './wheels';
import type { LivePeer } from './world-presence';
import type { Point } from './alappuzha-map';

export function createWorldPlayers(
  scene: T.Scene,
  project: (geo: Point) => Point,
  elevation: (x: number, z: number) => number,
  bus: T.Group,
) {
  type Actor = {
    nameLabel: ReturnType<typeof createWorldNameLabel>;
    avatar: ReturnType<typeof createAvatar>;
    umbrella: ReturnType<typeof createRainUmbrella>;
    vehicle?: T.Group;
    kind?: VehicleKind;
    roll?: (distance: number) => void;
    position: T.Vector3;
    heading: number;
    placed: boolean;
    busLoaded?: boolean;
  };
  const actors = new Map<string, Actor>();
  const releaseVehicle = (a: Actor) => {
    if (!a.vehicle) return;
    a.vehicle.removeFromParent();
    if (a.kind !== 'bus') {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      a.vehicle.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    }
    a.vehicle = undefined;
    a.kind = undefined;
    a.roll = undefined;
  };
  const remove = (id: string) => {
    const a = actors.get(id);
    if (!a) return;
    releaseVehicle(a);
    a.umbrella.group.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    a.avatar.dispose();
    a.nameLabel.dispose();
    actors.delete(id);
  };
  return {
    update(
      peers: Map<string, LivePeer>,
      local: T.Vector3,
      dt: number,
      raining: boolean,
    ) {
      const nearby = [...peers.entries()]
        .map(([id, peer]) => {
          const p = project([peer.packet.lon, peer.packet.lat]);
          return { id, peer, x: p[0] * 1000, z: p[1] * 1000 };
        })
        .filter((p) => Math.hypot(p.x - local.x, p.z - local.z) < 300)
        .sort(
          (a, b) =>
            Math.hypot(a.x - local.x, a.z - local.z) -
            Math.hypot(b.x - local.x, b.z - local.z),
        )
        .slice(0, 24);
      const wanted = new Set(nearby.map((p) => p.id));
      for (const id of actors.keys()) if (!wanted.has(id)) remove(id);
      for (const { id, peer, x, z } of nearby) {
        let a = actors.get(id);
        if (!a) {
          const avatar = createAvatar({
            name: peer.packet.name,
            gender: 0,
            outfit: id.charCodeAt(0) % 3,
            label: false,
          });
          avatar.group.scale.setScalar(1.8 / 0.34);
          avatar.group.userData.livePlayer = id;
          scene.add(avatar.group);
          a = {
            nameLabel: createWorldNameLabel(scene, peer.packet.name),
            avatar,
            umbrella: createRainUmbrella(avatar.group),
            position: new T.Vector3(),
            heading: peer.packet.heading,
            placed: false,
          };
          actors.set(id, a);
        }
        const before = a.position.clone(),
          distance = Math.hypot(x - a.position.x, z - a.position.z),
          k = !a.placed || distance > 35 ? 1 : 1 - Math.exp(-dt * 12);
        a.position.lerp(new T.Vector3(x, elevation(x, z), z), k);
        a.heading +=
          Math.atan2(
            Math.sin(peer.packet.heading - a.heading),
            Math.cos(peer.packet.heading - a.heading),
          ) * k;
        a.placed = true;
        const kind = peer.packet.vehicle;
        if (
          a.kind !== kind ||
          (kind === 'bus' && a.busLoaded !== Boolean(bus.userData.loaded))
        ) {
          releaseVehicle(a);
          if (kind) {
            if (kind === 'bus') {
              a.busLoaded = Boolean(bus.userData.loaded);
              const wrapper = new T.Group(),
                copy = bus.clone(true);
              copy.position.set(0, 0, 0);
              copy.rotation.set(0, 0, 0);
              copy.visible = true;
              wrapper.add(copy);
              const wheels = createWheelRoll(copy);
              a.vehicle = wrapper;
              a.roll = (d) => wheels.advance(d);
            } else {
              a.vehicle = createRoadVehicle(kind);
              a.roll = a.vehicle.userData.roll as (d: number) => void;
            }
            a.kind = kind;
            a.vehicle.userData.livePlayer = id;
            scene.add(a.vehicle);
          }
        }
        a.avatar.group.visible = !kind;
        a.nameLabel.update(a.position, kind);
        a.avatar.group.position.copy(a.position);
        a.avatar.group.rotation.y = a.heading - Math.PI / 2;
        a.avatar.update(dt, !kind && Math.abs(peer.packet.speed) > 0.1);
        a.umbrella.update(raining && !kind);
        if (a.vehicle) {
          a.vehicle.position.copy(a.position);
          a.vehicle.rotation.y = a.heading;
          const travel = a.position.distanceTo(before);
          if (travel < 5) a.roll?.(travel * Math.sign(peer.packet.speed));
        }
      }
    },
    colliders() {
      return [...actors.values()].filter(a=>a.kind && a.placed).map(a=>({x:a.position.x,z:a.position.z,yaw:a.heading,...vehicleSpecs[a.kind!]}));
    },
    dispose() {
      for (const id of actors.keys()) remove(id);
    },
  };
}
