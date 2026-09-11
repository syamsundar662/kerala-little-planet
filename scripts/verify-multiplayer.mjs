import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map();
function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');code=code.replace(/from\s*(['"])([^'"]+)\1/g,(all,q,spec)=>{if(spec.startsWith('.'))return 'from '+JSON.stringify(compile(path.resolve(path.dirname(file),spec+'.ts')));return 'from '+JSON.stringify(pathToFileURL(require.resolve(spec==='three'?'three':spec).replace('three.cjs','three.module.js')).href)});const url='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');cache.set(file,url);return url}
const T=await import(pathToFileURL(require.resolve('three').replace('three.cjs','three.module.js')).href);
const {outfitForName,tangentFrame,encodeHeading,decodeHeading,wrapAngle,round4,encodePos}=await import(compile('app/multiplayer-math.ts'));
const R=9;
let seed=7;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const randomNormal=()=>{const z=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-z*z);return new T.Vector3(r*Math.cos(a),z,r*Math.sin(a))};
// (a) heading frame round-trips, including the near-pole reference-vector branch.
for(let i=0;i<500;i++){
 const n=i<20?new T.Vector3((rnd()-.5)*.02,rnd()<.5?1:-1,(rnd()-.5)*.02).normalize():randomNormal();
 const {east,north}=tangentFrame(n);
 assert.ok(Math.abs(east.dot(n))<1e-9&&Math.abs(north.dot(n))<1e-9&&Math.abs(east.dot(north))<1e-9,'Tangent frame stays orthonormal to the normal');
 const angle=rnd()*Math.PI*2-Math.PI;
 const heading=decodeHeading(n,angle);
 assert.ok(Math.abs(heading.length()-1)<1e-9&&Math.abs(heading.dot(n))<1e-9,'Decoded heading is a unit tangent');
 assert.ok(Math.abs(wrapAngle(encodeHeading(n,heading)-angle))<1e-9,'Heading encode/decode round-trips');
}
// (b) 4-decimal wire rounding keeps surface error tiny at R=9.
for(let i=0;i<500;i++){
 const n=randomNormal(),heading=decodeHeading(n,rnd()*Math.PI*2-Math.PI);
 const p=encodePos('abcd1234',n,heading,true);
 const received=new T.Vector3(p.x,p.y,p.z).normalize();
 assert.ok(received.angleTo(n)*R<2e-3,'Wire rounding stays under 2mm of surface drift');
 const decoded=decodeHeading(received,p.h);
 assert.ok(decoded.angleTo(decodeHeading(received,encodeHeading(received,heading.projectOnPlane(received).normalize())))<2e-3,'Wire heading survives rounding');
 assert.equal(p.m,1);assert.equal(p.i,'abcd1234');
}
// (c) shortest-arc wrap across the ±π seam.
assert.ok(Math.abs(wrapAngle(3.1)-3.1)<1e-12&&Math.abs(wrapAngle(-3.1)+3.1)<1e-12);
assert.ok(Math.abs(wrapAngle(3.1-(-3.1))-(-(Math.PI*2-6.2)))<1e-9,'Crossing ±π picks the short way');
for(let i=0;i<200;i++){const a=(rnd()-.5)*40;const w=wrapAngle(a);assert.ok(w>=-Math.PI&&w<=Math.PI&&Math.abs(Math.sin(w)-Math.sin(a))<1e-9&&Math.abs(Math.cos(w)-Math.cos(a))<1e-9)}
// (d) nlerp ≈ slerp for a max-size 10Hz step (.45 units/s → .05 units → ~.0056 rad).
for(let i=0;i<200;i++){
 const from=randomNormal(),direction=decodeHeading(from,rnd()*Math.PI*2-Math.PI);
 const to=from.clone().applyQuaternion(new T.Quaternion().setFromAxisAngle(new T.Vector3().crossVectors(from,direction).normalize(),.05/R*1.2)).normalize();
 for(const alpha of [.25,.5,.75,1.2]){
  const nlerp=from.clone().lerp(to,alpha).normalize();
  const q=new T.Quaternion().setFromUnitVectors(from,to),slerp=from.clone().applyQuaternion(new T.Quaternion().identity().slerp(q,Math.min(alpha,1)));
  if(alpha<=1)assert.ok(nlerp.angleTo(slerp)<1e-6,'nlerp matches slerp within float noise at 10Hz step sizes');
  assert.ok(Math.abs(nlerp.length()-1)<1e-9);
 }
}
// (e) outfit hash is stable and in range.
assert.equal(outfitForName('Meera'),outfitForName('Meera'));
for(const name of ['a','Anand','ചിന്നു','visitor 12','x'.repeat(20),''])assert.ok([0,1,2].includes(outfitForName(name)));
assert.equal(round4(.123456),.1235);
console.log('verify-multiplayer: all checks passed');
