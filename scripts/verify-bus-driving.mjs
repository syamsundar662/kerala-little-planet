import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map();
function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');code=code.replace(/from\s*(['"])([^'"]+)\1/g,(all,q,spec)=>{if(spec.startsWith('.'))return 'from '+JSON.stringify(compile(path.resolve(path.dirname(file),spec+'.ts')));return 'from '+JSON.stringify(pathToFileURL(require.resolve(spec==='three'?'three':spec).replace('three.cjs','three.module.js')).href)});const url='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');cache.set(file,url);return url}
const T=await import(pathToFileURL(require.resolve('three').replace('three.cjs','three.module.js')).href);

const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
// Canvas textures are incidental to this physics regression; keep the real fleet and collision code.
Object.defineProperty(globalThis,'document',{value:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})},configurable:true});
GLTFLoader.prototype.load=function(_url,onLoad){
 const model=new T.Group();
 model.add(new T.Mesh(new T.BoxGeometry(10,4,2)));
 for(const name of ['Front wheel axle','Rear wheel axle']){
  const axle=new T.Mesh(new T.BoxGeometry(.5,.5,2));axle.name=name;axle.position.x=name.startsWith('Front')?3:-3;model.add(axle);
 }
 onLoad({scene:model});
};
const {createBusFleet}=await import(compile('app/bus-fleet.ts'));
const {intersectsBus}=await import(compile('app/vehicle-physics.ts'));
const {WORLD_RADIUS:R}=await import(compile('app/world.ts'));
const pos=(t,lat,r=R)=>new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(r);
for(const fps of [30,60,144]){
 const obstacles=[],fleet=createBusFleet(new T.Group(),pos,obstacles);
 for(const bus of fleet.buses){
  assert.ok(!intersectsBus(bus.state,obstacles),'Parked bus '+bus.id+' must not overlap depot walls');
  assert.equal(bus.wheels.count,2,'Both axles remain animatable after batching');
  const start=bus.state.normal.clone();
  const wheel=bus.group.getObjectByName('Front wheel axle'),rest=wheel.quaternion.clone();
  for(let i=0;i<fps*3;i++){fleet.stepLocal(bus.id,1,0,1/fps,obstacles);fleet.place(bus.id);}
  assert.ok(start.angleTo(bus.state.normal)*R>1.5,'Bus '+bus.id+' can drive out of its bay at '+fps+' FPS');
  assert.ok(bus.state.speed>.3,'Bus must not be trapped by a front pillar');
  assert.ok(wheel.quaternion.angleTo(rest)>.01,'Driving turns the wheels');
 }
 fleet.dispose();
}
console.log('PASS: all five bays start clear, buses drive out, and wheels rotate at 30/60/144 FPS.');

// Exercise the actual boarding/exit handlers with a lightweight scene fixture.
const planet=fs.readFileSync('app/planet.ts','utf8');
const handlers=['dropBus','boardBus','exitBus'].map(name=>planet.split(' function '+name+'(){')[1].split('\n')[0]).map((body,i)=>'function '+['dropBus','boardBus','exitBus'][i]+'(){'+body).join('\n');
vm.runInNewContext(`
 let myBus=-1,nearBus=0,busDriving=false,walking=true,trackWalk=true,walkMoving=true;
 const localAvatar={group:{visible:true}},localId='test',currentName='Driver';
 const walker={state:{normal:new T.Vector3(0,1,0),heading:new T.Vector3(1,0,0)}};
 const busFleet={buses:[{state:{normal:new T.Vector3(0,1,0),heading:new T.Vector3(1,0,0),speed:1}}]};
 const held=new Set(['forward']),parkedBuses=new Set(),busOccupancy=new Map();
 let claims=0,releases=0;
 const busNet={claim(){claims++},release(){releases++}},emitBus=()=>{},busDriveView=()=>{},walkView=()=>{walking=true;trackWalk=true};
 ${handlers}
 boardBus();
 assert.equal(myBus,0);assert.equal(busDriving,true);assert.equal(walking,false);
 assert.equal(localAvatar.group.visible,false);assert.equal(walkMoving,false);assert.equal(held.size,0);
 boardBus();assert.equal(claims,1,'Repeated boarding must not claim twice');
 exitBus();
 assert.equal(localAvatar.group.visible,true);assert.equal(walking,true);assert.equal(busDriving,false);
 assert.equal(myBus,-1);assert.equal(releases,1);assert.equal(busFleet.buses[0].state.speed,0);
 assert.ok(walker.state.normal.angleTo(busFleet.buses[0].state.normal)*R>.9,'Exit places walker beside bus');
 busOccupancy.set(0,{id:'other'});boardBus();
 assert.equal(myBus,-1);assert.equal(localAvatar.group.visible,true,'Failed boarding leaves avatar visible');
`,{T,R,assert});
console.log('PASS: boarding hides and stops walker, repeat claims are ignored, exit restores walker beside stopped bus, occupied bus rejects boarding.');
