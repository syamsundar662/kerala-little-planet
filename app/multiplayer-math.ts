import * as T from 'three';

// Pure helpers shared by app/multiplayer.ts and scripts/verify-multiplayer.mjs — keep free of Supabase/DOM imports.
export function outfitForName(name:string){let h=0x811c9dc5;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h%3}
// Tangent frame derived only from the surface normal so sender and receiver rebuild the identical basis.
export function tangentFrame(normal:T.Vector3){const ref=Math.abs(normal.y)>.99?new T.Vector3(1,0,0):new T.Vector3(0,1,0);const east=new T.Vector3().crossVectors(ref,normal).normalize();const north=new T.Vector3().crossVectors(normal,east).normalize();return {east,north}}
export function encodeHeading(normal:T.Vector3,heading:T.Vector3){const {east,north}=tangentFrame(normal);return Math.atan2(heading.dot(north),heading.dot(east))}
export function decodeHeading(normal:T.Vector3,angle:number){const {east,north}=tangentFrame(normal);return east.multiplyScalar(Math.cos(angle)).addScaledVector(north,Math.sin(angle))}
export function wrapAngle(a:number){return ((a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI}
export function round4(v:number){return Math.round(v*1e4)/1e4}
export type PosPayload={i:string;x:number;y:number;z:number;h:number;m:0|1};
export function encodePos(shortId:string,normal:T.Vector3,heading:T.Vector3,moving:boolean):PosPayload{return {i:shortId,x:round4(normal.x),y:round4(normal.y),z:round4(normal.z),h:round4(encodeHeading(normal,heading)),m:moving?1:0}}
