import {WORLD_RADIUS} from './world';
import * as T from 'three';
import type {Obstacle} from './vehicle-physics';

export function addUtilities(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number){
 const concrete=new T.MeshStandardMaterial({color:0x99998d,roughness:.95});
 const steel=new T.MeshStandardMaterial({color:0x4e5653,metalness:.65,roughness:.65});
 const ceramic=new T.MeshStandardMaterial({color:0x695748,roughness:.30});
 const position=(t:number,lat:number)=>new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat)).multiplyScalar(WORLD_RADIUS);
 const poles:T.Group[]=[];
 const lampGlass=new T.MeshStandardMaterial({color:0xffeed0,emissive:0xffcb83,emissiveIntensity:0,roughness:.35});
 const streetLights:T.SpotLight[]=[];
 for(let i=0;i<12;i++){
  let t=i/12*Math.PI*2+.04;let p=position(t,latitude(t)-.95/WORLD_RADIUS);
  // Slide along the verge to avoid foundations and tree trunks.
  for(let attempt=0;attempt<12;attempt++){
   const n=p.clone().normalize();if(!obstacles.some(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*WORLD_RADIUS<(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.08))break;
   t+=.012;p=position(t,latitude(t)-.95/WORLD_RADIUS);
  }
  const pole=new T.Group();pole.name='Concrete electricity pole';pole.position.copy(p);
  const up=p.clone().normalize(),forward=position(t+.001,latitude(t+.001)-.95/WORLD_RADIUS).sub(p).projectOnPlane(up).normalize(),side=new T.Vector3().crossVectors(forward,up).normalize();pole.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,up,side));
  const shaft=new T.Mesh(new T.CylinderGeometry(.014,.023,1.65,8),concrete);shaft.position.y=.78;shaft.castShadow=shaft.receiveShadow=true;pole.add(shaft);
  const base=new T.Mesh(new T.CylinderGeometry(.036,.043,.12,8),concrete);base.position.y=.025;pole.add(base);
  const arm=new T.Mesh(new T.BoxGeometry(.026,.026,.30),steel);arm.position.y=1.46;arm.castShadow=true;pole.add(arm);
  for(const z of [-.12,0,.12]){
   const pin=new T.Mesh(new T.CylinderGeometry(.008,.008,.10,8),steel);pin.position.set(0,1.52,z);pole.add(pin);
   for(let ring=0;ring<3;ring++){const insulator=new T.Mesh(new T.CylinderGeometry(.018,.016,.015,10),ceramic);insulator.position.set(0,1.515+ring*.020,z);pole.add(insulator)}
  }
  pole.userData.streetLamp=true;
  const aim=position(t,latitude(t)).sub(p).applyQuaternion(pole.quaternion.clone().invert());
  const reach=new T.Vector3(aim.x,0,aim.z).normalize().multiplyScalar(.28);
  const armLamp=new T.Mesh(new T.CylinderGeometry(.010,.010,.28,6),steel);armLamp.position.copy(reach).multiplyScalar(.5);armLamp.position.y=1.30;armLamp.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),reach.clone().normalize());pole.add(armLamp);
  const hood=new T.Mesh(new T.BoxGeometry(.12,.045,.075),steel);hood.position.set(reach.x,1.285,reach.z);pole.add(hood);
  const lens=new T.Mesh(new T.BoxGeometry(.10,.008,.058),lampGlass);lens.position.copy(hood.position);lens.position.y-=.027;pole.add(lens);
  const light=new T.SpotLight(0xffd599,0,4,.80,.75,1.5);light.name='Street lamp light';light.position.copy(lens.position);light.position.y-=.01;light.target.name='Street lamp aim';light.target.position.copy(aim);light.shadow.mapSize.set(512,512);light.shadow.normalBias=.008;light.shadow.bias=-.0001;light.shadow.camera.near=.05;light.shadow.camera.far=4;pole.add(light,light.target);streetLights.push(light);
  globe.add(pole);poles.push(pole);obstacles.push({normal:up,radius:.043});
 }
 const vertices:number[]=[];
 for(let i=0;i<poles.length;i++)for(const z of [-.12,0,.12]){
  const a=new T.Vector3(0,1.57,z).applyQuaternion(poles[i].quaternion).add(poles[i].position),next=poles[(i+1)%poles.length];
  const b=new T.Vector3(0,1.57,z).applyQuaternion(next.quaternion).add(next.position);
  const span=(f:number)=>{const p=a.clone().lerp(b,f);return p.addScaledVector(p.clone().normalize(),-.10*4*f*(1-f))};
  for(let j=0;j<20;j++)vertices.push(...span(j/20).toArray(),...span((j+1)/20).toArray());
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));const wires=new T.Group();wires.name='Connected overhead electricity lines';wires.userData.projectGeometry=true;wires.add(new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x292c29})));globe.add(wires);
 return {poles,wires,update(amount:number,busPosition:T.Vector3){lampGlass.emissiveIntensity=amount*2;const nearest=poles.map((p,i)=>({i,d:p.position.distanceToSquared(busPosition)})).sort((a,b)=>a.d-b.d).slice(0,3).map(p=>p.i);streetLights.forEach((light,i)=>{light.intensity=amount*3.5;light.visible=nearest.includes(i);light.castShadow=nearest.includes(i)})},dispose(){streetLights.forEach(light=>light.dispose())}};
}
