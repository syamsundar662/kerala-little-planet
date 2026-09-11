import * as T from 'three';
import {WORLD_RADIUS as R,SEA_LEVEL,coastLatitude,isDryLand,roadOffset} from './world';
import type {Obstacle} from './vehicle-physics';
import type {Kit} from './kerala-props';

// Southern half of Little Kerala: five district set-pieces (temple precinct, fishing
// harbour, snake-boat shed, kettuvallam, church) plus discovery clutter. Landmarks are
// rebuilt from the shared prop Kit's PBR materials and detailed components (real homes,
// framed windows, doors, pillars, GLTF palms). Every site faces the nearest road, gets a
// worn-earth approach path, self-grounds on the sphere, pushes a compact road-clear
// obstacle and merges per-material through kit.finish(); only boats and flags move.
export function addSouthernDistricts(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number,kit:Kit):{landmarks:number;update(now:number):void;dispose():void}{
 const M=kit.mats,P=kit.pbr,UP=new T.Vector3(0,1,0),R2=R*R,SEA=R+SEA_LEVEL,clamp=T.MathUtils.clamp;
 const g0=(x:number,z:number)=>Math.sqrt(R2-x*x-z*z)-R;
 const normal=(t:number,l:number)=>new T.Vector3(Math.cos(t)*Math.cos(l),Math.sin(l),Math.sin(t)*Math.cos(l));
 const groups:T.Group[]=[];const boats:{g:T.Group;n:T.Vector3;r:number;ph:number}[]=[];const flags:{f:T.Object3D;ph:number}[]=[];
 let landmarkCount=0,houseIx=0;
 const plaster=(i:number)=>P.plaster[((i%P.plaster.length)+P.plaster.length)%P.plaster.length];
 const clear=(n:T.Vector3,extent:number)=>obstacles.every(o=>Math.acos(clamp(n.dot(o.normal),-1,1))*R>extent+(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.15);
 const pushBox=(n:T.Vector3,axis:T.Vector3,halfX:number,halfZ:number)=>{obstacles.push({normal:n.clone(),axis:axis.clone(),halfX,halfZ})};
 const pushRound=(n:T.Vector3,radius:number)=>{obstacles.push({normal:n.clone(),radius})};
 const anchor=(t:number,l:number,name:string,id:string,r=R)=>{const g=new T.Group();g.name=name;g.userData.districtId=id;const n=normal(t,l);g.position.copy(n).multiplyScalar(r);g.quaternion.setFromUnitVectors(UP,n);globe.add(g);groups.push(g);return g};
 // Orient a group so local +z points at the nearest road (like world-details tea shops).
 const face=(g:T.Group,t:number)=>{const n=g.position.clone().normalize(),front=normal(t,latitude(t)).sub(n).projectOnPlane(n).normalize(),right=new T.Vector3().crossVectors(n,front).normalize();g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,n,front));return{n,front,right}};
 const worldN=(g:T.Group,x:number,z:number)=>{g.updateWorldMatrix(true,false);return g.localToWorld(new T.Vector3(x,g0(x,z),z)).normalize()};
 const finish=(g:T.Group)=>kit.finish(g);
 // Worn-earth strip from a building's entrance toward the road, stopping ~.55 short of centre.
 const approach=(g:T.Group,t:number,frontZ:number,x=0,w=.32)=>{const D=g.position.clone().normalize().angleTo(normal(t,latitude(t)))*R,end=D-.55;if(end>frontZ+.06)kit.path(g,x,frontZ,x,end,w)};
 // 2-D site search: sweep an inland latitude band and a longitude window until a road-facing,
 // land, obstacle-free spot appears. offLo/offHi are latitude offsets from the road (×R = metres).
 const search=(bt:number,offLo:number,offHi:number,extent:number,minOff:number,tWin:number,latN:number,tN:number,coast:boolean)=>{
  for(let li=0;li<latN;li++){const off=offLo+(latN>1?li/(latN-1)*(offHi-offLo):0);
   for(let ti=0;ti<tN;ti++){const t=bt+(ti?(ti%2?1:-1)*Math.ceil(ti/2)*(tWin*2/tN):0),l=(coast?coastLatitude(t):latitude(t))+off;
    if(isDryLand(t,l)&&roadOffset(t,l)>=minOff&&clear(normal(t,l),extent))return{t,l}}}
  return null};
 const site=(bt:number,offLo:number,offHi:number,extent:number,minOff:number,name:string,id:string,tWin=.06,latN=1,tN=9,coast=false)=>{
  const r=search(bt,offLo,offHi,extent,minOff,tWin,latN,tN,coast);if(!r)return null;const g=anchor(r.t,r.l,name,id);return{g,t:r.t,l:r.l,...face(g,r.t)}};
 // Landmarks must always land so every district stays represented (verify: 14 landmarks).
 const landmarkSite=(bt:number,offLo:number,offHi:number,extent:number,minOff:number,name:string,id:string,tWin=.08,latN=3,tN=11,coast=false)=>{
  const r=search(bt,offLo,offHi,extent,minOff,tWin,latN,tN,coast),t=r?r.t:bt,l=r?r.l:((coast?coastLatitude(bt):latitude(bt))+offHi);
  const g=anchor(t,l,name,id);g.userData.landmark=true;landmarkCount++;return{g,t,l,...face(g,t)}};
 // Places a real detailed home; only pushes its footprint obstacle when the home's own centre
 // stays clear of every road (guards against branch-road curvature dipping below the .55 rule).
 const home=(g:T.Group,right:T.Vector3,x:number,z:number,ry=0)=>{const{halfX,halfZ}=kit.house(g,x,z,houseIx++,ry),c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry)),n=worldN(g,x,z);if(roadOffset(Math.atan2(n.z,n.x),Math.asin(clamp(n.y,-1,1)))>.6)pushBox(n,right,halfX*c+halfZ*s+.03,halfX*s+halfZ*c+.03)};
 const moorBoat=(t:number,l:number,len:number,paint:T.Material,name:string,id:string)=>{const g=anchor(t,l,name,id,SEA);const b=kit.boat(g,0,0,len,paint);b.traverse(o=>{if(o instanceof T.Mesh)o.userData.dyn=true});boats.push({g,n:g.position.clone().normalize(),r:SEA,ph:t*3});finish(g)};
 // Photoreal GLB mooring: a dyn wrapper (kept whole by finish) holds a length-normalised
 // fishing-boat/canoe clone at the local waterline; the whole group bobs on the swell.
 const moorGltf=(t:number,l:number,name:'fishing-boat'|'canoe',len:number,ry:number,label:string,id:string)=>{const g=anchor(t,l,label,id,SEA);const w=new T.Group();w.rotation.y=ry;w.userData.dyn=true;g.add(w);kit.gltf(name,w,0,0,len);boats.push({g,n:g.position.clone().normalize(),r:SEA,ph:t*3});finish(g)};
 // Temple pot-finial: gold pot, flared rim and spike.
 const kalasham=(g:T.Group,x:number,y:number,z:number,s:number)=>{kit.cyl(g,x,y+s*.35,z,s*.42,s*.6,s*.7,M.gold,8);kit.cyl(g,x,y+s*.78,z,s*.72,s*.42,s*.14,M.gold,8);kit.cone(g,x,y+s*1.12,z,s*.3,s*.5,M.gold,8)};
 const lighthouse=(bt:number,name:string,id:string)=>{const s=search(bt,.17,.17,.4,.75,.05,1,9,true);if(!s)return;const g=anchor(s.t,s.l,name,id);face(g,s.t);const n=g.position.clone().normalize();let y=0;for(let i=0;i<6;i++){kit.cyl(g,0,y+.07,0,.088-i*.007,.098-i*.007,.14,i%2?M.red:M.white,10);y+=.14}kit.cyl(g,0,y+.05,0,.11,.11,.1,M.white,10);kit.box(g,0,y+.11,0,.17,.02,.17,M.gold);kit.cone(g,0,y+.2,0,.13,.14,M.red,10);pushRound(n,.16);finish(g)};
 // Arched footbridge with plank deck and twin handrails; sits on the water, so no obstacle.
 const footbridge=(bt:number,name:string,id:string)=>{const g=anchor(bt,coastLatitude(bt)-.02,name,id,SEA);for(let i=-2;i<=2;i++){const p=kit.box(g,0,.12-Math.abs(i)*.02,i*.18,.34,.05,.2,P.woodPlank);p.rotation.x=i*.16}for(const s of[-.16,.16]){for(let i=-2;i<=2;i++)kit.cyl(g,s,.21-Math.abs(i)*.02,i*.18,.01,.01,.16,M.timber,5);const rail=kit.box(g,s,.28,0,.018,.018,.92,M.timber);rail.rotation.x=0}finish(g)};

 // 1 · THIRUVANANTHAPURAM — East Fort temple precinct, market lane, terminal, coastal lighthouse.
 {const id='thiruvananthapuram',t0=.7;
  const S=landmarkSite(t0,.19,.38,.9,1.75,'Thiruvananthapuram temple precinct',id,.10,8,13);
  {const{g,t,right,n}=S;const bw=1.3,bd=1.12;
   // Stone compound wall with coping, split at the front for a gate.
   for(const sz of[-1,1]){kit.box(g,0,g0(0,sz*bd/2)+.11,sz*bd/2,sz<0?bw:bw*.34,.22,.06,P.stone);if(sz>0)kit.box(g,-bw*.33,g0(0,bd/2)+.11,bd/2,bw*.34,.22,.06,P.stone);kit.box(g,0,g0(0,sz*bd/2)+.235,sz*bd/2,bw+.05,.03,.1,P.stone)}
   for(const sx of[-1,1]){kit.box(g,sx*bw/2,g0(sx*bw/2,0)+.11,0,.06,.22,bd,P.stone);kit.box(g,sx*bw/2,g0(sx*bw/2,0)+.235,0,.1,.03,bd+.05,P.stone)}
   // Gopuram: five shrinking trapezoidal tiers, niche rows, corner finials, then a barrel vault.
   let y=g0(0,0),w=.74,d=.5;
   for(let i=0;i<5;i++){const h=.2-i*.02;kit.box(g,0,y+h/2,-.05,w,h,d,plaster(i));
    for(let k=-2;k<=2;k++)kit.box(g,k*w*.17,y+h*.52,-.05+d/2+.008,w*.08,h*.52,.03,P.stone);
    for(const sx of[-1,1])for(const sz of[-1,1])kit.cone(g,sx*w*.44,y+h+.03,-.05+sz*d*.44,.028,.08,M.gold,6);
    y+=h;kit.box(g,0,y+.016,-.05,w+.06,.032,d+.06,P.roofTile);y+=.032;w*=.8;d*=.8}
   const rv=w*.52,Lz=d*1.15,vault=kit.cyl(g,0,y+.02+rv,-.05,rv,rv,Lz,P.roofTile,12);vault.rotation.x=Math.PI/2;
   for(let k=-2;k<=2;k++)kalasham(g,0,y+.02+rv*1.7,-.05+k*Lz*.32,.05);
   // Temple tank: three descending stone ghats around a recessed water slab.
   const tx=.52,tz=-.42,ty=g0(tx,tz);for(let s=0;s<3;s++){const w2=.52-s*.11;kit.box(g,tx,ty+.04-s*.045,tz,w2,.05,w2,P.stone)}kit.box(g,tx,ty-.08,tz,.26,.02,.26,M.water);
   // Oil-lamp posts flank the gate; approach path down the entrance axis.
   for(const sx of[-1,1])kit.lamp(g,sx*.28,bd/2+.14);
   kit.signboard(g,.62,.3,.5,'Sree Temple','ക്ഷേത്രം');
   pushBox(n,right,.52,.46);approach(g,t,bd/2+.16);finish(g);
   const fg=anchor(t,S.l+.1,'Thiruvananthapuram flag',id);face(fg,t);kit.cyl(fg,0,g0(0,0)+.3,0,.012,.016,.6,M.darkTimber,6);const flag=new T.Mesh(new T.BoxGeometry(.2,.12,.008),M.red);flag.castShadow=flag.receiveShadow=true;flag.position.set(.1,g0(0,0)+.52,0);flag.userData.animated=true;fg.add(flag);flags.push({f:flag,ph:t*3});finish(fg);
  }
  const Mk=site(t0-.16,.18,.38,.5,1.8,'East Fort market street',id,.12,8,13);
  if(Mk){const{g,right,n,t}=Mk;kit.path(g,0,-.62,0,.72,.34);const aw=[M.red,M.blue,M.green,M.gold,M.tile];
   const stall=(x:number,z:number,rot:number,m:T.Material)=>{const s=new T.Group();s.position.set(x,g0(x,z),z);s.rotation.y=rot;g.add(s);kit.shopStall(s,0,0,m)};
   for(let i=0;i<3;i++){const z=-.4+i*.4;stall(-.42,z,Math.PI/2,aw[i]);stall(.42,z,-Math.PI/2,aw[(i+2)%5]);
    for(let k=0;k<3;k++)kit.box(g,-.22+(k-1)*.045,g0(0,z)+.15,z,.03,.09,.03,M.gold);// banana bunches
    for(let k=0;k<2;k++)kit.box(g,.2,g0(0,z)+.05+k*.05,z,.11,.05,.15,[M.red,M.blue][k]);// textile bolts
   }
   kit.signboard(g,0,.3,.82,'East Fort','കിഴക്കേകോട്ട');pushBox(n,right,.46,.42);approach(g,t,.82,0,.34);finish(g)}
  const Tm=site(t0+.14,-.16,-.34,.45,1.4,'Thiruvananthapuram bus terminal',id,.12,7,13);
  if(Tm){const{g,right,n,t}=Tm;kit.roof(g,0,g0(0,0)+.34,0,.98,.55,.14,P.metalRoof);for(const x of[-.44,.44])for(const z of[-.22,.22])kit.pillar(g,x,g0(x,z),z,.34);kit.box(g,0,g0(0,-.24)+.17,-.24,.98,.34,.05,P.plaster[0]);kit.signboard(g,.54,.24,.3,'KSRTC','കെഎസ്ആർടിസി');pushBox(n,right,.52,.32);approach(g,t,.3);finish(g)}
  lighthouse(t0-.14,'Thiruvananthapuram lighthouse',id);
  const H=site(t0+.26,.20,.40,.5,1.9,'Thiruvananthapuram houses',id,.12,8,13);
  if(H){const{g,right,t}=H;home(g,right,-.5,0);home(g,right,.1,-.02);home(g,right,.66,-.06);kit.gltf('palm',g,-.82,-.35,1);kit.gltf('tree',g,.88,-.4,.9);approach(g,t,.5,-.5,.3);finish(g)}
 }

 // 2 · KOLLAM — Ashtamudi fishing harbour, footbridge, waterfront workshop, houses.
 {const id='kollam',t0=1.148799;
  const S=landmarkSite(t0,.16,.24,.95,.62,'Ashtamudi fishing harbour',id,.08,4,11,true);
  {const{g,right,n,t}=S;const wy=g0(0,-.15);
   // Cashew warehouse: laterite walls, metal roof, barred windows, door and signboard.
   kit.box(g,0,wy+.24,-.15,1.05,.48,.62,P.laterite);kit.roof(g,0,wy+.48,-.15,1.15,.7,.18,P.metalRoof);
   for(const x of[-.34,.34])kit.window(g,x,wy+.3,.17,.15);kit.door(g,0,wy,.17,.36);
   kit.signboard(g,0,.42,.62,'Cashew Store','കശുവണ്ടി');
   // Jetty: individually visible planks with gaps, on angled timber piles, over the water (-z).
   for(let i=-3;i<=3;i++)kit.box(g,i*.13,g0(i*.13,-.62)+.14,-.62,.1,.03,.9,M.timber);
   for(const x of[-.36,.36])for(let z=-.95;z<=-.28;z+=.34){const p=kit.cyl(g,x,.07,z,.02,.026,.32,M.darkTimber,5);p.rotation.x=.14}
   // Net-drying racks with thin dark net planes.
   for(const x of[.38,.58]){for(let j=0;j<3;j++)kit.cyl(g,x,g0(x,.24)+.24,.24,.015,.015,.42,M.darkTimber,5);kit.box(g,x,g0(x,.24)+.42,.24,.02,.008,.42,M.darkTimber)}
   kit.box(g,.48,g0(.48,.24)+.44,.24,.2,.006,.42,M.darkTimber);
   // Ice and crate stacks.
   for(let j=0;j<4;j++)kit.box(g,-.55+j%2*.16,g0(-.55,.4)+.06+Math.floor(j/2)*.12,.4,.14,.11,.14,j%2?M.white:M.timber);
   pushBox(n,right,.5,.36);approach(g,t,.4,0,.32);finish(g)}
  moorBoat(t0-.03,coastLatitude(t0)-.03,.5,M.blue,'Ashtamudi moored boat',id);
  moorGltf(t0,coastLatitude(t0)-.03,'fishing-boat',.6,.45,'Ashtamudi moored boat',id);
  moorGltf(t0+.03,coastLatitude(t0)-.035,'fishing-boat',.6,-.7,'Ashtamudi moored boat',id);
  footbridge(t0-.09,'Kollam shore footbridge',id);
  const W=site(t0-.16,.19,.34,.45,.90,'Kollam waterfront workshop',id,.12,6,13,true);
  if(W){const{g,right,n,t}=W;kit.box(g,0,g0(0,0)+.19,0,.6,.38,.5,P.laterite);kit.roof(g,0,g0(0,0)+.38,0,.68,.58,.14,P.roofTile);kit.window(g,0,g0(0,.26)+.24,.26,.16);pushBox(n,right,.34,.3);approach(g,t,.3);finish(g)}
  const H=site(t0+.16,.20,.40,.5,1.85,'Kollam houses',id,.12,8,13);
  if(H){const{g,right,t}=H;home(g,right,-.34,0);home(g,right,.42,-.02);kit.gltf('palm',g,-.78,-.3,1);kit.palm(g,.82,-.32);approach(g,t,.5,-.34,.3);finish(g)}
 }

 // 3 · PATHANAMTHITTA — Aranmula snake-boat shed, mirror workshop, riverside pavilion, grove.
 // Relaxed placement (wide t-window + deep inland band) so all four groups land inland of the road.
 {const id='pathanamthitta',t0=1.597598;
  const S=landmarkSite(t0,.18,.38,1.0,1.6,'Aranmula snake-boat shed',id,.19,8,16);
  {const{g,right,n,t}=S;
   // Open-sided shed on six timber pillars with a broad tiled roof.
   for(const x of[-.42,.42])for(const z of[-.44,0,.44])kit.pillar(g,x,g0(x,z),z,.5);
   kit.roof(g,0,g0(0,0)+.5,0,1.0,1.15,.22,P.roofTile);
   // Chundan vallam: very long, low black hull; stern sweeps up in three angled segments.
   const hull=kit.boat(g,0,.02,1.08,M.darkTimber);hull.scale.set(1,.7,1.05);
   let sy=g0(0,-.6)+.24,sz=-.6,ang=.5;for(let s=0;s<3;s++){const seg=kit.box(g,0,sy,sz,.07,.3,.11,M.darkTimber);seg.rotation.x=-ang;sy+=Math.cos(ang)*.24;sz-=Math.sin(ang)*.16;ang+=.35}
   kit.cone(g,0,sy+.02,sz,.06,.15,M.darkTimber,8);const disc=kit.cyl(g,0,sy-.06,sz+.05,.05,.05,.02,M.gold,10);disc.rotation.x=Math.PI/2;// brass crest disc
   // Oar rack along the rear wall.
   for(let k=0;k<6;k++){const o=kit.cyl(g,-.55+k*.04,g0(0,.66)+.32,.66,.01,.01,.72,M.timber,4);o.rotation.z=.12}
   kit.signboard(g,.55,.3,.62,'Aranmula','ആറന്മുള');pushBox(n,right,.5,.45);approach(g,t,.55,0,.32);finish(g)}
  const Mw=site(t0,.18,.46,.65,1.5,'Aranmula mirror workshop',id,.19,10,16);
  if(Mw){const{g,right,n,t}=Mw;kit.box(g,0,g0(0,0)+.17,0,.44,.34,.42,P.woodPlank);kit.roof(g,0,g0(0,0)+.34,0,.5,.5,.12,P.roofTile);
   const mir=kit.cyl(g,0,g0(0,.22)+.2,.22,.11,.11,.02,M.gold,16);mir.rotation.x=Math.PI/2;kit.cyl(g,0,g0(0,.22)+.2,.215,.14,.14,.015,M.darkTimber,16).rotation.x=Math.PI/2;
   kit.window(g,-.16,g0(-.16,.21)+.3,.21,.12);pushBox(n,right,.29,.26);approach(g,t,.3);finish(g)}
  const Pv=site(t0,.16,.44,.7,1.3,'Aranmula riverside pavilion',id,.19,12,18);
  if(Pv){const{g,right,n,t}=Pv;for(const x of[-.26,.26])for(const z of[-.26,.26])kit.pillar(g,x,g0(x,z),z,.4);kit.roof(g,0,g0(0,0)+.4,0,.66,.66,.16,P.roofTile);for(let i=0;i<3;i++)kit.box(g,0,g0(0,.36+i*.12)+.04+i*.05,.36+i*.12,.56,.05,.12,P.stone);pushBox(n,right,.34,.32);approach(g,t,.44);finish(g)}
  const Gr=site(t0,.19,.46,.8,1.55,'Pathanamthitta grove',id,.19,10,16);
  if(Gr){const{g,right,t}=Gr;home(g,right,-.42,0);home(g,right,.46,-.02);for(const[px,pz,k]of[[-.78,-.15,0],[0,-.45,1],[.82,-.2,0],[-.22,.5,1]]as[number,number,number][])kit.gltf(k?'tree':'palm',g,px,pz,.9);approach(g,t,.5,-.42,.3);finish(g)}
 }

 // 4 · ALAPPUZHA — kettuvallam houseboat offshore, coir workshop, canal footbridge, houses.
 {const id='alappuzha',t0=2.046397;
  {const g=anchor(t0,coastLatitude(t0)-.04,'Alappuzha kettuvallam houseboat',id,SEA);g.userData.landmark=true;landmarkCount++;
   const hull=kit.boat(g,0,0,1.6,P.woodPlank);hull.scale.set(1,.92,1.05);
   // Canopy: three thatch-covered arched hoops with longitudinal cross-lath strips.
   for(let i=-1;i<=1;i++){const hoop=kit.cyl(g,0,.2,i*.42,.17,.17,.46,P.thatch,12);hoop.rotation.z=Math.PI/2}
   for(const x of[-.12,0,.12])kit.box(g,x,.37,0,.018,.01,.98,M.timber);
   // Open mid-section with railing along both sides.
   for(const s of[-1,1]){for(let z=-.4;z<=.4;z+=.2)kit.cyl(g,s*.18,.1,z,.008,.008,.12,M.timber,4);kit.box(g,s*.18,.16,0,.012,.012,.9,M.timber)}
   // Small rear steering platform with a tiller.
   kit.box(g,0,.14,.72,.34,.04,.18,P.woodPlank);const till=kit.cyl(g,.06,.22,.78,.008,.01,.22,M.darkTimber,5);till.rotation.x=.4;
   g.traverse(o=>{if(o instanceof T.Mesh)o.userData.dyn=true});boats.push({g,n:g.position.clone().normalize(),r:SEA,ph:t0*3});finish(g)}
  moorGltf(t0+.05,coastLatitude(t0)-.02,'canoe',.45,.8,'Alappuzha canoe',id);
  const Co=site(t0-.14,.18,.24,.45,.62,'Alappuzha coir workshop',id,.1,2,11,true);
  if(Co){const{g,right,n,t}=Co;kit.roof(g,0,g0(0,0)+.34,0,.92,.62,.14,P.thatch);for(const x of[-.4,.4])for(const z of[-.24,.24])kit.pillar(g,x,g0(x,z),z,.34);
   // Spinning-wheel hint: an upright spoked disc on a low frame.
   const wheel=kit.cyl(g,-.28,g0(-.28,0)+.18,0,.12,.12,.02,M.timber,10);wheel.rotation.y=Math.PI/2;for(let k=0;k<4;k++){const sp=kit.box(g,-.27,g0(-.28,0)+.18,0,.02,.2,.02,M.timber);sp.rotation.x=k*Math.PI/4}
   // Coir rope coils.
   for(const[cx,cz]of[[.15,-.28],[.4,-.28],[.28,.28]]as[number,number][]){const coil=kit.cyl(g,cx,g0(cx,cz)+.05,cz,.09,.11,.06,M.clay,10)}
   kit.signboard(g,0,.24,.66,'Coir','കയർ');pushBox(n,right,.5,.34);approach(g,t,.35);finish(g)}
  footbridge(t0+.08,'Alappuzha canal footbridge',id);
  lighthouse(t0-.1,'Alappuzha lighthouse',id);
  const H=site(t0+.16,.18,.24,.5,.62,'Alappuzha waterside houses',id,.1,2,11,true);
  if(H){const{g,right,t}=H;home(g,right,-.55,0);home(g,right,.5,-.02);kit.gltf('palm',g,-.95,-.3,1);kit.palm(g,1.0,-.3);approach(g,t,.5,-.55,.3);finish(g)}
 }

 // 5 · KOTTAYAM — white church, town bookshop street, rubber plantation, Kumarakom inn, houses.
 {const id='kottayam',t0=2.495196;
  const S=landmarkSite(t0,.19,.40,.95,1.75,'Kottayam church',id,.10,8,13);
  {const{g,right,n,t}=S;const gy=g0(0,0),fz=.4;
   kit.box(g,0,gy+.3,-.15,.72,.6,.98,plaster(0));kit.roof(g,0,gy+.6,-.15,.82,1.02,.24,P.roofTile);
   kit.box(g,0,gy+.42,fz,.62,.84,.16,plaster(1));
   // Quoin trim: stone blocks up both facade corners.
   for(const sx of[-1,1])for(let k=0;k<5;k++)kit.box(g,sx*.3,gy+.12+k*.17,fz+.02,.06,.11,.18,P.stone);
   // Arched door with a rounded stone arch above.
   kit.door(g,0,gy,fz+.02,.36);const arch=kit.cyl(g,0,gy+.36,fz+.02,.12,.12,.17,P.stone,12);arch.rotation.x=Math.PI/2;
   // Rose window.
   const rose=kit.cyl(g,0,gy+.6,fz+.03,.09,.09,.03,P.stone,14);rose.rotation.x=Math.PI/2;kit.cyl(g,0,gy+.6,fz+.05,.06,.06,.02,M.blue,14).rotation.x=Math.PI/2;
   // Stepped gable crowned with a cross.
   for(let k=0;k<3;k++)kit.box(g,0,gy+.86+k*.07,fz,.46-k*.15,.07,.16,plaster(1));kit.box(g,0,gy+1.12,fz,.03,.18,.04,M.white);kit.box(g,0,gy+1.18,fz,.13,.03,.04,M.white);
   // Bell hung in a small bell arch above the facade.
   for(const sx of[-1,1])kit.cyl(g,sx*.08,gy+.98,fz-.03,.012,.012,.16,P.stone,5);kit.box(g,0,gy+1.06,fz-.03,.24,.03,.06,P.stone);kit.cyl(g,0,gy+.98,fz-.03,.03,.045,.07,M.gold,8);
   // Side windows on rotated wall subgroups.
   for(const sx of[-1,1]){const wall=new T.Group();wall.position.set(sx*.36,0,-.15);wall.rotation.y=sx*Math.PI/2;g.add(wall);for(const z of[-.32,.14])kit.window(wall,z,gy+.42,0,.14)}
   // Low wall with gate posts across the front.
   for(const sx of[-1,1]){kit.box(g,sx*.45,g0(sx*.45,.56)+.1,.56,.36,.2,.05,P.stone);kit.box(g,sx*.26,g0(.26,.56)+.17,.56,.08,.34,.08,P.stone)}
   kit.signboard(g,.66,.3,.62,'St Church','പള്ളി');pushBox(n,right,.52,.46);approach(g,t,.72,0,.34);finish(g)}
  const St=site(t0-.16,.17,.34,.5,1.4,'Kottayam town street',id,.12,7,13);
  if(St){const{g,right,n,t}=St;const stall=(x:number,m:T.Material)=>{kit.shopStall(g,x,0,m);for(let k=0;k<4;k++)kit.box(g,x-.1+k%2*.12,g0(x,.18)+.07+Math.floor(k/2)*.055,.18,.1,.05,.12,[M.red,M.blue,M.green,M.gold][k])};
   stall(-.35,M.red);stall(.35,M.blue);kit.signboard(g,0,.3,.5,'Books','പുസ്തകങ്ങൾ');pushBox(n,right,.6,.34);approach(g,t,.5);finish(g)}
  const Rp=site(t0+.15,.18,.36,.55,1.55,'Kottayam rubber plantation',id,.12,7,13);
  if(Rp){const{g,t,right}=Rp;for(let r=0;r<2;r++)for(let c=0;c<7;c++){const x=-.72+c*.24,z=-.3+r*.55,y=g0(x,z);kit.cyl(g,x,y+.3,z,.028,.042,.6,M.timber,6);kit.box(g,x+.045,y+.2,z,.04,.05,.03,M.white);kit.cone(g,x,y+.74,z,.16,.28,M.leaf,7)}approach(g,t,.6,-.6,.3);finish(g)}
  const In=site(t0+.28,.18,.32,.5,.90,'Kumarakom waterside inn',id,.12,6,13,true);
  if(In){const{g,right,t}=In;home(g,right,0,0);home(g,right,-.72,0);kit.gltf('palm',g,.78,-.2,1);kit.palm(g,-.88,-.25);approach(g,t,.5,0,.3);finish(g)}
  const H=site(t0-.26,.20,.40,.5,1.85,'Kottayam houses',id,.12,8,13);
  if(H){const{g,right,t}=H;home(g,right,-.34,0);home(g,right,.42,-.02);kit.gltf('tree',g,-.78,-.3,.9);approach(g,t,.5,-.34,.3);finish(g)}
 }

 return {landmarks:landmarkCount,
  update(now:number){const s=now*.001;for(const b of boats)b.g.position.copy(b.n).multiplyScalar(b.r+Math.sin(s*1.4+b.ph)*.014);for(const fl of flags){fl.f.rotation.z=Math.sin(s*2.2+fl.ph)*.28;fl.f.rotation.y=Math.sin(s*3.1+fl.ph)*.4}},
  dispose(){for(const g of groups)globe.remove(g)}};
}
