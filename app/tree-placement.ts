import {WORLD_RADIUS,isDryLand,roadOffset} from './world';
import * as T from 'three';
import type {Obstacle} from './vehicle-physics';
export function clearTreesFromHomes(globe:T.Group,homes:Obstacle[],obstacles:Obstacle[],latitude:(t:number)=>number){
 let seed=1709;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const clusters=Array.from({length:9},()=>{const t=random()*Math.PI*2;return {t,lat:latitude(t)+(random()<.5?-1:1)*(.40+random()*.50)}});
 const planted:T.Vector3[]=[];
 const clear=(n:T.Vector3,margin:number)=>homes.every(h=>Math.acos(T.MathUtils.clamp(n.dot(h.normal),-1,1))*WORLD_RADIUS>Math.hypot(h.halfX??0,h.halfZ??0)+margin);
 for(const tree of [...globe.children]){
  if(!['palm-placeholder','tree-placeholder'].includes(tree.name))continue;
  const original=tree.position.clone().normalize(),margin=tree.name==='palm-placeholder'?.80:.60;
  const originalT=Math.atan2(original.z,original.x),originalLat=Math.asin(original.y);const mountainNormal=new T.Vector3(Math.cos(1.35)*Math.cos(1.12),Math.sin(1.12),Math.sin(1.35)*Math.cos(1.12));
  if(tree.name!=='palm-placeholder'&&clear(original,margin)&&isDryLand(originalT,originalLat)&&roadOffset(originalT,originalLat)>1&&original.angleTo(mountainNormal)*WORLD_RADIUS>2.8)continue;
  const collider=obstacles.find(o=>o.radius!==undefined&&o.normal.distanceTo(original)<1e-6);
  let found=false;
  for(let i=0;i<300;i++){
   const cluster=clusters[Math.floor(random()*clusters.length)],clustered=random()<.65;
   const t=clustered?cluster.t+(random()-.5)*.55:random()*Math.PI*2;
   const lat=T.MathUtils.clamp(clustered?cluster.lat+(random()-.5)*.36:(random()-.5)*2.2,-1.30,1.30);
   const n=new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat));
   if(!isDryLand(t,lat)||roadOffset(t,lat)<1.0||!clear(n,margin)||planted.some(p=>Math.acos(T.MathUtils.clamp(p.dot(n),-1,1))*WORLD_RADIUS<.38))continue;
   // Leave the pond and connected mountain footprint free of palm trunks.
   const pond=new T.Vector3(Math.cos(2.3)*Math.cos(.95),Math.sin(.95),Math.sin(2.3)*Math.cos(.95));
   const mountain=new T.Vector3(Math.cos(1.35)*Math.cos(1.12),Math.sin(1.12),Math.sin(1.35)*Math.cos(1.12));
   if(Math.acos(T.MathUtils.clamp(n.dot(pond),-1,1))*WORLD_RADIUS<1.05||Math.acos(T.MathUtils.clamp(n.dot(mountain),-1,1))*WORLD_RADIUS<2.8)continue;
   planted.push(n.clone());
   tree.position.copy(n).multiplyScalar(WORLD_RADIUS);tree.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);collider?.normal.copy(n);found=true;break;
  }
  if(!found){globe.remove(tree);if(collider)obstacles.splice(obstacles.indexOf(collider),1)}
 }
}
