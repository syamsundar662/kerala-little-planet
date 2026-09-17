import {startFall,stepFall,type FallState} from './pedestrian-fall';
import {WORLD_RADIUS} from './world';
import * as T from 'three';
import {createKeralaWardrobe} from './villager-clothing';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {surfaceRadius,type Obstacle} from './vehicle-physics';

export function createPedestrians(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number,count=8){
 const staticObstacles=[...obstacles],people:{group:T.Group;t:number;side:number;direction:number;phase:number;mixer?:T.AnimationMixer;walk?:T.AnimationAction;idle?:T.AnimationAction;blend:number;collider:Obstacle;fall?:FallState;fallAxis?:T.Vector3;pivot?:T.Group;pose?:{bone:T.Bone;rest:T.Quaternion;axis:T.Vector3;angle:number}[]}[]=[];
 const point=(t:number,side:number)=>{const lat=latitude(t)+side*(.76/WORLD_RADIUS);return new T.Vector3(Math.cos(t)*Math.cos(lat),Math.sin(lat),Math.sin(t)*Math.cos(lat))};
 const clear=(n:T.Vector3)=>staticObstacles.every(o=>Math.acos(T.MathUtils.clamp(n.dot(o.normal),-1,1))*WORLD_RADIUS>(o.radius??Math.hypot(o.halfX??0,o.halfZ??0))+.07);
 for(let i=0;i<count;i++){
  let t=i*Math.PI*2/count,side=i%2?1:-1,found=false;
  for(let j=0;j<180;j++){t+=.017;if(clear(point(t,side))&&clear(point(t+.025,side))&&clear(point(t-.025,side))){found=true;break}}
  if(!found)continue;
  const group=new T.Group();group.name='Walking villager '+(i+1);group.userData.animatedChildren=true;group.userData.animatedTree=true;
  const n=point(t,side),collider:Obstacle={normal:n.clone(),radius:.055};obstacles.push(collider);globe.add(group);people.push({group,t,side,direction:i%2?1:-1,phase:i,blend:0,collider});const person=people[people.length-1];collider.onImpact=(speed,direction)=>{if(person.fall?.active||!person.pivot)return false;const fall=startFall(speed);if(!fall)return false;person.fall=fall;collider.disabled=true;const local=direction.clone().applyQuaternion(group.quaternion.clone().invert());local.y=0;local.normalize();person.fallAxis=new T.Vector3(local.z,0,-local.x).normalize();return true;};
 }
 const update=(dt:number,busPosition:T.Vector3)=>{for(const person of people){const next=person.t+person.direction*dt*.196/WORLD_RADIUS,n=point(next,person.side);let moving=clear(n);if(!moving)person.direction*=-1;
  if(busPosition.lengthSq()>1&&Math.acos(T.MathUtils.clamp(n.dot(busPosition.clone().normalize()),-1,1))*WORLD_RADIUS<1.05)moving=false;
  if(person.fall?.active)moving=false;
  if(moving){person.t=next;person.phase+=dt*5.4}
  const normal=point(person.t,person.side),forward=point(person.t+person.direction*.001,person.side).sub(normal).projectOnPlane(normal).normalize(),right=new T.Vector3().crossVectors(forward,normal).normalize();person.group.position.copy(normal).multiplyScalar(surfaceRadius(normal)+.001);person.group.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,normal,right));person.collider.normal.copy(normal);
  if(person.mixer&&person.walk&&person.idle){for(const joint of person.pose??[])joint.bone.quaternion.copy(joint.rest);person.blend=T.MathUtils.damp(person.blend,moving?1:0,8,dt);person.walk.setEffectiveWeight(person.blend);person.idle.setEffectiveWeight(1-person.blend);person.mixer.update(dt*.9);for(const joint of person.pose??[])joint.rest.copy(joint.bone.quaternion);}
  if(person.pivot&&person.fall?.active){const busClear=busPosition.lengthSq()<1||person.group.position.distanceTo(busPosition)>1.35;const weight=stepFall(person.fall,dt,busClear);person.pivot.quaternion.setFromAxisAngle(person.fallAxis!,weight*1.48);person.pivot.position.y=.15-weight*.10;
   for(const joint of person.pose??[])joint.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(joint.axis,joint.angle*weight));
   if(!person.fall.active){person.pivot.quaternion.identity();person.pivot.position.y=.15;person.collider.disabled=false;person.direction*=-1;}
  }

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
   const pivot=new T.Group();pivot.name='Pedestrian fall pivot';pivot.position.y=.15;model.position.y-=.15;pivot.add(model);person.group.add(pivot);person.pivot=pivot;person.group.userData.visualRevision=2;
   person.pose=[];model.traverse(o=>{if(!(o instanceof T.Bone))return;let angle=0;const axis=new T.Vector3(1,0,0);if(/ForeArm/.test(o.name))angle=-.8;else if(/UpLeg/.test(o.name))angle=.35;else if(/LeftLeg|RightLeg/.test(o.name))angle=-.6;else if(/Spine$/.test(o.name))angle=.24;else if(/LeftArm|RightArm/.test(o.name)){angle=/Left/.test(o.name)?.5:-.5;axis.set(0,0,1);}if(angle)person.pose!.push({bone:o,rest:o.quaternion.clone(),axis,angle});});
   person.mixer=new T.AnimationMixer(model);person.walk=person.mixer.clipAction(clips.find(c=>c.name==='Walk')!).play();person.idle=person.mixer.clipAction(clips.find(c=>c.name==='Idle')!).play();person.walk.setEffectiveWeight(0);person.mixer.update(i*.173);
  });
 }).catch(error=>console.error('Pedestrian asset loading failed',error));
 update(0,new T.Vector3());return {update,count:people.length,dispose(){disposed=true;wardrobe?.dispose();for(const p of people){p.mixer?.stopAllAction();if(p.mixer)p.mixer.uncacheRoot(p.mixer.getRoot());p.group.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()})}}};
}
