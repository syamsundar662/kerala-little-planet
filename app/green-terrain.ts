import type {MeshStandardMaterial} from 'three';
// Retain the photographed surface variation while correcting its dry yellow cast.
export const GREEN_TERRAIN_GRADE=`
 float terrainLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
 vec3 livingGreen=terrainLuma*vec3(0.54,1.19,0.48);
 diffuseColor.rgb=mix(diffuseColor.rgb,livingGreen,0.86);
`;
export function gradeGreenTerrain(material:MeshStandardMaterial){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+GREEN_TERRAIN_GRADE)}};
