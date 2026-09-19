import * as T from 'three';

type Road = {a: [number, number]; b: [number, number]; width: number; kind: string; offset?: number};
export function createStreetLights(scene: T.Scene, mobile: boolean) {
  const metal = new T.MeshStandardMaterial({color: '#45515a', roughness: .75});
  const lamp = new T.MeshStandardMaterial({color: '#fff0cc', emissive: '#ffcf83', emissiveIntensity: 0});
  // A fixed light pool avoids a shader light for every pole in the world.
  const lights = Array.from({length: mobile ? 2 : 4}, () => {
    const light = new T.PointLight('#ffd699', 0, 27, 2);
    light.castShadow = false;
    scene.add(light);
    return light;
  });
  const dummy = new T.Object3D();
  let elapsed = 1;
  return {
    addChunk(group: T.Group, roads: Road[], elevation: (x: number, z: number) => number, blocked: (polygon: [number, number][]) => boolean) {
      const points: T.Vector3[] = [], poles: T.Vector3[] = [];
      for (const road of roads) {
        if (!/^(primary|secondary|tertiary|residential|unclassified|living_street)(?:_link)?$/.test(road.kind)) continue;
        const dx = road.b[0] - road.a[0], dz = road.b[1] - road.a[1], length = Math.hypot(dx, dz);
        if (length < .01) continue;
        const offset = road.offset ?? 0;
        for (let t = (52 - offset % 52) % 52; t < length && points.length < 160; t += 52) {
          const x = road.a[0] + dx * t / length, z = road.a[1] + dz * t / length;
          const nx = dz / length, nz = -dx / length;
          const edge = road.width / 2 + 2.5;
          const px = x + nx * edge, pz = z + nz * edge;
          // Check the entire road index, including junctions and parallel lanes.
          if (blocked([[px-.25,pz-.25],[px+.25,pz-.25],[px+.25,pz+.25],[px-.25,pz+.25]])) continue;
          const y = elevation(px, pz);
          poles.push(new T.Vector3(px, y, pz));
          points.push(new T.Vector3(px, y + 7, pz));
        }
      }
      group.userData.streetLights = points;
      if (!points.length) return;
      const shafts = new T.InstancedMesh(new T.CylinderGeometry(.08, .14, 7, 5), metal, points.length);
      const heads = new T.InstancedMesh(new T.SphereGeometry(.38, 8, 5), lamp, points.length);
      shafts.name = 'Roadside streetlight poles'; heads.name = 'Night streetlight lamps';
      points.forEach((p, i) => {
        dummy.position.copy(poles[i]); dummy.position.y += 3.5;
        dummy.updateMatrix(); shafts.setMatrixAt(i, dummy.matrix);
        dummy.position.copy(p); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      });
      group.add(shafts, heads);
    },
    update(dt: number, position: T.Vector3, daylight: number, chunks: Iterable<T.Group>) {
      const strength = 1 - T.MathUtils.smoothstep(daylight, .05, .45);
      lamp.emissiveIntensity = strength * 3;
      elapsed += dt;
      if (elapsed >= .25) {
        elapsed = 0;
        const nearest: T.Vector3[] = [];
        for (const chunk of chunks) for (const p of (chunk.userData.streetLights ?? []) as T.Vector3[]) {
          if (p.distanceToSquared(position) < 100 * 100) nearest.push(p);
        }
        nearest.sort((a, b) => a.distanceToSquared(position) - b.distanceToSquared(position));
        lights.forEach((light, i) => {
          light.userData.assigned = !!nearest[i];
          if (nearest[i]) light.position.copy(nearest[i]);
        });
      }
      lights.forEach(light => {light.intensity = light.userData.assigned ? strength * 650 : 0;});
      return lights.filter(light => light.intensity > 0).length;
    },
    dispose() { lights.forEach(light => {scene.remove(light); light.dispose();}); metal.dispose(); lamp.dispose(); },
  };
}
