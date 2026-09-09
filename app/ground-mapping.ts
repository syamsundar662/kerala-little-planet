import * as T from 'three';
import {GREEN_TERRAIN_GRADE} from './green-terrain';

// Inverse of the local road projection: recover a fixed point on the planet.
export function groundDirection(x:number,z:number,normal:T.Vector3,forward:T.Vector3,right:T.Vector3){
 const distance=Math.hypot(x,z),angle=distance/5.6;
 if(distance<1e-8)return normal.clone();
 return normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(forward,Math.sin(angle)*x/distance).addScaledVector(right,Math.sin(angle)*z/distance).normalize();
}
export function anchorGroundTexture(material:T.MeshStandardMaterial){
 const normal={value:new T.Vector3(0,1,0)},forward={value:new T.Vector3(1,0,0)},right={value:new T.Vector3(0,0,1)};
 material.onBeforeCompile=shader=>{
  shader.uniforms.groundNormal=normal;shader.uniforms.groundForward=forward;shader.uniforms.groundRight=right;
  shader.vertexShader='varying vec2 groundXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n groundXZ=vec2(position.x,-position.y);');
  shader.fragmentShader='varying vec2 groundXZ; uniform vec3 groundNormal; uniform vec3 groundForward; uniform vec3 groundRight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   float groundDistance=length(groundXZ);
   float groundAngle=groundDistance/5.6;
   vec3 groundPoint=normalize(cos(groundAngle)*groundNormal+sin(groundAngle)*(groundForward*groundXZ.x+groundRight*groundXZ.y)/max(groundDistance,0.000001));
   vec2 anchoredUV=vec2(atan(groundPoint.z,groundPoint.x)/6.28318530718+0.5,asin(clamp(groundPoint.y,-1.0,1.0))/3.14159265359+0.5);
   diffuseColor*=texture2D(map,anchoredUV*vec2(14.0,7.0));
   ${GREEN_TERRAIN_GRADE}
  `);
 };
 return {update(n:T.Vector3,f:T.Vector3,r:T.Vector3){normal.value.copy(n);forward.value.copy(f);right.value.copy(r)}};
}
