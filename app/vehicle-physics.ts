import {Vector3} from 'three';
import {roadElevation} from './road-surface';
import {stepDriving,type DriveState} from './driving';
export type Obstacle={normal:Vector3;radius?:number;axis?:Vector3;halfX?:number;halfZ?:number};
export const PLANET_RADIUS=5.6;
export function surfaceRadius(normal:Vector3){const t=Math.atan2(normal.z,normal.x),lat=Math.asin(normal.y);const center=.17+.10*Math.sin(t*3)+.05*Math.cos(t*2);const off=Math.abs(lat-center)*PLANET_RADIUS;return PLANET_RADIUS+roadElevation(off)}
export function contactRadius(normal:Vector3){const surface=surfaceRadius(normal);const wheel=.51*.17,axle=3.10*.17,track=1.115*.17;return Math.sqrt((surface+wheel)**2-axle**2-track**2)-wheel}
export function intersectsBus(state:DriveState,obstacles:Obstacle[]){const right=new Vector3().crossVectors(state.heading,state.normal).normalize();const hx=.88,hz=.225;
 for(const o of obstacles){const cos=Math.max(-1,Math.min(1,o.normal.dot(state.normal)));if(cos<.94)continue;const tangent=o.normal.clone().addScaledVector(state.normal,-cos);if(tangent.lengthSq()>1e-14)tangent.normalize().multiplyScalar(Math.acos(cos)*PLANET_RADIUS);const px=tangent.dot(state.heading),pz=tangent.dot(right);
  if(o.radius!==undefined){const dx=Math.max(Math.abs(px)-hx,0),dz=Math.max(Math.abs(pz)-hz,0);if(dx*dx+dz*dz<(o.radius+.012)**2)return true;continue}
  const axis=o.axis!;let ax=axis.dot(state.heading),az=axis.dot(right);const len=Math.hypot(ax,az);ax/=len;az/=len;const bx=-az,bz=ax,ox=o.halfX!,oz=o.halfZ!;
  if(Math.abs(px)>hx+Math.abs(ax)*ox+Math.abs(bx)*oz)continue;
  if(Math.abs(pz)>hz+Math.abs(az)*ox+Math.abs(bz)*oz)continue;
  if(Math.abs(px*ax+pz*az)>ox+hx*Math.abs(ax)+hz*Math.abs(az))continue;
  if(Math.abs(px*bx+pz*bz)>oz+hx*Math.abs(bx)+hz*Math.abs(bz))continue;
  return true;
 }return false}
export function moveWithCollisions(state:DriveState,throttle:number,steer:number,dt:number,obstacles:Obstacle[]){dt=Math.max(0,Math.min(dt,.05));const steps=Math.max(1,Math.ceil(dt/(1/120)));let hit=false;
 for(let i=0;i<steps;i++){const n=state.normal.clone(),h=state.heading.clone();stepDriving(state,throttle,steer,dt/steps);if(intersectsBus(state,obstacles)){state.normal.copy(n);state.heading.copy(h);state.speed=0;hit=true;break}}
 return hit;
}
