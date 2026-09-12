import * as T from 'three';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {getSupabase} from './realtime';
import {decodeHeading,encodePos,wrapAngle,type PosPayload} from './multiplayer-math';
import {regionAt,regionChannels} from './districts';

// Presence is SHARDED by district: a client publishes its position only to its current region's channel and
// subscribes to that region + the two longitude-adjacent ones. So each client's network + CPU cost scales with
// LOCAL density, not the whole planet (O(n) not O(n²)). Voice signalling rides one small global channel.
const REGION_PREFIX='little-kerala:region:';
const VOICE_CHANNEL='little-kerala:voice:v1';
type PresenceMeta={name:string;gender:number;outfit:number};
export type RemoteState={name:string;gender:number;outfit:number;hasPacket:boolean;fromNormal:T.Vector3;toNormal:T.Vector3;fromAngle:number;toAngle:number;receivedAt:number;interval:number;lastPacket:number;moving:boolean};

export function createMultiplayer(opts:{playerId:string;name:string;gender:number;outfit:number;onJoin:(id:string,meta:PresenceMeta)=>void;onLeave:(id:string)=>void;onRoster:(names:string[])=>void;onVoice?:(fromId:string,msg:unknown)=>void}){
 const shortId=opts.playerId.slice(0,8),remotes=new Map<string,RemoteState>(),byShort=new Map<string,string>(),remoteRegion=new Map<string,string>();
 const regionChans=new Map<string,{chan:RealtimeChannel;subscribed:boolean}>();
 let myRegion:string|undefined,voiceChan:RealtimeChannel|undefined,disposed=false,retryTimer:ReturnType<typeof setTimeout>|undefined,retryDelay=1000;
 const lastState={normal:new T.Vector3(0,1,0),heading:new T.Vector3(1,0,0),moving:false};let hasState=false,lastSentAt=-1e9,sentMoving=false;const sentNormal=new T.Vector3();

 const newRemote=(meta:PresenceMeta):RemoteState=>({name:String(meta.name??'Visitor').slice(0,20),gender:Number(meta.gender)===1?1:0,outfit:Number(meta.outfit)%3||0,hasPacket:false,fromNormal:new T.Vector3(0,1,0),toNormal:new T.Vector3(0,1,0),fromAngle:0,toAngle:0,receivedAt:0,interval:100,lastPacket:0,moving:false});
 const rosterEmit=()=>opts.onRoster([opts.name,...[...remotes.values()].map(r=>r.name)]);

 // Rebuild the remote set from the union of presence across every subscribed channel — robust to a peer hopping
 // regions (it leaves one channel's presence and joins another's, but stays in the union → no destroy/recreate flicker).
 const resyncAll=()=>{
  const present=new Map<string,{meta:PresenceMeta;region:string}>();
  for(const [region,entry] of regionChans){if(!entry.subscribed)continue;const state=entry.chan.presenceState<PresenceMeta>();for(const key of Object.keys(state)){if(key===opts.playerId)continue;present.set(key,{meta:state[key][0]??{name:'Visitor',gender:0,outfit:0},region})}}
  for(const [key,info] of present){if(!remotes.has(key)){const r=newRemote(info.meta);remotes.set(key,r);byShort.set(key.slice(0,8),key);opts.onJoin(key,{name:r.name,gender:r.gender,outfit:r.outfit})}remoteRegion.set(key,info.region)}
  for(const key of [...remotes.keys()])if(!present.has(key)){remotes.delete(key);byShort.delete(key.slice(0,8));remoteRegion.delete(key);opts.onLeave(key)}
  rosterEmit();
 };

 const receive=(payload:PosPayload)=>{
  if(!payload||payload.i===shortId)return;
  const id=byShort.get(payload.i);const r=id&&remotes.get(id);if(!r)return; // avatars exist only after presence sync; a racing pos packet is simply dropped
  const now=performance.now(),angle=Number(payload.h)||0;
  if(!r.hasPacket){r.fromNormal.set(payload.x,payload.y,payload.z).normalize();r.toNormal.copy(r.fromNormal);r.fromAngle=r.toAngle=angle;r.hasPacket=true}
  else{const alpha=Math.min((now-r.receivedAt)/r.interval,1.2);r.fromNormal.lerp(r.toNormal,alpha).normalize();r.fromAngle+=wrapAngle(r.toAngle-r.fromAngle)*alpha;r.toNormal.set(payload.x,payload.y,payload.z).normalize();r.toAngle=angle;r.interval=T.MathUtils.clamp(now-r.lastPacket,60,400)}
  r.receivedAt=now;r.lastPacket=now;r.moving=payload.m===1;
 };

 const pushPos=(force=false)=>{
  const entry=myRegion?regionChans.get(myRegion):undefined;if(!entry||!entry.subscribed||!hasState)return;
  const now=performance.now(),active=lastState.moving||sentMoving||lastState.normal.distanceToSquared(sentNormal)>1e-8;
  const interval=active?(remotes.size>12?200:100):1000; // adaptive: halve fan-out in a crowd, 1Hz heartbeat when idle
  if(!force&&now-lastSentAt<interval)return;
  lastSentAt=now;sentNormal.copy(lastState.normal);sentMoving=lastState.moving;
  entry.chan.send({type:'broadcast',event:'pos',payload:encodePos(shortId,lastState.normal,lastState.heading,lastState.moving)}).catch(()=>{});
 };
 const trackSelf=()=>{const entry=myRegion?regionChans.get(myRegion):undefined;if(entry?.subscribed)entry.chan.track({name:opts.name,gender:opts.gender,outfit:opts.outfit}).catch(()=>{})};

 const scheduleRetry=()=>{clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(!disposed&&myRegion)reshard(myRegion)},retryDelay);retryDelay=Math.min(retryDelay*2,15000)};
 const subscribeRegion=(region:string)=>{
  if(regionChans.has(region)||disposed)return;
  const chan=getSupabase().channel(REGION_PREFIX+region,{config:{broadcast:{self:false,ack:false},presence:{key:opts.playerId}}});
  const entry={chan,subscribed:false};regionChans.set(region,entry);
  chan.on('presence',{event:'sync'},resyncAll).on('broadcast',{event:'pos'},({payload})=>receive(payload as PosPayload)).subscribe(status=>{
   if(disposed)return;
   if(status==='SUBSCRIBED'){entry.subscribed=true;retryDelay=1000;if(region===myRegion){trackSelf();pushPos(true)}resyncAll()}
   else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){entry.subscribed=false;regionChans.delete(region);getSupabase().removeChannel(chan).catch(()=>{});scheduleRetry()}
  });
 };
 // Switch the subscribed set to {region-1, region, region+1}; keep shared channels, drop the rest, move our presence.
 const reshard=(region:string)=>{
  const prev=myRegion;myRegion=region;const want=new Set(regionChannels(region));
  for(const [r,entry] of [...regionChans])if(!want.has(r)){entry.subscribed=false;getSupabase().removeChannel(entry.chan).catch(()=>{});regionChans.delete(r)}
  for(const r of want)if(!regionChans.has(r))subscribeRegion(r);
  if(prev&&prev!==region){const old=regionChans.get(prev);if(old?.subscribed)old.chan.untrack().catch(()=>{})}
  trackSelf();resyncAll();
 };

 const onVisibility=()=>{if(document.hidden){lastState.moving=false;pushPos(true)}else pushPos(true)};
 return {
  remotes,
  connect(){
   disposed=false;retryDelay=1000;
   voiceChan=getSupabase().channel(VOICE_CHANNEL,{config:{broadcast:{self:false,ack:false}}});
   voiceChan.on('broadcast',{event:'v'},({payload})=>{const p=payload as {to?:string;from?:string;m?:unknown};if(!p||p.to!==shortId)return;const full=p.from&&byShort.get(p.from);if(full&&opts.onVoice)opts.onVoice(full,p.m)}).subscribe();
   document.addEventListener('visibilitychange',onVisibility);
  },
  send(normal:T.Vector3,heading:T.Vector3,moving:boolean){lastState.normal.copy(normal);lastState.heading.copy(heading);lastState.moving=moving;hasState=true;const region=regionAt(Math.atan2(normal.z,normal.x));if(region!==myRegion)reshard(region);pushPos()},
  signalVoice(toFullId:string,msg:unknown){if(!voiceChan)return;voiceChan.send({type:'broadcast',event:'v',payload:{to:toFullId.slice(0,8),from:shortId,m:msg}}).catch(()=>{})},
  sample(r:RemoteState,now:number){
   if(!r.hasPacket)return null;
   const alpha=Math.min((now-r.receivedAt)/r.interval,1.2); // brief extrapolation past the last packet, then hold
   const normal=r.fromNormal.clone().lerp(r.toNormal,alpha).normalize(),angle=r.fromAngle+wrapAngle(r.toAngle-r.fromAngle)*alpha;
   return {normal,heading:decodeHeading(normal,angle),moving:r.moving&&now-r.lastPacket<6000};
  },
  dispose(){disposed=true;clearTimeout(retryTimer);document.removeEventListener('visibilitychange',onVisibility);for(const [,entry] of regionChans){entry.chan.untrack().catch(()=>{});getSupabase().removeChannel(entry.chan).catch(()=>{})}regionChans.clear();if(voiceChan)getSupabase().removeChannel(voiceChan).catch(()=>{});remotes.clear();byShort.clear();remoteRegion.clear()},
 };
}
