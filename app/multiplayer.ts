import * as T from 'three';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {getSupabase} from './realtime';
import {decodeHeading,encodePos,wrapAngle,type PosPayload} from './multiplayer-math';

const CHANNEL='little-kerala:planet:v1';
type PresenceMeta={name:string;gender:number;outfit:number};
export type RemoteState={name:string;gender:number;outfit:number;hasPacket:boolean;fromNormal:T.Vector3;toNormal:T.Vector3;fromAngle:number;toAngle:number;receivedAt:number;interval:number;lastPacket:number;moving:boolean};

export function createMultiplayer(opts:{playerId:string;name:string;gender:number;outfit:number;onJoin:(id:string,meta:PresenceMeta)=>void;onLeave:(id:string)=>void;onRoster:(names:string[])=>void;onVoice?:(fromId:string,msg:unknown)=>void}){
 const shortId=opts.playerId.slice(0,8),remotes=new Map<string,RemoteState>(),byShort=new Map<string,string>();
 let channel:RealtimeChannel|undefined,subscribed=false,disposed=false,retryDelay=1000,retryTimer:ReturnType<typeof setTimeout>|undefined;
 const lastState={normal:new T.Vector3(0,1,0),heading:new T.Vector3(1,0,0),moving:false};let hasState=false,lastSentAt=-1e9,sentMoving=false;const sentNormal=new T.Vector3();
 const push=(force=false)=>{
  if(!subscribed||!hasState||!channel)return;
  const now=performance.now(),active=lastState.moving||sentMoving||lastState.normal.distanceToSquared(sentNormal)>1e-8;
  const interval=active?(remotes.size>12?200:100):1000; // adaptive rate: halve fan-out in a crowd, 1Hz heartbeat when idle so late joiners still see us
  if(!force&&now-lastSentAt<interval)return;
  lastSentAt=now;sentNormal.copy(lastState.normal);sentMoving=lastState.moving;
  channel.send({type:'broadcast',event:'pos',payload:encodePos(shortId,lastState.normal,lastState.heading,lastState.moving)}).catch(()=>{});
 };
 const syncRoster=()=>{
  if(!channel)return;
  const present=channel.presenceState<PresenceMeta>(),seen=new Set(Object.keys(present));
  for(const key of seen){if(key===opts.playerId||remotes.has(key))continue;const meta=present[key][0]??{name:'Visitor',gender:0,outfit:0};remotes.set(key,{name:String(meta.name??'Visitor').slice(0,20),gender:Number(meta.gender)===1?1:0,outfit:Number(meta.outfit)%3||0,hasPacket:false,fromNormal:new T.Vector3(0,1,0),toNormal:new T.Vector3(0,1,0),fromAngle:0,toAngle:0,receivedAt:0,interval:100,lastPacket:0,moving:false});byShort.set(key.slice(0,8),key);const r=remotes.get(key)!;opts.onJoin(key,{name:r.name,gender:r.gender,outfit:r.outfit})}
  for(const key of remotes.keys())if(!seen.has(key)){remotes.delete(key);byShort.delete(key.slice(0,8));opts.onLeave(key)}
  opts.onRoster([opts.name,...[...remotes.values()].map(r=>r.name)]);
 };
 const receive=(payload:PosPayload)=>{
  if(!payload||payload.i===shortId)return;
  const id=byShort.get(payload.i);const r=id&&remotes.get(id);if(!r)return; // avatars exist only after presence sync; a racing pos packet is simply dropped
  const now=performance.now(),angle=Number(payload.h)||0;
  if(!r.hasPacket){r.fromNormal.set(payload.x,payload.y,payload.z).normalize();r.toNormal.copy(r.fromNormal);r.fromAngle=r.toAngle=angle;r.hasPacket=true}
  else{const alpha=Math.min((now-r.receivedAt)/r.interval,1.2);r.fromNormal.lerp(r.toNormal,alpha).normalize();r.fromAngle+=wrapAngle(r.toAngle-r.fromAngle)*alpha;r.toNormal.set(payload.x,payload.y,payload.z).normalize();r.toAngle=angle;r.interval=T.MathUtils.clamp(now-r.lastPacket,60,400)}
  r.receivedAt=now;r.lastPacket=now;r.moving=payload.m===1;
 };
 const retry=(stale?:RealtimeChannel)=>{clearTimeout(retryTimer);retryTimer=setTimeout(async()=>{if(disposed)return;if(stale)await getSupabase().removeChannel(stale).catch(()=>{});if(!disposed)build()},retryDelay);retryDelay=Math.min(retryDelay*2,15000)};
 const build=()=>{
  if(disposed)return;
  try{
   channel=getSupabase().channel(CHANNEL,{config:{broadcast:{self:false,ack:false},presence:{key:opts.playerId}}});
   channel.on('presence',{event:'sync'},syncRoster).on('broadcast',{event:'pos'},({payload})=>receive(payload as PosPayload)).on('broadcast',{event:'v'},({payload})=>{const p=payload as {to?:string;from?:string;m?:unknown};if(!p||p.to!==shortId)return;const full=p.from&&byShort.get(p.from);if(full&&opts.onVoice)opts.onVoice(full,p.m)}).subscribe(status=>{
    if(disposed)return;
    if(status==='SUBSCRIBED'){subscribed=true;retryDelay=1000;channel!.track({name:opts.name,gender:opts.gender,outfit:opts.outfit}).catch(()=>{});push(true)}
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){subscribed=false;retry(channel)}
   });
  }catch{retry(channel)} // a half-removed stale channel can make .on() throw; back off and rebuild cleanly
 };
 const onVisibility=()=>{if(document.hidden){lastState.moving=false;push(true)}else push(true)};
 return {
  remotes,
  connect(){build();document.addEventListener('visibilitychange',onVisibility)},
  send(normal:T.Vector3,heading:T.Vector3,moving:boolean){lastState.normal.copy(normal);lastState.heading.copy(heading);lastState.moving=moving;hasState=true;push()},
  signalVoice(toFullId:string,msg:unknown){if(!subscribed||!channel)return;channel.send({type:'broadcast',event:'v',payload:{to:toFullId.slice(0,8),from:shortId,m:msg}}).catch(()=>{})},
  sample(r:RemoteState,now:number){
   if(!r.hasPacket)return null;
   const alpha=Math.min((now-r.receivedAt)/r.interval,1.2); // brief extrapolation past the last packet, then hold
   const normal=r.fromNormal.clone().lerp(r.toNormal,alpha).normalize(),angle=r.fromAngle+wrapAngle(r.toAngle-r.fromAngle)*alpha;
   return {normal,heading:decodeHeading(normal,angle),moving:r.moving&&now-r.lastPacket<6000};
  },
  dispose(){disposed=true;subscribed=false;clearTimeout(retryTimer);document.removeEventListener('visibilitychange',onVisibility);if(channel){channel.untrack().catch(()=>{});getSupabase().removeChannel(channel).catch(()=>{})}remotes.clear();byShort.clear()},
 };
}
