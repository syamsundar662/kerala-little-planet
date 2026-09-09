import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function batchStaticMeshes(root:T.Object3D,keep:(mesh:T.Mesh)=>boolean=()=>false){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();const buckets=new Map<string,{material:T.Material;geometries:T.BufferGeometry[];objects:T.Mesh[]}>();
 root.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.SkinnedMesh||Array.isArray(o.material)||keep(o)||Object.keys(o.geometry.morphAttributes).length)return;const key=o.material.uuid+String(o.castShadow)+String(o.receiveShadow)+Object.keys(o.geometry.attributes).sort().join(',');if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[],objects:[]});const bucket=buckets.get(key)!;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));bucket.geometries.push(geo);bucket.objects.push(o)});
 for(const bucket of buckets.values()){if(bucket.objects.length>1){const merged=mergeGeometries(bucket.geometries);if(merged){const mesh=new T.Mesh(merged,bucket.material);mesh.castShadow=bucket.objects[0].castShadow;mesh.receiveShadow=bucket.objects[0].receiveShadow;root.add(mesh);bucket.objects.forEach(o=>o.removeFromParent())}}bucket.geometries.forEach(g=>g.dispose())}
}
