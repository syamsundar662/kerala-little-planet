'use client';
import {useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';

type Dir='forward'|'reverse'|'left'|'right';
const DIRS:Dir[]=['forward','reverse','left','right'];

// Touch joystick for mobile. Maps the stick vector to the same discrete drive() directions the keyboard/d-pad use, so no engine change is needed.
export function Joystick({onDir,label='Movement joystick'}:{onDir:(d:Dir,pressed:boolean)=>void;label?:string}){
 const base=useRef<HTMLDivElement>(null);
 const held=useRef<Record<Dir,boolean>>({forward:false,reverse:false,left:false,right:false});
 const pointer=useRef<number|null>(null);
 const [thumb,setThumb]=useState({x:0,y:0});
 const apply=(x:number,y:number)=>{const dz=.24;const next:Record<Dir,boolean>={forward:y<-dz,reverse:y>dz,left:x<-dz,right:x>dz};for(const d of DIRS)if(next[d]!==held.current[d]){held.current[d]=next[d];onDir(d,next[d])}};
 const move=(cx:number,cy:number)=>{const el=base.current;if(!el)return;const r=el.getBoundingClientRect(),ox=r.left+r.width/2,oy=r.top+r.height/2,max=r.width/2;let dx=cx-ox,dy=cy-oy;const dist=Math.hypot(dx,dy);if(dist>max){dx=dx/dist*max;dy=dy/dist*max}setThumb({x:dx,y:dy});apply(dx/max,dy/max)};
 const end=(e?:ReactPointerEvent<HTMLDivElement>)=>{pointer.current=null;setThumb({x:0,y:0});for(const d of DIRS)if(held.current[d]){held.current[d]=false;onDir(d,false)}if(e){try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{/* already released */}}};
 return <div ref={base} className="joystick" role="application" aria-label={label}
   onPointerDown={e=>{pointer.current=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* capture unsupported */}move(e.clientX,e.clientY)}}
   onPointerMove={e=>{if(pointer.current===e.pointerId)move(e.clientX,e.clientY)}}
   onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
  <span className="joystick-ring" aria-hidden="true"/>
  <span className="joystick-thumb" style={{transform:`translate(${thumb.x}px,${thumb.y}px)`}} aria-hidden="true"/>
 </div>;
}
