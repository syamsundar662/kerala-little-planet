import assert from 'node:assert/strict';
import {roadRibbonGeometry,dashIntervals} from '../app/alappuzha-road-mesh.ts';
const covers=(geometry,x,z)=>{const p=geometry.attributes.position;for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2);const cross=(ax,az,bx,bz,cx,cz)=>(bx-ax)*(cz-az)-(bz-az)*(cx-ax);const a=cross(ax,az,bx,bz,x,z),b=cross(bx,bz,cx,cz,x,z),c=cross(cx,cz,ax,az,x,z);if((a>=-1e-6&&b>=-1e-6&&c>=-1e-6)||(a<=1e-6&&b<=1e-6&&c<=1e-6))return true;}return false;};
for(const sign of [1,-1]){
 const segments=[{a:[0,0],b:[10,0],width:4},{a:[10,0],b:[10,sign*10],width:4}];
 const old=roadRibbonGeometry(segments,0,.045,false),joined=roadRibbonGeometry(segments,0,.045,true);
 assert.equal(covers(old,11,-sign),false,'Regression fixture must expose the old outside-corner gap');assert(covers(joined,11,-sign),'Round joint must cover the outside corner');
 for(let i=0;i<joined.attributes.normal.count;i++)assert(joined.attributes.normal.getY(i)>.99,'All road/join normals face up');
 // Adjacent streamed chunks must cover the same join without relying on one another.
 const first=roadRibbonGeometry(segments.slice(0,1),0,.045,true),second=roadRibbonGeometry(segments.slice(1),0,.045,true);assert(covers(first,11,-sign));assert(covers(second,11,-sign));[old,joined,first,second].forEach(g=>g.dispose());
}
const full=dashIntervals(47,0),split=[];let offset=0;for(const length of [1,1,2,5,11,3,24]){split.push(...dashIntervals(length,offset).map(([a,b])=>[a+offset,b+offset]));offset+=length;}
const inside=(intervals,x)=>intervals.some(([a,b])=>x>=a&&x<b);for(let x=.05;x<47;x+=.1)assert.equal(inside(full,x),inside(split,x),'Dash phase must survive short OSM segments');
console.log('PASS: left/right bend gaps reproduced and covered; streamed joins continuous; upward normals; dash phase preserved.');
