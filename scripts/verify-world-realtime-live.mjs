import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url,'https://qogewfdbxlcllcfjsykt.supabase.co');assert.ok(key,'Project publishable key is required for live verification');
const code=ts.transpileModule(fs.readFileSync('app/world-presence.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createWorldPresence}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const ids=[crypto.randomUUID(),crypto.randomUUID()];
const sessions=clients.map((client,i)=>createWorldPresence(client,ids[i],'Connection test '+i));
const pose={lon:76.32001,lat:9.51001,heading:0,speed:0,vehicle:null};
const wait=async(predicate,label)=>{const end=Date.now()+20000;while(!predicate()){if(Date.now()>end)throw Error('Timed out: '+label+'; states '+sessions.map(s=>s.status).join(','));await new Promise(r=>setTimeout(r,100))}};
try{
 sessions.forEach(s=>s.update(pose));
 await wait(()=>sessions.every(s=>s.status==='online'),'both clients subscribe');
 await wait(()=>sessions[0].peers.has(ids[1])&&sessions[1].peers.has(ids[0]),'two clients see each other');
 await new Promise(r=>setTimeout(r,150));sessions[0].update({...pose,heading:.75,speed:10,vehicle:'car'});
 await wait(()=>sessions[1].peers.get(ids[0])?.packet.vehicle==='car','driving state broadcast');
 assert.equal(sessions[1].peers.get(ids[0]).packet.heading,.75);
 sessions[0].dispose();await wait(()=>!sessions[1].peers.has(ids[0]),'disconnect presence cleanup');
 console.log('PASS: qogewfdbxlcllcfjsykt live Supabase connection, two-client presence, movement/vehicle broadcast and disconnect cleanup.');
}finally{sessions.forEach(s=>s.dispose());await Promise.all(clients.map(c=>c.removeAllChannels()));await Promise.all(clients.map(c=>c.realtime.disconnect()));}
