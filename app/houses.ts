import {NATURAL_PALETTE as palette} from './natural-palette';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createHouseFactory(){
 const loader=new T.TextureLoader();
 const texture=(asset:string,kind:string,srgb=false)=>{const t=loader.load(`/textures/${asset}_${kind}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;return t};
 const pbr=(asset:string,color:number)=>new T.MeshStandardMaterial({color,map:texture(asset,'color',true),normalMap:texture(asset,'normal'),roughnessMap:texture(asset,'rough'),normalScale:new T.Vector2(.5,.5),roughness:1});
 const plaster=palette.plaster.map(c=>pbr('painted_plaster_wall',c));
 const roof=pbr('clay_roof_tiles',palette.roofTint),stone=pbr('mossy_stone_wall',palette.stoneTint);
 const wood=new T.MeshStandardMaterial({color:palette.wood,roughness:.78}),trim=new T.MeshStandardMaterial({color:0xe6dcc3,roughness:.8}),dark=new T.MeshStandardMaterial({color:0x18221e,roughness:.85});
 const glass=new T.MeshStandardMaterial({name:'Night window glow',color:0x24342e,emissive:0xffbd6b,emissiveIntensity:0,roughness:.75});
 const metal=new T.MeshStandardMaterial({color:0x3c4843,metalness:.55,roughness:.48});
 function box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 function hip(parent:T.Object3D,w:number,d:number,y:number,rise:number){
  const pts=[[-w/2,y,-d/2],[w/2,y,-d/2],[w/2,y,d/2],[-w/2,y,d/2],[-w*.22,y+rise,0],[w*.22,y+rise,0]];const faces=[[0,4,5],[0,5,1],[1,5,2],[2,5,4],[2,4,3],[3,4,0]];
  const v:number[]=[],uv:number[]=[];for(const face of faces)for(const i of face){v.push(...pts[i]);uv.push(pts[i][0]*3,(pts[i][2]+pts[i][1]*.4)*3)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mesh=new T.Mesh(geo,roof);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  box(parent,w,.028,d,0,y-.008,0,wood);box(parent,w*.45,.035,.04,0,y+rise,0,roof);
 }
 function window(parent:T.Object3D,x:number,y:number,z:number,width=.15){
  box(parent,width+.035,.235,.022,x,y,z,wood);box(parent,width,.20,.026,x,y,z+.008,glass);
  for(const dx of [-width/2,0,width/2])box(parent,.009,.21,.028,x+dx,y,z+.024,wood);
  box(parent,width,.009,.03,x,y,z+.025,wood);box(parent,width+.055,.025,.065,x,y-.12,z+.022,trim);
  for(let i=0;i<5;i++)box(parent,.008,.20,.015,x-width*.38+i*width*.19,y,z+.040,wood);
  for(const side of [-1,1]){const shutter=box(parent,width*.46,.20,.020,x+side*(width*.73),y,z+.04,wood);shutter.rotation.y=side*.42;for(let row=0;row<6;row++)box(parent,width*.45,.008,.01,x+side*(width*.73),y-.08+row*.032,z+.057,wood);}
 }
 return (index:number)=>{
  const g=new T.Group(),style=index%5,w=.82+(index%3)*.10,d=.66+(index%2)*.10,h=style===2?.91:.53;
  g.name=['Old Kerala veranda home','Tiled country bungalow','Timber balcony heritage home','Traditional village homestead','Old village tea shop'][style];
  box(g,w+.18,.24,d+.37,0,-.09,.10,stone);box(g,w,.10,d,0,.05,0,stone);box(g,w,h,d,0,h/2+.09,0,plaster[index%5]);
  // The porch projects from the front facade; foundation skirts intersect the globe.
  box(g,w+.12,.045,.25,0,.07,d/2+.11,stone);
  for(let i=0;i<3;i++)box(g,.34,.035,.08,0,.025-i*.025,d/2+.27+i*.055,stone);
  box(g,.16,.34,.025,0,.26,d/2+.017,wood);box(g,.11,.25,.008,0,.26,d/2+.033,wood);box(g,.013,.025,.012,.055,.24,d/2+.046,metal);
  for(const x of [-w*.30,w*.30])window(g,x,.36,d/2+.018);
  // Side and rear windows use the same physical frames and security bars.
  for(const side of [-1,1]){const wall=new T.Group();wall.position.x=side*w/2;wall.rotation.y=side*Math.PI/2;g.add(wall);window(wall,0,.36,.015,.18);if(style===2)window(wall,0,.79,.015,.18)}
  const rear=new T.Group();rear.position.z=-d/2;rear.rotation.y=Math.PI;g.add(rear);window(rear,-.2,.36,.01);window(rear,.2,.36,.01);
  hip(g,w+.24,d+.26,h+.10,style===2?.31:style===3?.36:.32);
  if(style!==4){
   const porch=new T.Group();porch.position.z=d/2+.10;g.add(porch);hip(porch,w+.20,.42,.52,.15);
   for(const x of [-w*.44,w*.44]){
    box(g,.045,.44,.045,x,.29,d/2+.20,wood);box(g,.075,.05,.075,x,.09,d/2+.20,stone);box(g,.085,.030,.085,x,.48,d/2+.20,wood);
    const bracket=box(g,.12,.018,.025,x-Math.sign(x)*.035,.44,d/2+.20,wood);bracket.rotation.z=Math.sign(x)*.62;
   }
   for(let i=0;i<10;i++)box(g,.015,.025,.08,-w*.46+i*w*.102,.505,d/2+.245,wood);
   for(const side of [-1,1]){box(g,w*.29,.035,.12,side*w*.29,.22,d/2+.17,wood);const back=box(g,w*.29,.13,.026,side*w*.29,.30,d/2+.22,wood);back.rotation.x=-.25;for(let i=0;i<4;i++)box(g,.015,.13,.026,side*w*.29+(i-1.5)*.05,.16,d/2+.17,wood)}
  }
  if(style===2){
   box(g,w+.09,.05,.27,0,.61,d/2+.09,trim);for(let i=0;i<12;i++)box(g,.009,.16,.012,-w/2+i*w/11,.71,d/2+.21,wood);box(g,w,.016,.025,0,.79,d/2+.21,wood);
   window(g,-w*.28,.81,d/2+.012);window(g,w*.28,.81,d/2+.012);
  }
  if(style===4){
   box(g,w*.84,.34,.03,0,.27,d/2+.045,dark);
   for(let i=0;i<9;i++)box(g,.066,.32,.025,-w*.35+i*w*.0875,.27,d/2+.065,wood);
   for(const x of [-w*.46,w*.46])box(g,.032,.48,.032,x,.29,d/2+.24,wood);
   const canopy=box(g,w+.10,.025,.35,0,.53,d/2+.14,roof);canopy.rotation.x=.16;
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e9dfb9';ctx.fillRect(0,0,512,96);ctx.fillStyle='#294c3c';ctx.textAlign='center';ctx.font='bold 36px sans-serif';ctx.fillText(index%2?'VILLAGE STORES':'KERALA TEA SHOP',256,61);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;box(g,w*.90,.115,.025,0,.49,d/2+.08,new T.MeshStandardMaterial({map,roughness:.9}));
  }
  // Rainwater pipes, plinth trim and porch furniture give the buildings human scale.
  box(g,.014,h+.05,.014,w*.48,h/2+.07,d/2+.026,metal);
  box(g,w+.015,.025,.024,0,.10,d/2+.015,trim);
  if(style!==4){box(g,.22,.025,.09,-w*.27,.19,d/2+.12,wood);for(const x of [-w*.27-.08,-w*.27+.08])box(g,.018,.10,.06,x,.13,d/2+.12,wood)}
  g.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
  g.traverse(o=>{if(o instanceof T.Mesh){const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);const mat=o.material as T.Material;if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(geo);o.geometry.dispose()}});
  g.clear();for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);if(merged){const mesh=new T.Mesh(merged,mat);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh)}geometries.forEach(geo=>geo.dispose())}
  const porchLight=new T.PointLight(0xffc781,0,.95,2);porchLight.name='Night porch light';porchLight.position.set(0,.46,d/2+.20);g.add(porchLight);g.userData.buildingLights=true;
  const bulb=new T.Mesh(new T.SphereGeometry(.015,8,6),new T.MeshStandardMaterial({name:'Night porch glow',color:0xf5dfb3,emissive:0xffbf72,emissiveIntensity:0}));bulb.position.copy(porchLight.position);g.add(bulb);
  return {group:g,halfX:w/2+.11,halfZ:d/2+.46};
 };
}
