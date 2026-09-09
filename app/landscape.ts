import {NATURAL_PALETTE as palette} from './natural-palette';
import * as T from 'three';
import {gradeGreenTerrain} from './green-terrain';
import {findBusStopSite} from './stop-placement';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import type { Obstacle } from './vehicle-physics';

// Every patch has a radial anchor so it also works in the unwrapped driver view.
export function addLandscape(globe:T.Group, obstacles:Obstacle[], latitude:(t:number)=>number) {
 let seed=924;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const noise=new SimplexNoise({random});
 const loader=new T.TextureLoader();const load=(kind:string,color=false)=>{const t=loader.load(`/textures/aerial_grass_rock_${kind}_1k.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=4;if(color)t.colorSpace=T.SRGBColorSpace;return t};
 const terrainMaterial=new T.MeshStandardMaterial({map:load("diff",true),normalMap:load("nor_gl"),roughnessMap:load("rough"),normalScale:new T.Vector2(.65,.65),roughness:1,vertexColors:true});
 gradeGreenTerrain(terrainMaterial);
 const material=(color:number)=>new T.MeshStandardMaterial({color,roughness:.95});
 const anchor=(t:number,lat:number)=>{const g=new T.Group();g.position.set(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(5.6);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),g.position.clone().normalize());globe.add(g);return g};
 const box=(g:T.Group,size:number[],p:number[],m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(...size as [number,number,number]),m);o.position.fromArray(p);o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
 const grassMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1});
 const wind={value:0},windForce={value:0};let windVelocity=0,lastWindTime:number|undefined;
 const windShader=(shader:{uniforms:Record<string,unknown>;vertexShader:string})=>{shader.uniforms.grassTime=wind;shader.uniforms.windForce=windForce;shader.vertexShader='uniform float grassTime; uniform float windForce; attribute float windWeight; attribute float windPhase;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float bend = windWeight * (windForce + sin(grassTime*3.2+windPhase)*0.045);
 transformed.x += bend;
 transformed.z += bend * 0.38;
 transformed.y -= abs(bend)*0.10;
 `)};
 grassMat.onBeforeCompile=windShader;
 const windDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});windDepth.onBeforeCompile=windShader;
 const windMesh=(geo:T.BufferGeometry,mat:T.Material)=>{const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=windDepth;return mesh};
 for(let patch=0;patch<210;patch++){
  const t=random()*Math.PI*2,lat=latitude(t)+(random()<.5?-1:1)*(.16+random()*.65);const candidate=new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat));if(obstacles.some(o=>Math.acos(T.MathUtils.clamp(candidate.dot(o.normal),-1,1))*5.6<(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.25))continue;const g=anchor(t,lat);g.name='Meadow grass';g.userData.groundedVegetation=true;
  const vertices:number[]=[],colors:number[]=[],weights:number[]=[],phases:number[]=[],groundOffsets:number[]=[];
  const patchPhase=patch*2.399,patchSize=.20+random()*.19;
  for(let blade=0;blade<160;blade++){
   const azimuth=random()*Math.PI*2,radial=Math.sqrt(random())*patchSize*(.78+.16*Math.sin(azimuth*3+patchPhase)+.06*Math.cos(azimuth*5));if(random()<radial/patchSize*.25)continue;const x=Math.cos(azimuth)*radial,z=Math.sin(azimuth)*radial,groundY=Math.sqrt(5.6**2-x*x-z*z)-5.6,y=groundY-.004,h=.035+random()*.10,w=.005+random()*.007,a=random()*Math.PI,bend=(random()-.5)*.055;
   const dx=Math.cos(a)*w,dz=Math.sin(a)*w;
   const c=new T.Color(palette.grass[Math.floor(random()*palette.grass.length)]);
   const bladePoint=(step:number,side:number)=>{const f=step/4;return [x+bend*f*f+dx*side*(1-f),y+h*f,z+.045*f*f+dz*side*(1-f)]};
   for(let segment=0;segment<4;segment++)for(const [step,side] of [[segment,-1],[segment,1],[segment+1,-1],[segment,1],[segment+1,1],[segment+1,-1]]){vertices.push(...bladePoint(step,side));weights.push((step/4)**2*h);phases.push(patchPhase+x*3+z*3);groundOffsets.push(groundY);const cc=c.clone().multiplyScalar(.60+step*.16);colors.push(cc.r,cc.g,cc.b)}

  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('windWeight',new T.Float32BufferAttribute(weights,1));geo.setAttribute('windPhase',new T.Float32BufferAttribute(phases,1));geo.setAttribute('groundOffset',new T.Float32BufferAttribute(groundOffsets,1));geo.computeVertexNormals();g.add(windMesh(geo,grassMat));
 }
 // One continuous landform with two unequal peaks and a shared saddle.
 {
  const g=anchor(1.35,-.67);g.name='Connected mountain peaks';
  const verts:number[]=[],cols:number[]=[],ids:number[]=[],uvs:number[]=[],steps=100,width=2.05,depth=1.10;
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
   const u=x/steps*2-1,v=z/steps*2-1,px=u*width,pz=v*depth;
   const envelope=1-T.MathUtils.smoothstep(Math.max(Math.abs(u),Math.abs(v)),.65,1);
   const tall=1.65*Math.exp(-(((px+.65)/.66)**2+((pz+.08)/.62)**2)*1.5);
   const low=.98*Math.exp(-(((px-.70)/.58)**2+((pz-.10)/.53)**2)*1.5);
   const saddle=.27*Math.exp(-((px/1.45)**2)-(pz/.62)**2);
   const detail=noise.noise(px*3,pz*3)*.065+noise.noise(px*8,pz*8)*.023+noise.noise(px*19,pz*19)*.008;
   const height=Math.max(0,tall+low+saddle+detail)*envelope;
   const base=Math.sqrt(5.6**2-px*px-pz*pz)-5.6;
   verts.push(px,base+height-.009,pz);uvs.push(x/steps*1.8,z/steps);
   const foothill=new T.Color(palette.groundTint),summit=new T.Color(palette.mountainTint);const c=foothill.lerp(summit,T.MathUtils.smoothstep(height,.15,1.7)).multiplyScalar(1+detail*.30);cols.push(c.r,c.g,c.b);
   if(x<steps&&z<steps){const k=z*(steps+1)+x;ids.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(ids);geo.computeVertexNormals();
  const mountain=new T.Mesh(geo,terrainMaterial);mountain.castShadow=mountain.receiveShadow=true;g.add(mountain);
  obstacles.push({normal:g.position.clone().normalize(),axis:new T.Vector3(1,0,0).applyQuaternion(g.quaternion),halfX:1.85,halfZ:.92});
 }
 const shrubMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.8});
 shrubMat.onBeforeCompile=windShader;
 for(let shrub=0;shrub<46;shrub++){
  const t=random()*Math.PI*2,lat=latitude(t)+(random()<.5?-1:1)*(.22+random()*.30),n=new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat));
  if(obstacles.some(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*5.6<(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.32))continue;
  const g=anchor(t,lat);g.name='Leafy roadside shrub';g.userData.groundedVegetation=true;const vertices:number[]=[],colors:number[]=[];const size=.18+random()*.17;
  const branchMat=new T.MeshStandardMaterial({color:0x66543a,roughness:1});branchMat.onBeforeCompile=windShader;
  for(let branch=0;branch<5;branch++){const a=branch*2.399,start=new T.Vector3(0,-.012,0),end=new T.Vector3(Math.cos(a)*size*.55,size*.78,Math.sin(a)*size*.55);const curve=new T.QuadraticBezierCurve3(start,new T.Vector3(end.x*.25,size*.45,end.z*.25),end);const branchGeo=new T.TubeGeometry(curve,6,.007,5,false),weight:number[]=[],phase:number[]=[];for(let i=0;i<branchGeo.attributes.position.count;i++){weight.push(Math.max(0,branchGeo.attributes.position.getY(i))**2*.7);phase.push(shrub*2.399)}branchGeo.setAttribute('windWeight',new T.Float32BufferAttribute(weight,1));branchGeo.setAttribute('windPhase',new T.Float32BufferAttribute(phase,1));g.add(windMesh(branchGeo,branchMat))}
  for(let leaf=0;leaf<240;leaf++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random())*size;const center=new T.Vector3(Math.cos(angle)*r,.025+Math.sqrt(Math.max(0,1-r*r/(size*size)))*size*(.65+random()*.5),Math.sin(angle)*r);
   const q=new T.Quaternion().setFromEuler(new T.Euler(random()*2,random()*6.28,random()*2));const length=.045+random()*.035;
   const points=[new T.Vector3(0,0,-length),new T.Vector3(-length*.40,0,0),new T.Vector3(0,.009,0),new T.Vector3(length*.40,0,0),new T.Vector3(0,0,length)];
   const c=new T.Color(palette.shrubs[Math.floor(random()*palette.shrubs.length)]);
   for(const index of [0,1,2,0,2,3,1,4,2,2,4,3]){vertices.push(...points[index].clone().applyQuaternion(q).add(center).toArray());colors.push(c.r,c.g,c.b)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const weights:number[]=[],phases:number[]=[];for(let i=0;i<geo.attributes.position.count;i++){weights.push(Math.max(0,geo.attributes.position.getY(i))**2*.7);phases.push(shrub*2.399)}geo.setAttribute('windWeight',new T.Float32BufferAttribute(weights,1));geo.setAttribute('windPhase',new T.Float32BufferAttribute(phases,1));g.add(windMesh(geo,shrubMat));obstacles.push({normal:n,radius:size*.8});
 }
 const stopSite=findBusStopSite(obstacles,latitude),stop=anchor(stopSite.t,stopSite.lat);stop.name='Village bus stop';
 // Local +Z is the open entrance: aim it toward the nearest road point.
 const roadTarget=new T.Vector3();let closestDistance=Infinity;
 for(let i=0;i<720;i++){const t=i/720*Math.PI*2,lat=latitude(t);const p=new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(5.652);const distance=p.distanceToSquared(stop.position);if(distance<closestDistance){closestDistance=distance;roadTarget.copy(p)}}
 const stopUp=stop.position.clone().normalize();const stopFront=roadTarget.sub(stop.position).projectOnPlane(stopUp).normalize();const stopRight=new T.Vector3().crossVectors(stopUp,stopFront).normalize();stop.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(stopRight,stopUp,stopFront));
 const stopTexture=(asset:string,kind:string,color=false)=>{const t=loader.load(`/textures/${asset}_${kind}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;if(color)t.colorSpace=T.SRGBColorSpace;return t};
 const concrete=new T.MeshStandardMaterial({color:0xc4baa4,map:stopTexture('mossy_stone_wall','color',true),normalMap:stopTexture('mossy_stone_wall','normal'),roughness:1}),metal=material(0x285d55),tile=new T.MeshStandardMaterial({map:stopTexture('clay_roof_tiles','color',true),normalMap:stopTexture('clay_roof_tiles','normal'),roughness:.9}),wood=material(0x765439);
 box(stop,[1.10,.20,.53],[0,-.055,0],concrete);
 for(const x of [-.46,.46])for(const z of [-.19,.19])box(stop,[.035,.68,.035],[x,.36,z],metal);
 box(stop,[1,.42,.035],[0,.28,-.20],concrete);
 const roof=box(stop,[1.16,.06,.66],[0,.72,0],tile);roof.rotation.x=.10;
 for(let i=0;i<17;i++)box(stop,[.016,.025,.67],[-.55+i*.068,.762,0],tile);
 box(stop,[.77,.035,.14],[0,.24,-.05],wood);for(const x of [-.3,.3])box(stop,[.025,.22,.10],[x,.12,-.05],metal);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f1e6bf';ctx.fillRect(0,0,768,128);ctx.fillStyle='#194f46';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.fillText('KSRTC · BUS STOP',384,82);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 box(stop,[.96,.15,.027],[0,.60,.22],new T.MeshStandardMaterial({map:texture,roughness:.8}));
 obstacles.push({normal:stop.position.clone().normalize(),axis:new T.Vector3(1,0,0).applyQuaternion(stop.quaternion),halfX:.58,halfZ:.32});
 return {update(time:number){const dt=lastWindTime===undefined?0:Math.min((time-lastWindTime)*.001,.05);lastWindTime=time;wind.value=time*.001;const target=.22+noise.noise(wind.value*.21,3)*.32;const steps=Math.max(1,Math.ceil(dt/.008));for(let i=0;i<steps;i++){const h=dt/steps;windVelocity+=((target-windForce.value)*14-windVelocity*5)*h;windForce.value+=windVelocity*h}}};
}
