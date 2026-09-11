import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map();
function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');code=code.replace(/from\s*(['"])([^'"]+)\1/g,(all,q,spec)=>{if(spec.startsWith('.'))return 'from '+JSON.stringify(compile(path.resolve(path.dirname(file),spec+'.ts')));return 'from '+JSON.stringify(pathToFileURL(require.resolve(spec==='three'?'three':spec).replace('three.cjs','three.module.js')).href)});const url='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');cache.set(file,url);return url}
const T=await import(pathToFileURL(require.resolve('three').replace('three.cjs','three.module.js')).href);

const {startFall,stepFall}=await import(compile('app/pedestrian-fall.ts'));
const {moveWithCollisions,intersectsBus}=await import(compile('app/vehicle-physics.ts'));
const {WORLD_RADIUS:R}=await import(compile('app/world.ts'));
assert.equal(startFall(0),null);assert.equal(startFall(.1),null);
for(const fps of [30,60,144]){
 const fall=startFall(1.4);let weight=0;
 for(let i=0;i<fps*10;i++){weight=stepFall(fall,1/fps,false);assert.ok(weight>=0&&weight<=1);}
 assert.ok(fall.active);assert.equal(weight,1,'Do not stand up inside bus');
 for(let i=0;i<fps*2;i++)weight=stepFall(fall,1/fps,true);
 assert.equal(fall.active,false);assert.equal(weight,0);
}
const light=startFall(.3),hard=startFall(2);let a,b;for(let i=0;i<6;i++){a=stepFall(light,.05,true);b=stepFall(hard,.05,true);}assert.ok(b>a,'Stronger impact produces faster fall');
let hits=0;const person={normal:new T.Vector3(.98,R,0).normalize(),radius:.055,onImpact(speed,direction){assert.ok(speed>.12);assert.ok(Math.abs(direction.length()-1)<1e-8);hits++;this.disabled=true;return true;}};
const state={normal:new T.Vector3(0,1,0),heading:new T.Vector3(1,0,0),speed:1.8,steering:0};
for(let i=0;i<120;i++)moveWithCollisions(state,1,0,1/120,[person]);
assert.equal(hits,1,'Fall event must not repeat through physics substeps');assert.ok(state.speed>1.5,'Pedestrian does not act like a rigid wall');assert.ok(!intersectsBus(state,[person]));
console.log('PASS: impact threshold, strength, safe recovery, single collision callback, bus momentum and 30/60/144 FPS fall timing.');
