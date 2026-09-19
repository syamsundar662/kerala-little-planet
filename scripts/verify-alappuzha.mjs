import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  makeGraph,
  route,
  nearest,
  project,
  stops,
} from '../app/alappuzha-map.ts';
const data = JSON.parse(fs.readFileSync('public/maps/alappuzha.json', 'utf8'));
assert(data.roads.length > 1000, 'Expected a real district road network');
const graph = makeGraph(data),
  nodes = stops.map((s) => nearest(graph, project(s.geo)));
for (let a = 0; a < stops.length; a++)
  for (let b = 0; b < stops.length; b++) {
    if (a === b) continue;
    const r = route(graph, nodes[a], nodes[b]);
    assert(r && r.km > 0, `No route: ${stops[a].name} to ${stops[b].name}`);
    assert(r.km < 200, 'Unreasonable district journey');
  }
const tiny = {
  roads: [
    {
      id: 1,
      name: 'One-way',
      kind: 'primary',
      oneway: 1,
      access: '',
      nodes: [1, 2],
      points: [
        [76.3, 9.5],
        [76.31, 9.5],
      ],
    },
    {
      id: 2,
      name: 'Private',
      kind: 'service',
      oneway: 0,
      access: 'private',
      nodes: [2, 3],
      points: [
        [76.31, 9.5],
        [76.32, 9.5],
      ],
    },
  ],
};
const g = makeGraph(tiny);
assert(route(g, 1, 2));
assert.equal(route(g, 2, 1), null);
assert.equal(route(g, 1, 3), null);
console.log(
  `PASS: ${data.roads.length} roads, ${graph.size} nodes, all 56 town-to-town routes; one-way and access restrictions.`,
);
