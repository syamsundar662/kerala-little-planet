import {createClient,type SupabaseClient} from '@supabase/supabase-js';

// Vite inlines import.meta.env.VITE_*; the NEXT_PUBLIC_ spellings are a fallback in case vinext maps those instead.
const env=((import.meta as unknown as {env?:Record<string,string|undefined>}).env)??{};
const SUPABASE_URL=env.VITE_SUPABASE_URL??env.NEXT_PUBLIC_SUPABASE_URL??(typeof process!=='undefined'?process.env?.NEXT_PUBLIC_SUPABASE_URL:undefined);
const SUPABASE_ANON_KEY=env.VITE_SUPABASE_PUBLISHABLE_KEY??env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??env.VITE_SUPABASE_ANON_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY??(typeof process!=='undefined'?process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY:undefined);

export function isMultiplayerConfigured(){return Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY)}
let client:SupabaseClient|undefined;
export function getSupabase(){client??=createClient(SUPABASE_URL!,SUPABASE_ANON_KEY!,{realtime:{params:{eventsPerSecond:15}},auth:{persistSession:false}});return client}
// crypto.randomUUID only exists in secure contexts (https / localhost); over plain http on a LAN IP it's undefined, so fall back to getRandomValues/Math.random.
function randomId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(c?.getRandomValues){const b=c.getRandomValues(new Uint8Array(16));b[6]=b[6]&0x0f|0x40;b[8]=b[8]&0x3f|0x80;const h=[...b].map(x=>x.toString(16).padStart(2,'0'));return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{const r=Math.floor(Math.random()*16);return (ch==='x'?r:r&0x3|0x8).toString(16)})}
export function getPlayerId(){try{let id=localStorage.getItem('little-kerala-player-id');if(!id){id=randomId();localStorage.setItem('little-kerala-player-id',id)}return id}catch{return randomId()}}

// The open-world session must never silently connect to the former planet project.
export const WORLD_PROJECT_REF='qogewfdbxlcllcfjsykt';
export function isWorldMultiplayerConfigured(){return isMultiplayerConfigured()&&SUPABASE_URL===`https://${WORLD_PROJECT_REF}.supabase.co`}
export function getWorldAnalyticsConfig(){return {url:SUPABASE_URL,key:SUPABASE_ANON_KEY}}
