import {WORLD_RADIUS,ROAD_ROUTES,ROAD_SEGMENTS,roadLatitude} from './world';
import {NATURAL_PALETTE as palette} from './natural-palette';
import * as T from 'three';

export function roadElevation(offset:number){
 const d=Math.abs(offset);
 if(d<=.515)return .052-.008*(d/.515)**2;
 if(d<.62)return .044*(1-T.MathUtils.smoothstep(d,.515,.62));
 return 0;
}
export function createRoadSurface(pos:(t:number,lat:number,r:number)=>T.Vector3,latitude:(t:number)=>number){
 const loader=new T.TextureLoader();const texture=(kind:string,color=false)=>{const t=loader.load(`/textures/worn_asphalt_${kind}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;return t};
 const asphalt=new T.MeshStandardMaterial({map:texture('color',true),normalMap:texture('normal'),roughnessMap:texture('rough'),normalScale:new T.Vector2(.45,.45),roughness:1,color:palette.asphaltTint,side:T.DoubleSide});
 const shoulder=new T.MeshStandardMaterial({color:palette.soil,roughness:1,side:T.DoubleSide});
 const vertices:number[]=[],uvs:number[]=[],offsets=[-.62,-.515,0,.515,.62],geometry=new T.BufferGeometry();
 for(const route of ROAD_ROUTES)for(let strip=0;strip<4;strip++){
  const start=vertices.length/3;
  for(let i=0;i<ROAD_SEGMENTS;i++){
   const t=i/ROAD_SEGMENTS*Math.PI*2,t2=(i+1)/ROAD_SEGMENTS*Math.PI*2;
   for(const [along,cross] of [[t,strip],[t2,strip],[t,strip+1],[t,strip+1],[t2,strip],[t2,strip+1]]){
    const offset=offsets[cross];vertices.push(...pos(along,roadLatitude(along,route)+offset/WORLD_RADIUS,WORLD_RADIUS+roadElevation(offset)+route*.0001+(Math.abs(offset)===.62?-.003:0)).toArray());uvs.push(along*WORLD_RADIUS/1.5,(offset+.62)/1.5);
   }
  }
  geometry.addGroup(start,vertices.length/3-start,strip===0||strip===3?1:0);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,[asphalt,shoulder]);mesh.receiveShadow=true;mesh.name='Crowned asphalt with grounded shoulders';return mesh;
}
