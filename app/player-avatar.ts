import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Normal walking humans: boy = Khronos "CesiumMan" (casual man, own walk), girl = three.js "Michelle" (casual woman, driven by Soldier's mixamorig Walk/Idle). See public/CHARACTER-CREDITS.txt.
const TARGET_HEIGHT=.42;   // final world-unit height on the R=9 planet
type Model={scene:T.Group;scale:number;minY:number;walk:T.AnimationClip;idle:T.AnimationClip|null;face:number};
type Rig={boy:Model;girl:Model};
let rigPromise:Promise<Rig>|undefined;
const measure=(scene:T.Group):{scene:T.Group;scale:number;minY:number}=>{scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false}});const b=new T.Box3().setFromObject(scene),h=b.max.y-b.min.y;return {scene,scale:TARGET_HEIGHT/h,minY:b.min.y}};
// Drop any Hips root translation so the avatar never drifts against our own movement (mixamorig clips only).
const cleanClip=(clip:T.AnimationClip)=>{const c=clip.clone();c.tracks=c.tracks.filter(t=>!t.name.endsWith('Hips.position'));return c};
const loadRig=()=>rigPromise??=Promise.all([new GLTFLoader().loadAsync('/man.glb'),new GLTFLoader().loadAsync('/woman.glb'),new GLTFLoader().loadAsync('/anim.glb')]).then(([man,woman,anim])=>{
 const walk=cleanClip(anim.animations.find(a=>a.name==='Walk')!),idle=cleanClip(anim.animations.find(a=>a.name==='Idle')!);
 return {
  boy:{...measure(man.scene as T.Group),walk:man.animations[0],idle:null,face:FACE_MAN},
  girl:{...measure(woman.scene as T.Group),walk,idle,face:FACE_WOMAN},
 };
});
let FACE_MAN=Math.PI,FACE_WOMAN=Math.PI; // yaw so each model faces the group's forward (+X); tuned per model

function makeNameLabel(name:string){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;
 ctx.font='600 30px ui-sans-serif,system-ui,sans-serif';const width=Math.min(236,ctx.measureText(name).width+34),x=(256-width)/2;
 ctx.fillStyle='rgba(18,32,28,.78)';ctx.beginPath();ctx.roundRect(x,10,width,44,22);ctx.fill();
 ctx.strokeStyle='rgba(255,246,220,.35)';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#fdf6e0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,128,33,208);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
 sprite.position.set(0,.56,0);sprite.scale.set(.55,.1375,1);sprite.renderOrder=20;
 return {sprite,texture};
}

// gender: 0 = boy (Soldier), 1 = girl (Michelle). outfit only nudges the walk phase so joiners don't stride in lockstep.
export function createAvatar({name,gender,outfit,label}:{name:string;gender:number;outfit:number;label:boolean}){
 const group=new T.Group();group.name='Player '+name;group.userData.animatedChildren=true;group.userData.animatedTree=true;group.userData.dyn=true;
 let mixer:T.AnimationMixer|undefined,walk:T.AnimationAction|undefined,idle:T.AnimationAction|undefined,blend=0,disposed=false;
 let speakBadge:T.Mesh|undefined,speakGeo:T.TorusGeometry|undefined,speakMat:T.MeshStandardMaterial|undefined,speakClock=0;
 const setSpeaking=(on:boolean)=>{
  if(!on&&!speakBadge)return;
  if(!speakBadge){speakGeo=new T.TorusGeometry(.11,.022,8,20);speakMat=new T.MeshStandardMaterial({name:'Night speak glow',color:0x2fd07a,emissive:0x2fd07a,emissiveIntensity:1.4,roughness:.5});speakBadge=new T.Mesh(speakGeo,speakMat);speakBadge.rotation.x=Math.PI/2;speakBadge.position.set(0,.5,0);speakBadge.renderOrder=19;group.add(speakBadge)}
  speakBadge.visible=on;
 };
 let sprite:T.Sprite|undefined,texture:T.CanvasTexture|undefined;
 const ready=loadRig().then(rig=>{
  if(disposed)return;
  const src=gender===1?rig.girl:rig.boy;const model=clone(src.scene) as T.Object3D;model.name='Kerala visitor';
  model.scale.setScalar(src.scale);model.position.y=-src.minY*src.scale;model.rotation.y=src.face;
  group.add(model);
  mixer=new T.AnimationMixer(model);walk=mixer.clipAction(src.walk).play();walk.setEffectiveWeight(0);if(src.idle){idle=mixer.clipAction(src.idle).play()}mixer.update(Math.abs(seed(name)+outfit*.317)%1);
  if(label){({sprite,texture}=makeNameLabel(name));group.add(sprite)}
 }).catch(error=>console.error('Player avatar loading failed',error));
 return {
  group,ready,
  update(dt:number,moving:boolean){if(speakBadge?.visible){speakClock+=dt;speakBadge.scale.setScalar(1+Math.sin(speakClock*11)*.16)}if(!mixer||!walk)return;blend=T.MathUtils.damp(blend,moving?1:0,8,dt);walk.setEffectiveWeight(blend);idle?.setEffectiveWeight(1-blend);mixer.update(dt*(moving?1.35:1))},
  setSpeaking,
  // clones share source geometry/materials/textures — only dispose per-instance skeleton + the name label.
  dispose(){disposed=true;mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(mixer.getRoot());group.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()});texture?.dispose();sprite?.material.dispose();speakGeo?.dispose();speakMat?.dispose();group.parent?.remove(group)},
 };
}
const seed=(name:string)=>{let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))|0;return h*.173};
