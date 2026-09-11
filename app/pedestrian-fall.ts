// Non-graphic procedural fall, ground pause and gradual recovery.
export type FallState={age:number;strength:number;active:boolean};
export function startFall(speed:number):FallState|null{return speed>.12?{age:0,strength:Math.min(1,speed/1.6),active:true}:null;}
export function stepFall(state:FallState,dt:number,busClear:boolean){
 const fallTime=.58-state.strength*.20,restUntil=fallTime+2.4+state.strength*1.6,recoverTime=1.6;
 state.age+=Math.max(0,Math.min(dt,.05));
 if(!busClear&&state.age>restUntil)state.age=restUntil;
 const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t)};
 const weight=state.age<fallTime?smooth(state.age/fallTime):1-smooth((state.age-restUntil)/recoverTime);
 state.active=state.age<restUntil+recoverTime;
 return weight;
}
