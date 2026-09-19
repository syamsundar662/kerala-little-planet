import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WORLD_RADIUS,roadLatitude} from './world';
import {surfaceRadius,moveWithCollisions,type Obstacle} from './vehicle-physics';
import type {DriveState} from './driving';
import {batchStaticMeshes} from './batch-meshes';
import {createWheelRoll} from './wheels';

// A shared KSRTC bus stand with FLEET_SIZE parked buses any villager can board and drive. Each bus is an independent
// rigid clone of ksrtc.glb with its own DriveState, so planet.ts drives one locally (moveWithCollisions) and replays
// the others from the network; nobody driving → the bus eases home to its bay. The depot is built bay-by-bay, each
// piece attached TANGENT to the sphere at its own bay normal, so the whole stand hugs the planet's curve.
export const FLEET_SIZE=5;
const R=WORLD_RADIUS;
const BAY_SPACING=0.82,BUS_LIFT=.04,BOARD_RANGE=2.6;
const DEPOT_T=0.90,DEPOT_SIDE=1,DEPOT_OFFSET=3.0; // set back on the grass beside the main road (a short driveway off the tarmac)
export const DEPOT_CLEAR=2.9; // keep-out radius: planet.ts skips spawning houses/trees/palms/rocks within this of the centre

const moveAlong=(n:T.Vector3,dir:T.Vector3,dist:number)=>{const axis=new T.Vector3().crossVectors(n,dir).normalize();return n.clone().applyQuaternion(new T.Quaternion().setFromAxisAngle(axis,dist/R)).normalize()};

// Where the stand sits — exported so world generation can leave a clear patch for it.
export function depotFootprint(pos:(t:number,lat:number,r?:number)=>T.Vector3){
 const roadLat=roadLatitude(DEPOT_T),latC=roadLat+DEPOT_SIDE*(DEPOT_OFFSET/R);
 return {center:pos(DEPOT_T,latC).normalize(),radius:DEPOT_CLEAR};
}

export type Bus={id:number;group:T.Group;state:DriveState;bay:{normal:T.Vector3;heading:T.Vector3};wheels?:ReturnType<typeof createWheelRoll>};

function faceTexture(text:string,sub:string){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d')!;
 g.fillStyle='#b41f24';g.fillRect(0,0,c.width,c.height);g.fillStyle='#f4c542';g.fillRect(0,0,c.width,12);g.fillRect(0,c.height-12,c.width,12);
 g.fillStyle='#ffd94a';g.font='bold 150px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,c.width/2,c.height/2-10);
 g.fillStyle='#ffffff';g.font='bold 44px Georgia, serif';g.fillText(sub,c.width/2,c.height/2+84);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function bayNumberTexture(n:number){
 const c=document.createElement('canvas');c.width=128;c.height=128;const g=c.getContext('2d')!;
 g.fillStyle='#1c2a2a';g.fillRect(0,0,128,128);g.fillStyle='#ffd94a';g.font='bold 92px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),64,68);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
}

export function createBusFleet(globe:T.Group,pos:(t:number,lat:number,r?:number)=>T.Vector3,obstacles:Obstacle[]){
 const roadLat=roadLatitude(DEPOT_T),latC=roadLat+DEPOT_SIDE*(DEPOT_OFFSET/R);
 const up=pos(DEPOT_T,latC).normalize();
 const roadN=pos(DEPOT_T,roadLat).normalize();
 const faceRoad=roadN.clone().sub(up).projectOnPlane(up).normalize();     // parked heading: drive forward = onto the road
 const right=new T.Vector3().crossVectors(faceRoad,up).normalize();       // bays line up along the road tangent

 const concrete=new T.MeshStandardMaterial({color:0xb7b3a8,roughness:.96});
 const wallMat=new T.MeshStandardMaterial({color:0xe4e0d4,roughness:.9});
 const pillarMat=new T.MeshStandardMaterial({color:0xefece2,roughness:.85});
 const roofMat=new T.MeshStandardMaterial({color:0x8f2f2a,roughness:.7,metalness:.1});
 const fasciaMat=new T.MeshStandardMaterial({color:0xa8352d,roughness:.65});

 // A container at the origin holds every depot piece; each piece is attached in globe space tangent to its own normal.
 const depot=new T.Group();depot.name='KSRTC bus stand';depot.userData.depot=true;globe.add(depot);
 const attach=(geo:T.BufferGeometry,m:T.Material|T.Material[],normal:T.Vector3,height:number,cast=true)=>{
  const n=normal.clone().normalize(),f=faceRoad.clone().projectOnPlane(n).normalize(),rr=new T.Vector3().crossVectors(f,n).normalize();
  const o=new T.Mesh(geo,m);o.castShadow=cast;o.receiveShadow=true;o.position.copy(n).multiplyScalar(surfaceRadius(n)+height);
  o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f,n,rr));depot.add(o);return o;
 };
 const bayW=BAY_SPACING*0.98;
 for(let i=0;i<FLEET_SIZE;i++){
  const bn=moveAlong(up,right,(i-(FLEET_SIZE-1)/2)*BAY_SPACING);
  attach(new T.BoxGeometry(2.1,.06,bayW),concrete,bn,.03,false);                                    // bay platform (tangent → follows curve)
  attach(new T.BoxGeometry(.16,.86,bayW),wallMat,moveAlong(bn,faceRoad,-.98),.46);                  // back wall segment
  attach(new T.BoxGeometry(2.3,.08,bayW),roofMat,bn,1.12);                                           // roof tile
  attach(new T.BoxGeometry(.09,.30,bayW),fasciaMat,moveAlong(bn,faceRoad,1.02),1.02);               // front fascia band
  const pillarN=moveAlong(moveAlong(bn,faceRoad,.98),right,BAY_SPACING/2);
  attach(new T.CylinderGeometry(.055,.065,1.02,10),pillarMat,pillarN,.51);       // front pillar
  // bay number plate on the wall, facing the road (+x face carries the number)
  const num=new T.MeshStandardMaterial({map:bayNumberTexture(i+1),roughness:.8});
  attach(new T.BoxGeometry(.04,.3,.3),[num,wallMat,wallMat,wallMat,wallMat,wallMat],moveAlong(bn,faceRoad,-.88),.64);
  // obstacles: a solid block behind each bay (can't reverse through the wall) + the front pillar
  obstacles.push({normal:moveAlong(bn,faceRoad,-.98),axis:faceRoad.clone(),halfX:.08,halfZ:bayW/2});
  obstacles.push({normal:pillarN,radius:.08});
 }
 // Central KSRTC marquee above the fascia, facing the road.
 const face=new T.MeshStandardMaterial({map:faceTexture('KSRTC','KERALA STATE ROAD TRANSPORT'),roughness:.6});
 const back=new T.MeshStandardMaterial({color:0x6d1a17,roughness:.8});
 attach(new T.BoxGeometry(.08,.46,BAY_SPACING*(FLEET_SIZE-1)+0.4),[face,back,back,back,back,back],moveAlong(up,faceRoad,1.02),1.5);

 // ---- Drivable buses ----
 const buses:Bus[]=[];
 for(let i=0;i<FLEET_SIZE;i++){
  const bayNormal=moveAlong(up,right,(i-(FLEET_SIZE-1)/2)*BAY_SPACING);
  const heading=faceRoad.clone().projectOnPlane(bayNormal).normalize();
  const group=new T.Group();group.name='KSRTC bus '+(i+1);globe.add(group);
  const ph=new T.Mesh(new T.BoxGeometry(.42,.34,1.5),new T.MeshStandardMaterial({color:0xb43b2f,roughness:.6}));ph.position.y=.2;ph.castShadow=true;group.add(ph);
  buses.push({id:i,group,bay:{normal:bayNormal,heading},state:{normal:bayNormal.clone(),heading:heading.clone(),speed:0,steering:0,waterResistance:0,lateralSpeed:0,collisionYaw:0}});
 }

 // Stream the coach once, then drop an independent clone into every bay.
 new GLTFLoader().load('/ksrtc.glb',gltf=>{
  const template=gltf.scene;template.scale.setScalar(.17);
  template.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>/glass|glazing/i.test(m.name))){o.material=new T.MeshStandardMaterial({name:'bus glass',color:0xc5e3df,transparent:true,opacity:.08,roughness:.12,metalness:0,depthWrite:false,side:T.DoubleSide});o.castShadow=false;o.receiveShadow=false}}});
  const box=new T.Box3().setFromObject(template),center=box.getCenter(new T.Vector3());
  template.position.set(-center.x,-box.min.y,-center.z); // wheels rest on the group's y=0 plane, centred on the normal
  for(const bus of buses){
   const model=template.clone(true);
   const clonedGlass=new Set<T.Object3D>();model.traverse(o=>{if(o instanceof T.Mesh&&o.material&&(o.material as T.Material).name==='bus glass')clonedGlass.add(o)});
   batchStaticMeshes(model,m=>{if(clonedGlass.has(m))return true;let parent:T.Object3D|null=m;while(parent&&parent!==model){if(/^(Front|Rear)[ _]wheel[ _]axle/i.test(parent.name))return true;parent=parent.parent}return false});
   bus.group.remove(bus.group.children[0]);bus.group.add(model);
   bus.wheels=createWheelRoll(model);
  }
 },undefined,()=>{/* keep placeholders on load failure */});

 const place=(bus:Bus)=>{const n=bus.state.normal;if(bus.wheels){const previous=bus.group.position.clone().normalize();const distance=previous.angleTo(n)*R;const sign=Math.sign(n.clone().sub(previous).dot(bus.state.heading));bus.wheels.advance(distance*sign);bus.wheels.setSteering(bus.state.steering,0,true)}const rgt=new T.Vector3().crossVectors(bus.state.heading,n).normalize();bus.group.position.copy(n).multiplyScalar(surfaceRadius(n)+BUS_LIFT);bus.group.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(bus.state.heading,n,rgt))};
 for(const b of buses)place(b);

 return {
  buses,center:up.clone(),
  place:(id:number)=>place(buses[id]),
  stepLocal:(id:number,throttle:number,steer:number,dt:number,obs:Obstacle[])=>moveWithCollisions(buses[id].state,throttle,steer,dt,obs),
  setTransform:(id:number,normal:T.Vector3,heading:T.Vector3)=>{const s=buses[id].state;s.normal.copy(normal).normalize();s.heading.copy(heading).addScaledVector(s.normal,-heading.dot(s.normal)).normalize()},
  returnToBay:(id:number,dt:number)=>{const b=buses[id],k=1-Math.exp(-dt*3.2);b.state.normal.lerp(b.bay.normal,k).normalize();b.state.heading.copy(b.bay.heading).addScaledVector(b.state.normal,-b.bay.heading.dot(b.state.normal)).normalize();b.state.speed=0;b.state.steering=0;b.state.lateralSpeed=0;b.state.collisionYaw=0},
  boardable:(walkerNormal:T.Vector3,occupancy:Map<number,{id:string}>,myId:string):number|null=>{let best:number|null=null,bd=BOARD_RANGE;for(const b of buses){const h=occupancy.get(b.id);if(h&&h.id!==myId)continue;const d=Math.acos(T.MathUtils.clamp(walkerNormal.dot(b.state.normal),-1,1))*R;if(d<bd){bd=d;best=b.id}}return best},
  dispose:()=>{for(const b of buses)globe.remove(b.group);globe.remove(depot);depot.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});buses.forEach(b=>b.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()}))},
 };
}
