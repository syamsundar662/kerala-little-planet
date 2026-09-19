import {WORLD_RADIUS} from './world';
import * as T from 'three';
import type {Obstacle} from './vehicle-physics';
import {DISTRICTS} from './districts';
export function createDistrictGateways(globe:T.Group,point:(t:number,r?:number)=>T.Vector3,latitude:(t:number)=>number,obstacles:Obstacle[]){
 const textures:T.Texture[]=[],materials:T.Material[]=[],groups:T.Group[]=[];
 const postGeo=new T.CylinderGeometry(.009,.012,.42,6),plateGeo=new T.PlaneGeometry(.69,.23),postMaterial=new T.MeshStandardMaterial({color:0x697568,roughness:.9});
 for(const d of DISTRICTS){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#17463b';c.fillRect(0,0,768,256);c.strokeStyle='#d9e9b3';c.lineWidth=6;c.strokeRect(9,9,750,238);c.textAlign='center';c.fillStyle='#e9efd5';c.font=`600 ${d.name.length>15?39:49}px sans-serif`;c.fillText(d.name,384,99);c.font='32px sans-serif';c.fillText(d.malayalam,384,154);c.fillStyle='#c3d996';c.font='21px sans-serif';c.fillText('OPEN WORLD · DISTRICT GATEWAY',384,208);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);const material=new T.MeshStandardMaterial({map:texture,roughness:.9,side:T.DoubleSide});materials.push(material);
 let t=d.gateway,n=new T.Vector3(),found=false;
 for(let attempt=0;attempt<40;attempt++){const along=d.gateway+(Math.floor(attempt/8)-2)*.018,l=latitude(along)+(attempt%2?1:-1)*(.14+Math.floor(attempt%8/2)*.024),candidate=new T.Vector3(Math.cos(along)*Math.cos(l),Math.sin(l),Math.sin(along)*Math.cos(l));if(obstacles.every(o=>Math.acos(T.MathUtils.clamp(candidate.dot(o.normal),-1,1))*WORLD_RADIUS>(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.40)){t=along;n=candidate;found=true;break}}
 if(!found)continue;
 const g=new T.Group();g.name=d.name+' gateway';g.userData.districtId=d.id;g.position.copy(n).multiplyScalar(WORLD_RADIUS);const forward=point(t+.001).sub(point(t)).projectOnPlane(n).normalize(),right=new T.Vector3().crossVectors(forward,n);g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,n,right));
 const plate=new T.Mesh(plateGeo,material);plate.position.y=.39;plate.rotation.y=Math.PI;plate.castShadow=plate.receiveShadow=true;g.add(plate);for(const x of[-.27,.27]){const post=new T.Mesh(postGeo,postMaterial);post.position.set(x,.21,0);post.castShadow=true;g.add(post)}globe.add(g);groups.push(g);obstacles.push({normal:n.clone(),axis:forward,halfX:.35,halfZ:.025});
 }
 return {dispose(){groups.forEach(g=>globe.remove(g));textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());postMaterial.dispose();postGeo.dispose();plateGeo.dispose()}};
}
