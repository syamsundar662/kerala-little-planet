import * as T from 'three';
import {WORLD_RADIUS as R} from './world';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHouseFactory} from './houses';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
// Shared Kerala scenery kit. Regional modules call these builders; every mesh reuses one
// geometry+material instance so a whole village stays cheap to draw. Surfaces are now driven by
// the same CC0 PBR texture pipeline as houses.ts (map+normal+rough, sRGB colour, anisotropy 4).
export type Kit={
 mats:{clay:T.MeshStandardMaterial;tile:T.MeshStandardMaterial;timber:T.MeshStandardMaterial;darkTimber:T.MeshStandardMaterial;lime:T.MeshStandardMaterial;white:T.MeshStandardMaterial;laterite:T.MeshStandardMaterial;concrete:T.MeshStandardMaterial;thatch:T.MeshStandardMaterial;leaf:T.MeshStandardMaterial;teaGreen:T.MeshStandardMaterial;stone:T.MeshStandardMaterial;gold:T.MeshStandardMaterial;red:T.MeshStandardMaterial;blue:T.MeshStandardMaterial;green:T.MeshStandardMaterial;sand:T.MeshStandardMaterial;water:T.MeshStandardMaterial};
 box(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material):T.Mesh;
 cyl(parent:T.Object3D,x:number,y:number,z:number,rTop:number,rBot:number,h:number,m:T.Material,seg?:number):T.Mesh;
 cone(parent:T.Object3D,x:number,y:number,z:number,r:number,h:number,m:T.Material,seg?:number):T.Mesh;
 roof(parent:T.Object3D,x:number,y:number,z:number,w:number,d:number,rise:number,m:T.Material):T.Mesh;
 tiledHouse(parent:T.Object3D,x:number,z:number,w:number,h:number,d:number,wall?:T.Material):void;
 lateriteHouse(parent:T.Object3D,x:number,z:number,w:number,h:number,d:number):void;
 shopStall(parent:T.Object3D,x:number,z:number,awning:T.Material):void;
 palm(parent:T.Object3D,x:number,z:number,h?:number):void;
 boat(parent:T.Object3D,x:number,z:number,length:number,paint?:T.Material):T.Group;
 flagPole(parent:T.Object3D,x:number,z:number,h:number,flag:T.Material):void;
 signboard(parent:T.Object3D,x:number,y:number,z:number,text:string,malayalam?:string):void;
 pbr:{plaster:T.MeshStandardMaterial[];roofTile:T.MeshStandardMaterial;stone:T.MeshStandardMaterial;laterite:T.MeshStandardMaterial;woodPlank:T.MeshStandardMaterial;thatch:T.MeshStandardMaterial;metalRoof:T.MeshStandardMaterial};
 window(parent:T.Object3D,x:number,y:number,z:number,width?:number):void;
 door(parent:T.Object3D,x:number,y:number,z:number,h?:number):void;
 pillar(parent:T.Object3D,x:number,y:number,z:number,h:number):void;
 house(parent:T.Object3D,x:number,z:number,index:number,ry?:number):{halfX:number;halfZ:number};
 gltf(name:'palm'|'tree'|'fishing-boat'|'canoe',parent:T.Object3D,x:number,z:number,scale?:number):void;
 lamp(parent:T.Object3D,x:number,z:number):void;
 path(parent:T.Object3D,x1:number,z1:number,x2:number,z2:number,width?:number):void;
 finish(g:T.Group):void;
 dispose():void;
};
export function createKit():Kit{
 const loader=new T.TextureLoader();
 const textures:T.Texture[]=[],signMats:T.Material[]=[],geos:T.BufferGeometry[]=[],houseGroups:T.Group[]=[];
 // One shared Texture object per asset+map, tinted per material — mirrors houses.ts:7-8.
 const texCache=new Map<string,T.Texture>();
 // aerial_grass_rock ships with diff/nor_gl/rough_1k suffixes rather than color/normal/rough.
 const texKind:Record<string,Record<string,string>>={aerial_grass_rock:{color:'diff_1k',normal:'nor_gl_1k',rough:'rough_1k'}};
 const texture=(asset:string,kind:string,srgb=false)=>{const key=asset+kind;let t=texCache.get(key);if(!t){const file=texKind[asset]?.[kind]??kind;t=loader.load(`/textures/${asset}_${file}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;texCache.set(key,t);textures.push(t)}return t};
 const pbrMat=(asset:string,color:number,roughness=1,metalness=0)=>new T.MeshStandardMaterial({color,map:texture(asset,'color',true),normalMap:texture(asset,'normal'),roughnessMap:texture(asset,'rough'),normalScale:new T.Vector2(.5,.5),roughness,metalness});
 const S=(color:number,roughness=.9,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 // Photographed detail survives because tints stay light (houses.ts uses palette.plaster the same way).
 const plaster=[0xe3decd,0xd7cfbb,0xcebea5,0xe7e0d0,0xc5b9a1].map(c=>pbrMat('painted_plaster_wall',c));
 const windowGlass=new T.MeshStandardMaterial({name:'Night window glow',color:0x24342e,emissive:0xffbd6b,emissiveIntensity:0,roughness:.75});
 const lampGlow=new T.MeshStandardMaterial({name:'Night porch glow',color:0xf5dfb3,emissive:0xffbf72,emissiveIntensity:0,roughness:.5});
 const ironMat=new T.MeshStandardMaterial({color:0x24262a,metalness:.6,roughness:.5});
 const pathMat=pbrMat('worn_asphalt',0x7a5a3c);
 const metalRoof=pbrMat('corrugated_metal',0x9aa1a0,.6,.5);
 const mats={
  clay:pbrMat('clay_roof_tiles',0xd7a586),tile:pbrMat('clay_roof_tiles',0xc98f6f),
  timber:pbrMat('wood_planks',0x8a6a45),darkTimber:pbrMat('wood_planks',0x4a3420),
  lime:pbrMat('painted_plaster_wall',0xe8ddc4),white:pbrMat('painted_plaster_wall',0xf2efe6),
  laterite:pbrMat('red_brick',0x9a4f2e),concrete:pbrMat('worn_asphalt',0xc4c0b4),
  thatch:pbrMat('thatch',0xcbb079),leaf:pbrMat('aerial_grass_rock',0x2f6b32,.88),teaGreen:pbrMat('aerial_grass_rock',0x4fae3c,.86),
  stone:pbrMat('mossy_stone_wall',0x9a948a),gold:S(0xd4af37,.45,.55),red:pbrMat('wood_planks',0xb23a2e,.88),
  blue:pbrMat('wood_planks',0x2f5f8a,.85),green:pbrMat('wood_planks',0x3f8a3f,.88),sand:pbrMat('painted_plaster_wall',0xd8c89a,.94),water:S(0x2f7f88,.3,.2)};
 const pbr={plaster,roofTile:mats.tile,stone:mats.stone,laterite:mats.laterite,woodPlank:mats.timber,thatch:mats.thatch,metalRoof};
 // One shared unit primitive each; tapered cylinders/cones fall back to tracked geometry.
 const boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,12),coneGeo=new T.ConeGeometry(1,1,12),plateGeo=new T.PlaneGeometry(.5,.2),nutGeo=new T.SphereGeometry(1,6,5);
 const hullGeo=new T.SphereGeometry(1,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),postGeo=new T.CylinderGeometry(.01,.013,1,6);
 // Gabled triangular-prism roof: span across x, ridge along z, apex at local y=1 (now UV-mapped).
 const roofGeo=(()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5, .5,0,-.5, 0,1,-.5, -.5,0,.5, .5,0,.5, 0,1,.5],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0, 1,0, .5,1, 0,0, 1,0, .5,1],2));g.setIndex([0,3,5, 0,5,2, 1,2,5, 1,5,4, 0,2,1, 3,4,5, 0,1,4, 0,4,3]);g.computeVertexNormals();return g})();
 const y0=(x:number,z:number)=>Math.sqrt(R*R-x*x-z*z)-R;
 const mesh=(parent:T.Object3D,g:T.BufferGeometry,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
 const box=(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const o=mesh(parent,boxGeo,x,y,z,m);o.scale.set(w,h,d);return o};
 const cyl=(parent:T.Object3D,x:number,y:number,z:number,rTop:number,rBot:number,h:number,m:T.Material,seg=12)=>{
  if(rTop===rBot&&seg===12){const o=mesh(parent,cylGeo,x,y,z,m);o.scale.set(rBot,h,rBot);return o}
  const g=new T.CylinderGeometry(rTop,rBot,h,seg);geos.push(g);return mesh(parent,g,x,y,z,m)};
 const cone=(parent:T.Object3D,x:number,y:number,z:number,r:number,h:number,m:T.Material,seg=12)=>{
  if(seg===12){const o=mesh(parent,coneGeo,x,y,z,m);o.scale.set(r,h,r);return o}
  const g=new T.ConeGeometry(r,h,seg);geos.push(g);return mesh(parent,g,x,y,z,m)};
 const roof=(parent:T.Object3D,x:number,y:number,z:number,w:number,d:number,rise:number,m:T.Material)=>{const o=mesh(parent,roofGeo,x,y,z,m);o.scale.set(w*1.08,rise,d*1.08);return o};
 // Houses.ts-quality components placed at explicit local coords.
 const window=(parent:T.Object3D,x:number,y:number,z:number,width=.15)=>{
  box(parent,x,y,z,width+.035,.235,.022,mats.timber);box(parent,x,y,z+.008,width,.20,.026,windowGlass);
  for(const dx of[-width/2,0,width/2])box(parent,x+dx,y,z+.024,.009,.21,.028,mats.timber);
  box(parent,x,y,z+.025,width,.009,.03,mats.timber);
  box(parent,x,y-.12,z+.022,width+.055,.025,.055,mats.stone);box(parent,x,y+.125,z+.022,width+.055,.028,.05,mats.stone);
  for(const side of[-1,1]){const sh=box(parent,x+side*(width*.73),y,z+.04,width*.46,.20,.020,mats.darkTimber);sh.rotation.y=side*.42;for(let row=0;row<6;row++)box(parent,x+side*(width*.73),y-.08+row*.032,z+.057,width*.45,.008,.01,mats.darkTimber)}
 };
 const door=(parent:T.Object3D,x:number,y:number,z:number,h=.34)=>{
  const w=h*.5;box(parent,x,y+h/2,z,w+.03,h+.03,.02,mats.timber);box(parent,x,y+h/2,z+.012,w,h,.02,mats.darkTimber);
  for(let i=0;i<4;i++)box(parent,x-w*.36+i*w*.24,y+h/2,z+.026,.012,h*.92,.006,mats.timber);
  box(parent,x+w*.3,y+h*.5,z+.03,.02,.02,.02,mats.gold);
 };
 const pillar=(parent:T.Object3D,x:number,y:number,z:number,h:number)=>{
  box(parent,x,y+.03,z,.09,.06,.09,mats.stone);cyl(parent,x,y+.06+h/2,z,.028,.034,h,mats.timber);box(parent,x,y+.06+h+.025,z,.1,.05,.1,mats.timber);
 };
 const tiledHouse=(parent:T.Object3D,x:number,z:number,w:number,h:number,d:number,wall:T.Material=mats.lime)=>{
  const b=y0(x,z),fz=z+d/2;
  box(parent,x,b+.03,z,w+.08,.06,d+.08,mats.stone);
  box(parent,x,b+.06+h/2,z,w,h,d,wall);
  roof(parent,x,b+.06+h,z,w,d,w*.4,mats.tile);
  box(parent,x,b+.05+h,z,w+.12,.03,d+.12,mats.darkTimber);
  box(parent,x,b+.06+h+w*.4,z,.05,.03,d*1.02,mats.tile);
  door(parent,x,b+.06,fz+.005,h*.6);
  for(const s of[-1,1])window(parent,x+s*w*.32,b+.06+h*.55,fz+.005,w*.16);
  for(const s of[-1,1])pillar(parent,x+s*w*.42,b+.06,fz+w*.22,h*.7);
  box(parent,x,b+.05,fz+w*.14,w*.94,.04,w*.26,mats.concrete);
 };
 const lateriteHouse=(parent:T.Object3D,x:number,z:number,w:number,h:number,d:number)=>{
  const b=y0(x,z),fz=z+d/2;
  box(parent,x,b+.03,z,w+.08,.06,d+.08,mats.stone);
  box(parent,x,b+.06+h/2,z,w,h,d,mats.laterite);
  for(let k=1;k<3;k++)box(parent,x,b+.06+h*k/3,fz+.002,w*.99,h*.04,.006,mats.stone);
  roof(parent,x,b+.06+h,z,w,d,w*.38,mats.tile);
  box(parent,x,b+.05+h,z,w+.1,.03,d+.1,mats.darkTimber);
  box(parent,x,b+.06+h+w*.38,z,.05,.03,d*1.02,mats.tile);
  door(parent,x,b+.06,fz+.005,h*.58);
  window(parent,x+w*.34,b+.06+h*.55,fz+.005,w*.15);
  for(const s of[-1,1])pillar(parent,x+s*w*.44,b+.06,fz+w*.2,h*.62);
 };
 const shopStall=(parent:T.Object3D,x:number,z:number,awning:T.Material)=>{
  const b=y0(x,z);
  box(parent,x,b+.06+.19,z-.15,.52,.42,.04,mats.lime);
  for(const s of[-1,1])box(parent,x+s*.25,b+.06+.19,z-.01,.04,.42,.3,mats.lime);
  roof(parent,x,b+.48,z-.02,.58,.4,.12,mats.tile);
  box(parent,x,b+.47,z-.02,.64,.03,.44,mats.darkTimber);
  box(parent,x,b+.12,z+.14,.52,.16,.1,mats.timber);box(parent,x,b+.21,z+.14,.54,.02,.12,mats.darkTimber);
  const aw=box(parent,x,b+.44,z+.06,.62,.02,.32,awning);aw.rotation.x=-.2;
  for(const s of[-1,1])cyl(parent,x+s*.28,b+.24,z+.2,.012,.014,.42,mats.timber);
  const crate=[mats.red,mats.green,mats.gold];for(let j=0;j<3;j++){box(parent,x-.17+j*.17,b+.09,z+.2,.12,.12,.12,mats.timber);box(parent,x-.17+j*.17,b+.16,z+.2,.1,.04,.1,crate[j])}
  for(let k=0;k<4;k++)box(parent,x-.18+k*.12,b+.34,z+.16,.03,.07,.03,k%2?mats.red:mats.gold);
 };
 const palm=(parent:T.Object3D,x:number,z:number,h=.55)=>{
  const b=y0(x,z);let py=b,px=x,ang=0;const seg=6;
  for(let i=0;i<seg;i++){const sh=h*.22,r0=.032-i*.004,r1=.032-(i+1)*.004;ang+=.11;cyl(parent,px+Math.sin(ang)*sh*.3,py+sh/2,z,r1,r0,sh,mats.timber,6).rotation.z=ang;if(i%2===0)cyl(parent,px+Math.sin(ang)*sh*.3,py+sh*.7,z,r0+.006,r0+.006,.012,mats.darkTimber,6).rotation.z=ang;py+=sh*.9;px+=Math.sin(ang)*sh*.5}
  const cx=px,cy=py+.02;cone(parent,cx,cy,z,.05,.05,mats.leaf,6);
  const fronds=9;for(let k=0;k<fronds;k++){const a=k/fronds*Math.PI*2,len=.3;const fx=cx+Math.cos(a)*len*.45,fz=z+Math.sin(a)*len*.45;const f=box(parent,fx,cy-.02,fz,len,.012,.055,k%2?mats.teaGreen:mats.leaf);f.rotation.y=-a;f.rotation.z=.34}
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2;mesh(parent,nutGeo,cx+Math.cos(a)*.028,cy-.035,z+Math.sin(a)*.028,mats.darkTimber).scale.setScalar(.022)}
 };
 const boat=(parent:T.Object3D,x:number,z:number,length:number,paint:T.Material=mats.timber)=>{
  const b=y0(x,z),g=new T.Group();g.position.set(x,b,z);parent.add(g);
  const hull=new T.Mesh(hullGeo,paint);hull.scale.set(length*.5,length*.13,length*.22);hull.material.side=T.DoubleSide;hull.castShadow=hull.receiveShadow=true;g.add(hull);
  for(const s of[-1,1])box(g,0,.012,s*length*.2,length*.9,.02,.02,mats.darkTimber);
  for(const s of[-.25,.25])box(g,length*s,.006,0,.05,.02,length*.4,mats.timber);
  for(const s of[-1,1])box(g,s*length*.46,.03,0,.03,.09,.05,mats.darkTimber);
  return g;
 };
 const flagPole=(parent:T.Object3D,x:number,z:number,h:number,flag:T.Material)=>{
  const b=y0(x,z);cyl(parent,x,b+h/2,z,.012,.016,h,mats.stone,8);box(parent,x+.09,b+h*.86,z,.17,.11,.006,flag);
 };
 const signboard=(parent:T.Object3D,x:number,y:number,z:number,text:string,malayalam?:string)=>{
  const b=y0(x,z),canvas=document.createElement('canvas');canvas.width=512;canvas.height=malayalam?256:180;const c=canvas.getContext('2d')!;
  c.fillStyle='#17463b';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle='#d9e9b3';c.lineWidth=6;c.strokeRect(8,8,canvas.width-16,canvas.height-16);
  c.textAlign='center';c.fillStyle='#eef3dc';c.font=`600 ${text.length>16?42:56}px sans-serif`;c.fillText(text,256,malayalam?104:112);
  if(malayalam){c.fillStyle='#c9dfa4';c.font='38px sans-serif';c.fillText(malayalam,256,176)}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
  const mat=new T.MeshStandardMaterial({map:tex,roughness:.9,side:T.DoubleSide});signMats.push(mat);
  const plate=new T.Mesh(plateGeo,mat);plate.position.set(x,b+y+.1,z);plate.castShadow=plate.receiveShadow=true;parent.add(plate);
  for(const s of[-1,1]){const p=new T.Mesh(postGeo,mats.timber);p.position.set(x+s*.18,b+(y+.1)/2,z);p.scale.y=y+.1;p.castShadow=p.receiveShadow=true;parent.add(p)}
 };
 // A full detailed home from houses.ts, self-grounded and kept intact through finish().
 let houseFactory:ReturnType<typeof createHouseFactory>|undefined;
 const house=(parent:T.Object3D,x:number,z:number,index:number,ry=0)=>{
  if(!houseFactory)houseFactory=createHouseFactory();
  const {group,halfX,halfZ}=houseFactory(index);
  group.position.set(x,y0(x,z),z);group.rotateY(ry);group.userData.dyn=true;
  parent.add(group);houseGroups.push(group);
  return {halfX,halfZ};
 };
 // Palm/tree GLB loaded once; placeholder appears immediately, the clone attaches when ready.
 const gltfLoader=new GLTFLoader(),gltfCache=new Map<string,Promise<T.Group>>();
 // Boats share a loader path but are normalized by LENGTH (bow toward +x) instead of height,
 // grounded so the hull sits at local y=0; callers then pass the target length as the scale arg.
 const loadModel=(name:'palm'|'tree'|'fishing-boat'|'canoe')=>{let p=gltfCache.get(name);if(!p){p=new Promise<T.Group>((resolve,reject)=>{try{gltfLoader.load('/'+name+'.glb',g=>{const scene=g.scene,boat=name==='fishing-boat'||name==='canoe';if(boat)scene.rotation.y=Math.PI/2;scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());scene.position.set(-center.x,-bounds.min.y,-center.z);scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;if(boat){const m=o.material as T.MeshStandardMaterial;if(m)m.side=T.DoubleSide}}});const wrap=new T.Group();wrap.add(scene);wrap.scale.setScalar(boat?1/(size.x||1):(name==='palm'?1.65:.9)/(size.y||1));resolve(wrap)},undefined,reject)}catch(e){reject(e)}});gltfCache.set(name,p)}return p};
 const gltf=(name:'palm'|'tree'|'fishing-boat'|'canoe',parent:T.Object3D,x:number,z:number,scale=1)=>{
  const holder=new T.Group();holder.position.set(x,y0(x,z),z);holder.scale.setScalar(scale);holder.userData.dyn=true;parent.add(holder);
  loadModel(name).then(model=>{holder.add(model.clone(true))}).catch(()=>{});
 };
 const lamp=(parent:T.Object3D,x:number,z:number)=>{
  const b=y0(x,z);
  cyl(parent,x,b+.03,z,.05,.07,.06,ironMat,8);cyl(parent,x,b+.32,z,.016,.024,.52,ironMat,8);cyl(parent,x,b+.58,z,.05,.036,.05,ironMat,8);
  box(parent,x,b+.63,z,.085,.07,.085,lampGlow);
  for(const[dx,dz] of[[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][])cyl(parent,x+dx*.042,b+.63,z+dz*.042,.006,.006,.075,ironMat,4);
  cone(parent,x,b+.71,z,.06,.05,ironMat,6);box(parent,x,b+.755,z,.012,.03,.012,ironMat);
 };
 const path=(parent:T.Object3D,x1:number,z1:number,x2:number,z2:number,width=.16)=>{
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz)||1e-4,steps=Math.max(1,Math.round(len/.15));
  const ux=dx/len,uz=dz/len,px=-uz*width/2,pz=ux*width/2;
  const py=(x:number,z:number)=>Math.sqrt(Math.max(0,R*R-x*x-z*z))-R+.004;
  const v:number[]=[],uv:number[]=[];
  for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,ax=x1+dx*a,az=z1+dz*a,bx=x1+dx*b,bz=z1+dz*b;
   const p1=[ax+px,py(ax+px,az+pz),az+pz],p2=[ax-px,py(ax-px,az-pz),az-pz],p3=[bx+px,py(bx+px,bz+pz),bz+pz],p4=[bx-px,py(bx-px,bz-pz),bz-pz];
   v.push(...p1,...p3,...p2,...p2,...p3,...p4);
   uv.push(0,a*len/width,1,b*len/width,0,a*len/width,0,a*len/width,1,b*len/width,1,b*len/width)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();geos.push(geo);
  const m=new T.Mesh(geo,pathMat);m.receiveShadow=true;m.castShadow=false;parent.add(m);
 };
 // Per-material merge like houses.ts:65-67, but animated/dyn subtrees and PointLights are kept live.
 const finish=(g:T.Group)=>{
  g.updateWorldMatrix(true,true);const inverse=g.matrixWorld.clone().invert();
  const batches=new Map<T.Material,T.BufferGeometry[]>(),keep:T.Object3D[]=[],keepWorld=new Map<T.Object3D,T.Matrix4>();
  const scan=(o:T.Object3D)=>{for(const child of o.children){
   if(child.userData.animated||child.userData.dyn||child instanceof T.PointLight){child.updateWorldMatrix(true,false);keepWorld.set(child,child.matrixWorld.clone());keep.push(child);continue}
   if(child instanceof T.Mesh&&!Array.isArray(child.material)){child.updateWorldMatrix(true,false);const src=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();src.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,child.matrixWorld));const mat=child.material as T.Material;if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(src)}
   scan(child)}};
  scan(g);
  for(const k of keep)k.removeFromParent();
  g.clear();
  for(const[mat,list] of batches){const merged=mergeGeometries(list);if(merged){const o=new T.Mesh(merged,mat);o.castShadow=o.receiveShadow=true;g.add(o)}list.forEach(geo=>geo.dispose())}
  for(const k of keep){g.add(k);new T.Matrix4().multiplyMatrices(inverse,keepWorld.get(k)!).decompose(k.position,k.quaternion,k.scale)}
 };
 return {mats,box,cyl,cone,roof,tiledHouse,lateriteHouse,shopStall,palm,boat,flagPole,signboard,pbr,window,door,pillar,house,gltf,lamp,path,finish,dispose(){
  [boxGeo,cylGeo,coneGeo,roofGeo,plateGeo,hullGeo,postGeo,nutGeo,...geos].forEach(g=>g.dispose());
  Object.values(mats).forEach(m=>m.dispose());
  [...plaster,windowGlass,lampGlow,ironMat,pathMat,metalRoof,...signMats].forEach(m=>m.dispose());
  textures.forEach(t=>t.dispose());
  const seenMat=new Set<T.Material>(),seenTex=new Set<T.Texture>();
  for(const hg of houseGroups)hg.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(seenMat.has(m))continue;seenMat.add(m);for(const key of ['map','normalMap','roughnessMap','emissiveMap'] as const){const tx=(m as T.MeshStandardMaterial)[key];if(tx&&!seenTex.has(tx)){seenTex.add(tx);tx.dispose()}}m.dispose()}}});
 }};
}
