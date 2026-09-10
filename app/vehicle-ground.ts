import {WORLD_RADIUS,terrainElevation,SEA_LEVEL} from './world';
import {samplePond} from './pond-physics';
import * as T from 'three';
import {surfaceRadius} from './vehicle-physics';
import type {WheelSupport} from './suspension';
export function createVehicleGround(globe:T.Group,rocks:T.Group[]){
 const ray=new T.Raycaster(),up=new T.Vector3(),normal=new T.Vector3(),point=new T.Vector3(),worldUp=new T.Vector3(),q=new T.Quaternion();
 return {water(bus:T.Object3D,wheels:WheelSupport[],flat:boolean){const up=bus.position.clone().normalize();return wheels.map(w=>{const n=new T.Vector3(w.x,0,w.z).applyQuaternion(bus.quaternion).add(bus.position).normalize(),pond=samplePond(n)??(terrainElevation(Math.atan2(n.z,n.x),Math.asin(n.y))<SEA_LEVEL?{wet:true,waterRadius:WORLD_RADIUS+SEA_LEVEL}:null);return pond?.wet?(flat?pond.waterRadius:pond.waterRadius*n.dot(up))-bus.position.length():-Infinity})},sample(bus:T.Object3D,wheels:WheelSupport[],flat:boolean){
  up.copy(bus.position).normalize();globe.updateWorldMatrix(true,false);globe.getWorldQuaternion(q);
  return wheels.map(w=>{
   normal.set(w.x,0,w.z).applyQuaternion(bus.quaternion).add(bus.position).normalize();let radial=surfaceRadius(normal);
   // Only nearby stones are ray-tested; terrain uses the shared road profile.
   const nearby=rocks.filter(r=>r.position.clone().normalize().dot(normal)>.9992);
   if(nearby.length){nearby.forEach(r=>r.updateWorldMatrix(true,true));point.copy(normal).multiplyScalar(WORLD_RADIUS+1.1);globe.localToWorld(point);worldUp.copy(normal).applyQuaternion(q);ray.set(point,worldUp.negate());ray.far=1.4;const hits=ray.intersectObjects(nearby,true);if(hits.length)radial=Math.max(radial,globe.worldToLocal(hits[0].point.clone()).length());}
   return flat?radial-bus.position.length():radial*normal.dot(up)-bus.position.length();
  });
 }};
}
