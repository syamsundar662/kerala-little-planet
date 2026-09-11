import * as T from 'three';
import {WORLD_RADIUS as R,SEA_LEVEL,coastLatitude,isDryLand,roadOffset} from './world';
import type {Obstacle} from './vehicle-physics';
import type {Kit} from './kerala-props';

// Five northern districts (Malappuram → Kasaragod). Each site self-grounds on the
// curved planet, faces the nearest road, merges to a handful of draws via kit.finish,
// and pushes its own solid footprint as an Obstacle (centre always roadOffset>0.55).
// Detailed homes/vegetation come from the shared Kit; only flags and boats move.
export function addNorthernDistricts(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number,kit:Kit){
 const M=kit.mats,P=kit.pbr;
 const groups:T.Group[]=[];
 const reserved:Obstacle[]=[];
 const flags:{pivot:T.Object3D;phase:number}[]=[];
 const boats:{g:T.Object3D;y0:number;phase:number}[]=[];
 const localMats:T.Material[]=[],localTex:T.Texture[]=[],localGeo:T.BufferGeometry[]=[];
 let landmarks=0;
 const normal=(t:number,l:number)=>new T.Vector3(Math.cos(t)*Math.cos(l),Math.sin(l),Math.sin(t)*Math.cos(l));
 const gy=(x:number,z:number)=>Math.sqrt(R*R-x*x-z*z)-R;
 const clear=(n:T.Vector3,extent:number)=>[...obstacles,...reserved].every(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*R>extent+(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.15);
 const worldNormal=(g:T.Object3D,x:number,z:number)=>new T.Vector3(x,gy(x,z),z).applyQuaternion(g.quaternion).add(g.position).normalize();
 const pushBox=(g:T.Object3D,x:number,z:number,hX:number,hZ:number,right:T.Vector3)=>obstacles.push({normal:worldNormal(g,x,z),axis:right.clone(),halfX:hX,halfZ:hZ});
 const pushRound=(g:T.Object3D,x:number,z:number,r:number)=>obstacles.push({normal:worldNormal(g,x,z),radius:r});
 const blob=(g:T.Object3D,x:number,y:number,z:number,r:number,m:T.Material)=>{const s=new T.Mesh(new T.SphereGeometry(r,7,5),m);s.position.set(x,y,z);s.castShadow=s.receiveShadow=true;g.add(s);return s;};
 const dome=(g:T.Object3D,x:number,y:number,z:number,r:number,m:T.Material,sx=1,sy=1)=>{const d=new T.Mesh(new T.SphereGeometry(r,12,8,0,Math.PI*2,0,Math.PI/2),m);d.position.set(x,y,z);d.scale.set(sx,sy,sx);d.castShadow=d.receiveShadow=true;g.add(d);return d;};
 const swayFlag=(g:T.Object3D,x:number,z:number,h:number,m:T.Material,phase:number)=>{const y=gy(x,z);kit.cyl(g,x,y+h/2,z,.008,.011,h,M.timber,5);const p=new T.Group();p.position.set(x,y+h,z);const f=kit.box(p,.08,-.02,0,.16,.1,.006,m);(f as any).userData.dyn=true;p.userData.dyn=true;g.add(p);flags.push({pivot:p,phase});};
 // Paved walkway from a group's entrance toward the road, stopping ~.55 short of centre.
 const pathToRoad=(g:T.Object3D,off:number,frontZ:number,w=.34)=>{const zEnd=Math.min(off-.55,frontZ+1.0);if(zEnd>frontZ+.12)kit.path(g,0,frontZ,0,zEnd,w);};
 // Semicircular aureole display (radial red/gold stripe canvas), abstract — no figure.
 const aureole=(g:T.Object3D,x:number,y:number,z:number,r:number)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
  for(let i=0;i<24;i++){c.fillStyle=i%2?'#d4af37':'#b23a2e';c.beginPath();c.moveTo(128,256);c.arc(128,256,248,Math.PI+i/24*Math.PI,Math.PI+(i+1)/24*Math.PI);c.closePath();c.fill();}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;localTex.push(tex);
  const geo=new T.CircleGeometry(r,28,0,Math.PI);localGeo.push(geo);
  const mat=new T.MeshStandardMaterial({map:tex,roughness:.85,side:T.DoubleSide});localMats.push(mat);
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);
 };

 type Build=(g:T.Group,t:number,n:T.Vector3,fwd:T.Vector3,right:T.Vector3,off:number)=>void;
 // Land site: nudges longitude/latitude until it clears road, obstacles and prior sites.
 // Hill sites sweep latitude 0.30..0.68 directly across the full ±0.19 longitude window.
 // Footprint road-clearance: sample the site's bounding rectangle (±fx along the road,
 // ±fz across it) and demand every sampled point stays >=ROADSAFE from ALL three routes.
 // This catches wide/deep structures whose merged per-material bounding boxes throw phantom
 // corners toward the north/south branch roads even when the pushed centre clears route 0.
 const ROADSAFE=.68;
 const roadClearRect=(n:T.Vector3,fwd:T.Vector3,right:T.Vector3,fx:number,fz:number)=>{
  if(fx<=0&&fz<=0)return true;
  const base=n.clone().multiplyScalar(R);
  for(const sx of[-1,-.5,0,.5,1])for(const sz of[-1,-.5,0,.5,1]){
   const p=base.clone().addScaledVector(right,sx*fx).addScaledVector(fwd,sz*fz).normalize();
   if(roadOffset(Math.atan2(p.z,p.x),Math.asin(T.MathUtils.clamp(p.y,-1,1)))<ROADSAFE)return false;
  }
  return true;
 };
 const landSite=(id:string,name:string,t0:number,minOff:number,extent:number,reserve:number,landmark:boolean,build:Build,opt:{hill?:boolean;coast?:boolean;fx?:number;fz?:number}={})=>{
  const hill=!!opt.hill,coast=!!opt.coast,fx=opt.fx??0,fz=opt.fz??0;
  const lonSteps=hill?42:33,latSteps=hill?22:16,lonStep=hill?.012:.009;
  for(let a=0;a<lonSteps;a++){
   const t=t0+((a%2?1:-1)*Math.ceil(a/2)*lonStep);
   if(Math.abs(t-t0)>.26)continue;
   for(let d=0;d<latSteps;d++){
    const l=hill?.28+d/(latSteps-1)*.44:(coast?coastLatitude(t)+.16:latitude(t))+(minOff/R+.05+d*.06);
    if(!isDryLand(t,l))continue;
    const off=roadOffset(t,l);if(off<minOff)continue;
    const n=normal(t,l);if(!clear(n,extent))continue;
    const fwd=normal(t,latitude(t)).sub(n).projectOnPlane(n).normalize();
    const right=new T.Vector3().crossVectors(n,fwd);
    if(!roadClearRect(n,fwd,right,fx,fz))continue;
    const g=new T.Group();g.name=name;g.userData.districtId=id;if(landmark){g.userData.landmark=true;landmarks++;}
    g.position.copy(n).multiplyScalar(R);
    g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,n,fwd));
    globe.add(g);groups.push(g);
    build(g,t,n,fwd,right,off);
    reserved.push({normal:n,radius:reserve});kit.finish(g);return true;
   }
  }
  return false;
 };
 // Sea site: anchored just off the shore at sea level; never blocks the bus.
 const seaSite=(id:string,name:string,t0:number,lOff:number,build:(g:T.Group)=>void)=>{
  const t=t0,l=coastLatitude(t)+lOff,n=normal(t,l);
  const g=new T.Group();g.name=name;g.userData.districtId=id;
  g.position.copy(n).multiplyScalar(R+SEA_LEVEL);
  const fwd=normal(t,latitude(t)).sub(n).projectOnPlane(n).normalize();
  const right=new T.Vector3().crossVectors(n,fwd);
  g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,n,fwd));
  globe.add(g);groups.push(g);build(g);kit.finish(g);return g;
 };
 // Photoreal GLB boat: a dyn wrapper (kept whole by finish, so it bobs and never merges)
 // holds a length-normalised fishing-boat/canoe clone grounded at the local waterline.
 const gltfBoat=(g:T.Object3D,name:'fishing-boat'|'canoe',x:number,z:number,len:number,phase:number,ry=0)=>{const w=new T.Group();w.position.set(x,gy(x,z),z);w.rotation.y=ry;w.userData.dyn=true;g.add(w);kit.gltf(name,w,0,0,len);boats.push({g:w,y0:w.position.y,phase});};
 const home=(g:T.Group,x:number,z:number,index:number,right:T.Vector3,ry=0)=>{const e=kit.house(g,x,z,index,ry);pushBox(g,x,z,e.halfX,e.halfZ,right);};

 // ── 1 · MALAPPURAM · Kondotty mosque (Kerala-gabled), market street, river crossing ──
 landSite('malappuram','Kondotty mosque',4.739191,1.2,.94,.55,true,(g,t,n,fwd,right,off)=>{
  const W=P.plaster[0],y=gy(0,-.12);
  // Prayer hall + clerestory under twin gabled tiled roofs (Kerala mosque, not onion-domed).
  kit.box(g,0,y+.30,-.12,1.0,.60,.8,W);
  kit.box(g,0,y+.74,-.12,.6,.3,.5,W);
  kit.roof(g,0,y+.60,-.12,1.06,.84,.34,P.roofTile);
  kit.roof(g,0,y+.90,-.12,.64,.54,.24,P.roofTile);
  // Rows of arched windows down both plastered side walls; clerestory windows to the front.
  for(const s of[-1,1]){const wall=new T.Group();wall.position.set(s*.5,0,-.12);wall.rotation.y=s*Math.PI/2;g.add(wall);for(const wz of[-.26,0,.26])kit.window(wall,wz,y+.30,0,.13);}
  for(const wx of[-.18,.18])kit.window(g,wx,y+.74,.12,.12);
  // Arcaded entrance porch (3 arches on 4 pillars) with a modest green dome, facing the road.
  kit.box(g,0,gy(0,.5)+.03,.5,.94,.06,.34,P.stone);
  for(const px of[-.4,-.13,.13,.4])kit.pillar(g,px,gy(px,.6),.6,.34);
  kit.box(g,0,gy(0,.6)+.36,.6,.9,.06,.08,W);
  kit.roof(g,0,gy(0,.53)+.44,.53,.98,.4,.16,P.roofTile);
  dome(g,0,gy(0,.53)+.46,.53,.13,M.teaGreen,1,.66);
  // Slender minaret with balcony ring + small dome cap.
  const mx=-.66,mz=-.34,my=gy(mx,mz);
  kit.cyl(g,mx,my+.6,mz,.05,.062,1.2,P.plaster[0],10);
  kit.cyl(g,mx,my+1.0,mz,.085,.085,.05,P.plaster[0],12);
  dome(g,mx,my+1.22,mz,.075,P.plaster[0],1,.85);
  kit.cone(g,mx,my+1.36,mz,.026,.09,M.gold,6);
  // Compound wall with an arched gate, flanking lamps.
  for(const x of[-.72,.72])kit.box(g,x,gy(x,.6)+.1,.6,.46,.2,.05,P.laterite);
  for(const x of[-.17,.17])kit.box(g,x,gy(x,.6)+.17,.6,.06,.34,.06,P.laterite);
  kit.box(g,0,gy(0,.6)+.32,.6,.42,.06,.06,P.laterite);
  kit.lamp(g,-.72,.66);kit.lamp(g,.72,.66);
  kit.gltf('tree',g,.94,-.5,1.1);kit.gltf('tree',g,-1.0,-.55,1.1);
  kit.signboard(g,.5,.2,.66,'Kondotty','കൊണ്ടോട്ടി');
  pathToRoad(g,off,.5,.42);
  pushBox(g,0,-.12,.5,.4,right);pushRound(g,mx,mz,.09);
 },{fx:.98,fz:.76});
 landSite('malappuram','Kondotty market street',4.739191-.13,.88,.6,.4,false,(g,t,n,fwd,right,off)=>{
  // Two stall rows facing a central lane, awnings varied, goods stacked, hanging bunches.
  kit.path(g,0,-.5,0,Math.min(off-.55,.4),.42);
  const aw=[M.red,M.gold,M.green];
  for(const side of[-.3,.3]){const row=new T.Group();row.position.set(side,0,.02);row.rotation.y=side<0?Math.PI/2:-Math.PI/2;g.add(row);
   for(let i=0;i<3;i++)kit.shopStall(row,0,-.34+i*.34,aw[(i+(side<0?0:1))%3]);
   for(let i=0;i<3;i++)kit.box(row,.14,gy(0,0)+.05,-.3+i*.32,.08,.1,.08,M.sand);
   for(const bz of[-.2,.22])blob(row,.05,gy(0,bz)+.34,bz,.05,M.green);
  }
  kit.signboard(g,0,.2,-.45,'Market','ചന്ത');
  // A detailed landmark + moving ferry leave no draw budget for a kept kit.house here,
  // so the market homes use the (now PBR-textured) merged tiledHouse.
  kit.tiledHouse(g,-.6,-.42,.46,.32,.42);pushBox(g,-.6,-.42,.29,.24,right);
  kit.tiledHouse(g,.62,-.42,.46,.32,.42);pushBox(g,.62,-.42,.29,.24,right);
  pushBox(g,0,0,.42,.2,right);
 },{fx:.92,fz:.66});
 seaSite('malappuram','Kondotty river crossing',4.739191+.05,-.03,(g)=>{
  kit.box(g,0,.12,0,.34,.03,1.25,P.woodPlank);
  for(let i=-2;i<=2;i++)kit.box(g,0,.135,i*.28,.34,.006,.05,M.darkTimber);
  for(let z=-.5;z<=.5;z+=.25)for(const x of[-.14,.14])kit.cyl(g,x,.02,z,.02,.025,.2,M.darkTimber,5);
  for(const x of[-.17,.17]){kit.box(g,x,.19,0,.02,.09,1.25,M.timber);for(let z=-.5;z<=.5;z+=.25)kit.cyl(g,x,.16,z,.01,.01,.09,M.timber,4);}
  gltfBoat(g,'canoe',.55,.4,.45,1.3,.6);
 });

 // ── 2 · KOZHIKODE · Beypore uru slipway, beach promenade, warehouses ──────────────
 landSite('kozhikode','Beypore uru slipway',5.187990,1.0,.95,.5,true,(g,t,n,fwd,right,off)=>{
  const yb=gy(0,0),L=1.55;
  // Slipway rails on sleepers running to the sea; the half-built hull rests on timber shores.
  kit.box(g,0,yb+.005,-.55,1.15,.02,1.1,M.sand);
  for(const s of[-.2,.2])kit.box(g,s,gy(s,-.6)+.04,-.6,.05,.05,1.5,M.darkTimber);
  for(let i=0;i<7;i++){const z=-1.3+i*.24;kit.box(g,0,gy(0,z)+.02,z,.62,.03,.06,M.darkTimber);}
  // The uru itself is the real scanned wooden hull (photoreal PBR GLB), bow along the slipway.
  const cradle=new T.Group();cradle.position.y=yb+.06;cradle.rotation.y=Math.PI/2;g.add(cradle);
  kit.gltf('fishing-boat',cradle,0,0,L*.9);
  // Timber shores leaning against the hull flanks.
  for(const s of[-1,1])for(const z of[-.5,.1,.6]){const p=kit.cyl(g,s*.28,gy(s*.28,z)+.15,z,.025,.03,.36,M.darkTimber,5);p.rotation.z=s*.62;}
  // Scaffold with platforms + ladders both sides.
  for(const s of[-1,1]){const sx=s*.5;
   for(const z of[-.5,.5])kit.cyl(g,sx,gy(sx,z)+.32,z,.02,.024,.64,M.timber,5);
   kit.box(g,sx,gy(sx,0)+.6,0,.06,.03,1.1,M.timber);
   kit.box(g,sx,gy(sx,0)+.62,0,.2,.02,1.0,P.woodPlank);
   const lad=new T.Group();lad.position.set(sx-s*.13,gy(sx,-.35)+.05,-.35);lad.rotation.x=.2;g.add(lad);
   for(let r=0;r<5;r++)kit.box(lad,0,.06+r*.11,0,.16,.014,.02,M.timber);
   for(const lx of[-.07,.07])kit.cyl(lad,lx,.3,0,.012,.012,.58,M.timber,4);
  }
  // Log piles + saw bench.
  for(let i=0;i<3;i++)kit.cyl(g,-.9,gy(-.9,-.4)+.06+i*.09,-.4,.05,.05,.5,M.timber,6).rotation.z=Math.PI/2;
  for(let i=0;i<2;i++)kit.cyl(g,-.9,gy(-.9,-.62)+.06+i*.09,-.62,.05,.05,.5,M.timber,6).rotation.z=Math.PI/2;
  kit.box(g,.85,gy(.85,-.35)+.14,-.35,.42,.04,.16,M.timber);
  for(const x of[.68,1.02])for(const z of[-.42,-.28])kit.cyl(g,x,gy(x,z)+.07,z,.015,.02,.14,M.darkTimber,4);
  kit.gltf('palm',g,1.05,.45);kit.gltf('palm',g,-1.05,.3);
  kit.signboard(g,.55,.2,.8,'Beypore','ബേപ്പൂർ');
  pathToRoad(g,off,.55,.4);
  pushRound(g,0,0,.85);
 },{coast:true});
 seaSite('kozhikode','Kozhikode beach promenade',5.187990-.08,-.02,(g)=>{
  // Sea wall + coping, paved promenade walk, food stalls, a pier on cross-braced piles.
  kit.box(g,0,.1,-.05,1.6,.16,.08,P.stone);
  kit.box(g,0,.19,-.05,1.66,.04,.11,P.stone);
  kit.path(g,-.7,.12,.7,.12,.3);
  for(let i=0;i<3;i++)kit.shopStall(g,-.5+i*.5,-.28,[M.red,M.gold,M.green][i]);
  kit.signboard(g,-.5,.22,-.42,'Halwa','ഹൽവ');
  kit.box(g,.2,.16,.7,.24,.03,1.0,P.woodPlank);
  for(let z=.3;z<=1.1;z+=.27)for(const x of[.1,.3])kit.cyl(g,x,.05,z,.02,.025,.3,M.darkTimber,5);
  for(let z=.3;z<=.85;z+=.27){const br=kit.box(g,.2,.08,z,.24,.012,.012,M.darkTimber);br.rotation.z=.6;}
  gltfBoat(g,'fishing-boat',-.7,.5,.6,2.1,-.5);
 });
 landSite('kozhikode','Kozhikode warehouses',5.187990+.12,.9,.8,.45,false,(g,t,n,fwd,right,off)=>{
  for(const x of[-.5,.5]){const yb=gy(x,0);kit.box(g,x,yb+.2,0,.5,.4,.6,P.plaster[1]);kit.roof(g,x,yb+.4,0,.56,.66,.14,P.roofTile);kit.box(g,x,gy(x,.3)+.16,.3,.18,.28,.03,P.woodPlank);pushBox(g,x,0,.27,.32,right);}
  home(g,0,-.62,12,right);
  kit.gltf('palm',g,-.95,-.3);kit.gltf('palm',g,.95,-.3);
  kit.signboard(g,0,.2,-.3,'Beach Road','ബീച്ച് റോഡ്');
  pathToRoad(g,off,.35,.36);
 },{fx:.82,fz:.95});

 // ── 3 · WAYANAD · farm village, coffee estate, viewpoint, plateau homes (misty plateau) ──
 landSite('wayanad','Wayanad farm village',5.636789,1.0,.85,.5,true,(g,t,n,fwd,right,off)=>{
  // Treehouse platform on 4 stilts around a real tree, thatch roof, rope-rail ladder.
  const px=-.4,pz=-.2,py=gy(px,pz);
  kit.gltf('tree',g,px,pz,1.4);
  for(const dx of[-.28,.28])for(const dz of[-.28,.28])kit.cyl(g,px+dx,py+.3,pz+dz,.03,.036,.6,M.darkTimber,5);
  kit.box(g,px,py+.62,pz,.62,.04,.62,P.woodPlank);
  for(const dx of[-.3,.3])for(const dz of[-.3,.3])kit.cyl(g,px+dx,py+.74,pz+dz,.012,.012,.24,M.timber,4);
  for(const dz of[-.3,.3])kit.box(g,px,py+.78,pz+dz,.6,.012,.012,M.timber);
  for(const dx of[-.3,.3])kit.box(g,px+dx,py+.78,pz,.012,.012,.6,M.timber);
  kit.roof(g,px,py+.86,pz,.66,.66,.2,P.thatch);
  const lad=new T.Group();lad.position.set(px+.28,py+.02,pz+.34);lad.rotation.x=-.3;g.add(lad);
  for(let r=0;r<5;r++)kit.box(lad,0,.06+r*.12,0,.14,.014,.02,M.timber);
  for(const lx of[-.06,.06])kit.cyl(lad,lx,.32,0,.01,.01,.64,M.darkTimber,4);
  // Paddock: post-and-two-rail fence with slight irregularity.
  for(let i=0;i<8;i++){const x=-.66+i*.18,j=Math.sin(i*3.1)*.02;kit.cyl(g,x,gy(x,.6)+.11+j,.6,.012,.015,.24,M.timber,4);}
  for(const yy of[.09,.17])kit.box(g,-.03,gy(0,.6)+yy,.6,1.14,.014,.014,M.timber);
  // Spice yard: bordered woven drying mats (chilli / pepper / coffee) with a rake prop.
  const spice=[M.red,M.darkTimber,M.clay];
  for(let i=0;i<3;i++){const mxp=.12+i*.3,mzp=.32;kit.box(g,mxp,gy(mxp,mzp)+.008,mzp,.28,.012,.22,M.timber);kit.box(g,mxp,gy(mxp,mzp)+.014,mzp,.24,.012,.18,spice[i]);}
  const rake=kit.cyl(g,.72,gy(.72,.2)+.18,.2,.008,.008,.4,M.timber,4);rake.rotation.z=.4;
  // Farm shed with pitched metal roof + leaning tools.
  const sx=.62,sz=-.28,sb=gy(sx,sz);
  kit.box(g,sx,sb+.18,sz,.5,.36,.44,P.plaster[2]);
  kit.box(g,sx,sb+.24,sz,.28,.28,.02,M.darkTimber);
  const mr=kit.box(g,sx,sb+.42,sz,.58,.02,.52,P.metalRoof);mr.rotation.x=.1;
  for(const to of[-.28,-.22])kit.cyl(g,sx+to,sb+.2,sz+.2,.008,.008,.4,M.timber,4).rotation.z=.28;
  // Coffee bushes with a few red berries under two shade trees.
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=-.62+c*.28,z=.5-r*.14;blob(g,x,gy(x,z)+.1,z,.09,M.green);if((r+c)%2===0)for(let b=0;b<3;b++)kit.box(g,x-.04+b*.04,gy(x,z)+.14,z+.05,.012,.012,.012,M.red);}
  kit.gltf('tree',g,-.8,.4,1.0);kit.gltf('tree',g,.5,.5,1.0);
  kit.signboard(g,0,.2,-.6,'Wayanad Farm','വയനാട്');
  pathToRoad(g,off,.42,.36);
  pushBox(g,sx,sz,.28,.24,right);pushRound(g,px,pz,.34);
 },{hill:true,fx:.9,fz:.66});
 landSite('wayanad','Wayanad coffee estate',5.636789-.12,.9,.55,.4,false,(g,t,n,fwd,right,off)=>{
  for(let r=0;r<4;r++)for(let c=0;c<5;c++){const x=-.55+c*.28,z=.38-r*.24;blob(g,x,gy(x,z)+.11,z,.12,M.teaGreen);if((r+c)%3===0)for(let b=0;b<2;b++)kit.box(g,x-.03+b*.06,gy(x,z)+.16,z+.06,.014,.014,.014,M.red);}
  for(const[tx,tz]of[[-.7,-.55],[.7,-.5],[0,-.66]]as[number,number][])kit.gltf('tree',g,tx,tz,1.0);
  // Pulping shed with metal roof + drying racks.
  const sx=.5,sz=.12,sb=gy(sx,sz);
  kit.box(g,sx,sb+.16,sz,.46,.32,.4,P.plaster[0]);
  const mr=kit.box(g,sx,sb+.36,sz,.54,.02,.48,P.metalRoof);mr.rotation.x=.1;
  for(let i=0;i<4;i++)kit.box(g,-.44+i*.22,gy(-.44,.48)+.14,.48,.2,.012,.14,M.timber);
  home(g,-.5,-.28,20,right,.12);
  kit.signboard(g,-.1,.2,-.5,'Coffee Estate','കാപ്പിത്തോട്ടം');
  pathToRoad(g,off,.36,.36);
  pushBox(g,sx,sz,.25,.22,right);
 },{hill:true,fx:.82,fz:.6});
 landSite('wayanad','Wayanad valley viewpoint',5.636789+.12,.85,.5,.33,false,(g,t,n,fwd,right,off)=>{
  const yb=gy(0,.2);
  kit.box(g,0,yb+.06,.2,.72,.06,.42,P.woodPlank);
  for(let i=0;i<5;i++)kit.cyl(g,-.3+i*.15,gy(0,.42)+.18,.42,.012,.012,.24,M.timber,4);
  kit.box(g,0,gy(0,.42)+.28,.42,.72,.02,.02,M.timber);
  kit.box(g,0,gy(0,-.05)+.1,-.05,.4,.02,.12,M.timber);
  for(const x of[-.15,.15])kit.cyl(g,x,gy(x,-.05)+.05,-.05,.01,.012,.1,M.darkTimber,4);
  const scope=kit.cyl(g,.24,gy(.24,.28)+.2,.28,.02,.026,.22,M.stone,6);scope.rotation.z=.55;
  kit.gltf('tree',g,-.7,-.4,1.0);
  kit.signboard(g,0,.2,-.35,'Viewpoint','കാഴ്ചബംഗ്ലാവ്');
  pathToRoad(g,off,.3,.34);
  pushBox(g,0,-.05,.24,.18,right);
 },{hill:true,fx:.42,fz:.48});
 landSite('wayanad','Wayanad plateau homes',5.636789+.22,1.05,.4,.32,false,(g,t,n,fwd,right,off)=>{
  home(g,-.42,-.15,21,right,.08);home(g,.44,-.12,22,right,-.08);home(g,.02,-.62,23,right,Math.PI);
  kit.gltf('tree',g,-.85,-.5,1.0);kit.gltf('tree',g,.9,-.55,1.0);
  pathToRoad(g,off,.32,.36);
 },{hill:true,fx:.78,fz:.74});

 // ── 4 · KANNUR · Theyyam grove, weaving workshop, laterite homes, fort approach ─────
 landSite('kannur','Kaliyattam Theyyam grove',6.085588,1.05,.9,.5,true,(g,t,n,fwd,right,off)=>{
  // Dense tree ring + low laterite boundary wall.
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;kit.gltf('tree',g,Math.cos(a)*.92,Math.sin(a)*.92,.95);}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;kit.box(g,Math.cos(a)*.74,gy(Math.cos(a)*.74,Math.sin(a)*.74)+.06,Math.sin(a)*.74,.16,.12,.04,P.laterite).rotation.y=-a;}
  // Stepped laterite platform.
  kit.cyl(g,0,gy(0,0)+.05,0,.62,.64,.1,P.laterite,20);
  kit.cyl(g,0,gy(0,0)+.14,0,.48,.5,.08,P.laterite,20);
  kit.cyl(g,0,gy(0,0)+.21,0,.34,.36,.06,P.laterite,20);
  // Shrine with tiled 2-tier roof + brass finial (set back).
  const shy=gy(0,-.1);
  kit.box(g,0,shy+.4,-.1,.34,.28,.3,P.laterite);
  kit.roof(g,0,shy+.54,-.1,.42,.4,.16,P.roofTile);
  kit.roof(g,0,shy+.7,-.1,.28,.26,.12,P.roofTile);
  kit.cone(g,0,shy+.84,-.1,.04,.14,M.gold,6);
  // Headdress aureole display on a timber stand (front, road-facing) — abstract, no figure.
  kit.cyl(g,0,gy(0,.32)+.16,.32,.02,.026,.32,M.darkTimber,6);
  aureole(g,0,gy(0,.32)+.5,.34,.34);
  // Row of standing oil lamps.
  for(const x of[-.4,-.2,0,.2,.4])kit.lamp(g,x,.5);
  kit.signboard(g,.5,.2,.66,'Kaliyattam','കളിയാട്ടം');
  pathToRoad(g,off,.5,.4);
  pushRound(g,0,0,.6);
 },{fx:.86,fz:.86});
 landSite('kannur','Kannur weaving workshop',6.085588-.13,.9,.85,.45,false,(g,t,n,fwd,right,off)=>{
  // Open shed with tiled roof over two looms + a yarn-hank shelf.
  for(const x of[-.5,.5])for(const z of[-.35,.35])kit.cyl(g,x,gy(x,z)+.24,z,.025,.03,.48,M.timber,5);
  kit.roof(g,0,gy(0,0)+.52,0,1.2,.9,.16,P.roofTile);
  for(const cx of[-.35,.35]){
   for(const x of[cx-.16,cx+.16])for(const z of[-.16,.16])kit.cyl(g,x,gy(x,z)+.14,z,.015,.02,.28,M.darkTimber,4);
   kit.box(g,cx,gy(cx,0)+.22,0,.3,.005,.3,M.lime);
   kit.cyl(g,cx,gy(cx,.18)+.14,.18,.03,.03,.28,M.white,8).rotation.z=Math.PI/2;
  }
  kit.box(g,0,gy(0,-.4)+.3,-.4,.7,.02,.14,M.timber);
  for(let i=0;i<4;i++)kit.box(g,-.28+i*.18,gy(0,-.4)+.36,-.4,.08,.08,.08,[M.red,M.gold,M.blue,M.green][i]);
  kit.signboard(g,0,.2,.5,'Handloom','കൈത്തറി');
  pathToRoad(g,off,.35,.4);
  pushBox(g,0,0,.55,.4,right);
 },{fx:.68,fz:.56});
 landSite('kannur','Kannur laterite homes',6.085588-.06,1.1,.8,.4,false,(g,t,n,fwd,right,off)=>{
  // Laterite is the Kannur idiom — keep the PBR-textured laterite homes here.
  kit.lateriteHouse(g,-.5,.05,.6,.4,.45);pushBox(g,-.5,.05,.33,.26,right);
  kit.lateriteHouse(g,.52,-.05,.58,.4,.44);pushBox(g,.52,-.05,.32,.25,right);
  kit.lateriteHouse(g,.02,-.55,.55,.38,.42);pushBox(g,.02,-.55,.3,.24,right);
  kit.gltf('palm',g,-.95,.3);kit.gltf('palm',g,.98,.25);
  pathToRoad(g,off,.4,.36);
 });
 seaSite('kannur','Kannur fort approach',6.085588+.06,-.02,(g)=>{
  const w=kit.box(g,0,.14,0,1.3,.22,.1,P.laterite);w.rotation.y=.18;
  for(let i=0;i<6;i++)kit.box(g,-.55+i*.22,.28,.02,.08,.1,.08,P.laterite).rotation.y=.18;
  kit.cyl(g,.62,.2,.05,.2,.24,.34,P.laterite,12);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;kit.box(g,.62+Math.cos(a)*.2,.4,.05+Math.sin(a)*.2,.06,.08,.06,P.laterite);}
  kit.box(g,.2,.1,.55,.2,.03,.7,P.woodPlank);
  for(let z=.3;z<=.85;z+=.27)kit.cyl(g,.2,.03,z,.02,.02,.16,M.darkTimber,5);
 });

 // ── 5 · KASARAGOD · Bekal fort bastion, Yakshagana stage, coastal village ───────────
 landSite('kasaragod','Bekal fort',.251202,.95,.95,.5,true,(g,t,n,fwd,right,off)=>{
  // Big tapered laterite bastion with stone string-courses, merlons, sentry turret, slits.
  kit.cyl(g,0,gy(0,0)+.5,0,.4,.52,1.0,P.laterite,20);
  for(const yy of[.32,.66]){const rr=.52-.12*yy+.016;kit.cyl(g,0,gy(0,0)+yy,0,rr,rr,.035,P.stone,22);}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;kit.box(g,Math.cos(a)*.4,gy(0,0)+1.03,Math.sin(a)*.4,.09,.1,.09,P.laterite).rotation.y=-a;}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3;kit.box(g,Math.cos(a)*.47,gy(0,0)+.55,Math.sin(a)*.47,.03,.14,.03,M.darkTimber).rotation.y=-a;}
  const tx=Math.cos(.9)*.4,tz=Math.sin(.9)*.4;
  kit.cyl(g,tx,gy(0,0)+1.14,tz,.1,.11,.2,P.laterite,12);
  dome(g,tx,gy(0,0)+1.24,tz,.11,P.stone,1,.68);
  // Sea-facing cannon in an embrasure notch (sea is −z).
  const cannon=kit.cyl(g,0,gy(0,-.42)+.42,-.42,.03,.04,.32,M.darkTimber,8);cannon.rotation.x=Math.PI/2-.15;
  // Two inland wall segments with wall-walk + parapet + merlons.
  for(const s of[-1,1]){const wx=s*.72;
   kit.box(g,wx,gy(wx,.25)+.2,.25,.1,.4,.9,P.laterite);
   kit.box(g,wx,gy(wx,.25)+.42,.25,.13,.03,.9,P.stone);
   kit.box(g,wx+s*.05,gy(wx,.25)+.5,.25,.03,.14,.9,P.laterite);
   for(let i=0;i<5;i++)kit.box(g,wx+s*.05,gy(wx,-.1)+.58,-.1+i*.2,.04,.08,.06,P.laterite);
   pushBox(g,wx,.25,.1,.45,right);
  }
  kit.signboard(g,.5,.2,.66,'Bekal','ബേക്കൽ');
  pathToRoad(g,off,.5,.4);
  pushRound(g,0,0,.44);
 },{coast:true});
 landSite('kasaragod','Yakshagana stage',.251202-.13,1.05,.7,.4,false,(g,t,n,fwd,right,off)=>{
  // Raised stage on 4 carved posts, canopy, fabric backdrop, footlights, pennant strings.
  kit.box(g,0,gy(0,0)+.14,0,.9,.14,.7,P.woodPlank);
  for(const x of[-.4,.4])for(const z of[-.3,.3]){kit.cyl(g,x,gy(x,z)+.42,z,.03,.04,.56,M.darkTimber,6);kit.box(g,x,gy(x,z)+.72,z,.07,.07,.07,M.gold);}
  kit.roof(g,0,gy(0,0)+.74,0,1.0,.8,.16,P.roofTile);
  kit.box(g,0,gy(0,-.32)+.44,-.32,.9,.44,.02,M.red);
  for(const x of[-.35,-.12,.12,.35]){kit.cyl(g,x,gy(x,.32)+.17,.32,.015,.02,.06,M.darkTimber,5);kit.cone(g,x,gy(x,.32)+.22,.32,.02,.05,M.gold,6);}
  for(let i=0;i<3;i++){const pxp=-.32+i*.32;const p=new T.Group();p.position.set(pxp,gy(pxp,.3)+.7,.3);const f=kit.box(p,0,-.04,0,.05,.08,.004,[M.red,M.gold,M.green][i%3]);(f as any).userData.dyn=true;p.userData.dyn=true;g.add(p);flags.push({pivot:p,phase:i*.5});}
  swayFlag(g,-.45,.34,.55,M.gold,.4);
  kit.signboard(g,-.32,.2,.55,'Yakshagana','യക്ഷഗാനം');
  pathToRoad(g,off,.4,.4);
  pushBox(g,0,0,.45,.35,right);
 },{coast:true,fx:.6,fz:.6});
 landSite('kasaragod','Kasaragod coastal village',.251202-.07,1.1,.8,.4,false,(g,t,n,fwd,right,off)=>{
  // One hero detailed home + merged neighbours (cheap in bulk).
  home(g,-.5,.05,30,right,.1);
  kit.tiledHouse(g,.52,-.05,.5,.34,.46);pushBox(g,.52,-.05,.31,.26,right);
  kit.tiledHouse(g,.02,-.55,.48,.32,.42);pushBox(g,.02,-.55,.3,.24,right);
  kit.gltf('palm',g,-.95,.3);kit.gltf('palm',g,1.0,.2);
  kit.signboard(g,-.1,.2,-.5,'Kasaragod','ಕಾಸರಗೋಡು');
  pathToRoad(g,off,.4,.36);
 },{coast:true,fx:.87,fz:.87});

 return {
  landmarks,
  update(now:number){
   for(const f of flags)f.pivot.rotation.y=Math.sin(now*.003+f.phase)*.3;
   for(const b of boats)b.g.position.y=b.y0+Math.sin(now*.002+b.phase)*.012;
  },
  dispose(){for(const g of groups)globe.remove(g);localMats.forEach(m=>m.dispose());localTex.forEach(t=>t.dispose());localGeo.forEach(g=>g.dispose());}
 };
}
