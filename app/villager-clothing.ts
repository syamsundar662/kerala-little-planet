import * as T from 'three';

// Garments use the character's existing bind-space and bone weights, so they
// follow the same walking clips and work with SkeletonUtils copies in FPV.
export function createKeralaWardrobe(source:T.Object3D){
 let body!:T.SkinnedMesh;source.traverse(o=>{if(o instanceof T.SkinnedMesh)body=o});
 const positions=body.geometry.attributes.position,normals=body.geometry.attributes.normal;
 const indices=body.geometry.attributes.skinIndex,weights=body.geometry.attributes.skinWeight;
 const templates:{geometry:T.BufferGeometry;material:T.MeshStandardMaterial;name:string}[][]=[];
 const material=(color:number)=>new T.MeshStandardMaterial({color,roughness:.94,metalness:0,side:T.DoubleSide});
 const cream=new T.Color(0xe6dfc7),gold=new T.Color(0xb58a37);
 function finish(p:number[],si:number[],sw:number[],colors?:number[],faces?:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(faces)g.setIndex(faces);g.computeVertexNormals();return g}
 function nearest(x:number,y:number,z:number){let best=Infinity,index=0;for(let i=0;i<positions.count;i++){const d=(positions.getX(i)-x)**2+(positions.getY(i)-y)**2+(positions.getZ(i)-z)**2;if(d<best){best=d;index=i}}return index}
 function skin(i:number,si:number[],sw:number[]){for(let k=0;k<4;k++){si.push(indices.getComponent(i,k));sw.push(weights.getComponent(i,k))}}
 function shirt(){const p:number[]=[],si:number[]=[],sw:number[]=[];const index=body.geometry.index;
  for(let f=0;f<(index?.count??positions.count);f+=3){const ids=[0,1,2].map(k=>index?index.getX(f+k):f+k);const included=ids.every(i=>{const y=positions.getY(i);let dominant=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,dominant))dominant=k;const bone=body.skeleton.bones[indices.getComponent(i,dominant)].name;return y>.92&&y<1.455&&!/Hand|Neck|Head/.test(bone)});if(!included)continue;
   for(const i of ids){p.push(positions.getX(i)+normals.getX(i)*.010,positions.getY(i)+normals.getY(i)*.010,positions.getZ(i)+normals.getZ(i)*.010);skin(i,si,sw)}
  }return finish(p,si,sw);
 }
 function wrap(bottom:number,top:number,width:number,depth:number,kasavu:boolean){const p:number[]=[],si:number[]=[],sw:number[]=[],colors:number[]=[],faces:number[]=[];const rows=20,segments=48;
  for(let row=0;row<=rows;row++){const v=row/rows,y=T.MathUtils.lerp(bottom,top,v);for(let col=0;col<=segments;col++){const a=col/segments*Math.PI*2;const pleat=.009*Math.cos(a*16)*(1-v*.6),rx=T.MathUtils.lerp(width,.162,v),rz=T.MathUtils.lerp(depth,.125,v);const x=(rx+pleat)*Math.cos(a),z=(rz+pleat)*Math.sin(a);p.push(x,y,z);skin(nearest(x,y,z),si,sw);const c=kasavu&&(row===1||row===2||col===12||col===13)?gold:cream;colors.push(c.r,c.g,c.b);if(row<rows&&col<segments){const k=row*(segments+1)+col;faces.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2)}}}
  return finish(p,si,sw,colors,faces);
 }
 function drape(sari:boolean){const p:number[]=[],si:number[]=[],sw:number[]=[],colors:number[]=[],faces:number[]=[];for(let row=0;row<=24;row++){const v=row/24,y=T.MathUtils.lerp(sari?.89:.68,1.43,v),cx=sari?T.MathUtils.lerp(-.09,.145,v):.13,z=.155+.012*Math.sin(v*Math.PI);for(let col=0;col<=8;col++){const x=cx+(col/8-.5)*(sari?.19:.09),zz=z+.008*Math.cos(col*Math.PI*.75);p.push(x,y,zz);skin(nearest(x,y,zz),si,sw);const c=col===0||col===8?gold:cream;colors.push(c.r,c.g,c.b);if(row<24&&col<8){const k=row*9+col;faces.push(k,k+1,k+9,k+1,k+10,k+9)}}}return finish(p,si,sw,colors,faces)}
 const topGeometry=shirt();
 for(let variant=0;variant<3;variant++){
  const shirtMaterial=material([0x789999,0x7c303b,0x246c68][variant]);
  const clothMaterial=material(variant===2?0x326f79:0xffffff);clothMaterial.vertexColors=true;
  const items=[{geometry:topGeometry,material:shirtMaterial,name:variant===1?'Sari blouse':'Cotton shirt or kurta'},
   {geometry:wrap(variant===2?.56:.10,1.00,variant===2?.21:.25,variant===2?.15:.18,variant!==2),material:clothMaterial,name:['Pleated kasavu mundu','Kasavu sari skirt','Everyday salwar kurta'][variant]}];
  if(variant!==0){const m=material(variant===2?0xce9275:0xffffff);m.vertexColors=true;items.push({geometry:drape(variant===1),material:m,name:variant===1?'Gold-bordered sari pallu':'Cotton dupatta'})}
  templates.push(items);
 }
 return {dress(model:T.Object3D,index:number){let target!:T.SkinnedMesh;model.traverse(o=>{if(o instanceof T.SkinnedMesh)target=o});const variant=index%3;model.userData.outfit=['Mundu and cotton shirt','Kasavu sari','Salwar and dupatta'][variant];for(const item of templates[variant]){const garment=new T.SkinnedMesh(item.geometry,item.material);garment.name=item.name;garment.position.copy(target.position);garment.quaternion.copy(target.quaternion);garment.scale.copy(target.scale);garment.bindMode=target.bindMode;garment.bind(target.skeleton,target.bindMatrix);garment.castShadow=garment.receiveShadow=true;garment.frustumCulled=false;target.parent!.add(garment)}},dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();for(const list of templates)for(const item of list){geometries.add(item.geometry);materials.add(item.material)}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}};
}
