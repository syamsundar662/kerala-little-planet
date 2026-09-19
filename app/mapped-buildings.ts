import * as T from 'three';
import { naturalMaterial } from './alappuzha-materials';
import type { MappedBuilding, Point } from './alappuzha-map';
// Footprints and tagged dimensions are mapped; facade openings are illustrative.
export function createMappedBuildings() {
  const materials = new Map<string, T.MeshStandardMaterial>();
  const palette = [
    '#b9b4a3',
    '#c4b596',
    '#aaa99e',
    '#b9c3ba',
    '#b9a397',
    '#aeb9c0',
    '#c8c0ac',
    '#a9afa0',
  ];
  const validColor = (value: string | undefined) =>
    value &&
    (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ||
      Object.hasOwn(T.Color.NAMES, value.toLowerCase()))
      ? value.toLowerCase()
      : undefined;
  const material = (color: string, facade: boolean, storey = 3) => {
    const key = `${color}/${facade}/${storey}`;
    const existing = materials.get(key);
    if (existing) return existing;
    // Limit custom-color draw calls in dense neighborhoods.
    if (materials.size >= 96)
      return [...materials.values()].find((m) => m.userData.facade === facade)!;
    const m = naturalMaterial(color, facade ? 'plaster' : 'roof');
    m.userData.facade = facade;
    if (facade) {
      const base = m.onBeforeCompile.bind(m);
      m.customProgramCacheKey = () => `mapped-facade-${storey}`;
      m.onBeforeCompile = (shader, renderer) => {
        base(shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vFacadeNormal;',
          )
          .replace(
            '#include <beginnormal_vertex>',
            '#include <beginnormal_vertex>\nvFacadeNormal=normalize(mat3(modelMatrix)*objectNormal);',
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vFacadeNormal;',
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
      if(abs(vFacadeNormal.y)<.3){
        float horizontal=abs(vFacadeNormal.z)>.5?vSurfaceWorld.x:vSurfaceWorld.z;
        vec2 bay=fract(vec2(horizontal/2.8,vSurfaceWorld.y/${storey.toFixed(2)}));
        float pane=step(.24,bay.x)*step(bay.x,.76)*step(.28,bay.y)*step(bay.y,.79);
        float frame=step(.20,bay.x)*step(bay.x,.80)*step(.24,bay.y)*step(bay.y,.83);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.55,frame);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.095,.115),pane);
        float sill=step(.20,bay.y)*step(bay.y,.24)*step(.18,bay.x)*step(bay.x,.82);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.44,.42,.36),sill);
      }`,
        );
      };
    }
    materials.set(key, m);
    return m;
  };
  return {
    add(
      group: T.Group,
      building: MappedBuilding,
      points: Point[],
      base: number,
    ) {
      const ring = points.slice();
      if (
        ring.length > 1 &&
        Math.hypot(ring[0][0] - ring.at(-1)![0], ring[0][1] - ring.at(-1)![1]) <
          0.01
      )
        ring.pop();
      if (ring.length < 3) return;
      const seed = Math.abs(
        building.id ?? Math.round(points[0][0] * 13 + points[0][1] * 7),
      );
      const industrial = /industrial|warehouse|garage|shed/.test(
        building.kind ?? '',
      );
      const color =
        validColor(building.color) ??
        (building.material === 'brick'
          ? '#9b6954'
          : palette[seed % palette.length]);
      const roofColor =
        validColor(building.roofColor) ??
        (industrial
          ? '#7d8588'
          : building.roofShape === 'flat'
            ? '#92938a'
            : '#855746');
      const rectangle =
        ring.length === 4 &&
        ring.every((p, i) => {
          const a = ring[(i + 1) % 4],
            b = ring[(i + 2) % 4];
          const ux = a[0] - p[0],
            uz = a[1] - p[1],
            vx = b[0] - a[0],
            vz = b[1] - a[1];
          return (
            Math.abs(ux * vx + uz * vz) <
            0.12 * Math.hypot(ux, uz) * Math.hypot(vx, vz)
          );
        });
      const shapeName =
        building.roofShape ??
        (!industrial && building.height < 10 ? 'gabled' : 'flat');
      const pitched =
        rectangle && ['gabled', 'hipped', 'pyramidal'].includes(shapeName);
      const roofHeight = pitched
        ? Math.min(building.height * 0.4, building.roofHeight ?? 1.6)
        : 0;
      const wallHeight = building.height - roofHeight;
      const shape = new T.Shape(ring.map((p) => new T.Vector2(p[0], -p[1])));
      const geo = new T.ExtrudeGeometry(shape, {
        depth: wallHeight,
        bevelEnabled: false,
        steps: 1,
      });
      geo.rotateX(-Math.PI / 2);
      const wall = new T.Mesh(
        geo,
        material(
          color,
          !industrial,
          Math.max(
            2,
            Math.min(
              5,
              Math.round(
                (wallHeight /
                  (building.levels ??
                    Math.max(1, Math.round(wallHeight / 3)))) *
                  2,
              ) / 2,
            ),
          ),
        ),
      );
      wall.position.y = base;
      group.add(wall);
      if (pitched) {
        // Rotate the ring so the ridge follows the longer axis of the footprint.
        if (
          Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]) >
          Math.hypot(ring[2][0] - ring[1][0], ring[2][1] - ring[1][1])
        )
          ring.push(ring.shift()!);
        const p = ring.map((v) => new T.Vector3(v[0], base + wallHeight, v[1]));
        const r0 = p[0].clone().lerp(p[1], 0.5),
          r1 = p[2].clone().lerp(p[3], 0.5);
        if (shapeName === 'hipped') {
          const a = r0.clone();
          r0.lerp(r1, 0.22);
          r1.lerp(a, 0.22);
        } else if (shapeName === 'pyramidal') {
          r0.lerp(r1, 0.5);
          r1.copy(r0);
        }
        r0.y += roofHeight;
        r1.y += roofHeight;
        const vertices: number[] = [];
        for (const tri of [
          [p[0], p[1], r0],
          [p[1], p[2], r1],
          [p[1], r1, r0],
          [p[2], p[3], r1],
          [p[3], p[0], r0],
          [p[3], r0, r1],
        ])
          for (const v of tri) vertices.push(v.x, v.y, v.z);
        const roofGeo = new T.BufferGeometry();
        roofGeo.setAttribute(
          'position',
          new T.Float32BufferAttribute(vertices, 3),
        );
        roofGeo.computeVertexNormals();
        const roofMat = material(roofColor, false);
        roofMat.side = T.DoubleSide;
        group.add(new T.Mesh(roofGeo, roofMat));
      } else {
        const roof = new T.Mesh(
          new T.ShapeGeometry(shape),
          material(roofColor, false),
        );
        roof.rotation.x = -Math.PI / 2;
        roof.position.y = base + wallHeight + 0.025;
        group.add(roof);
      }
    },
    dispose() {
      materials.forEach((m) => m.dispose());
      materials.clear();
    },
  };
}
