import {WORLD_RADIUS} from './world';
import {Vector3,Quaternion,MathUtils} from 'three';
export const POND_NORMAL=new Vector3(Math.cos(2.3)*Math.cos(.95),Math.sin(.95),Math.sin(2.3)*Math.cos(.95));
export const POND_ROTATION=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),POND_NORMAL);
export const POND_INVERSE=POND_ROTATION.clone().invert();
export const POND_ANCHOR=POND_NORMAL.clone().multiplyScalar(WORLD_RADIUS);
export const pondEdge=(a:number)=>1+.06*Math.sin(a*3)+.035*Math.cos(a*5);
export function samplePond(normal:Vector3){
 if(normal.dot(POND_NORMAL)<.97)return null;
 const local=normal.clone().multiplyScalar(WORLD_RADIUS).sub(POND_ANCHOR).applyQuaternion(POND_INVERSE);
 const a=Math.atan2(local.z/.45,local.x/.72),r=Math.hypot(local.x/.72,local.z/.45)/pondEdge(a);
 if(r>=1.32)return null;
 const blend=1-MathUtils.smoothstep(r,.88,1.32);let floorY=MathUtils.lerp(local.y,Math.min(local.y,-.12),blend);
 if(r>=.99){const bank=r<1.12?MathUtils.lerp(-.017,.002,(r-.99)/.13):MathUtils.lerp(.002,local.y-.003,(r-1.12)/.26);floorY=Math.max(floorY,bank);}
 const floorRadius=(WORLD_RADIUS+floorY)/normal.dot(POND_NORMAL),waterRadius=(WORLD_RADIUS-.025)/normal.dot(POND_NORMAL);
 return {floorRadius,waterRadius,wet:r<1&&waterRadius>floorRadius,local,r};
}
