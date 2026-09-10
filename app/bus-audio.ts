export function createBusAudio(){
 let ctx:AudioContext|undefined,master:GainNode,engine:GainNode,road:GainNode,water:GainNode,filter:BiquadFilterNode,diesel:AudioBufferSourceNode,nightBed:GainNode,noiseBuffer:AudioBuffer;
 let muted=false,volume=.35,disposed=false,lastUpdate=0,lastHorn=-10,lastImpact=-10,lastCrash=-10,nextBird=0,lastWet=0,nextReverse=0;
 let reverseTone:OscillatorNode|undefined,reverseGain:GainNode|undefined;
 const sources:AudioScheduledSourceNode[]=[];const engineRequest=new AbortController();
 function start(){
  if(disposed)return;
  if(!ctx){
   const Audio=window.AudioContext;if(!Audio)return;ctx=new Audio();master=ctx.createGain();master.gain.value=muted?0:volume;
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.ratio.value=6;master.connect(limiter);limiter.connect(ctx.destination);
   engine=ctx.createGain();engine.gain.value=0;filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=320;engine.connect(filter);filter.connect(master);
   diesel=ctx.createBufferSource();diesel.loop=true;diesel.connect(engine);
   const audioContext=ctx;
   fetch('/audio/bus-diesel-recording.mp3',{signal:engineRequest.signal}).then(r=>{if(!r.ok)throw new Error('Bus recording unavailable');return r.arrayBuffer()}).then(bytes=>audioContext.decodeAudioData(bytes)).then(recording=>{
    if(disposed)return;
    const rate=recording.sampleRate,start=Math.floor(rate*3),length=Math.min(Math.floor(rate*10),recording.length-start),fade=Math.floor(rate*.20),count=length-fade;
    const loop=audioContext.createBuffer(1,count,rate),samples=loop.getChannelData(0),mono=new Float32Array(length);
    for(let c=0;c<recording.numberOfChannels;c++){const data=recording.getChannelData(c);for(let i=0;i<length;i++)mono[i]+=data[start+i]/recording.numberOfChannels;}
    samples.set(mono.subarray(fade));for(let i=0;i<fade;i++){const t=i/(fade-1);samples[count-fade+i]=mono[length-fade+i]*(1-t)+mono[i]*t;}
    let sum=0,peak=0;for(const v of samples){sum+=v*v;peak=Math.max(peak,Math.abs(v));}const gain=Math.min(.18/Math.max(.0001,Math.sqrt(sum/count)),.85/Math.max(.0001,peak));for(let i=0;i<count;i++)samples[i]*=gain;
    diesel.buffer=loop;diesel.start();sources.push(diesel);
   }).catch(error=>{if(!disposed)console.error('Could not load bus engine recording',error)});
   const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let smooth=0;for(let i=0;i<data.length;i++){smooth=.84*smooth+.16*(Math.random()*2-1);data[i]=smooth;}
   noiseBuffer=buffer;const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;sources.push(noise);
   road=ctx.createGain();road.gain.value=0;const roadFilter=ctx.createBiquadFilter();roadFilter.type='lowpass';roadFilter.frequency.value=700;noise.connect(roadFilter);roadFilter.connect(road);road.connect(master);
   water=ctx.createGain();water.gain.value=0;const splash=ctx.createBiquadFilter();splash.type='lowpass';splash.frequency.value=1800;splash.Q.value=.6;noise.connect(splash);splash.connect(water);water.connect(master);noise.start();
   nightBed=ctx.createGain();nightBed.gain.value=0;nightBed.connect(master);const insects=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),chirps=insects.getChannelData(0);
   for(let i=0;i<chirps.length;i++){const t=i/ctx.sampleRate,gate=Math.max(0,Math.sin(t*Math.PI*2*13))**8*(.35+.65*Math.max(0,Math.sin(t*Math.PI*2/3)));chirps[i]=gate*(Math.sin(t*Math.PI*2*3700)*.38+Math.sin(t*Math.PI*2*4300)*.12);}
   const crickets=ctx.createBufferSource();crickets.buffer=insects;crickets.loop=true;crickets.connect(nightBed);crickets.start();sources.push(crickets);
  }
  if(ctx.state==='suspended'&&!document.hidden)void ctx.resume().catch(()=>{});
 }
 const unlock=()=>{if(!muted)start()};const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLElement&&e.target.isContentEditable)return;unlock();if(e.key.toLowerCase()==='h'&&!e.repeat)horn()};
 const visibility=()=>{if(document.hidden)void ctx?.suspend().catch(()=>{});else if(ctx&&!muted)void ctx.resume().catch(()=>{})};
 window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);
 function horn(){start();if(!ctx||muted||ctx.currentTime-lastHorn<.6)return;lastHorn=ctx.currentTime;const t=ctx.currentTime,g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1500;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.19,t+.04);g.gain.setValueAtTime(.19,t+.28);g.gain.exponentialRampToValueAtTime(.001,t+.50);g.connect(f);f.connect(master);let remaining=2;for(const hz of[220,277]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(g);o.start();o.stop(t+.52);o.onended=()=>{o.disconnect();if(--remaining===0){g.disconnect();f.disconnect()}}}}
 function stopReverse(){if(ctx&&reverseGain)reverseGain.gain.setTargetAtTime(0,ctx.currentTime,.015);nextReverse=0;}
 function reverseBeep(inside:boolean){
  if(!ctx||muted)return;const t=ctx.currentTime;if(t<nextReverse)return;nextReverse=t+.8;
  const o=ctx.createOscillator(),g=ctx.createGain();reverseTone=o;reverseGain=g;o.type='sine';o.frequency.value=980;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(inside?.10:.17,t+.012);g.gain.setValueAtTime(inside?.10:.17,t+.29);g.gain.linearRampToValueAtTime(0,t+.32);
  o.connect(g);g.connect(master);o.start();o.stop(t+.34);o.onended=()=>{o.disconnect();g.disconnect();if(reverseTone===o){reverseTone=undefined;reverseGain=undefined}};
 }
 function noiseHit(strength:number,duration:number,hz:number){if(!ctx||muted)return;const t=ctx.currentTime,n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuffer;f.type='lowpass';f.frequency.value=hz;g.gain.setValueAtTime(Math.max(.001,strength),t);g.gain.exponentialRampToValueAtTime(.001,t+duration);n.connect(f);f.connect(g);g.connect(master);n.start();n.stop(t+duration+.02);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect()}}
 function crash(speed:number){if(!ctx||ctx.state!=='running'||muted||speed<.10||ctx.currentTime-lastCrash<.5)return;lastCrash=ctx.currentTime;const strength=Math.min(1,speed/1.4);noiseHit(.35+strength*.7,.24+strength*.30,1700);const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(34,t+.25);g.gain.setValueAtTime(.18+strength*.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g);g.connect(master);o.start();o.stop(t+.35);o.onended=()=>{o.disconnect();g.disconnect()}}
 function bird(level:number){if(!ctx||muted)return;const t=ctx.currentTime;for(let i=0;i<3;i++){const o=ctx.createOscillator(),g=ctx.createGain(),start=t+i*.17,f=1700+Math.random()*1100;o.type='sine';o.frequency.setValueAtTime(f,start);o.frequency.exponentialRampToValueAtTime(f*1.55,start+.045);o.frequency.exponentialRampToValueAtTime(f*.86,start+.13);g.gain.setValueAtTime(.001,start);g.gain.linearRampToValueAtTime(level,start+.02);g.gain.exponentialRampToValueAtTime(.001,start+.14);o.connect(g);g.connect(master);o.start(start);o.stop(start+.16);o.onended=()=>{o.disconnect();g.disconnect()}}}
 return {horn,crash,mute(value:boolean){muted=value;if(value)stopReverse();if(!value)start();if(ctx)master.gain.setTargetAtTime(muted?0:volume,ctx.currentTime,.04)},volume(value:number){volume=Math.max(0,Math.min(1,value));if(ctx)master.gain.setTargetAtTime(muted?0:volume,ctx.currentTime,.04)},
 update(speed:number,throttle:boolean,wet:number,inside:boolean,active:boolean,impact=0,night=0,ready=true){
  if(!ctx||ctx.state!=='running'||ctx.currentTime-lastUpdate<.05)return;lastUpdate=ctx.currentTime;const t=ctx.currentTime,s=Math.min(1,Math.abs(speed)/2.1),revs=.94+s*.20+(throttle?.07:0);
  if(active&&speed<-.025&&!muted)reverseBeep(inside);else stopReverse();
  diesel.playbackRate.setTargetAtTime(revs,t,.32);filter.frequency.setTargetAtTime(inside?950:1800,t,.15);engine.gain.setTargetAtTime(active?(inside?.62:.52)+(throttle?.10:0):0,t,.18);road.gain.setTargetAtTime(s*(inside?.17:.24)*(1-wet*.7),t,.12);water.gain.setTargetAtTime(Math.max(0,wet)*(.18+s*1.1),t,.10);
  if(wet-lastWet>.06)noiseHit(Math.min(.75,(wet-lastWet)*2+s*.35),.48,2200);lastWet=wet;
  nightBed.gain.setTargetAtTime(ready?Math.max(0,Math.min(1,night))*(inside?.08:.16):0,t,.7);
  if(ready&&night<.55&&t>nextBird&&!muted){bird((1-night)*(inside?.045:.085));nextBird=t+3.5+Math.random()*5;}

  if(impact>.13&&t-lastImpact>.22&&!muted){lastImpact=t;const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(68,t);o.frequency.exponentialRampToValueAtTime(29,t+.14);g.gain.setValueAtTime(Math.min(.14,impact*.22),t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(master);o.start();o.stop(t+.20);o.onended=()=>{o.disconnect();g.disconnect()}}
 },dispose(){disposed=true;engineRequest.abort();stopReverse();window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);sources.forEach(s=>{s.stop();s.disconnect()});void ctx?.close().catch(()=>{})}};
}
