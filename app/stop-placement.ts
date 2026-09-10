import {WORLD_RADIUS} from './world';
import * as T from 'three';
import type {Obstacle} from './vehicle-physics';

export function findBusStopSite(obstacles:Obstacle[],latitude:(t:number)=>number){
 // Include the roof overhang and a walking gap in the clearance check.
 const shelterRadius=Math.hypot(.58,.34)+.12;
 for(const offset of [.19,.22,.25])for(let step=0;step<720;step++)for(const side of [1,-1]){
  const t=.95+(step%2?-1:1)*Math.ceil(step/2)*Math.PI*2/720,lat=latitude(t)+side*offset*5.6/WORLD_RADIUS;
  const normal=new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat));
  if(obstacles.every(o=>Math.acos(T.MathUtils.clamp(normal.dot(o.normal),-1,1))*WORLD_RADIUS>shelterRadius+(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))))return {t,lat};
 }
 throw new Error('No unobstructed roadside site for the bus stop');
}
