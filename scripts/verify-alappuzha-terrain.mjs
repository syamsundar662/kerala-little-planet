import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createTerrain} from '../app/alappuzha-terrain.ts';
const meta=JSON.parse(fs.readFileSync('public/maps/terrain/alappuzha-dem.json','utf8'));
const raw=fs.readFileSync('public/maps/terrain/alappuzha-dem.bin');
assert.equal(raw.length,meta.width*meta.height*2);
const values=Float32Array.from({length:meta.width*meta.height},(_,i)=>raw.readInt16LE(i*2)/10);
const terrain=createTerrain({...meta,values});
const points=[[76.3388,9.4981],[76.3375,9.6875],[76.501,9.247],[76.6,9.15]];
const heights=points.map(([lon,lat])=>terrain.sample((lon-76.3)*109750,(9.5-lat)*111320));
assert(heights.every(h=>Number.isFinite(h)&&h>-15&&h<150));
assert(Math.max(...heights)-Math.min(...heights)>1,'DEM must have actual relief');
for(const center of [[4250,250],[4750,250],[30000,25000]]){
 terrain.update(...center);const p=terrain.geometry.attributes.position;
 for(let i=0;i<p.count;i++)assert(Math.abs(p.getY(i)-(terrain.sample(p.getX(i),p.getZ(i))-.06))<.001,'mesh matches actor surface');
}
const fixture=createTerrain({step:50,x:0,z:0,width:2,height:2,values:[0,10,20,40]});
assert.equal(fixture.sample(10,10),6);assert.equal(fixture.sample(40,40),30);assert.equal(fixture.sample(-10,-10),0);
assert.throws(()=>createTerrain({...meta,values:[NaN]}));
console.log('PASS: DEM dimensions, regional relief, triangle interpolation, streamed surface/actor alignment, invalid-data rejection.',{heights});
