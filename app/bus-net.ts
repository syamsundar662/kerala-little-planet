import * as T from 'three';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {getSupabase} from './realtime';
import {decodeHeading,encodeHeading,wrapAngle,round4} from './multiplayer-math';

// Real-time state for the shared KSRTC fleet. Unlike walker presence (district-sharded), the handful of buses are
// GLOBAL world objects everyone must see, so they ride ONE small channel. Occupancy comes from presence (auto-clears
// if a driver disconnects); positions come from broadcast. Two claimants on one bus tie-break by lowest player id.
const BUS_CHANNEL='little-kerala:buses:v1';
type ClaimMeta={bus:number;name:string};
export type Occupant={id:string;name:string};
type RemoteBus={hasPacket:boolean;from:T.Vector3;to:T.Vector3;fromAngle:number;toAngle:number;receivedAt:number;interval:number;lastPacket:number;moving:boolean};
type BusPayload={b:number;i:string;x:number;y:number;z:number;h:number;m:0|1};

export function createBusNet(opts:{playerId:string;onOccupancy:(occ:Map<number,Occupant>)=>void;onYield:(busId:number)=>void}){
 const shortId=opts.playerId.slice(0,8);
 let chan:RealtimeChannel|undefined,subscribed=false,disposed=false,myBus=-1,myName='';
 let lastSentAt=-1e9;const remotes=new Map<number,RemoteBus>();

 const occupancy=():Map<number,Occupant>=>{
  const occ=new Map<number,Occupant>();if(!chan)return occ;
  const state=chan.presenceState<ClaimMeta>();
  for(const key of Object.keys(state)){const m=state[key][0];if(!m||typeof m.bus!=='number'||m.bus<0)continue;const cur=occ.get(m.bus);if(!cur||key<cur.id)occ.set(m.bus,{id:key,name:String(m.name??'Driver').slice(0,20)})}
  return occ;
 };
 const emitOccupancy=()=>{const occ=occupancy();opts.onOccupancy(occ);if(myBus>=0){const holder=occ.get(myBus);if(holder&&holder.id!==opts.playerId)opts.onYield(myBus)}};

 const receive=(p:BusPayload)=>{
  if(!p||p.i===shortId||typeof p.b!=='number')return;
  const now=performance.now(),angle=Number(p.h)||0;let r=remotes.get(p.b);
  if(!r){r={hasPacket:false,from:new T.Vector3(0,1,0),to:new T.Vector3(0,1,0),fromAngle:0,toAngle:0,receivedAt:0,interval:120,lastPacket:0,moving:false};remotes.set(p.b,r)}
  if(!r.hasPacket){r.from.set(p.x,p.y,p.z).normalize();r.to.copy(r.from);r.fromAngle=r.toAngle=angle;r.hasPacket=true}
  else{const alpha=Math.min((now-r.receivedAt)/r.interval,1.2);r.from.lerp(r.to,alpha).normalize();r.fromAngle+=wrapAngle(r.toAngle-r.fromAngle)*alpha;r.to.set(p.x,p.y,p.z).normalize();r.toAngle=angle;r.interval=T.MathUtils.clamp(now-r.lastPacket,60,400)}
  r.receivedAt=now;r.lastPacket=now;r.moving=p.m===1;
 };
 const track=()=>{if(chan&&subscribed)chan.track({bus:myBus,name:myName}).catch(()=>{})};

 return {
  connect(){
   if(disposed)return;
   chan=getSupabase().channel(BUS_CHANNEL,{config:{broadcast:{self:false,ack:false},presence:{key:opts.playerId}}});
   chan.on('presence',{event:'sync'},emitOccupancy).on('broadcast',{event:'bpos'},({payload})=>receive(payload as BusPayload)).subscribe(status=>{
    if(disposed)return;
    if(status==='SUBSCRIBED'){subscribed=true;track();emitOccupancy()}
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')subscribed=false;
   });
  },
  claim(busId:number,name:string){myBus=busId;myName=name||'Driver';track()},
  release(){myBus=-1;track()},
  sendBus(busId:number,normal:T.Vector3,heading:T.Vector3,moving:boolean){
   if(!chan||!subscribed)return;const now=performance.now(),interval=moving?100:450;if(now-lastSentAt<interval)return;lastSentAt=now;
   const payload:BusPayload={b:busId,i:shortId,x:round4(normal.x),y:round4(normal.y),z:round4(normal.z),h:round4(encodeHeading(normal,heading)),m:moving?1:0};
   chan.send({type:'broadcast',event:'bpos',payload}).catch(()=>{});
  },
  sample(busId:number,now:number){
   const r=remotes.get(busId);if(!r||!r.hasPacket)return null;
   const alpha=Math.min((now-r.receivedAt)/r.interval,1.2);
   const normal=r.from.clone().lerp(r.to,alpha).normalize(),angle=r.fromAngle+wrapAngle(r.toAngle-r.fromAngle)*alpha;
   return {normal,heading:decodeHeading(normal,angle),moving:r.moving&&now-r.lastPacket<4000};
  },
  dispose(){disposed=true;if(chan){chan.untrack().catch(()=>{});getSupabase().removeChannel(chan).catch(()=>{})}remotes.clear()},
 };
}
