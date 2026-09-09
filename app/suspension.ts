// Scene units are 0.17 metres per metre of the source vehicle.
export const VEHICLE_GRAVITY=9.81*.17;
export type WheelSupport={x:number;z:number;y:number;radius:number};
export function createSuspension(wheels:WheelSupport[]){
 const travel=.042,k=36,damping=3.3;
 let height=0,pitch=0,roll=0,velocity=0,pitchVelocity=0,rollVelocity=0,initialized=false;
 const wheelY=wheels.map(w=>w.y),grounded=wheels.map(()=>true);
 function reset(ground:number[]){const desired=ground.map((g,i)=>g+wheels[i].radius-wheels[i].y);height=desired.reduce((a,b)=>a+b,0)/wheels.length;pitch=roll=velocity=pitchVelocity=rollVelocity=0;initialized=true;}
 return {reset,step(ground:number[],dt:number){
  if(!initialized)reset(ground);dt=Math.max(0,Math.min(dt,.05));const steps=Math.max(1,Math.ceil(dt*180)),h=dt/steps;
  for(let s=0;s<steps;s++){
   let force=0,torquePitch=0,torqueRoll=0;
   wheels.forEach((w,i)=>{const target=ground[i]+w.radius-w.y,corner=height+pitch*w.x+roll*w.z,compression=target-corner;
    grounded[i]=compression>=-travel;
    if(grounded[i]){const speed=velocity+pitchVelocity*w.x+rollVelocity*w.z;const bumpStop=Math.max(0,compression-.033)*220;const f=Math.max(0,VEHICLE_GRAVITY/wheels.length+k*compression-damping*speed+bumpStop);force+=f;torquePitch+=f*w.x;torqueRoll+=f*w.z;}
   });
   velocity+=(force-VEHICLE_GRAVITY)*h;pitchVelocity+=(torquePitch/.26-pitchVelocity*.7)*h;rollVelocity+=(torqueRoll/.045-rollVelocity*.9)*h;
   height+=velocity*h;pitch+=pitchVelocity*h;roll+=rollVelocity*h;
  }
  wheels.forEach((w,i)=>{const free=height+pitch*w.x+roll*w.z+w.y-travel;wheelY[i]=Math.max(ground[i]+w.radius,free);grounded[i]=free<=ground[i]+w.radius+.0005;});
  return {height,pitch,roll,wheelY,grounded,velocity};
 }};
}
