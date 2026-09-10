import {WORLD_RADIUS,COAST_GLSL,SEA_LEVEL} from './world';
import {POND_ANCHOR,POND_INVERSE} from './pond-physics';
import * as T from 'three';
import {GREEN_TERRAIN_GRADE} from './green-terrain';

// Inverse of the local road projection: recover a fixed point on the planet.
export function groundDirection(x:number,z:number,normal:T.Vector3,forward:T.Vector3,right:T.Vector3){
 const distance=Math.hypot(x,z),angle=distance/WORLD_RADIUS;
 if(distance<1e-8)return normal.clone();
 return normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(forward,Math.sin(angle)*x/distance).addScaledVector(right,Math.sin(angle)*z/distance).normalize();
}
export function anchorGroundTexture(material:T.MeshStandardMaterial,water=false){
 const normal={value:new T.Vector3(0,1,0)},forward={value:new T.Vector3(1,0,0)},right={value:new T.Vector3(0,0,1)};
 material.onBeforeCompile=shader=>{
  shader.uniforms.pondAnchor={value:POND_ANCHOR};shader.uniforms.pondInverse={value:new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(POND_INVERSE))};shader.uniforms.groundNormal=normal;shader.uniforms.groundForward=forward;shader.uniforms.groundRight=right;
  shader.vertexShader='varying vec2 groundXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n groundXZ=vec2(position.x,-position.y);');
  shader.fragmentShader=COAST_GLSL+'uniform vec3 pondAnchor;uniform mat3 pondInverse;varying vec2 groundXZ; uniform vec3 groundNormal; uniform vec3 groundForward; uniform vec3 groundRight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   float groundDistance=length(groundXZ);
   float groundAngle=groundDistance/${WORLD_RADIUS.toFixed(1)};
   vec3 groundPoint=normalize(cos(groundAngle)*groundNormal+sin(groundAngle)*(groundForward*groundXZ.x+groundRight*groundXZ.y)/max(groundDistance,0.000001));
   vec3 pondLocal=pondInverse*(groundPoint*${WORLD_RADIUS.toFixed(1)}-pondAnchor);
   float pa=atan(pondLocal.z/.45,pondLocal.x/.72);
   float pr=length(pondLocal.xz/vec2(.72,.45))/(1.0+.06*sin(pa*3.0)+.035*cos(pa*5.0));
   ${water?'':'if(pondLocal.y>-.4&&pr<1.32)discard;'}
   vec2 anchoredUV=vec2(atan(groundPoint.z,groundPoint.x)/6.28318530718+0.5,asin(clamp(groundPoint.y,-1.0,1.0))/3.14159265359+0.5);
   ${water?`if(terrainElevation(atan(groundPoint.z,groundPoint.x),asin(clamp(groundPoint.y,-1.0,1.0)))>=${SEA_LEVEL})discard;`:`diffuseColor*=texture2D(map,anchoredUV*vec2(14.0,7.0));
   ${GREEN_TERRAIN_GRADE}
   float beach=1.0-smoothstep(0.0,.028,asin(clamp(groundPoint.y,-1.0,1.0))-coastLatitude(atan(groundPoint.z,groundPoint.x)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.29,.16),beach);`}
  `);
 };
 return {update(n:T.Vector3,f:T.Vector3,r:T.Vector3){normal.value.copy(n);forward.value.copy(f);right.value.copy(r)}};
}
