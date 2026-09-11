import * as T from 'three';
import {WORLD_RADIUS as R} from './world';

// Proximity voice chat: a small WebRTC audio mesh between nearby walking villagers.
// Signalling rides the existing Supabase Realtime channel (see multiplayer.ts) — this module never
// touches the network directly; it hands opaque messages to `send` and is fed replies via handleSignal.
export type VoiceMsg={t:'ready'|'offer'|'answer'|'ice';sdp?:string;candidate?:RTCIceCandidateInit};
export type VoiceState={enabled:boolean;status:'off'|'requesting'|'live'|'denied'|'error';nearby:number;speaking:string[];localSpeaking:boolean};

const STUN:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]};
const NEAR=1.2,RANGE=3.6,DROP=4.6; // world units of arc distance: full volume within NEAR, silent past RANGE, connection torn down past DROP

type Peer={pc:RTCPeerConnection;audio:HTMLAudioElement;source?:MediaStreamAudioSourceNode;gain?:GainNode;analyser?:AnalyserNode;buf?:Float32Array;dist:number;speaking:boolean;makingOffer:boolean;connected:boolean};

export function createVoiceChat(opts:{playerId:string;send:(toId:string,msg:VoiceMsg)=>void;onState:(s:VoiceState)=>void}){
 const peers=new Map<string,Peer>();
 let localStream:MediaStream|undefined,ctx:AudioContext|undefined,localAnalyser:AnalyserNode|undefined,localBuf:Float32Array|undefined;
 let enabled=false,status:VoiceState['status']='off',localSpeaking=false,disposed=false;
 let meter:ReturnType<typeof setInterval>|undefined;
 const near=new Map<string,number>(); // peerId -> current arc distance, maintained by updateProximity
 const initiator=(peerId:string)=>opts.playerId<peerId; // exactly one side of each pair offers; the other answers

 const emit=()=>{if(disposed)return;const speaking=[...peers].filter(([,p])=>p.speaking).map(([id])=>id);opts.onState({enabled,status,nearby:[...peers].filter(([,p])=>p.connected).length,speaking,localSpeaking})};

 const gainFor=(d:number)=>d<=NEAR?1:d>=RANGE?0:(()=>{const t=(d-NEAR)/(RANGE-NEAR);return 1-t*t*(3-2*t)})();

 const teardown=(id:string)=>{const p=peers.get(id);if(!p)return;peers.delete(id);try{p.pc.onicecandidate=null;p.pc.ontrack=null;p.pc.onconnectionstatechange=null;p.pc.close()}catch{}try{p.source?.disconnect();p.gain?.disconnect();p.analyser?.disconnect()}catch{}p.audio.srcObject=null;p.audio.remove();emit()};

 const makePeer=(id:string):Peer=>{
  const pc=new RTCPeerConnection(STUN);
  const audio=document.createElement('audio');audio.autoplay=true;(audio as HTMLAudioElement&{playsInline:boolean}).playsInline=true;audio.muted=true;audio.style.display='none';document.body.appendChild(audio);
  const peer:Peer={pc,audio,dist:near.get(id)??99,speaking:false,makingOffer:false,connected:false};
  if(localStream)for(const track of localStream.getTracks())pc.addTrack(track,localStream);
  pc.onicecandidate=e=>{if(e.candidate)opts.send(id,{t:'ice',candidate:e.candidate.toJSON()})};
  pc.onconnectionstatechange=()=>{const s=pc.connectionState;peer.connected=s==='connected';if(s==='failed'||s==='closed')teardown(id);else emit()};
  pc.ontrack=e=>{
   const stream=e.streams[0]||new MediaStream([e.track]);audio.srcObject=stream; // an attached element is required for the WebAudio graph to pull the remote track in Chrome
   if(ctx){peer.source=ctx.createMediaStreamSource(stream);peer.gain=ctx.createGain();peer.gain.gain.value=gainFor(peer.dist);peer.analyser=ctx.createAnalyser();peer.analyser.fftSize=256;peer.buf=new Float32Array(peer.analyser.fftSize);peer.source.connect(peer.analyser);peer.analyser.connect(peer.gain);peer.gain.connect(ctx.destination)}
  };
  peers.set(id,peer);return peer;
 };

 const offer=async(id:string)=>{const p=peers.get(id)||makePeer(id);if(p.makingOffer||p.pc.signalingState!=='stable')return;try{p.makingOffer=true;const o=await p.pc.createOffer();await p.pc.setLocalDescription(o);opts.send(id,{t:'offer',sdp:p.pc.localDescription!.sdp})}catch{}finally{p.makingOffer=false}};

 const connect=(id:string)=>{if(peers.has(id))return;if(initiator(id))offer(id);else opts.send(id,{t:'ready'})}; // answerer nudges the initiator in case it enabled first

 const handleSignal=async(from:string,msg:VoiceMsg)=>{
  if(!enabled||disposed)return; // taking part requires a live mic; a stray signal before enable is ignored
  try{
   if(msg.t==='ready'){if(initiator(from)&&near.has(from)&&!peers.has(from))offer(from);return}
   const p=peers.get(from)||makePeer(from);
   if(msg.t==='offer'&&msg.sdp){await p.pc.setRemoteDescription({type:'offer',sdp:msg.sdp});const a=await p.pc.createAnswer();await p.pc.setLocalDescription(a);opts.send(from,{t:'answer',sdp:p.pc.localDescription!.sdp})}
   else if(msg.t==='answer'&&msg.sdp){if(p.pc.signalingState==='have-local-offer')await p.pc.setRemoteDescription({type:'answer',sdp:msg.sdp})}
   else if(msg.t==='ice'&&msg.candidate){await p.pc.addIceCandidate(msg.candidate).catch(()=>{})}
  }catch{}
 };

 const sampleLevel=(analyser:AnalyserNode,buf:Float32Array)=>{analyser.getFloatTimeDomainData(buf as unknown as Float32Array<ArrayBuffer>);let sum=0;for(let i=0;i<buf.length;i++)sum+=buf[i]*buf[i];return Math.sqrt(sum/buf.length)};
 const tick=()=>{
  let changed=false;
  if(localAnalyser&&localBuf){const spk=sampleLevel(localAnalyser,localBuf)>.028;if(spk!==localSpeaking){localSpeaking=spk;changed=true}}
  for(const[,p]of peers){if(p.analyser&&p.buf){const spk=p.connected&&sampleLevel(p.analyser,p.buf)>.02;if(spk!==p.speaking){p.speaking=spk;changed=true}}}
  if(changed)emit();
 };

 const enable=async()=>{
  if(enabled)return;status='requesting';emit();
  try{
   localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   ctx=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();await ctx.resume().catch(()=>{});
   localAnalyser=ctx.createAnalyser();localAnalyser.fftSize=256;localBuf=new Float32Array(localAnalyser.fftSize);ctx.createMediaStreamSource(localStream).connect(localAnalyser); // meter only; local mic is never routed to our own speakers
   enabled=true;status='live';
   for(const id of near.keys())connect(id);
   meter=setInterval(tick,120);
   emit();
  }catch(e){status=(e&&(e as DOMException).name==='NotAllowedError')?'denied':'error';localStream=undefined;emit()}
 };

 const disable=()=>{
  enabled=false;status='off';localSpeaking=false;
  if(meter){clearInterval(meter);meter=undefined}
  for(const id of [...peers.keys()])teardown(id);
  localStream?.getTracks().forEach(t=>t.stop());localStream=undefined;
  localAnalyser?.disconnect();localAnalyser=undefined;localBuf=undefined;
  ctx?.close().catch(()=>{});ctx=undefined;
  emit();
 };

 return {
  enable,disable,handleSignal,
  isEnabled:()=>enabled,
  // Called ~5Hz from the walk loop with the local normal and every visible remote avatar's normal.
  updateProximity(localNormal:T.Vector3,others:Map<string,T.Vector3>){
   near.clear();
   for(const[id,n]of others){const d=Math.acos(T.MathUtils.clamp(localNormal.dot(n),-1,1))*R;near.set(id,d);const p=peers.get(id);if(p){p.dist=d;if(p.gain&&ctx)p.gain.gain.setTargetAtTime(gainFor(d),ctx.currentTime,.08)}
    if(enabled){if(d<RANGE&&!peers.has(id))connect(id);else if(d>DROP&&peers.has(id))teardown(id)}}
   if(enabled)for(const id of [...peers.keys()])if(!others.has(id))teardown(id); // avatar left the world
  },
  removePeer:teardown,
  dispose(){disposed=true;disable()},
 };
}
