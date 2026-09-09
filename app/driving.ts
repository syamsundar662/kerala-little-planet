import { Vector3, Quaternion, MathUtils } from 'three';
export type DriveState={normal:Vector3;heading:Vector3;speed:number;steering:number};
const WHEELBASE=(3.10+2.85)*.17;
export function stepDriving(state:DriveState,throttle:number,steer:number,dt:number){
 if(!Number.isFinite(dt)||!Number.isFinite(throttle)||!Number.isFinite(steer))return state;
 dt=Math.max(0,Math.min(.05,dt));throttle=MathUtils.clamp(throttle,-1,1);steer=MathUtils.clamp(steer,-1,1);
 const target=throttle>=0?throttle*2.1:throttle*1.05,rate=throttle?2.2:4.8;
 const speedBefore=state.speed,decay=Math.exp(-dt*rate);
 state.speed=target+(speedBefore-target)*decay;
 const distance=target*dt+(speedBefore-target)*(1-decay)/rate;
 // Gentle keyboard taps make small corrections; holding a key builds lock.
 // Reduce steering lock at cruising speed and centre quickly on release.
 const limit=MathUtils.lerp(.46,.30,MathUtils.smoothstep(Math.abs(state.speed),.3,2.1));
 const previous=state.steering??0;
 state.steering=MathUtils.damp(previous,steer*limit,steer===0?20:8,dt);
 if(Math.abs(state.steering)<.0001&&steer===0)state.steering=0;
 const turn=distance*Math.tan((previous+state.steering)*.5)/WHEELBASE;
 // Signed travel gives the correct reverse turn, with no stationary pivoting.
 state.heading.applyAxisAngle(state.normal,turn*.5).normalize();
 const axis=new Vector3().crossVectors(state.normal,state.heading).normalize();
 const q=new Quaternion().setFromAxisAngle(axis,distance/5.65);
 state.normal.applyQuaternion(q).normalize();
 state.heading.applyQuaternion(q).applyAxisAngle(state.normal,turn*.5).addScaledVector(state.normal,-state.heading.dot(state.normal)).normalize();
 return state;
}
