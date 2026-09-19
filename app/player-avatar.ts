import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Stylised Kerala villager rig (lighter than the ultrarealistic build) with Blender-authored clothing and animation.
const TARGET_HEIGHT=.34;      // final world-unit height on the R=9 planet
const FACE=Math.PI/2;         // yaw so the model faces the group's forward (+X)
type Rig={scene:T.Group;walk:T.AnimationClip;idle:T.AnimationClip;scale:number;minY:number};
let keralaRigPromise:Promise<Rig>|undefined;
const loadKeralaRig=()=>keralaRigPromise??=new GLTFLoader().loadAsync('/kerala-villager.glb?v=stylised-20260917').then(gltf=>{
 const scene=gltf.scene;scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false}});
 const walk=gltf.animations.find(a=>a.name==='Walk'),idle=gltf.animations.find(a=>a.name==='Idle');
 if(!walk||!idle)throw new Error('Kerala character animations are missing');
 const box=new T.Box3().setFromObject(scene);return {scene,walk,idle,scale:TARGET_HEIGHT/(box.max.y-box.min.y),minY:box.min.y};
}).catch(error=>{keralaRigPromise=undefined;throw error});

export function makeNameLabel(name:string){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;
 ctx.font='600 30px ui-sans-serif,system-ui,sans-serif';const width=Math.min(236,ctx.measureText(name).width+34),x=(256-width)/2;
 ctx.fillStyle='rgba(18,32,28,.78)';ctx.beginPath();ctx.roundRect(x,10,width,44,22);ctx.fill();
 ctx.strokeStyle='rgba(255,246,220,.35)';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#fdf6e0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,128,33,208);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
 sprite.position.set(0,.44,0);sprite.scale.set(.55,.1375,1);sprite.renderOrder=20;
 return {sprite,texture};
}

// Outfit varies the animation phase; legacy gender is retained only in the wire format.
export function createAvatar({name,outfit,label}:{name:string;gender:number;outfit:number;label:boolean}){
 const group=new T.Group();group.name='Player '+name;group.userData.animatedChildren=true;group.userData.animatedTree=true;group.userData.dyn=true;
 let mixer:T.AnimationMixer|undefined,walk:T.AnimationAction|undefined,idle:T.AnimationAction|undefined,blend=0,disposed=false;
 let speakBadge:T.Mesh|undefined,speakGeo:T.TorusGeometry|undefined,speakMat:T.MeshStandardMaterial|undefined,speakClock=0;
 const setSpeaking=(on:boolean)=>{
  if(!on&&!speakBadge)return;
  if(!speakBadge){speakGeo=new T.TorusGeometry(.11,.022,8,20);speakMat=new T.MeshStandardMaterial({name:'Night speak glow',color:0x2fd07a,emissive:0x2fd07a,emissiveIntensity:1.4,roughness:.5});speakBadge=new T.Mesh(speakGeo,speakMat);speakBadge.rotation.x=Math.PI/2;speakBadge.position.set(0,.51,0);speakBadge.renderOrder=19;group.add(speakBadge)}
  speakBadge.visible=on;
 };
 let sprite:T.Sprite|undefined,texture:T.CanvasTexture|undefined;
 const ready=loadKeralaRig().then(rig=>{
  if(disposed)return;
  const model=clone(rig.scene) as T.Object3D;model.name='Kerala visitor';
  model.scale.setScalar(rig.scale);model.position.y=-rig.minY*rig.scale;model.rotation.y=FACE;
  group.add(model);
  mixer=new T.AnimationMixer(model);walk=mixer.clipAction(rig.walk).play();idle=mixer.clipAction(rig.idle).play();walk.setEffectiveWeight(0);mixer.update(Math.abs(seed(name)+outfit*.317)%1);
  if(label){({sprite,texture}=makeNameLabel(name));group.add(sprite)}
 }).catch(error=>console.error('Player avatar loading failed',error));
 return {
  group,ready,
  update(dt:number,moving:boolean){if(speakBadge?.visible){speakClock+=dt;speakBadge.scale.setScalar(1+Math.sin(speakClock*11)*.16)}if(!mixer||!walk||!idle)return;blend=T.MathUtils.damp(blend,moving?1:0,8,dt);walk.setEffectiveWeight(blend);idle.setEffectiveWeight(1-blend);mixer.update(dt)},
  setSpeaking,
  // clones share source geometry/materials/textures — only dispose per-instance skeleton + the label/badge.
  dispose(){disposed=true;mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(mixer.getRoot());group.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()});texture?.dispose();sprite?.material.dispose();speakGeo?.dispose();speakMat?.dispose();group.parent?.remove(group)},
 };
}
const seed=(name:string)=>{let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))|0;return h*.173};
