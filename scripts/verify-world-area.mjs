import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const mapModule=compile(fs.readFileSync('app/alappuzha-map.ts','utf8'));
const moduleUrl=compile(fs.readFileSync('app/world-area.ts','utf8').replace("'./alappuzha-map'",JSON.stringify(mapModule)));
const {areaBoxes,parseArea,loadWorldArea}=await import(moduleUrl);
const {mapProjection,unprojectPoint,makeGraph}=await import(mapModule);
for(const origin of [[-0.1276,51.5072],[151.2093,-33.8688],[179.999,0],[-179.999,0],[0,89.999]]) {
 const boxes=areaBoxes(origin);assert.ok(boxes.length<=2);
 for(const [s,w,n,e] of boxes){assert.ok(s>=-90&&n<=90&&w>=-180&&e<=180&&s<=n&&w<=e);}
 const projection=mapProjection({origin});assert.deepEqual(projection(origin),[0,0]);
 const p=[.2,-.3],round=projection(unprojectPoint({origin},p));
 if(Math.abs(origin[1])<89)assert.ok(Math.hypot(round[0]-p[0],round[1]-p[1])<1e-7);
}
const fixture=origin=>({elements:[
 {type:'way',id:1,nodes:[1,2,3],tags:{highway:'residential',name:'Test street'},geometry:[{lon:origin[0],lat:origin[1]},{lon:origin[0]+.001,lat:origin[1]},{lon:origin[0]+.002,lat:origin[1]}]},
 {type:'way',id:2,nodes:[4,5,6,4],tags:{building:'yes','building:levels':'3'},geometry:[{lon:origin[0],lat:origin[1]+.0002},{lon:origin[0]+.0001,lat:origin[1]+.0002},{lon:origin[0]+.0001,lat:origin[1]+.0003},{lon:origin[0],lat:origin[1]+.0002}]}
]});
const origin=[-0.1276,51.5072],data=parseArea(fixture(origin),origin);
assert.equal(data.roads.length,1);assert.equal(data.buildings.length,1);assert.equal(data.buildings[0].height,9);assert.equal(makeGraph(data).size,3);
assert.equal(data.stops[1].name,'Test street');
assert.throws(()=>parseArea({elements:[]},origin),/No mapped/);
assert.throws(()=>parseArea({elements:[],remark:'timeout'},origin),/incomplete/);
assert.throws(()=>areaBoxes([Infinity,0]),/valid/);
let requests=0;globalThis.fetch=async(url,options)=>{requests++;assert.ok(url.includes('/api/world-map?')&&url.includes('51.'));return new Response(JSON.stringify(fixture(origin)));};
await loadWorldArea(origin,new AbortController().signal);
await loadWorldArea(origin,new AbortController().signal);assert.equal(requests,1,'Repeated area loads use the bounded session cache');
const cancelled=new AbortController();cancelled.abort();await assert.rejects(loadWorldArea(origin,cancelled.signal));
globalThis.fetch=async()=>{throw new TypeError('Load failed');};
await assert.rejects(loadWorldArea([10,10],new AbortController().signal),/retry this location/);
console.log('PASS: worldwide projections, antimeridian, bounded boxes, geometry conversion, graph, empty/invalid responses, session cache and cancellation.');

const tagged=fixture(origin);Object.assign(tagged.elements[1].tags,{height:"30 ft",'building:colour':'#aabbcc','roof:shape':'hipped','roof:colour':'red','roof:height':'2'});
const taggedBuilding=parseArea(tagged,origin).buildings[0];assert(Math.abs(taggedBuilding.height-9.144)<.001);assert.equal(taggedBuilding.heightSource,'mapped');assert.equal(taggedBuilding.color,'#aabbcc');assert.equal(taggedBuilding.roofShape,'hipped');assert.equal(taggedBuilding.roofHeight,2);assert.equal(taggedBuilding.levels,3);
console.log('PASS: mapped building heights, units, levels, wall and roof tags preserved.');
