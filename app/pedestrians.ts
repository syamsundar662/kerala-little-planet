import {WORLD_RADIUS} from './world';
import * as T from 'three';
import {createKeralaWardrobe} from './villager-clothing';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {surfaceRadius,type Obstacle} from './vehicle-physics';

export function createPedestrians(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number){
 const staticObstacles=[...obstacles],people:{group:T.Group;t:number;side:number;direction:number;phase:number;mixer?:T.AnimationMixer;walk?:T.AnimationAction;idle?:T.AnimationAction;blend:number;collider:Obstacle}[]=[];
 const point=(t:number,side:number)=>{const lat=latitude(t)+side*(.76/WORLD_RADIUS);return new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat))};
 const clear=(n:T.Vector3)=>staticObstacles.every(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*WORLD_RADIUS>(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.07);
 for(let i=0;i<8;i++){
  let t=i*Math.PI*2/8,side=i%2?1:-1,found=false;
  for(let j=0;j<180;j++){t+=.017;if(clear(point(t,side))&&clear(point(t+.025,side))&&clear(point(t-.025,side))){found=true;break}}
  if(!found)continue;
  const group=new T.Group();group.name='Walking villager '+(i+1);group.userData.animatedChildren=true;group.userData.animatedTree=true;
  const n=point(t,side),collider={normal:n.clone(),radius:.055};obstacles.push(collider);globe.add(group);people.push({group,t,side,direction:i%2?1:-1,phase:i,blend:0,collider});
 }
 const update=(dt:number,busPosition:T.Vector3)=>{for(const person of people){const next=person.t+person.direction*dt*.196/WORLD_RADIUS,n=point(next,person.side);let moving=clear(n);if(!moving)person.direction*=-1;
  if(busPosition.lengthSq()>1&&Math.acos(T.MathUtils.clamp(n.dot(busPosition.clone().normalize()),-1,1))*WORLD_RADIUS<1.05)moving=false;
  if(moving){person.t=next;person.phase+=dt*5.4}
  const normal=point(person.t,person.side),forward=point(person.t+person.direction*.001,person.side).sub(normal).projectOnPlane(normal).normalize(),right=new T.Vector3().crossVectors(forward,normal).normalize();person.group.position.copy(normal).multiplyScalar(surfaceRadius(normal)+.001);person.group.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,normal,right));person.collider.normal.copy(normal);
  if(person.mixer&&person.walk&&person.idle){person.blend=T.MathUtils.damp(person.blend,moving?1:0,8,dt);person.walk.setEffectiveWeight(person.blend);person.idle.setEffectiveWeight(1-person.blend);person.mixer.update(dt*.9);}

 }};
 let disposed=false;let wardrobe:ReturnType<typeof createKeralaWardrobe>|undefined;
 Promise.all([new GLTFLoader().loadAsync('/villager.glb'),fetch('/villager-motion.json').then(r=>{if(!r.ok)throw new Error('Could not load pedestrian motion');return r.json()})]).then(([asset,motions])=>{
  if(disposed)return;
  const clips=(motions as object[]).map(data=>T.AnimationClip.parse(data as Parameters<typeof T.AnimationClip.parse>[0]));
  asset.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false}});
  const bounds=new T.Box3().setFromObject(asset.scene),height=bounds.max.y-bounds.min.y;
  wardrobe=createKeralaWardrobe(asset.scene);
  people.forEach((person,i)=>{
   const model=clone(asset.scene);model.name='Kerala villager';wardrobe!.dress(model,i);
   const size=.30+(i%3)*.009;model.scale.multiplyScalar(size/height);model.rotation.y=Math.PI/2;model.position.y=-bounds.min.y*size/height;
   person.group.add(model);person.group.userData.visualRevision=1;
   person.mixer=new T.AnimationMixer(model);person.walk=person.mixer.clipAction(clips.find(c=>c.name==='Walk')!).play();person.idle=person.mixer.clipAction(clips.find(c=>c.name==='Idle')!).play();person.walk.setEffectiveWeight(0);person.mixer.update(i*.173);
  });
 }).catch(error=>console.error('Pedestrian asset loading failed',error));
 update(0,new T.Vector3());return {update,count:people.length,dispose(){disposed=true;wardrobe?.dispose();for(const p of people){p.mixer?.stopAllAction();if(p.mixer)p.mixer.uncacheRoot(p.mixer.getRoot());p.group.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()})}}};
}
