export type MappedBuilding = {
  id?: number;
  points: Point[];
  height: number;
  levels?: number;
  kind?: string;
  color?: string;
  material?: string;
  roofColor?: string;
  roofShape?: string;
  roofHeight?: number;
  heightSource?: 'mapped' | 'levels' | 'estimated';
};
export type Point = [number, number];
export type Road = {
  id: number;
  name: string;
  kind: string;
  oneway: number;
  access: string;
  nodes: number[];
  points: Point[];
};
export type MapStop = { name: string; label: string; geo: Point };
export type MapData = {
  origin?: Point;
  viewBounds?: [number, number, number, number];
  title?: string;
  radiusKm?: number;
  stops?: MapStop[];
  buildings?: MappedBuilding[];
  timestamp: string;
  boundary: Point[][];
  roads: Road[];
  water: { area: boolean; points: Point[] }[];
  places: { name: string; point: Point }[];
};
export const project = ([lon, lat]: Point): Point => [
  (lon - 76.3) * 109.75,
  (9.5 - lat) * 111.32,
];
// Each loaded region has its own local coordinates; no mutable global origin.
export function mapProjection(data: Pick<MapData, 'origin'>) {
  if (!data.origin) return project;
  const [lon, lat] = data.origin;
  const xScale = 111.32 * Math.max(0.000001, Math.cos((lat * Math.PI) / 180));
  return ([x, y]: Point): Point => [
    (((x - lon + 540) % 360) - 180) * xScale,
    (lat - y) * 111.32,
  ];
}
export function unprojectPoint(
  data: Pick<MapData, 'origin'>,
  point: Point,
): Point {
  const [lon, lat] = data.origin ?? [76.3, 9.5];
  const xScale = data.origin
    ? 111.32 * Math.max(0.000001, Math.cos((lat * Math.PI) / 180))
    : 109.75;
  return [
    ((lon + point[0] / xScale + 540) % 360) - 180,
    Math.max(-90, Math.min(90, lat - point[1] / 111.32)),
  ];
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export type Graph = Map<
  number,
  { point: Point; edges: { to: number; km: number; name: string }[] }
>;
export function makeGraph(data: MapData): Graph {
  const graph: Graph = new Map();
  const project = mapProjection(data);
  for (const r of data.roads) {
    if (['private', 'no'].includes(r.access)) continue;
    for (let i = 0; i < r.nodes.length; i++) {
      const id = r.nodes[i];
      if (!graph.has(id))
        graph.set(id, { point: project(r.points[i]), edges: [] });
    }
    for (let i = 1; i < r.nodes.length; i++) {
      const a = graph.get(r.nodes[i - 1])!,
        b = graph.get(r.nodes[i])!;
      const km = distance(a.point, b.point);
      if (r.oneway !== -1) a.edges.push({ to: r.nodes[i], km, name: r.name });
      if (r.oneway !== 1)
        b.edges.push({ to: r.nodes[i - 1], km, name: r.name });
    }
  }
  return graph;
}
export function nearest(graph: Graph, p: Point) {
  let best = 0,
    min = Infinity;
  for (const [id, n] of graph) {
    const d = distance(p, n.point);
    if (d < min) {
      min = d;
      best = id;
    }
  }
  return best;
}
// A* with a binary min heap. OSM node IDs preserve junctions and grade-separated crossings.
export function route(
  graph: Graph,
  start: number,
  end: number,
): { points: Point[]; km: number; names: string[] } | null {
  const goal = graph.get(end);
  if (!goal || !graph.has(start)) return null;
  const heap: { id: number; score: number }[] = [];
  const push = (v: { id: number; score: number }) => {
    heap.push(v);
    let i = heap.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= v.score) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = v;
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++;
        if (heap[c].score >= last.score) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = last;
    }
    return top;
  };
  const costs = new Map([[start, 0]]),
    prev = new Map<number, { id: number; name: string }>(),
    closed = new Set<number>();
  push({ id: start, score: 0 });
  while (heap.length) {
    const { id } = pop();
    if (closed.has(id)) continue;
    if (id === end) {
      const ids = [end],
        names: string[] = [];
      let at = end;
      while (at !== start) {
        const p = prev.get(at)!;
        if (p.name && !names.includes(p.name)) names.push(p.name);
        at = p.id;
        ids.push(at);
      }
      return {
        points: ids.reverse().map((n) => graph.get(n)!.point),
        km: costs.get(end)!,
        names: names.reverse(),
      };
    }
    closed.add(id);
    for (const edge of graph.get(id)!.edges) {
      const c = costs.get(id)! + edge.km;
      if (c < (costs.get(edge.to) ?? Infinity)) {
        costs.set(edge.to, c);
        prev.set(edge.to, { id, name: edge.name });
        push({
          id: edge.to,
          score: c + distance(graph.get(edge.to)!.point, goal.point),
        });
      }
    }
  }
  return null;
}
export const stops = [
  {
    name: 'Alappuzha',
    label: 'The backwater hub',
    geo: [76.3388, 9.4981] as Point,
  },
  { name: 'Mararikulam', label: 'The beach run', geo: [76.3053, 9.6] as Point },
  {
    name: 'Cherthala',
    label: 'Northbound local',
    geo: [76.3356, 9.686] as Point,
  },
  {
    name: 'Ambalappuzha',
    label: 'The temple town',
    geo: [76.3675, 9.3844] as Point,
  },
  {
    name: 'Haripad',
    label: 'The southern connection',
    geo: [76.4644, 9.279] as Point,
  },
  {
    name: 'Kayamkulam',
    label: 'The long-distance run',
    geo: [76.502, 9.1745] as Point,
  },
  {
    name: 'Mavelikkara',
    label: 'Across the district',
    geo: [76.5505, 9.241] as Point,
  },
  {
    name: 'Chengannur',
    label: 'The eastern gateway',
    geo: [76.6153, 9.318] as Point,
  },
];
export const dayKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
