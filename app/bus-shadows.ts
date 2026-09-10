import * as T from 'three';
import {surfaceRadius} from './vehicle-physics';

// Ambient contact occlusion complements the sun's directional shadow, even on
// the unlit side of the planet. The receiver follows the actual road surface.
export function createBusContactShadow(bus:T.Group){
 const geometry=new T.PlaneGeometry(2.05,.62,40,16);geometry.rotateX(-Math.PI/2);
 const coordinates=geometry.attributes.position.array.slice();
 const material=new T.ShaderMaterial({uniforms:{contacts:{value:[1,1,1,1]},wheelPositions:{value:[new T.Vector2(.527,.19),new T.Vector2(.527,-.19),new T.Vector2(-.4845,.172),new T.Vector2(-.4845,-.172)]}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  vertexShader:`varying vec2 footprint;void main(){footprint=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 footprint;uniform float contacts[4];uniform vec2 wheelPositions[4];
  void main(){vec2 p=(footprint-.5)*vec2(2.05,.62);
   float body=(1.0-smoothstep(.62,1.0,abs(p.x)))*(1.0-smoothstep(.10,.29,abs(p.y)))*.33;
   float tires=0.0;
   for(int i=0;i<4;i++){
    vec2 wheel=wheelPositions[i];
    vec2 d=(p-wheel)/vec2(.060,.048);tires=max(tires,exp(-dot(d,d)*1.8)*.64*contacts[i]);
   }
   float opacity=1.0-(1.0-body)*(1.0-tires);if(opacity<.003)discard;gl_FragColor=vec4(0.0,0.0,0.0,opacity);
  }`});
 const mesh=new T.Mesh(geometry,material);mesh.name='Bus underbody and tire contact shadow';mesh.frustumCulled=false;mesh.renderOrder=1;bus.add(mesh);
 const local=new T.Vector3(),normal=new T.Vector3(),inverse=new T.Quaternion();
 return {update(inside:boolean){
  if(bus.position.lengthSq()<1)return;material.uniforms.contacts.value=(bus.userData.wheelGrounded??[true,true,true,true]).map((v:boolean)=>v?1:0);inverse.copy(bus.quaternion).invert();
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   local.fromArray(coordinates,i*3);
   if(inside){normal.copy(local).applyQuaternion(bus.quaternion).add(bus.position).normalize();local.y=surfaceRadius(normal)-bus.position.length()+.0015;}
   else{normal.copy(local).applyQuaternion(bus.quaternion).add(bus.position).normalize();local.copy(normal).multiplyScalar(surfaceRadius(normal)+.0015).sub(bus.position).applyQuaternion(inverse);}
   positions.setXYZ(i,local.x,local.y,local.z);
  }positions.needsUpdate=true;
 },dispose(){bus.remove(mesh);geometry.dispose();material.dispose()}};
}
