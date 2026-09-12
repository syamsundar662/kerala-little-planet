import {getSupabase,isMultiplayerConfigured} from './realtime';

// Fire-and-forget join logging. Sends name/gender/device to the `visits` edge
// function, which derives IP + approximate geo server-side and stores a row.
// Silent by design: analytics must never block or break walking in.
export function logVisit(info:{playerId:string;name:string;gender:number}){
 if(!isMultiplayerConfigured())return;
 try{
  const body={
   playerId:info.playerId,
   name:info.name,
   gender:info.gender,
   language:typeof navigator!=='undefined'?navigator.language:'',
   screen:typeof screen!=='undefined'?`${screen.width}x${screen.height}`:'',
   referrer:typeof document!=='undefined'?document.referrer:'',
   timezone:(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return ''}})(),
  };
  getSupabase().functions.invoke('visits',{body}).catch(()=>{});
 }catch{/* analytics is best-effort */}
}
