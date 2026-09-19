// Refresh source with the Overpass query documented in docs/alappuzha-map.md.
import fs from 'node:fs';
const raw = JSON.parse(
  fs.readFileSync(process.argv[2] || '/tmp/alappuzha-osm.json', 'utf8'),
);
if (raw.remark) throw Error(raw.remark);
const elements = raw.elements;
const boundary = elements.find(
  (e) => e.type === 'relation' && e.id === 3743889,
);
if (!boundary) throw Error('Missing district boundary');
const point = (p) => [p.lon, p.lat];
const roads = elements
  .filter((e) => e.type === 'way' && e.tags?.highway && e.geometry?.length > 1)
  .map((e) => ({
    id: e.id,
    name: e.tags.name || e.tags.ref || '',
    kind: e.tags.highway,
    oneway:
      e.tags.oneway === 'yes'
        ? 1
        : e.tags.oneway === '-1'
          ? -1
          : e.tags.junction === 'roundabout'
            ? 1
            : 0,
    access: e.tags.access || e.tags.motor_vehicle || '',
    nodes: e.nodes,
    points: e.geometry.map(point),
  }));
const data = {
  source: '© OpenStreetMap contributors',
  license: 'ODbL 1.0',
  timestamp: raw.osm3s.timestamp_osm_base,
  boundary: boundary.members
    .filter((m) => m.geometry)
    .map((m) => m.geometry.map(point)),
  roads,
  water: elements
    .filter(
      (e) =>
        e.type === 'way' && (e.tags?.waterway || e.tags?.natural === 'water'),
    )
    .map((e) => ({
      area: e.tags.natural === 'water',
      points: e.geometry.map(point),
    })),
  places: elements
    .filter((e) => e.type === 'node' && e.tags?.place)
    .map((e) => ({
      name: e.tags.name || e.tags['name:en'] || '',
      point: point(e),
    }))
    .filter((e) => e.name),
};
fs.mkdirSync('public/maps', { recursive: true });
fs.writeFileSync('public/maps/alappuzha.json', JSON.stringify(data));
console.log({
  roads: roads.length,
  points: roads.reduce((n, r) => n + r.points.length, 0),
  places: data.places.length,
  water: data.water.length,
});
