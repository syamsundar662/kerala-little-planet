type Point = [number, number];
type Road = { a: Point; b: Point; width: number };
const pointDistance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = dx * dx + dz * dz;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const cross = (a: Point, b: Point, p: Point) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  )
    return false;
  return (
    cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
  );
}
function inside(p: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function overlapsRoad(polygon: Point[], road: Road, padding = 1.25) {
  if (polygon.length < 3) return false;
  if (inside(road.a, polygon) || inside(road.b, polygon)) return true;
  const radius = road.width / 2 + padding;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    if (
      intersects(a, b, road.a, road.b) ||
      Math.min(
        pointDistance(a, road.a, road.b),
        pointDistance(b, road.a, road.b),
        pointDistance(road.a, a, b),
        pointDistance(road.b, a, b),
      ) <= radius
    )
      return true;
  }
  return false;
}
export function sceneryFootprint(
  x: number,
  z: number,
  yaw: number,
  building = true,
): Point[] {
  const bounds = building
    ? [
        [-5, -5],
        [5, -5],
        [5, 7],
        [-5, 7],
      ]
    : [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ];
  return bounds.map(([px, pz]) => [
    x + px * Math.cos(yaw) + pz * Math.sin(yaw),
    z - px * Math.sin(yaw) + pz * Math.cos(yaw),
  ]);
}
export function createRoadClearance() {
  const cells = new Map<string, Road[]>(),
    size = 128;
  const bounds = (points: Point[]) => ({
    minX: Math.floor(Math.min(...points.map((p) => p[0])) / size),
    maxX: Math.floor(Math.max(...points.map((p) => p[0])) / size),
    minZ: Math.floor(Math.min(...points.map((p) => p[1])) / size),
    maxZ: Math.floor(Math.max(...points.map((p) => p[1])) / size),
  });
  return {
    clear: () => cells.clear(),
    add: (road: Road) => {
      const r = road.width / 2 + 1.25,
        b = bounds([
          [
            Math.min(road.a[0], road.b[0]) - r,
            Math.min(road.a[1], road.b[1]) - r,
          ],
          [
            Math.max(road.a[0], road.b[0]) + r,
            Math.max(road.a[1], road.b[1]) + r,
          ],
        ]);
      for (let x = b.minX; x <= b.maxX; x++)
        for (let z = b.minZ; z <= b.maxZ; z++) {
          const key = `${x},${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key)!.push(road);
        }
    },
    blocked: (polygon: Point[]) => {
      const b = bounds(polygon),
        seen = new Set<Road>();
      for (let x = b.minX; x <= b.maxX; x++)
        for (let z = b.minZ; z <= b.maxZ; z++)
          for (const road of cells.get(`${x},${z}`) ?? []) {
            if (seen.has(road)) continue;
            seen.add(road);
            if (overlapsRoad(polygon, road)) return true;
          }
      return false;
    },
  };
}
