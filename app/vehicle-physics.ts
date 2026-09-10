import {WORLD_RADIUS,roadOffset,terrainElevation} from './world';
import {samplePond} from './pond-physics';
import {Vector3,Quaternion,MathUtils} from 'three';
import {roadElevation} from './road-surface';
import {stepDriving,type DriveState} from './driving';
export type Obstacle={normal:Vector3;radius?:number;axis?:Vector3;halfX?:number;halfZ?:number};
export const PLANET_RADIUS=WORLD_RADIUS;
export function surfaceRadius(normal:Vector3){const t=Math.atan2(normal.z,normal.x),lat=Math.asin(normal.y);const off=roadOffset(t,lat);return samplePond(normal)?.floorRadius??(PLANET_RADIUS+terrainElevation(t,lat)+roadElevation(off))}
export function contactRadius(normal:Vector3){const surface=surfaceRadius(normal);const wheel=.51*.17,axle=3.10*.17,track=1.115*.17;return Math.sqrt((surface+wheel)**2-axle**2-track**2)-wheel}
type Contact={normal:Vector3;depth:number;x:number;z:number};
function contact(state:DriveState,o:Obstacle):Contact|null{
 const hx=.88,hz=.225;
 const extent=o.radius??Math.hypot(o.halfX??0,o.halfZ??0),cos=MathUtils.clamp(state.normal.dot(o.normal),-1,1);
 if(cos<Math.cos((extent+1.1)/PLANET_RADIUS))return null;
 const right=new Vector3().crossVectors(state.heading,state.normal).normalize();
 const tangent=o.normal.clone().addScaledVector(state.normal,-cos);if(tangent.lengthSq()>1e-14)tangent.normalize().multiplyScalar(Math.acos(cos)*PLANET_RADIUS);
 const px=tangent.dot(state.heading),pz=tangent.dot(right);let nx=0,nz=0,depth=Infinity;
 if(o.radius!==undefined){const radius=o.radius+.008,cx=MathUtils.clamp(px,-hx,hx),cz=MathUtils.clamp(pz,-hz,hz),dx=px-cx,dz=pz-cz,d=Math.hypot(dx,dz);
  if(d>=radius)return null;
  if(d>1e-8){nx=-dx/d;nz=-dz/d;depth=radius-d;}
  else if(hx-Math.abs(px)<hz-Math.abs(pz)){nx=px>=0?-1:1;depth=hx-Math.abs(px)+radius;}
  else{nz=pz>=0?-1:1;depth=hz-Math.abs(pz)+radius;}
 }else{
  const axis=o.axis!.clone().projectOnPlane(state.normal).normalize(),ax=axis.dot(state.heading),az=axis.dot(right),bx=-az,bz=ax;
  for(const [x,z] of [[1,0],[0,1],[ax,az],[bx,bz]]){const distance=px*x+pz*z,overlap=hx*Math.abs(x)+hz*Math.abs(z)+(o.halfX??0)*Math.abs(ax*x+az*z)+(o.halfZ??0)*Math.abs(bx*x+bz*z)-Math.abs(distance);
   if(overlap<=0)return null;if(overlap<depth){depth=overlap;const sign=distance>=0?-1:1;nx=x*sign;nz=z*sign;}
  }
 }
 return {normal:state.heading.clone().multiplyScalar(nx).addScaledVector(right,nz).normalize(),depth,x:MathUtils.clamp(px,-hx,hx),z:MathUtils.clamp(pz,-hz,hz)};
}
export function intersectsBus(state:DriveState,obstacles:Obstacle[]){return obstacles.some(o=>contact(state,o)!==null)}
function translate(state:DriveState,displacement:Vector3){const distance=displacement.length();if(distance<1e-10)return;const axis=new Vector3().crossVectors(state.normal,displacement).normalize(),q=new Quaternion().setFromAxisAngle(axis,distance/PLANET_RADIUS);state.normal.applyQuaternion(q).normalize();state.heading.applyQuaternion(q).projectOnPlane(state.normal).normalize();}
export function moveWithCollisions(state:DriveState,throttle:number,steer:number,dt:number,obstacles:Obstacle[]){
 dt=Math.max(0,Math.min(dt,.05));const steps=Math.max(1,Math.ceil(dt*180)),h=dt/steps;let hit=false;state.collisionImpact=undefined;
 for(let i=0;i<steps;i++){
  stepDriving(state,throttle,steer,h);
  state.lateralSpeed=(state.lateralSpeed??0)*Math.exp(-h*4);state.collisionYaw=(state.collisionYaw??0)*Math.exp(-h*6);
  state.heading.applyAxisAngle(state.normal,state.collisionYaw*h).normalize();
  translate(state,new Vector3().crossVectors(state.heading,state.normal).multiplyScalar(state.lateralSpeed*h));
  // Resolve overlapping contacts in several passes, including tight corners.
  for(let pass=0;pass<6;pass++){let touched=false;
   for(const o of obstacles){const c=contact(state,o);if(!c)continue;hit=touched=true;
    const right=new Vector3().crossVectors(state.heading,state.normal).normalize(),velocity=state.heading.clone().multiplyScalar(state.speed).addScaledVector(right,state.lateralSpeed??0),closing=-velocity.dot(c.normal);
    if(closing>0){const restitution=closing>.3?.08:0,impulse=(1+restitution)*closing;
     const change=c.normal.clone().multiplyScalar(impulse);velocity.add(change);
     const tangent=velocity.clone().addScaledVector(c.normal,-velocity.dot(c.normal)),slip=tangent.length();if(slip>1e-8)velocity.addScaledVector(tangent,-Math.min(.16*impulse,slip)/slip);
     const forward=change.dot(state.heading),lateral=change.dot(right);state.speed=velocity.dot(state.heading);state.lateralSpeed=velocity.dot(right);
     state.collisionYaw=MathUtils.clamp((state.collisionYaw??0)+(c.z*forward-c.x*lateral)*.25,-.45,.45);
     if(!state.collisionImpact||closing>state.collisionImpact.speed)state.collisionImpact={speed:closing,forward,lateral};
    }
    translate(state,c.normal.multiplyScalar(c.depth+.00015));
   }if(!touched)break;
  }
 }
 return hit;
}
