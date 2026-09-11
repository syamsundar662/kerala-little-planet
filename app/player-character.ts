import * as T from 'three';
import {WORLD_RADIUS,isDryLand,roadLatitude} from './world';
import type {Obstacle} from './vehicle-physics';

export type WalkState={normal:T.Vector3;heading:T.Vector3;speed:number};
export type WalkInput={forward:boolean;reverse:boolean;left:boolean;right:boolean};

const clearAt=(n:T.Vector3,obstacles:Obstacle[],margin=.05)=>obstacles.every(o=>o.disabled||Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*WORLD_RADIUS>(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+margin);
const onLand=(n:T.Vector3)=>isDryLand(Math.atan2(n.z,n.x),Math.asin(T.MathUtils.clamp(n.y,-1,1)),.05);

export function createWalker(spawn:{normal:T.Vector3;heading:T.Vector3},obstacles:Obstacle[]){
 const state:WalkState={normal:spawn.normal.clone().normalize(),heading:spawn.heading.clone().normalize(),speed:0};
 const stepped=(direction:T.Vector3,distance:number)=>{const axis=new T.Vector3().crossVectors(state.normal,direction.clone().multiplyScalar(Math.sign(distance))).normalize();return state.normal.clone().applyQuaternion(new T.Quaternion().setFromAxisAngle(axis,Math.abs(distance)/WORLD_RADIUS)).normalize()};
 const update=(dt:number,input:WalkInput)=>{
  const steer=(input.left?1:0)-(input.right?1:0);
  if(steer)state.heading.applyAxisAngle(state.normal,2.4*dt*steer);
  state.heading.addScaledVector(state.normal,-state.heading.dot(state.normal)).normalize();
  const throttle=(input.forward?1:0)-(input.reverse?1:0);
  state.speed=T.MathUtils.damp(state.speed,throttle>0?.45:throttle<0?-.28:0,10,dt);
  const distance=state.speed*dt;
  if(Math.abs(distance)<1e-6)return false;
  // Try straight ahead, then slide along a wall by yawing the travel direction (facing stays put).
  for(const yaw of [0,.6,-.6]){
   const direction=yaw?state.heading.clone().applyAxisAngle(state.normal,yaw):state.heading.clone();
   const candidate=stepped(direction,distance);
   if(!onLand(candidate)||!clearAt(candidate,obstacles))continue;
   const axis=new T.Vector3().crossVectors(state.normal,direction.multiplyScalar(Math.sign(distance))).normalize();
   const q=new T.Quaternion().setFromAxisAngle(axis,Math.abs(distance)/WORLD_RADIUS);
   state.normal.applyQuaternion(q).normalize();state.heading.applyQuaternion(q).projectOnPlane(state.normal).normalize();
   return true;
  }
  state.speed=0;return false;
 };
 return {state,update};
}

// Roadside spawn near the main junction (t≈.7, where the bus starts) with a per-player spread so joiners don't stack.
export function findSpawn(seed:string,obstacles:Obstacle[]){
 let h=0;for(let i=0;i<seed.length;i++)h=(Math.imul(h,31)+seed.charCodeAt(i))>>>0;
 const side=h&1?1:-1;let t=.7+((h>>>1)%97/97-.5)*.12;
 const point=(at:number)=>{const lat=roadLatitude(at)+side*(.76/WORLD_RADIUS);return new T.Vector3(Math.cos(at)*Math.cos(lat),Math.sin(lat),Math.sin(at)*Math.cos(lat))};
 for(let j=0;j<220;j++){const n=point(t);if(onLand(n)&&clearAt(n,obstacles,.12)){return {normal:n,heading:point(t+.001).sub(n).projectOnPlane(n).normalize()}}t+=.017}
 const n=point(.7);return {normal:n.clone().normalize(),heading:point(.701).sub(n).projectOnPlane(n).normalize()};
}
