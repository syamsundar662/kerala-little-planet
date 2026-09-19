import { mapProjection, type MapData, type Point } from './alappuzha-map';
import type { TerrainData } from './alappuzha-terrain';
export const AREA_RADIUS_KM = 1.2;
export function validPoint(point: Point) {
  return (
    point.every(Number.isFinite) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90
  );
}
export function areaBoxes([lon, lat]: Point): [
  number,
  number,
  number,
  number,
][] {
  if (!validPoint([lon, lat]))
    throw Error(
      'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).',
    );
  const dy = AREA_RADIUS_KM / 111.32;
  const dx = Math.min(
    180,
    dy / Math.max(0.000001, Math.cos((lat * Math.PI) / 180)),
  );
  const south = Math.max(-90, lat - dy),
    north = Math.min(90, lat + dy);
  if (dx === 180) return [[south, -180, north, 180]];
  if (lon - dx < -180)
    return [
      [south, lon - dx + 360, north, 180],
      [south, -180, north, lon + dx],
    ];
  if (lon + dx > 180)
    return [
      [south, lon - dx, north, 180],
      [south, -180, north, lon + dx - 360],
    ];
  return [[south, lon - dx, north, lon + dx]];
}
type Element = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: ({ lon: number; lat: number } | null)[];
};
export function parseArea(
  payload: { elements?: Element[]; remark?: string },
  origin: Point,
): MapData {
  if (!validPoint(origin) || !Array.isArray(payload.elements) || payload.remark)
    throw Error('The map provider returned incomplete data. Please retry.');
  if (payload.elements.length > 25000)
    throw Error(
      'This area is too dense to load safely. Choose a nearby location.',
    );
  const data: MapData = {
    origin,
    title: 'Nearby world',
    radiusKm: AREA_RADIUS_KM,
    timestamp: new Date().toISOString(),
    boundary: [],
    roads: [],
    water: [],
    places: [],
    buildings: [],
    stops: [],
  };
  const project = mapProjection(data);
  let vertices = 0;
  for (const e of payload.elements) {
    if (e.type !== 'way' || !e.geometry || !Number.isFinite(e.id)) continue;
    const tags = e.tags ?? {};
    const runs: { points: Point[]; nodes: number[] }[] = [];
    let run = { points: [] as Point[], nodes: [] as number[] };
    e.geometry.forEach((p, i) => {
      const point: Point = p ? [p.lon, p.lat] : [NaN, NaN];
      const projected = p ? project(point) : [Infinity, Infinity];
      if (
        !validPoint(point) ||
        Math.abs(projected[0]) > AREA_RADIUS_KM + 0.2 ||
        Math.abs(projected[1]) > AREA_RADIUS_KM + 0.2
      ) {
        if (run.points.length > 1) runs.push(run);
        run = { points: [], nodes: [] };
        return;
      }
      run.points.push(point);
      run.nodes.push(e.nodes?.[i] ?? -(e.id * 10000 + i));
    });
    if (run.points.length > 1) runs.push(run);
    for (const part of runs) {
      vertices += part.points.length;
      if (vertices > 180000)
        throw Error(
          'This area has too much geometry. Choose a nearby location.',
        );
      if (
        tags.highway &&
        !['private', 'no'].includes(tags.access ?? '') &&
        !/^(footway|path|steps|cycleway|pedestrian|construction|proposed|bridleway)$/.test(
          tags.highway,
        )
      ) {
        data.roads.push({
          id: e.id,
          name: tags.name ?? '',
          kind: tags.highway,
          oneway:
            tags.oneway === '-1'
              ? -1
              : tags.oneway === 'yes' || tags.junction === 'roundabout'
                ? 1
                : 0,
          access: tags.access ?? '',
          ...part,
        });
      } else if (
        tags.building &&
        part.points.length >= 4 &&
        part.nodes[0] === part.nodes.at(-1)
      ) {
        const measure = (value: string | undefined) => {
          const n = parseFloat(value ?? '');
          return Number.isFinite(n) && n > 0
            ? n * (/ft|feet|'/i.test(value ?? '') ? 0.3048 : 1)
            : undefined;
        };
        const levels = measure(tags['building:levels']);
        const explicit = measure(tags.height);
        const kind = tags.building;
        const height =
          explicit ??
          (levels
            ? levels * 3
            : /house|detached|bungalow|garage|shed/.test(kind)
              ? 3.5
              : /industrial|warehouse/.test(kind)
                ? 8
                : 6);
        data.buildings!.push({
          id: e.id,
          points: part.points,
          height: Math.max(2, Math.min(300, height)),
          levels: levels ? Math.max(1, Math.min(80, levels)) : undefined,
          kind,
          color: tags['building:colour'] || tags['building:color'],
          material: tags['building:material'],
          roofColor: tags['roof:colour'] || tags['roof:color'],
          roofShape: tags['roof:shape'],
          roofHeight: measure(tags['roof:height']),
          heightSource: explicit ? 'mapped' : levels ? 'levels' : 'estimated',
        });
      } else if (tags.natural === 'water' || tags.waterway)
        data.water.push({
          points: part.points,
          area: tags.natural === 'water',
        });
    }
  }
  if (!data.roads.length)
    throw Error(
      'No mapped drivable roads were found nearby. Try a location closer to a town or road.',
    );
  data.stops = [
    { name: 'Selected location', label: 'Nearest mapped road', geo: origin },
  ];
  const names = new Set<string>();
  for (const road of data.roads)
    if (road.name && !names.has(road.name) && data.stops.length < 9) {
      names.add(road.name);
      data.stops.push({
        name: road.name,
        label: 'Nearby road',
        geo: road.points[Math.floor(road.points.length / 2)],
      });
    }
  return data;
}
const cache = new Map<string, MapData>();

export async function loadWorldArea(
  point: Point,
  signal: AbortSignal,
): Promise<{ data: MapData; terrain: TerrainData }> {
  areaBoxes(point);
  const key = point.map((v) => v.toFixed(5)).join(',');
  let data = cache.get(key);
  if (!data) {
    signal.throwIfAborted();
    try {
      const response = await fetch(
        `/api/world-map?lon=${encodeURIComponent(point[0])}&lat=${encodeURIComponent(point[1])}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
        },
      );
      const payload = (await response.json()) as {
        elements?: Element[];
        remark?: string;
        error?: string;
      };
      if (!payload || typeof payload !== 'object')
        throw Error(
          'The map provider returned an invalid response. Please retry.',
        );
      if (!response.ok)
        throw Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Nearby map download failed. Please retry.',
        );
      signal.throwIfAborted();
      data = parseArea(payload, point);
    } catch (error) {
      if (signal.aborted) throw error;
      if (
        error instanceof TypeError ||
        (error instanceof Error &&
          /^(load failed|failed to fetch|networkerror|timeout)/i.test(
            error.message,
          ))
      ) {
        throw Error(
          'The nearby map could not download. Check your connection, then retry this location.',
        );
      }
      throw error;
    }
    cache.set(key, data);
    if (cache.size > 3) cache.delete(cache.keys().next().value!);
  }
  signal.throwIfAborted();
  return {
    data,
    terrain: {
      source: 'Simplified flat terrain',
      step: 50,
      x: -2000,
      z: -2000,
      width: 2,
      height: 2,
      values: [0, 0, 0, 0],
    },
  };
}
