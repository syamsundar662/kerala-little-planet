import { MeshStandardMaterial } from 'three';
export type SurfaceKind = 'asphalt' | 'soil' | 'grass' | 'plaster' | 'roof';
// World-space grain survives batching and chunk boundaries without UV seams.
export function naturalMaterial(color: string, kind: SurfaceKind) {
  const material = new MeshStandardMaterial({
    color,
    roughness: kind === 'asphalt' ? 0.96 : kind === 'roof' ? 0.85 : 1,
    metalness: 0,
  });
  material.customProgramCacheKey = () => `alappuzha-natural-${kind}-1`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vSurfaceWorld;',
      )
      .replace(
        '#include <project_vertex>',
        'vSurfaceWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
   varying vec3 vSurfaceWorld;
   float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1.,0.)),f.x),mix(surfaceHash(i+vec2(0.,1.)),surfaceHash(i+vec2(1.,1.)),f.x),f.y);}
  `,
    );
    const uv =
      kind === 'plaster' || kind === 'roof'
        ? 'vSurfaceWorld.xz+vSurfaceWorld.y*vec2(.73,1.17)'
        : 'vSurfaceWorld.xz';
    const treatment =
      kind === 'grass'
        ? `float terrainPatch=surfaceNoise(suv*.13);diffuseColor.rgb*=mix(.74,1.12,terrainPatch);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.17,.10),smoothstep(.72,.96,terrainPatch)*.24);`
        : kind === 'asphalt'
          ? `diffuseColor.rgb*=mix(.82,1.08,surfaceNoise(suv*.45));`
          : kind === 'soil'
            ? `diffuseColor.rgb*=mix(.68,1.18,surfaceNoise(suv*1.3));`
            : `diffuseColor.rgb*=mix(.87,1.05,surfaceNoise(suv*1.8));`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
   vec2 suv=${uv};${treatment}
   float grainVisibility=1.0-smoothstep(.04,.25,max(length(dFdx(suv)),length(dFdy(suv))));
   diffuseColor.rgb*=1.0+(surfaceNoise(suv*38.0)-.5)*.2*grainVisibility;
  `,
    );
  };
  return material;
}
