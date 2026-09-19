import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const mapURL=compile(fs.readFileSync('app/alappuzha-map.ts','utf8'));
const areaURL=compile(fs.readFileSync('app/world-area.ts','utf8').replace("'./alappuzha-map'",JSON.stringify(mapURL)));
const streamURL=compile(fs.readFileSync('app/world-stream.ts','utf8').replace("'./alappuzha-map'",JSON.stringify(mapURL)).replace("'./world-area'",JSON.stringify(areaURL)));
const {createWorldStream,mergeRegions}=await import(streamURL);
const {mapProjection,unprojectPoint}=await import(mapURL);
const origin=[-.1276,51.5072],project=mapProjection({origin});
const region=(center)=>({origin:center,title:'Nearby world',timestamp:'test',roads:[],water:[],boundary:[],places:[],stops:[],buildings:[]});
const initial=region(origin);
let time=0,calls=[],updates=[],statuses=[],finish;
const stream=createWorldStream(initial,{now:()=>time,onData:d=>updates.push(d),onStatus:s=>statuses.push(s),load:(point,signal)=>{calls.push({point,signal});return new Promise(resolve=>finish=()=>resolve({data:region(point)}));}});
const tick=(p,ms=100)=>{time+=ms;stream.update(p);};
tick([0,0]);for(let i=0;i<100;i++)tick([0,0]);assert.equal(calls.length,0,'Stationary player does not prefetch');
for(let x=2;x<=400;x+=2)tick([x,0]);assert.equal(calls.length,1,'Movement east prefetches before edge');assert.ok(project(calls[0].point)[0]>.9);assert.ok(Math.abs(project(calls[0].point)[1])<1e-7);
for(let x=402;x<=800;x+=2)tick([x,0]);assert.equal(calls.length,1,'One request in flight');
finish();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(updates.length,1);assert.deepEqual(updates[0].origin,origin,'Projection origin stays fixed');
tick([800,0],9000);for(let z=2;z<=400;z+=2)tick([800,z]);assert.equal(calls.length,2,'Turning south requests new area');assert.ok(project(calls[1].point)[1]>.9);
stream.dispose();assert.equal(calls[1].signal.aborted,true);finish();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(updates.length,1,'Disposed stream ignores late results');
// Segment de-duplication preserves new portions of clipped OSM ways.
const road=(nodes)=>({id:1,name:'Road',kind:'residential',oneway:0,access:'',nodes,points:nodes.map(n=>[n/10000,0])});
const merged=mergeRegions(origin,[{...initial,roads:[road([1,2,3])]},{...initial,roads:[road([2,3,4])]}]);
assert.equal(merged.roads.reduce((sum,r)=>sum+r.nodes.length-1,0),3);
assert.ok(merged.roads.some(r=>r.nodes.includes(4)));
// Long journeys keep only three regions; backtracking reloads evicted coverage.
let instantCalls=0,last;
const journey=createWorldStream(initial,{now:()=>time,onData:d=>last=d,onStatus:()=>{},load:async point=>{instantCalls++;return {data:region(point)}}});
for(let x=0;x<=8000;x+=4){time+=100;journey.update([x,0]);await Promise.resolve();}
assert.ok(instantCalls>5);assert.ok(last.viewBounds[0]>0,'Distant initial area evicted');assert.ok(last.viewBounds[2]-last.viewBounds[0]<6,'Retained coverage stays bounded');
const before=instantCalls;
for(let x=8000;x>=0;x-=4){time+=100;journey.update([x,0]);await Promise.resolve();}
assert.ok(instantCalls>before,'Reversing reloads old areas');journey.dispose();
let failures=0,status;
const retry=createWorldStream(initial,{now:()=>time,onData:()=>assert.fail('failed data must never apply'),onStatus:s=>status=s,load:async()=>{failures++;throw Error('busy');}});
time+=100;retry.update([2000,0]);await Promise.resolve();assert.equal(status,'retrying');
for(let i=0;i<100;i++){time+=100;retry.update([2000,0]);}assert.equal(failures,1,'No retry storm');
time+=60000;retry.update([2000,0]);await Promise.resolve();assert.equal(failures,2);retry.dispose();
console.log('PASS: directional prefetch, turns/reverse, stationary suppression, one in-flight request, fixed origin, de-duplication, bounded retention, backtracking, cooldown, disposal.');
