import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/road-render-regression',route=>route.fulfill({contentType:'text/html',body:`<html><body><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import {roadRibbonGeometry,configureGroundLayers} from '/app/alappuzha-road-mesh.ts';
try {
const renderer=new T.WebGLRenderer({antialias:false});renderer.setSize(800,600);document.body.appendChild(renderer.domElement);
const target=new T.WebGLRenderTarget(800,600),scene=new T.Scene(),camera=new T.PerspectiveCamera(58,800/600,.5,1600);
const materials=[0x0000ff,0x00ffff,0xff00ff,0xffffff].map(color=>new T.MeshBasicMaterial({color,side:T.DoubleSide}));
const layers=configureGroundLayers(...materials);
const ground=new T.Mesh(new T.PlaneGeometry(4000,4000,16,16),new T.MeshBasicMaterial({color:0x00ff00}));ground.rotation.x=-Math.PI/2;ground.renderOrder=-100;ground.position.set(30000,-.06,20000);scene.add(ground);
const segment={a:[30000,19900],b:[30000,21200],width:14};const road=new T.Mesh(roadRibbonGeometry([segment],0,.045,true),materials[2]);road.renderOrder=layers.get(materials[2]);scene.add(road);
const pixel=new Uint8Array(4);let sampled=0;
function read(point){point.project(camera);const x=Math.floor((point.x*.5+.5)*800),y=Math.floor((point.y*.5+.5)*600);if(x<0||x>=800||y<0||y>=600)return null;renderer.readRenderTargetPixels(target,x,y,1,1,pixel);return [...pixel];}
for(let frame=0;frame<80;frame++){
 camera.position.set(30000+Math.sin(frame*.19)*3,3.4+Math.sin(frame*.13)*.4,20000+frame*.3);camera.lookAt(30000,1,20200+frame*.3);camera.updateMatrixWorld();renderer.setRenderTarget(target);renderer.render(scene,camera);
 for(const forward of [15,25,40,70,100,180,300]){const color=read(new T.Vector3(30000,.045,camera.position.z+forward));if(!color)continue;sampled++;if(color[0]<240||color[1]>15||color[2]<240)throw Error('Asphalt disappeared at frame '+frame+' distance '+forward+': '+color);}
}
// Surface compositing must still let buildings/vehicles occlude roads.
const box=new T.Mesh(new T.BoxGeometry(8,5,8),new T.MeshBasicMaterial({color:0xff0000}));box.position.set(30000,2.5,20045);scene.add(box);camera.position.set(30000,4,20000);camera.lookAt(30000,2,20045);camera.updateMatrixWorld();renderer.render(scene,camera);const occluder=read(new T.Vector3(30000,2.5,20041));if(!occluder||occluder[0]<240||occluder[1]>15||occluder[2]>15)throw Error('Road painted over a foreground object: '+occluder);
window.result={sampled,frames:80,occluder};target.dispose();renderer.dispose();
}catch(e){window.result={error:String(e)}}
</script></body></html>`}));
 await page.goto('http://localhost:3002/road-render-regression');await page.waitForFunction(()=>window.result,{timeout:60000});const result=await page.evaluate(()=>window.result);assert(!result.error,result.error);assert(result.sampled>400);assert.deepEqual(errors,[]);console.log('PASS: moving-camera road pixel coverage and foreground occlusion:',result);
}finally{await browser.close();}
