import {WORLD_RADIUS} from './world';
import {createPondEffects} from './pond-effects';
import {NATURAL_PALETTE as palette} from './natural-palette';
import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';

export function createPond(globe:T.Group,terrain:T.BufferGeometry){
 const normal=new T.Vector3(Math.cos(2.3)*Math.cos(.95),Math.sin(.95),Math.sin(2.3)*Math.cos(.95));
 const orientation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),normal),inverse=orientation.clone().invert();
 const anchor=normal.clone().multiplyScalar(WORLD_RADIUS),waterLevel=-.025;
 const edge=(a:number)=>1+.06*Math.sin(a*3)+.035*Math.cos(a*5);
 // Carve a shallow basin instead of laying a flattened sphere above the land.
 const positions=terrain.attributes.position;
 for(let i=0;i<positions.count;i++){
  const v=new T.Vector3().fromBufferAttribute(positions,i),local=v.clone().sub(anchor).applyQuaternion(inverse);
  if(local.y<-.4)continue;const a=Math.atan2(local.z/.45,local.x/.72),r=Math.hypot(local.x/.72,local.z/.45)/edge(a);
  if(r<1.32){const blend=1-T.MathUtils.smoothstep(r,.88,1.32);local.y=T.MathUtils.lerp(local.y,Math.min(local.y,-.12),blend);local.applyQuaternion(orientation).add(anchor);positions.setXYZ(i,local.x,local.y,local.z)}
 }
 positions.needsUpdate=true;terrain.computeVertexNormals();
 // Preserve exact smooth sphere normals away from the locally carved basin.
 const terrainNormals=terrain.attributes.normal;
 for(let i=0;i<positions.count;i++){const p=new T.Vector3().fromBufferAttribute(positions,i);if(Math.abs(p.length()-WORLD_RADIUS)<.00001){p.normalize();terrainNormals.setXYZ(i,p.x,p.y,p.z)}}
 terrainNormals.needsUpdate=true;
 const pixels=new Uint8Array(128*128*4);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;pixels[i]=128+Math.round(24*Math.sin(x*Math.PI/16+y*Math.PI/32));pixels[i+1]=128+Math.round(24*Math.cos(y*Math.PI/16-x*Math.PI/32));pixels[i+2]=250;pixels[i+3]=255}
 const normals=new T.DataTexture(pixels,128,128);normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.magFilter=normals.minFilter=T.LinearFilter;normals.needsUpdate=true;
 const waters:Water[]=[];const effects=createPondEffects();
 const make=(flat:boolean)=>{
  const group=new T.Group();group.name='Grounded village pond';
  const shape=new T.Shape();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=edge(a),x=Math.cos(a)*.72*r,z=Math.sin(a)*.45*r;if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z)}
  const water=new Water(new T.ShapeGeometry(shape),{textureWidth:512,textureHeight:512,waterNormals:normals,waterColor:palette.water,sunColor:0xfff0ce,sunDirection:new T.Vector3(-8,16,9).normalize(),distortionScale:.45,alpha:1});
  const reflect=water.onBeforeRender.bind(water);let lastReflection=-Infinity;water.onBeforeRender=(...args)=>{const now=performance.now();if(now-lastReflection<80)return;lastReflection=now;reflect(...args)};
  water.rotation.x=-Math.PI/2;water.position.y=waterLevel;water.material.uniforms.size.value=8;group.add(water);waters.push(water);
  const v:number[]=[],uv:number[]=[],ids:number[]=[];
  for(let ring=0;ring<3;ring++)for(let i=0;i<=96;i++){
   const a=i/96*Math.PI*2,r=edge(a)*[.99,1.12,1.38][ring],x=Math.cos(a)*.72*r,z=Math.sin(a)*.45*r;
   const y=flat?[waterLevel+.008,waterLevel+.027,-.003][ring]:[waterLevel+.008,waterLevel+.027,Math.sqrt(WORLD_RADIUS**2-x*x-z*z)-WORLD_RADIUS-.003][ring];v.push(x,y,z);uv.push(x*2,z*2);
   if(ring<2&&i<96){const k=ring*97+i;ids.push(k,k+1,k+97,k+1,k+98,k+97)}
  }
  const bankGeo=new T.BufferGeometry();bankGeo.setAttribute('position',new T.Float32BufferAttribute(v,3));bankGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));bankGeo.setIndex(ids);bankGeo.computeVertexNormals();
  const bank=new T.Mesh(bankGeo,new T.MeshStandardMaterial({color:0x71684a,roughness:1,side:T.DoubleSide}));bank.receiveShadow=true;group.add(bank);
  for(let i=0;i<18;i++){const a=i*.43,r=edge(a)*1.15,x=Math.cos(a)*.72*r,z=Math.sin(a)*.45*r;const stone=new T.Mesh(new T.IcosahedronGeometry(.025+(i%3)*.008,1),new T.MeshStandardMaterial({color:0x737566,roughness:.94}));stone.position.set(x,waterLevel+.026,z);stone.scale.set(1.4,.55,1);stone.castShadow=stone.receiveShadow=true;group.add(stone)}
  if(flat){const v:number[]=[],ids:number[]=[];for(let row=0;row<=16;row++)for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=row/16*1.32,x=Math.cos(a)*.72*edge(a)*r,z=Math.sin(a)*.45*edge(a)*r;const sphereY=Math.sqrt(WORLD_RADIUS**2-x*x-z*z)-WORLD_RADIUS;const y=T.MathUtils.lerp(sphereY,Math.min(sphereY,-.12),1-T.MathUtils.smoothstep(r,.88,1.32));v.push(x,Math.sqrt((WORLD_RADIUS+y)**2+x*x+z*z)-WORLD_RADIUS,z);if(row<16&&i<96){const k=row*97+i;ids.push(k,k+1,k+97,k+1,k+98,k+97)}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(ids);geo.computeVertexNormals();const basin=new T.Mesh(geo,new T.MeshStandardMaterial({color:0x4b4932,roughness:1,side:T.DoubleSide}));basin.name='Submerged pond basin';basin.receiveShadow=true;group.add(basin);}
  effects.add(group);return group;
 };
 const pond=make(false);pond.position.copy(anchor);pond.quaternion.copy(orientation);pond.userData.createRoadCopy=()=>make(true);globe.add(pond);
 return {update(time:number,light?:T.DirectionalLight,bus?:T.Object3D){effects.update(time,bus);for(const water of waters){water.material.uniforms.time.value=time*.001;if(light){water.material.uniforms.sunColor.value.copy(light.color).multiplyScalar(light.intensity/3.4);water.material.uniforms.sunDirection.value.copy(light.position).normalize()}}},dispose(){effects.dispose();normals.dispose();for(const water of waters){water.material.uniforms.mirrorSampler.value?.dispose();water.material.dispose()}}};
}
