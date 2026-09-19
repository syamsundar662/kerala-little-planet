import {mapProjection, unprojectPoint, type MapData, type Point, type Road} from './alappuzha-map';
import {loadWorldArea} from './world-area';
export type StreamStatus = 'ready' | 'loading' | 'retrying';
type Region = {data: MapData; center: Point};
export function mergeRegions(origin: Point, regions: MapData[]): MapData {
 const latest=regions.at(-1)!;
 const roads: Road[]=[], seen=new Set<string>();
 const buildings=new Map<string,NonNullable<MapData['buildings']>[number]>(),water=new Map<string,MapData['water'][number]>();
 for(const data of regions){
  for(const road of data.roads){
   let points:Point[]=[],nodes:number[]=[];
   const flush=()=>{if(nodes.length>1)roads.push({...road,points,nodes});points=[];nodes=[];};
   for(let i=1;i<road.nodes.length;i++){
    const key=`${road.id}:${road.nodes[i-1]}:${road.nodes[i]}`;
    if(seen.has(key)){flush();continue;}seen.add(key);
    if(!nodes.length){nodes.push(road.nodes[i-1]);points.push(road.points[i-1]);}
    nodes.push(road.nodes[i]);points.push(road.points[i]);
   }
   flush();
  }
  for(const b of data.buildings??[])buildings.set(JSON.stringify(b.points),b);
  for(const w of data.water)water.set(JSON.stringify(w.points),w);
 }
 const project=mapProjection({origin}),centers=regions.map(d=>project(d.origin!));
 const radius=1.2;
 const minX=Math.min(...centers.map(p=>p[0]))-radius,maxX=Math.max(...centers.map(p=>p[0]))+radius;
 const minZ=Math.min(...centers.map(p=>p[1]))-radius,maxZ=Math.max(...centers.map(p=>p[1]))+radius;
 return {...latest,origin,roads,buildings:[...buildings.values()],water:[...water.values()],viewBounds:[minX,minZ,maxX,maxZ]};
}
// Movement samples are in the original world's metres. Its origin never changes.
export function createWorldStream(initial:MapData, options:{
 onData:(data:MapData)=>void;
 onStatus:(status:StreamStatus)=>void;
 load?:(point:Point,signal:AbortSignal)=>Promise<{data:MapData}>;
 now?:()=>number;
}) {
 const origin=initial.origin!;
 const project=mapProjection({origin});
 const now=options.now??(()=>performance.now());
 const load=options.load??loadWorldArea;
 let regions:Region[]=[{data:initial,center:project(origin)}];
 let previous:Point|null=null,previousTime=0,current:Point=[0,0];
 let velocity:Point=[0,0],inflight:AbortController|null=null,disposed=false,nextRequest=0;
 let status:StreamStatus='ready';
 const publish=(next:StreamStatus)=>{if(status!==next){status=next;options.onStatus(next);}};
 const covered=(p:Point)=>regions.some(r=>Math.abs(p[0]-r.center[0]*1000)<950&&Math.abs(p[1]-r.center[1]*1000)<950);
 const request=async(target:Point)=>{
  const controller=new AbortController();inflight=controller;publish('loading');
  try{
   const {data}=await load(unprojectPoint({origin},[target[0]/1000,target[1]/1000]),controller.signal);
   if(disposed||controller.signal.aborted)return;
   regions.push({data,center:project(data.origin!)});
   // Keep current coverage plus the new forward region; old distant data is evicted.
   const newest=regions.pop()!;
   regions.sort((a,b)=>Math.hypot(a.center[0]*1000-current[0],a.center[1]*1000-current[1])-Math.hypot(b.center[0]*1000-current[0],b.center[1]*1000-current[1]));
   regions=[...regions.slice(0,2),newest];
   options.onData(mergeRegions(origin,regions.map(r=>r.data)));
   nextRequest=now()+8000;publish('ready');
  }catch{
   if(!disposed&&!controller.signal.aborted){nextRequest=now()+60000;publish('retrying');}
  }finally{if(inflight===controller)inflight=null;}
 };
 return {
  update(position:Point){
   if(disposed)return;
   const time=now();current=[...position];
   const elapsed=(time-previousTime)/1000;
   if(previous&&elapsed>0&&elapsed<2){
    const dx=position[0]-previous[0],dz=position[1]-previous[1];
    // Large jumps are town travel, not a request to prefetch kilometres ahead.
    if(Math.hypot(dx,dz)<200){velocity=[dx/elapsed,dz/elapsed];}else velocity=[0,0];
   }else velocity=[0,0];
   previous=[...position];previousTime=time;
   if(inflight||time<nextRequest)return;
   const speed=Math.hypot(...velocity);
   const lookahead=Math.min(1100,Math.max(650,speed*30));
   const moving=speed>.2;
   const direction:Point=moving?[velocity[0]/speed,velocity[1]/speed]:[0,0];
   const ahead:Point=[position[0]+direction[0]*lookahead,position[1]+direction[1]*lookahead];
   if(covered(position)&&(!moving||covered(ahead))){if(status==='retrying')publish('ready');return;}
   const target:Point=[Math.round(ahead[0]/1000)*1000,Math.round(ahead[1]/1000)*1000];
   void request(target);
  },
  dispose(){disposed=true;inflight?.abort();inflight=null;},
 };
}
