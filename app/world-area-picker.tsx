'use client';
import {useState} from 'react';
import CurrentLocation from './current-location';
import KeralaExplorer from './kerala-explorer';
import './kerala-explorer.css';
import type {Point} from './alappuzha-map';
export type WorldArea = {point: Point; name?:string; region?:'kerala'} | {point?: undefined; name?:undefined; region?:undefined};
export default function WorldAreaPicker({onSelect}: {onSelect: (area:WorldArea)=>void}) {
 const [error,setError]=useState('');
 return <main className="area-picker"><section className="area-picker-card">
  <small>KERALA & BEYOND</small>
  <h1>Kerala, one road at a time.</h1>
  <p>Start anywhere in the world. Nearby streets load first, then more areas download ahead as you travel.</p>
  <KeralaExplorer onSelect={onSelect}/>
  <h2>Or explore your own location</h2>
  <CurrentLocation onLocate={()=>false} onTravel={()=>{}} onExplore={point=>onSelect({point})}/>
  <form onSubmit={event=>{
   event.preventDefault();const values=new FormData(event.currentTarget);
   const latitude=Number(values.get('latitude')),longitude=Number(values.get('longitude'));
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){setError('Enter valid latitude and longitude.');return;}
   setError('');onSelect({point:[longitude,latitude]});
  }}>
   <h2>Choose any coordinates</h2>
   <div className="area-coordinates"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" placeholder="51.5072" required/></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" placeholder="-0.1276" required/></label></div>
   <button type="submit">Load nearby streets</button>
   {error&&<output>{error}</output>}
  </form>
  <button className="area-demo" onClick={()=>onSelect({})}>Alappuzha with detailed terrain</button>
  <p className="area-note">Worldwide maps stream in small areas about 2.4 km across, with real mapped roads and building footprints on simplified flat terrain. Availability depends on OpenStreetMap coverage. No street-data download until you choose.</p>
 </section></main>;
}
