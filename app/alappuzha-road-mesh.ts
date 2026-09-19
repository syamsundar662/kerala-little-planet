import { BufferGeometry, Float32BufferAttribute, type Material } from 'three';

export function configureGroundLayers(
  water: Material,
  shoulder: Material,
  asphalt: Material,
  stripe: Material,
) {
  const layers = new Map<Material, number>([
    [water, -90],
    [shoulder, -80],
    [asphalt, -70],
    [stripe, -60],
  ]);
  for (const material of layers.keys()) {
    material.depthTest = false;
    material.depthWrite = false;
  }
  return layers;
}
export type RoadSegment = {
  a: [number, number];
  b: [number, number];
  width: number;
};
// A round join covers the outside wedge left by independently extruded segments.
// Build these in world coordinates so streamed chunk boundaries share identical joins.
export function roadRibbonGeometry(
  segments: RoadSegment[],
  extraWidth: number,
  height: number,
  roundJoins = false,
) {
  const vertices: number[] = [];
  const joins = new Map<string, { x: number; z: number; radius: number }>();
  const triangle = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number,
  ) => vertices.push(ax, height, az, bx, height, bz, cx, height, cz);
  for (const { a, b, width } of segments) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      radius = (width + extraWidth) / 2;
    if (length < 0.01 || radius <= 0) continue;
    const nx = (-dz / length) * radius,
      nz = (dx / length) * radius;
    // Upward winding avoids inconsistent lighting between strips and their joins.
    triangle(a[0] + nx, a[1] + nz, b[0] + nx, b[1] + nz, a[0] - nx, a[1] - nz);
    triangle(b[0] + nx, b[1] + nz, b[0] - nx, b[1] - nz, a[0] - nx, a[1] - nz);
    if (roundJoins)
      for (const [x, z] of [a, b]) {
        const key = `${x},${z}`,
          existing = joins.get(key);
        if (!existing || existing.radius < radius)
          joins.set(key, { x, z, radius });
      }
  }
  for (const { x, z, radius } of joins.values())
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6;
      triangle(
        x,
        z,
        x + Math.cos(b) * radius,
        z + Math.sin(b) * radius,
        x + Math.cos(a) * radius,
        z + Math.sin(a) * radius,
      );
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
// Keep a dash's phase across OSM nodes; short segments must not restart it.
export function dashIntervals(
  length: number,
  offset: number,
): [number, number][] {
  const result: [number, number][] = [];
  for (
    let start = Math.floor(offset / 10) * 10 - offset;
    start < length;
    start += 10
  ) {
    const a = Math.max(0, start),
      b = Math.min(length, start + 3);
    if (b > a) result.push([a, b]);
  }
  return result;
}
