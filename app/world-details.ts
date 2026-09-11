import * as T from 'three';
import {WORLD_RADIUS as R,SEA_LEVEL,COAST_GLSL,coastLatitude,isDryLand,roadOffset,roadLatitude} from './world';
import {batchStaticMeshes} from './batch-meshes';
import type {Obstacle} from './vehicle-physics';

export function coastalTerrain(material:T.MeshStandardMaterial){
 const grade=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  grade.call(material,shader,renderer);
  shader.vertexShader='varying vec3 coastPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncoastPosition=position;');
  shader.fragmentShader='varying vec3 coastPosition;\n'+COAST_GLSL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 coastN=normalize(coastPosition);float longitude=atan(coastN.z,coastN.x);float latitude=asin(clamp(coastN.y,-1.0,1.0));
   float beach=1.0-smoothstep(0.0,.028,latitude-coastLatitude(longitude));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.29,.16),beach);
  `);
 };
}

// Wide physical scenery with shared materials; no extra reflection render passes.
export function addWorldDetails(globe:T.Group,obstacles:Obstacle[]){
 const water=new T.MeshStandardMaterial({color:0x206e79,roughness:.29,metalness:.25});
 const sea=new T.Mesh(new T.SphereGeometry(R+SEA_LEVEL,192,128),water);sea.name='Arabian Sea';sea.receiveShadow=true;globe.add(sea);
 const ripple={value:0};water.onBeforeCompile=shader=>{shader.uniforms.seaTime=ripple;shader.vertexShader='varying vec3 seaPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nseaPoint=position;');shader.fragmentShader='uniform float seaTime;varying vec3 seaPoint;\n'+COAST_GLSL+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 normal=normalize(normal+vec3(sin(seaPoint.x*36.0+seaTime)*.07,cos(seaPoint.z*31.0+seaTime*.8)*.07,0.0));
 `);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 seaN=normalize(seaPoint);float seaLon=atan(seaN.z,seaN.x),seaLat=asin(clamp(seaN.y,-1.0,1.0)),coastGap=seaLat-coastLatitude(seaLon);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.56,.58),(1.0-smoothstep(0.0,.11,-coastGap))*.4);
 float foam=(1.0-smoothstep(0.0,.02,abs(coastGap)))*(.55+.45*sin(seaLon*130.0+seaTime*2.6));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.97,.96),clamp(foam,0.0,1.0)*.85);
 `)};
 // Same CC0 PBR pipeline as houses.ts / kerala-props: shared map+normal+rough, tinted per material.
 const gtexKind:Record<string,Record<string,string>>={aerial_grass_rock:{color:'diff_1k',normal:'nor_gl_1k',rough:'rough_1k'}};
 const texLoader=new T.TextureLoader(),detailTex:T.Texture[]=[];
 const dtex=(asset:string,kind:string,srgb=false)=>{const file=gtexKind[asset]?.[kind]??kind;const t=texLoader.load(`/textures/${asset}_${file}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;detailTex.push(t);return t;};
 const pm=(asset:string,color:number,roughness=1)=>new T.MeshStandardMaterial({color,map:dtex(asset,'color',true),normalMap:dtex(asset,'normal'),roughnessMap:dtex(asset,'rough'),normalScale:new T.Vector2(.5,.5),roughness});
 const clay=pm('clay_roof_tiles',0x965336),timber=pm('wood_planks',0x503b28),lime=pm('painted_plaster_wall',0xe0d6ba),earth=pm('aerial_grass_rock',0x6d6940),rice=pm('aerial_grass_rock',0x428348,.9),riceLight=pm('aerial_grass_rock',0x60994b,.9),boatPaint=pm('wood_planks',0x336a80);
 const boxGeo=new T.BoxGeometry(1,1,1);const box=(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const mesh=new T.Mesh(boxGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh};
 const normal=(t:number,l:number)=>new T.Vector3(Math.cos(t)*Math.cos(l),Math.sin(l),Math.sin(t)*Math.cos(l));
 const reserved:Obstacle[]=[];
 const clear=(n:T.Vector3,extent:number)=>[...obstacles,...reserved].every(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*R>extent+(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.15);
 const anchor=(t:number,l:number,name:string,r=R)=>{const g=new T.Group();g.name=name;const n=normal(t,l);g.position.copy(n).multiplyScalar(r);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);globe.add(g);return g};
 const finish=(g:T.Group)=>batchStaticMeshes(g);
 // Small paddy parcels are drivable; their rows follow the actual spherical ground.
 let fields=0,shops=0;
 for(let i=0;i<48;i++){
  const t=i*2.399,l=-.48+((i*17)%29)/29*1.18,n=normal(t,l);
  if(!isDryLand(t,l)||roadOffset(t,l)<1.5||!clear(n,1.1))continue;
  const g=anchor(t,l,'Paddy field '+(++fields));reserved.push({normal:n,radius:.92});
  const verts:number[]=[],uv:number[]=[],indices:number[]=[],steps=16;
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){const px=(x/steps-.5)*1.5,pz=(z/steps-.5)*1.05;verts.push(px,Math.sqrt(R*R-px*px-pz*pz)-R+.003,pz);uv.push(x/steps*10,z/steps*7);if(x<steps&&z<steps){const k=z*(steps+1)+x;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2)}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const patch=new T.Mesh(geo,earth);patch.receiveShadow=true;g.add(patch);
  // Shared low-poly rice clumps merge to two draws per parcel.
  for(let row=0;row<10;row++)for(let col=0;col<16;col++){
   const x=(col/15-.5)*1.40,z=(row/9-.5)*.95,y=Math.sqrt(R*R-x*x-z*z)-R;
   box(g,x,y+.038,z,.016,.074,.042,(row+col)%3?rice:riceLight);
  }
  g.userData.groundedVegetation=true;finish(g);
 }
 // Roadside tea shops with shaded verandas, benches and produce crates.
 for(let i=0;i<18;i++){
  const t=.28+i*Math.PI*2/18,l=roadLatitude(t,i%3)+(i%2?1:-1)*.16,n=normal(t,l);
  if(!isDryLand(t,l)||roadOffset(t,l)<1.0||!clear(n,.82))continue;
  const g=anchor(t,l,'Village tea shop '+(++shops));const front=normal(t,roadLatitude(t,i%3)).sub(n).projectOnPlane(n).normalize(),right=new T.Vector3().crossVectors(n,front);g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,n,front));
  box(g,0,.23,0,.66,.46,.48,lime);box(g,0,.28,.245,.42,.32,.012,timber);box(g,0,.51,.07,.87,.06,.75,clay).rotation.x=.12;
  for(const x of [-.36,.36])box(g,x,.25,.37,.025,.50,.025,timber);
  box(g,0,.17,.36,.48,.035,.13,timber);for(const x of [-.22,.22])box(g,x,.08,.36,.025,.16,.025,timber);
  for(let j=0;j<3;j++)box(g,.32,.07,-.16+j*.15,.12,.14,.12,earth);
  obstacles.push({normal:n,axis:right,halfX:.44,halfZ:.45});finish(g);
 }
 // Canoes just off the coastline, plus wooden mooring posts.
 for(let i=0;i<9;i++){
  const t=.3+i*.69,l=coastLatitude(t)-.055,g=anchor(t,l,'Coastal fishing canoe',R+SEA_LEVEL);
  const hull=new T.Mesh(new T.SphereGeometry(1,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),i%2?timber:boatPaint);hull.scale.set(.48,.095,.105);hull.material.side=T.DoubleSide;g.add(hull);
  for(const x of [-.23,0,.23])box(g,x,.005,0,.05,.025,.16,timber);
  const oar=box(g,.05,.055,0,.78,.012,.02,timber);oar.rotation.y=.55;
  finish(g);
 }
 return {fields,shops,update(now:number){ripple.value=now*.001},dispose(){detailTex.forEach(t=>t.dispose())}};
}
