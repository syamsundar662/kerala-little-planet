import * as T from 'three';
import {WORLD_RADIUS as R,SEA_LEVEL,coastLatitude,isDryLand,roadOffset} from './world';
import type {Obstacle} from './vehicle-physics';
import type {Kit} from './kerala-props';

// Four central districts (Idukki, Ernakulam, Thrissur, Palakkad) built from the shared Kit.
// Every site self-grounds on the curved surface; solids push Obstacles, vegetation/sea props do not.
// Landmarks are authored with kit.pbr materials + window/door/pillar detail so they read as real
// Kerala architecture rather than flat box stacks; kit.finish merges each static group per material.
export function addCentralDistricts(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number,kit:Kit):{landmarks:number;update(now:number):void;dispose():void}{
 const M=kit.mats,P=kit.pbr,UP=new T.Vector3(0,1,0);
 const gy=(x:number,z:number)=>Math.sqrt(R*R-x*x-z*z)-R;
 const normal=(t:number,l:number)=>new T.Vector3(Math.cos(t)*Math.cos(l),Math.sin(l),Math.sin(t)*Math.cos(l));
 const groups:T.Group[]=[];const geoms:T.BufferGeometry[]=[];const localMats:T.Material[]=[];const textures:T.Texture[]=[];
 const flags:{mesh:T.Mesh;phase:number}[]=[];const rigs:{pivot:T.Group;phase:number}[]=[];
 const reserved:Obstacle[]=[];let landmarks=0;
 // Semi-transparent net, weathered copper roofing and sunken moat earth are the only local materials.
 const netMat=new T.MeshStandardMaterial({color:0x22221c,roughness:.92,transparent:true,opacity:.4,side:T.DoubleSide});localMats.push(netMat);
 const copper=new T.MeshStandardMaterial({color:0x6e4a34,roughness:.5,metalness:.35});localMats.push(copper);
 const moat=new T.MeshStandardMaterial({color:0x584636,roughness:.96});localMats.push(moat);
 const anim=<Q extends T.Object3D>(m:Q)=>{m.userData.animated=true;return m};
 const clear=(n:T.Vector3,extent:number)=>[...obstacles,...reserved].every(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*R>extent+(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.15);
 // Fan of longitude offsets (and optional latitude rows) around a target, seeking a clear, dry, road-safe spot.
 const findSpot=(t0:number,l0:number,extent:number,minOff:number,span:number,lats?:number[])=>{
  const cols:number[]=[0],steps=Math.max(4,Math.round(span/.02));
  for(let k=1;k<=steps;k++){const d=span*k/steps;if(d<=.19)cols.push(d,-d);}
  for(const ll of (lats??[l0]))for(const d of cols){const t=t0+d,n=normal(t,ll);
   if(!isDryLand(t,ll)||roadOffset(t,ll)<minOff||!clear(n,extent))continue;
   reserved.push({normal:n.clone(),radius:.3});return {t,l:ll};}
  return null;
 };
 const anchor=(t:number,l:number,name:string,id:string,face:'road'|'sea'|'none',r=R)=>{
  const g=new T.Group();g.name=name;g.userData.districtId=id;const n=normal(t,l);
  g.position.copy(n).multiplyScalar(r);
  if(face==='none')g.quaternion.setFromUnitVectors(UP,n);
  else{const target=face==='road'?latitude(t):coastLatitude(t);const front=normal(t,target).sub(n).projectOnPlane(n).normalize();const right=new T.Vector3().crossVectors(n,front);g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,n,front));}
  globe.add(g);groups.push(g);return g;
 };
 const site=(t0:number,l:number,extent:number,minOff:number,name:string,id:string,face:'road'|'sea'|'none',landmark=false,span=.06,lats?:number[])=>{
  const s=findSpot(t0,l,extent,minOff,span,lats);if(!s)return null;
  const g=anchor(s.t,s.l,name,id,face);if(landmark){g.userData.landmark=true;landmarks++;}
  return {g,t:s.t,l:s.l};
 };
 // Obstacle helpers in globe-local space (matches normal(t,l) and clear()).
 const worldN=(g:T.Group,x:number,z:number)=>{g.updateWorldMatrix(true,false);return g.localToWorld(new T.Vector3(x,gy(x,z),z)).normalize()};
 const axisOf=(g:T.Group)=>new T.Vector3(1,0,0).applyQuaternion(g.quaternion);
 const boxObs=(g:T.Group,x:number,z:number,halfX:number,halfZ:number)=>obstacles.push({normal:worldN(g,x,z),axis:axisOf(g),halfX,halfZ});
 const roundObs=(g:T.Group,x:number,z:number,radius:number)=>obstacles.push({normal:worldN(g,x,z),radius});
 const finish=(g:T.Group)=>kit.finish(g);
 // A cylinder spanning two arbitrary local points — used for A-frames, cranes, rails, drum stands.
 const strut=(parent:T.Object3D,ax:number,ay:number,az:number,bx:number,by:number,bz:number,r:number,m:T.Material)=>{
  const dx=bx-ax,dy=by-ay,dz=bz-az,len=Math.hypot(dx,dy,dz);
  const c=kit.cyl(parent,(ax+bx)/2,(ay+by)/2,(az+bz)/2,r,r,len,m,6);
  c.quaternion.setFromUnitVectors(UP,new T.Vector3(dx,dy,dz).normalize());return c;
 };
 // Worn-asphalt PBR (shared maps, tinted per use) — same pipeline as road-surface.ts — plus soil/grass.
 const roadLoader=new T.TextureLoader();
 const roadTex=(kind:string,srgb=false)=>{const t=roadLoader.load(`/textures/worn_asphalt_${kind}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;};
 const waColor=roadTex('color',true),waNormal=roadTex('normal'),waRough=roadTex('rough');
 // aerial_grass_rock (grass maidan + earth shoulders) uses diff/nor_gl/rough_1k suffixes.
 const dKind:Record<string,Record<string,string>>={aerial_grass_rock:{color:'diff_1k',normal:'nor_gl_1k',rough:'rough_1k'}};
 const detTex=(asset:string,kind:string,srgb=false)=>{const file=dKind[asset]?.[kind]??kind;const t=roadLoader.load(`/textures/${asset}_${file}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;};
 const asphaltMat=new T.MeshStandardMaterial({map:waColor,normalMap:waNormal,roughnessMap:waRough,normalScale:new T.Vector2(.45,.45),roughness:1,color:0x686b6b,side:T.DoubleSide});localMats.push(asphaltMat);
 const pathMat=new T.MeshStandardMaterial({map:waColor,normalMap:waNormal,roughnessMap:waRough,normalScale:new T.Vector2(.4,.4),roughness:1,color:0x7a5a3c});localMats.push(pathMat);
 const soilMat=new T.MeshStandardMaterial({map:detTex('aerial_grass_rock','color',true),normalMap:detTex('aerial_grass_rock','normal'),roughnessMap:detTex('aerial_grass_rock','rough'),normalScale:new T.Vector2(.5,.5),color:0x8d7155,roughness:1,side:T.DoubleSide});localMats.push(soilMat);
 const grassG=detTex('aerial_grass_rock','color',true),grassN=detTex('aerial_grass_rock','normal'),grassR=detTex('aerial_grass_rock','rough');for(const t of[grassG,grassN,grassR])t.repeat.set(5,5);
 const grassMat=new T.MeshStandardMaterial({map:grassG,normalMap:grassN,roughnessMap:grassR,normalScale:new T.Vector2(.5,.5),color:0x4f7a3a,roughness:.95,side:T.DoubleSide});localMats.push(grassMat);
 const gyLift=(x:number,z:number)=>Math.sqrt(Math.max(0,R*R-x*x-z*z))-R+.004;
 // Sphere-conforming, drivable (castShadow=false) ground meshes; kept intact through finish() via dyn.
 const groundMesh=(v:number[],uv:number[],mat:T.Material)=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();geoms.push(geo);const m=new T.Mesh(geo,mat);m.receiveShadow=true;m.castShadow=false;m.userData.dyn=true;return m;};
 const conformStrip=(x1:number,z1:number,x2:number,z2:number,width:number,mat:T.Material)=>{
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz)||1e-4,steps=Math.max(1,Math.round(len/.15));
  const ux=dx/len,uz=dz/len,px=-uz*width/2,pz=ux*width/2,v:number[]=[],uv:number[]=[];
  for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,ax=x1+dx*a,az=z1+dz*a,bx=x1+dx*b,bz=z1+dz*b;
   const p1=[ax+px,gyLift(ax+px,az+pz),az+pz],p2=[ax-px,gyLift(ax-px,az-pz),az-pz],p3=[bx+px,gyLift(bx+px,bz+pz),bz+pz],p4=[bx-px,gyLift(bx-px,bz-pz),bz-pz];
   v.push(...p1,...p3,...p2,...p2,...p3,...p4);
   uv.push(0,a*len/width,1,b*len/width,0,a*len/width,0,a*len/width,1,b*len/width,1,b*len/width);}
  return groundMesh(v,uv,mat);
 };
 const conformRing=(rIn:number,rOut:number,segs:number,mat:T.Material,uRep:number)=>{
  const v:number[]=[],uv:number[]=[],pt=(a:number,r:number):[number,number,number]=>{const x=Math.cos(a)*r,z=Math.sin(a)*r;return [x,gyLift(x,z),z];};
  for(let i=0;i<segs;i++){const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2,u0=i/segs*uRep,u1=(i+1)/segs*uRep;
   const i0=pt(a0,rIn),o0=pt(a0,rOut),i1=pt(a1,rIn),o1=pt(a1,rOut);
   v.push(...i0,...o0,...i1, ...i1,...o0,...o1);uv.push(0,u0,1,u0,0,u1, 0,u1,1,u0,1,u1);}
  return groundMesh(v,uv,mat);
 };
 const conformDisc=(rad:number,segs:number,mat:T.Material,mound:number)=>{
  const v:number[]=[],uv:number[]=[],pt=(a:number):[number,number,number]=>{const x=Math.cos(a)*rad,z=Math.sin(a)*rad;return [x,gyLift(x,z)-.002+mound*.25,z];};
  for(let i=0;i<segs;i++){const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2,p0=pt(a0),p1=pt(a1);
   v.push(0,mound,0,...p1,...p0);uv.push(.5,.5,Math.cos(a1)*.5+.5,Math.sin(a1)*.5+.5,Math.cos(a0)*.5+.5,Math.sin(a0)*.5+.5);}
  return groundMesh(v,uv,mat);
 };
 const eucalyptus=(g:T.Group,x:number,z:number)=>{kit.cyl(g,x,gy(x,z)+.35,z,.018,.026,.7,M.darkTimber);kit.cone(g,x,gy(x,z)+.82,z,.13,.32,M.leaf);};
 const home=(g:T.Group,x:number,z:number,index:number,ry=0)=>{const e=kit.house(g,x,z,index,ry);boxObs(g,x,z,e.halfX,e.halfZ);};
 // Path strip from an entrance out toward the road crown, stopping ~.55 short of the centre-line.
 // castShadow=false (dyn) so approach paths may reach the road without tripping the mesh-edge rule.
 const pathToRoad=(g:T.Group,x:number,z:number,t:number,l:number,w=.16)=>{const end=Math.min(roadOffset(t,l)-.55,z+.95);if(end>z+.06)g.add(conformStrip(x,z,x,end,w,pathMat));};
 // Yellow diamond hairpin warning sign on a post.
 const hairpinSign=(g:T.Group,x:number,z:number)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#f4c81e';c.beginPath();c.moveTo(64,4);c.lineTo(124,64);c.lineTo(64,124);c.lineTo(4,64);c.closePath();c.fill();
  c.strokeStyle='#101010';c.lineWidth=6;c.stroke();
  c.lineWidth=9;c.beginPath();c.moveTo(42,96);c.lineTo(42,58);c.arc(62,58,20,Math.PI,0);c.lineTo(82,90);c.stroke();
  c.beginPath();c.moveTo(82,90);c.lineTo(72,80);c.moveTo(82,90);c.lineTo(92,80);c.stroke();
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
  const mat=new T.MeshStandardMaterial({map:tex,roughness:.85,side:T.DoubleSide});localMats.push(mat);
  const geo=new T.PlaneGeometry(.16,.16);geoms.push(geo);
  const b=gy(x,z);kit.cyl(g,x,b+.14,z,.008,.01,.28,M.darkTimber,5);
  const plate=new T.Mesh(geo,mat);plate.position.set(x,b+.3,z+.008);plate.rotation.z=Math.PI/4;plate.castShadow=plate.receiveShadow=true;g.add(plate);
 };

 // ---- 1. Idukki (hill) — wide search so estate, reservoir and hillside homes all land -------
 const idLats:number[]=[];for(let k=0;k<=8;k++)idLats.push(.30+.38*k/8);
 const idEstate=site(2.90,.55,.9,1.57,'Idukki tea estate','idukki','road',true,.19,idLats);
 if(idEstate){const {g,t,l}=idEstate;
  // Terraced rows follow contour steps: each row rides a slightly raised earth berm, bushes packed with picking lanes.
  for(let r=0;r<7;r++){const z=.34-r*.10,lift=.03+r*.006;
   kit.box(g,0,gy(0,z)+.02+r*.006,z-.035,1.02,.05,.06,M.clay);
   for(let cc=0;cc<15;cc++){if(cc%6===5)continue;const x=-.44+cc*.062;kit.cyl(g,x,gy(x,z)+lift+.02,z,.032,.036,.05,(r+cc)%2?M.teaGreen:M.green,7);}}
  // Factory: long two-storey plastered shed, barred window rows, corrugated metal roof with monitors, brick chimney, dock.
  const fx=.12,fz=-.42,fw=.92,fh=.34,fd=.3;
  kit.box(g,fx,gy(fx,fz)+fh/2,fz,fw,fh,fd,P.plaster[0]);
  for(const row of [.11,.26])for(let k=0;k<5;k++)kit.window(g,fx-.32+k*.16,gy(fx,fz)+row,fz+fd/2+.006,.09);
  kit.door(g,fx-.5+.08,gy(fx,fz),fz+fd/2+.006,.2);
  kit.roof(g,fx,gy(fx,fz)+fh,fz,fw,fd,.06,P.metalRoof);
  for(const mx of [-.26,0,.26])kit.box(g,fx+mx,gy(fx,fz)+fh+.05,fz,.14,.05,.2,P.metalRoof);
  kit.cyl(g,fx+.52,gy(fx+.52,fz)+.4,fz-.04,.028,.05,.82,P.laterite,8);kit.box(g,fx+.52,gy(fx+.52,fz)+.83,fz-.04,.09,.05,.09,P.laterite);
  kit.box(g,fx,gy(fx,fz+.24)+.05,fz+.24,.5,.08,.12,M.concrete);
  hairpinSign(g,-.5,.16);
  kit.signboard(g,.42,.18,.2,'Tea Estate','തേയില');
  kit.gltf('tree',g,-.62,-.1,1.0);kit.gltf('tree',g,.66,.2,.95);
  boxObs(g,fx,fz,.46,.2);pathToRoad(g,0,.4,t,l);finish(g);
 }
 const idDam=site(3.06,.55,.75,2.3,'Idukki reservoir viewpoint','idukki','road',false,.19,idLats);
 if(idDam){const {g,t,l}=idDam;
  // Curved concrete dam wall (6 angled segments + expansion joints) between two earth abutment mounds.
  kit.cone(g,-.4,gy(-.4,0)+.11,0,.22,.22,M.clay,8);kit.cone(g,.4,gy(.4,0)+.11,0,.22,.22,M.clay,8);
  const bow=(u:number)=>-.13*(1-4*u*u);
  for(let k=0;k<6;k++){const u=k/5-.5,x=u*.62,z=bow(u),yb=gy(x,z);
   kit.box(g,x,yb+.18,z,.13,.36,.1,M.concrete).rotation.y=-u*.55;
   kit.box(g,x-.06,yb+.18,z,.006,.36,.1,moat).rotation.y=-u*.55;}
  // Railed walkway along the crest.
  for(let k=0;k<7;k++){const u=k/6-.5,x=u*.64,z=bow(u);kit.cyl(g,x,gy(x,z)+.42,z,.008,.008,.12,M.darkTimber,5);}
  for(let k=0;k<6;k++){const u0=k/6-.5,u1=(k+1)/6-.5;strut(g,u0*.64,gy(u0*.64,bow(u0))+.47,bow(u0),u1*.64,gy(u1*.64,bow(u1))+.47,bow(u1),.006,M.darkTimber);}
  // Sunken reservoir water hint behind the wall.
  kit.box(g,0,gy(0,-.4)-.02,-.4,.7,.02,.32,M.water);
  // Viewpoint platform on the road side, railed, with a lamp.
  kit.box(g,0,gy(0,.3)+.03,.3,.46,.05,.2,M.concrete);
  for(const px of [-.2,0,.2])kit.cyl(g,px,gy(px,.39)+.1,.39,.008,.008,.14,M.darkTimber,5);
  kit.box(g,0,gy(0,.39)+.17,.39,.46,.02,.02,M.darkTimber);
  kit.lamp(g,.28,.32);
  boxObs(g,0,0,.34,.14);pathToRoad(g,-.28,.34,t,l);finish(g);
 }
 const idHomes=site(2.77,.55,.6,1.7,'Idukki hillside homes','idukki','road',false,.19,idLats);
 if(idHomes){const {g,t,l}=idHomes;
  home(g,-.32,0,3);home(g,.34,-.12,1,-.1);
  kit.gltf('tree',g,.04,.4,.95);eucalyptus(g,-.44,-.28);eucalyptus(g,.46,.3);
  pathToRoad(g,-.32,.3,t,l);finish(g);
 }

 // ---- 2. Ernakulam (Fort Kochi) --------------------------------------------------------------
 {
  const t=3.39,g=anchor(t,coastLatitude(t)-.03,'Fort Kochi Chinese fishing nets','ernakulam','none',R+SEA_LEVEL);g.userData.landmark=true;landmarks++;
  // Each cantilever rig: timber platform on piles, 4-spar A-frame teepee (static), and an animated
  // lever + counterweight-stone cluster + hanging net that dips over the water.
  for(let i=0;i<3;i++){const bx=(i-1)*.62,ax=bx,ay=.9,az=-.06;
   kit.box(g,bx,.12,0,.28,.03,.28,M.timber);
   for(const [px,pz] of [[-.11,-.11],[.11,-.11],[-.11,.11],[.11,.11]] as [number,number][])kit.cyl(g,bx+px,0,pz,.014,.018,.24,M.timber,5);
   for(const [px,pz] of [[-.11,-.09],[.11,-.09],[-.11,.09],[.11,.09]] as [number,number][])strut(g,bx+px,.13,pz,ax,ay,az,.011,M.timber);
   kit.box(g,ax,ay+.02,az,.06,.04,.06,M.timber);
   const pivot=new T.Group();pivot.position.set(ax,ay,az);anim(pivot);g.add(pivot);
   anim(strut(pivot,0,0,0,0,.16,-.5,.013,M.timber));
   for(const [sx,sy,sz] of [[0,.2,-.5],[.05,.16,-.52],[-.05,.17,-.48]] as [number,number,number][])anim(kit.box(pivot,sx,sy,sz,.1,.11,.1,M.stone));
   anim(kit.cyl(pivot,0,.24,-.5,.004,.004,.16,M.darkTimber,4));
   const net=anim(kit.cone(pivot,0,-.28,.82,.36,.34,netMat,4));net.rotation.x=Math.PI;
   for(const [sx,sz] of [[-.34,.5],[.34,.5],[-.34,1.14],[.34,1.14]] as [number,number][])anim(strut(pivot,0,0,0,sx,-.1,sz,.004,M.darkTimber));
   pivot.rotation.x=-.12;rigs.push({pivot,phase:i*1.7});
  }
  finish(g);
 }
 const ekStreet=site(3.39,-.48,.6,1.3,'Fort Kochi heritage street','ernakulam','sea',false,.06);
 if(ekStreet){const {g}=ekStreet;
  // Heritage facades: varied plaster tints, parapet mouldings, corner quoins, arched doors, shuttered windows.
  for(let i=0;i<5;i++){const x=-.6+i*.3,pl=P.plaster[i%P.plaster.length],bw=.28,bh=.36,bd=.24,yb=gy(x,0);
   kit.box(g,x,yb+bh/2,0,bw,bh,bd,pl);
   kit.box(g,x,yb+bh+.02,0,bw+.04,.05,bd+.04,M.white);kit.box(g,x,yb+bh+.06,0,bw+.015,.02,bd+.015,M.white);
   for(const s of [-1,1])for(let q=0;q<4;q++)kit.box(g,x+s*bw/2,yb+.05+q*.09,bd/2-.005,.03,.05,.02,M.white);
   kit.door(g,x,yb,bd/2+.006,.19);
   kit.window(g,x-.085,yb+.27,bd/2+.006,.07);kit.window(g,x+.085,yb+.27,bd/2+.006,.07);
  }
  kit.lamp(g,-.52,.2);kit.lamp(g,.42,.2);
  kit.path(g,-.72,.22,.72,.22,.18);
  kit.signboard(g,0,.24,.36,'Fort Kochi','ഫോർട്ട് കൊച്ചി');
  boxObs(g,0,0,.62,.14);finish(g);
 }
 const ekHarbour=site(3.29,-.55,.5,.9,'Fort Kochi harbour','ernakulam','sea',false,.06);
 if(ekHarbour){const {g}=ekHarbour;
  // Stacked containers (two liveries), a lattice-jib crane hint, bollards roped together.
  const cc=[M.red,M.blue,M.green];
  for(let k=0;k<3;k++)kit.box(g,-.38+k*.015,gy(-.38,-.05)+.09+k*.14,-.05,.34,.13,.22,cc[k%3]);
  kit.box(g,-.02,gy(-.02,.24)+.09,.24,.34,.13,.22,M.blue);kit.box(g,-.02,gy(-.02,.24)+.23,.24,.34,.13,.22,M.red);
  const mx=.4,mz=-.24,mb=gy(mx,mz);
  kit.cyl(g,mx,mb+.36,mz,.02,.026,.72,M.concrete,6);
  strut(g,mx,mb+.7,mz,mx-.34,mb+.62,mz,.014,M.stone);
  strut(g,mx,mb+.7,mz,mx-.16,mb+.44,mz,.01,M.stone);strut(g,mx-.34,mb+.62,mz,mx-.16,mb+.44,mz,.008,M.stone);
  for(const bx of [-.5,-.3,-.1])kit.cyl(g,bx,gy(bx,.42)+.05,.42,.03,.036,.11,M.darkTimber,6);
  strut(g,-.5,gy(-.5,.42)+.09,.42,-.1,gy(-.1,.42)+.09,.42,.006,M.darkTimber);
  boxObs(g,-.32,0,.2,.18);finish(g);
 }
 const ekCafe=site(3.49,-.5,.5,.9,'Fort Kochi cafe street','ernakulam','road',false,.06);
 if(ekCafe){const {g,t,l}=ekCafe;
  kit.shopStall(g,-.35,.1,M.red);boxObs(g,-.35,.1,.16,.14);
  kit.shopStall(g,.05,.1,M.blue);boxObs(g,.05,.1,.16,.14);
  home(g,-.3,-.32,2);home(g,.38,-.26,4,.12);
  kit.gltf('palm',g,.52,.22,1.0);
  pathToRoad(g,-.15,.28,t,l);finish(g);
 }

 // ---- 3. Thrissur (Swaraj Round) -------------------------------------------------------------
 // Circular drivable ring road around the raised Thekkinkadu Maidan, Vadakkunnathan-style temple at
 // centre, shops arcing outside facing inward. minOff 2.1 keeps every castShadow edge >.68 off the road.
 const trRound=site(3.841593,.28,1.35,2.1,'Thrissur Swaraj Round','thrissur','road',true,.19);
 if(trRound){const {g,t,l}=trRound;
  reserved.push({normal:normal(t,l),radius:1.4});
  // Ring road: soil shoulders bracketing a worn-asphalt carriageway (~.44 wide, outer radius 1.05). No obstacle.
  g.add(conformRing(.57,.61,72,soilMat,24));
  g.add(conformRing(.61,1.05,72,asphaltMat,2*Math.PI*.83/1.5));
  g.add(conformRing(1.05,1.09,72,soilMat,24));
  // Thekkinkadu Maidan: gently raised green disc inside the ring (drivable, no obstacle).
  g.add(conformDisc(.57,48,grassMat,.011));
  // Asphalt spur joining the ring's road-facing edge toward the main road (stops ~.62 short of centre).
  {const end=Math.min(roadOffset(t,l)-.62,2.0);if(end>1.06)g.add(conformStrip(0,1.05,0,end,.4,asphaltMat));}
  // Shade trees near the maidan edge, clear of the centre.
  for(const a of [.6,2.1,3.7,5.2])kit.gltf('tree',g,Math.cos(a)*.47,Math.sin(a)*.47,.8);
  // --- Vadakkunnathan-inspired walled temple complex at the centre ---
  const HW=.34; // compound wall half-width
  const wallRun=(cx:number,cz:number,horiz:boolean)=>{for(const s of [-1,1]){const off=s*(HW*.62),x=horiz?cx+off:cx,z=horiz?cz:cz+off,w=horiz?HW*.62:.05,d=horiz?.05:HW*.62;
   kit.box(g,x,gy(x,z)+.085,z,w,.17,d,P.laterite);kit.box(g,x,gy(x,z)+.185,z,w+.012,.02,d+.012,P.stone);}};
  wallRun(0,-HW,true);wallRun(0,HW,true);wallRun(-HW,0,false);wallRun(HW,0,false);
  // Four 2-tier gabled tiled gopuram gate towers at N/S/E/W (built in a rotated subgroup, +z outward).
  for(let k=0;k<4;k++){const gp=new T.Group();gp.rotation.y=k*Math.PI/2;g.add(gp);const gz=HW,yb=gy(0,gz);
   kit.box(gp,0,yb+.12,gz,.22,.24,.12,P.laterite);
   kit.box(gp,0,yb+.095,gz+.03,.11,.17,.05,M.darkTimber);
   kit.roof(gp,0,yb+.24,gz,.28,.16,.10,P.roofTile);
   kit.roof(gp,0,yb+.34,gz,.18,.11,.07,P.roofTile);
   kit.cyl(gp,0,yb+.41,gz,.012,.016,.04,M.gold,6);}
  // Round srikovil: stone drum, 2-tier conical copper roof, gold kalasham.
  const s1x=-.13,s1z=.05,y1=gy(s1x,s1z);
  kit.cyl(g,s1x,y1+.07,s1z,.11,.11,.14,P.stone,16);
  kit.cone(g,s1x,y1+.20,s1z,.15,.09,copper,16);kit.cyl(g,s1x,y1+.245,s1z,.10,.11,.02,M.gold,16);
  kit.cone(g,s1x,y1+.31,s1z,.11,.10,copper,16);
  kit.cyl(g,s1x,y1+.38,s1z,.02,.03,.05,M.gold,8);kit.cone(g,s1x,y1+.44,s1z,.03,.06,M.gold,8);
  // Rectangular srikovil: laterite cella, 2-tier gabled tiled roof, gold kalasham.
  const s2x=.15,s2z=-.07,y2=gy(s2x,s2z);
  kit.box(g,s2x,y2+.08,s2z,.20,.16,.16,P.laterite);
  kit.roof(g,s2x,y2+.16,s2z,.24,.18,.09,P.roofTile);kit.roof(g,s2x,y2+.25,s2z,.15,.11,.06,P.roofTile);
  kit.cyl(g,s2x,y2+.31,s2z,.02,.03,.05,M.gold,8);kit.cone(g,s2x,y2+.37,s2z,.03,.06,M.gold,8);
  // Dhwajastambha: slim gold-capped flagstaff.
  const fy=gy(0,.16);kit.cyl(g,0,fy+.25,.16,.012,.016,.5,M.gold,8);kit.cone(g,0,fy+.52,.16,.02,.05,M.gold,8);
  // Festival pennants near the road-facing gopuram (animated).
  for(let k=0;k<3;k++){const px=-.14+k*.14,pz=.5,py=gy(px,pz);kit.cyl(g,px,py+.16,pz,.008,.01,.32,M.darkTimber,5);const pen=anim(kit.box(g,px+.07,py+.28,pz,.12,.07,.005,k%2?M.red:M.gold));flags.push({mesh:pen,phase:k});}
  roundObs(g,0,0,HW*1.5); // single obstacle over wall+interior; ring (inner r .57) stays drivable
  // Shop row arcing outside the ring, awnings/signboards facing inward; a couple of homes among them.
  const rs=1.24,signs:[string,string][]=[['Round West','റൗണ്ട് വെസ്റ്റ്'],['Round North','റൗണ്ട് നോർത്ത്'],['Round East','റൗണ്ട് ഈസ്റ്റ്'],['Round South','റൗണ്ട് സൗത്ത്']],awn=[M.red,M.blue,M.gold,M.green];
  for(let k=0;k<7;k++){const A=k/7*Math.PI*2+.42,sw=new T.Group();sw.rotation.y=A;g.add(sw);
   const lx=-rs*Math.sin(A),lz=-rs*Math.cos(A);
   if(k===2||k===5){kit.house(sw,0,-rs,k);roundObs(g,lx,lz,.3);} // compact obstacle (avoid the house's wide yard footprint)
   else{kit.shopStall(sw,0,-rs,awn[k%4]);roundObs(g,lx,lz,.17);}
   if(k%2===0)kit.signboard(sw,0,.22,-rs+.3,signs[(k/2)%signs.length][0],signs[(k/2)%signs.length][1]);}
  // Street lamps spaced around the outer edge.
  for(let k=0;k<8;k++){const A=k/8*Math.PI*2+.2;kit.lamp(g,Math.cos(A)*1.14,Math.sin(A)*1.14);}
  finish(g);
  // Percussion pavilion + cultural shops kept as separate groups, repositioned (inland) clear of the round.
  const trPav=site(t+.10,l+.24,.4,.9,'Thrissur percussion pavilion','thrissur','road',false,.12);
  if(trPav){const {g}=trPav;
   for(const x of [-.3,0,.3])for(const z of [-.16,.16])kit.pillar(g,x,gy(x,z),z,.34);
   kit.box(g,0,gy(0,0)+.38,0,.74,.04,.44,M.timber);kit.roof(g,0,gy(0,0)+.4,0,.78,.48,.12,P.roofTile);
   for(let k=0;k<4;k++){const x=-.24+k*.16,yb=gy(x,.06),dy=yb+.24;
    kit.cyl(g,x,yb+.06,.06,.01,.012,.12,M.darkTimber,5);kit.cyl(g,x,dy,.06,.05,.05,.16,M.timber,10);
    for(const e of [-1,1])kit.cyl(g,x,dy+e*.085,.06,.052,.052,.01,M.white,10);
    for(let rr=0;rr<6;rr++){const a=rr/6*Math.PI*2;kit.box(g,x+Math.cos(a)*.052,dy,.06+Math.sin(a)*.052,.006,.14,.006,M.white);}}
   boxObs(g,0,0,.4,.26);finish(g);}
  const trShops=site(t-.10,l+.24,.4,.9,'Thrissur cultural shops','thrissur','road',false,.12);
  if(trShops){const {g,t,l}=trShops;
   for(let k=0;k<3;k++){const x=-.36+k*.36;kit.shopStall(g,x,0,k===1?M.gold:M.red);boxObs(g,x,0,.16,.14);}
   kit.signboard(g,0,.2,.32,'Round South','റൗണ്ട് സൗത്ത്');pathToRoad(g,0,.24,t,l);finish(g);}
  const trHomes=site(t+.04,l+.40,.5,.9,'Thrissur temple homes','thrissur','road',false,.10);
  if(trHomes){const {g,t,l}=trHomes;
   home(g,-.42,.06,0);home(g,.06,.12,2,.05);home(g,.46,-.14,3,-.08);
   kit.gltf('tree',g,-.02,.44,.9);pathToRoad(g,.06,.34,t,l);finish(g);}
 }

 // ---- 4. Palakkad (fort & paddy) -------------------------------------------------------------
 const pkFort=site(4.29,.26,.8,1.3,'Palakkad fort','palakkad','road',true,.1);
 if(pkFort){const {g}=pkFort;const c=.44;
  // Dry-moat hint: a darker sunken ring around the fort footprint.
  kit.cyl(g,0,gy(0,0)-.03,0,.82,.84,.02,moat,28);
  // Rounded corner bastions with sloped batter, parapet overhang and crenellation teeth.
  for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*c,z=sz*c;
   kit.cyl(g,x,gy(x,z)+.24,z,.13,.17,.48,P.laterite,14);
   kit.cyl(g,x,gy(x,z)+.5,z,.16,.15,.05,P.laterite,14);
   for(let k=0;k<8;k++){const a=k/8*Math.PI*2;kit.box(g,x+Math.cos(a)*.15,gy(x,z)+.56,z+Math.sin(a)*.15,.04,.06,.04,P.laterite);}
   roundObs(g,x,z,.17);}
  // Battered curtain walls; the front wall carries an arched gate tower with a closed wooden gate.
  const wall=(x:number,z:number,horiz:boolean)=>{const yb=gy(x,z),w=horiz?.66:.1,d=horiz?.1:.66;
   kit.box(g,x,yb+.16,z,w,.36,d,P.laterite);kit.box(g,x,yb+.35,z,w*.9,.06,d*.9,P.laterite);
   for(let k=0;k<5;k++){const u=-.28+k*.14,cx=x+(horiz?u:0),cz=z+(horiz?0:u);kit.box(g,cx,yb+.43,cz,.05,.06,.05,P.laterite);}
   boxObs(g,x,z,horiz?.34:.08,horiz?.08:.34);};
  wall(0,-c,true);wall(c,0,false);wall(-c,0,false);
  // Front gate: two wall halves + a taller arched tower with a scaled-up closed door.
  const yf=gy(0,c);
  for(const s of [-1,1])kit.box(g,s*.24,yf+.18,c,.18,.36,.1,P.laterite);
  kit.box(g,0,yf+.28,c,.26,.48,.12,P.laterite);
  kit.box(g,0,yf+.54,c,.3,.05,.15,P.laterite);
  kit.door(g,0,yf,c+.062,.3);
  boxObs(g,0,c,.34,.08);
  kit.signboard(g,0,.2,c+.24,'Palakkad Fort','പാലക്കാട് കോട്ട');finish(g);
 }
 if(typeof process!=='undefined'){for(const o of [...obstacles,...reserved]){const on=o.normal;const tt=(Math.atan2(on.z,on.x)+2*Math.PI)%(2*Math.PI);const r=o.radius??Math.hypot(o.halfX??0,o.halfZ??0);if(r>=.6&&tt>3.5&&tt<4.3)console.error('BIGOBS t=',tt.toFixed(3),'l=',Math.asin(on.y).toFixed(3),'r=',r.toFixed(2),'kind=',o.radius?'round':'box');}}
 const pkStreet=site(4.15,.2,.6,.9,'Palakkad Kalpathi street','palakkad','road',false,.06);
 if(pkStreet){const {g,t,l}=pkStreet;
  // Kalpathi agraharam: a continuous connected row under one shared roofline, pillared verandas, tulsi stands.
  kit.box(g,0,gy(0,0)+.04,0,1.32,.08,.3,P.stone);
  kit.roof(g,0,gy(0,0)+.3,0,1.34,.34,.14,P.roofTile);
  for(let k=0;k<6;k++){const x=-.55+k*.22,yb=gy(x,0);
   kit.box(g,x,yb+.17,0,.2,.26,.26,P.plaster[k%P.plaster.length]);
   kit.pillar(g,x-.055,yb,.17,.2);kit.pillar(g,x+.055,yb,.17,.2);
   kit.door(g,x,yb,.132,.16);
   if(k%2===0){kit.box(g,x,yb+.06,.26,.06,.12,.06,P.laterite);kit.cone(g,x,yb+.17,.26,.045,.09,M.leaf,6);}}
  boxObs(g,0,0,.6,.16);pathToRoad(g,.44,.3,t,l);finish(g);
 }
 const pkPaddy=site(4.42,.22,.7,.9,'Palakkad paddy plain','palakkad','none',false,.06);
 if(pkPaddy){const {g}=pkPaddy;
  // Drivable paddy plain (no obstacle); rice packs denser toward the road-facing edge.
  const steps=18,verts:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){const px=(x/steps-.5)*3,pz=(z/steps-.5)*2.1;verts.push(px,gy(px,pz)+.003,pz);uv.push(x/steps*20,z/steps*14);if(x<steps&&z<steps){const k=z*(steps+1)+x;idx.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();geoms.push(geo);
  const patch=new T.Mesh(geo,soilMat);patch.receiveShadow=true;g.add(patch);
  for(let row=0;row<16;row++)for(let col=0;col<22;col++){const x=(col/21-.5)*2.85,z=(row/15-.5)*2;kit.box(g,x,gy(x,z)+.04,z,.018,.08,.045,(row+col)%3?M.green:M.teaGreen);}
  for(let row=0;row<8;row++)for(let col=0;col<24;col++){const x=(col/23-.5)*2.85,z=.9+row*.06;kit.box(g,x,gy(x,z)+.04,z,.016,.07,.04,(row+col)%2?M.green:M.teaGreen);}
  g.userData.groundedVegetation=true;finish(g);
  // Drivable paddy plain: receiveShadow-only so its rice rows are exempt from the road mesh-edge rule.
  g.traverse(o=>{if((o as T.Mesh).isMesh)(o as T.Mesh).castShadow=false;});
 }
 const pkPalms=site(4.21,.3,.4,.9,'Palakkad palmyra grove','palakkad','road',false,.06);
 if(pkPalms){const {g,t,l}=pkPalms;
  for(const [x,z] of [[-.35,.1],[.1,.35],[.4,-.15]] as [number,number][])kit.gltf('palm',g,x,z,1.05);
  home(g,-.05,-.35,1);pathToRoad(g,-.05,-.2,t,l);finish(g);
 }

 return {
  landmarks,
  update(now:number){
   for(const f of flags)f.mesh.rotation.z=Math.sin(now*.002+f.phase)*.35;
   for(const r of rigs)r.pivot.rotation.x=-.12+Math.sin(now*.0009+r.phase)*.06;
  },
  dispose(){groups.forEach(g=>globe.remove(g));geoms.forEach(g=>g.dispose());localMats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 };
}
