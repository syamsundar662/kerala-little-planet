import * as T from 'three';
export type TerrainData = {
  source: string;
  step: number;
  x: number;
  z: number;
  width: number;
  height: number;
  values: number[] | Float32Array;
};
export function createTerrain(data: TerrainData) {
  if (
    data.step !== 50 ||
    data.width < 2 ||
    data.height < 2 ||
    data.values.length !== data.width * data.height ||
    !data.values.every(Number.isFinite)
  )
    throw Error('Invalid elevation dataset');
  const sample = (x: number, z: number) => {
    const gx = T.MathUtils.clamp((x - data.x) / data.step, 0, data.width - 1),
      gz = T.MathUtils.clamp((z - data.z) / data.step, 0, data.height - 1);
    const ix = Math.min(Math.floor(gx), data.width - 2),
      iz = Math.min(Math.floor(gz), data.height - 2),
      fx = gx - ix,
      fz = gz - iz;
    const a = data.values[iz * data.width + ix],
      b = data.values[iz * data.width + ix + 1],
      c = data.values[(iz + 1) * data.width + ix],
      d = data.values[(iz + 1) * data.width + ix + 1];
    // Same triangles as the rendered ground, so actors never use a different surface.
    return fx + fz <= 1
      ? a + (b - a) * fx + (c - a) * fz
      : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  };
  const geometry = new T.BufferGeometry();
  const size = 80,
    vertices = new Float32Array((size + 1) ** 2 * 3),
    indices: number[] = [];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const a = j * (size + 1) + i,
        b = a + 1,
        c = a + size + 1,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  geometry.setAttribute('position', new T.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return {
    sample,
    geometry,
    update: (cx: number, cz: number) => {
      const x0 = Math.floor(cx / data.step) * data.step - 2000,
        z0 = Math.floor(cz / data.step) * data.step - 2000;
      for (let j = 0; j <= size; j++)
        for (let i = 0; i <= size; i++) {
          const x = x0 + i * data.step,
            z = z0 + j * data.step;
          vertices.set([x, sample(x, z) - 0.06, z], (j * (size + 1) + i) * 3);
        }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    },
  };
}

export async function loadTerrain(signal: AbortSignal): Promise<TerrainData> {
  const [meta, raster] = await Promise.all([
    fetch('/maps/terrain/alappuzha-dem.json', { signal }),
    fetch('/maps/terrain/alappuzha-dem.bin', { signal }),
  ]);
  if (!meta.ok || !raster.ok) throw Error('Elevation download failed');
  const data = (await meta.json()) as Omit<TerrainData, 'values'> & {
    encoding: string;
  };
  const buffer = await raster.arrayBuffer();
  if (
    data.encoding !== 'int16-le-decimeters' ||
    buffer.byteLength !== data.width * data.height * 2
  )
    throw Error('Incomplete elevation data');
  const view = new DataView(buffer);
  const values = Float32Array.from(
    { length: data.width * data.height },
    (_, i) => view.getInt16(i * 2, true) / 10,
  );
  return { ...data, values };
}

// Split road faces at DEM cell edges and diagonals before lifting them. Merely
// lifting endpoints cuts through convex terrain and causes disappearing asphalt.
export function drapeTerrainGeometry(
  geometry: T.BufferGeometry,
  sample: (x: number, z: number) => number,
  step = 50,
) {
  type P = [number, number, number];
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = source.getAttribute('position'),
    result: number[] = [];
  const clip = (poly: P[], distance: (p: P) => number): P[] => {
    const output: P[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = distance(a),
        db = distance(b);
      if (da >= 0) output.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        output.push([
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t,
        ]);
      }
    }
    return output;
  };
  const emit = (poly: P[]) => {
    for (let i = 1; i + 1 < poly.length; i++)
      for (const p of [poly[0], poly[i], poly[i + 1]])
        result.push(p[0], p[1] + sample(p[0], p[2]), p[2]);
  };
  for (let i = 0; i < positions.count; i += 3) {
    const poly: P[] = [0, 1, 2].map((j) => [
      positions.getX(i + j),
      positions.getY(i + j),
      positions.getZ(i + j),
    ]);
    const minX = Math.floor(Math.min(...poly.map((p) => p[0])) / step),
      maxX = Math.floor(Math.max(...poly.map((p) => p[0])) / step);
    const minZ = Math.floor(Math.min(...poly.map((p) => p[2])) / step),
      maxZ = Math.floor(Math.max(...poly.map((p) => p[2])) / step);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        let piece = clip(poly, (p) => p[0] - x * step);
        piece = clip(piece, (p) => (x + 1) * step - p[0]);
        piece = clip(piece, (p) => p[2] - z * step);
        piece = clip(piece, (p) => (z + 1) * step - p[2]);
        emit(clip(piece, (p) => (x + z + 1) * step - p[0] - p[2]));
        emit(clip(piece, (p) => p[0] + p[2] - (x + z + 1) * step));
      }
  }
  if (source !== geometry) source.dispose();
  geometry.setIndex(null);
  geometry.setAttribute('position', new T.Float32BufferAttribute(result, 3));
  geometry.computeVertexNormals();
}
