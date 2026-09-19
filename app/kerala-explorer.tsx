'use client';
import {useState} from 'react';
import {DISTRICTS} from './districts';
import {KERALA_DISTRICT_PATHS,KERALA_VIEWBOX,KERALA_DISTRICT_CENTER} from './kerala-map';
import {KERALA_STARTS} from './kerala-starts';
import type {WorldArea} from './world-area-picker';
export default function KeralaExplorer({onSelect}:{onSelect:(area:WorldArea)=>void}) {
 const [selected,setSelected]=useState('ernakulam');
 const [query,setQuery]=useState('');
 const start=KERALA_STARTS.find(s=>s.id===selected)!;
 const district=DISTRICTS.find(d=>d.id===selected)!;
 const filtered=KERALA_STARTS.filter(s=>{
  const d=DISTRICTS.find(d=>d.id===s.id)!;
  return `${d.name} ${d.malayalam} ${s.town}`.toLowerCase().includes(query.toLowerCase());
 });
 return <section className="kerala-explorer" aria-labelledby="kerala-title">
  <div className="kerala-heading"><small>ONE STATE · FOURTEEN DISTRICTS</small><h2 id="kerala-title">Explore all of Kerala.</h2><p>Choose a starting town. Roads and buildings load nearby, then ahead as you travel.</p></div>
  <div className="kerala-browser">
   <div className="kerala-overview"><svg viewBox={KERALA_VIEWBOX.join(' ')} aria-label="Kerala district overview">
    {KERALA_STARTS.map(s=><path key={s.id} d={KERALA_DISTRICT_PATHS[s.id]} className={selected===s.id?'selected':''} onClick={()=>setSelected(s.id)}><title>{DISTRICTS.find(d=>d.id===s.id)!.name}</title></path>)}
    {KERALA_DISTRICT_CENTER[selected]&&<circle cx={KERALA_DISTRICT_CENTER[selected][0]} cy={KERALA_DISTRICT_CENTER[selected][1]} r="3" fill="#153b2c" pointerEvents="none"/>}
   </svg><small>District outlines: DataMeet · CC BY 4.0</small></div>
   <div className="kerala-district-picker"><label htmlFor="kerala-search">Find a district or town</label><input id="kerala-search" type="search" placeholder="Kochi, Wayanad…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="kerala-district-list">{filtered.map(s=>{const d=DISTRICTS.find(d=>d.id===s.id)!;return <button key={s.id} type="button" aria-pressed={selected===s.id} onClick={()=>setSelected(s.id)}><span>{d.name}<small>{s.town===d.name?d.malayalam:`Start in ${s.town}`}</small></span><span aria-hidden="true">{selected===s.id?'✓':'↗'}</span></button>})}{!filtered.length&&<p>No matching district. Try another name.</p>}</div>
   </div>
  </div>
  <div className="kerala-start"><div><strong>{district.name}</strong><span>{district.landscape}</span><small>Start near {start.town} · nearest mapped road</small></div><button type="button" onClick={()=>onSelect({point:start.point,name:start.town,region:'kerala'})}>Explore {start.town} →</button></div>
  <p className="kerala-coverage-note">All districts are selectable. Street coverage depends on OpenStreetMap. Terrain is simplified; hills and elevated bridges are not yet reconstructed.</p>
 </section>;
}
