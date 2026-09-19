import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Inspect real loaded wheel objects without shipping a debug API in the app.
 await page.route('**/app/alappuzha-world.ts*',async route=>{
  const response=await route.fetch();
  const source=await response.text();
  assert.ok(source.includes('busWheels = createWheelRoll('));
  await route.fulfill({response,body:source.replace('busWheels = createWheelRoll(', 'window.__tyreTestBus = bus; window.__zoomTest = () => ({distance: camera.position.distanceTo(look), fov: camera.fov, zoom}); busWheels = createWheelRoll(')});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.__tyreTestBus,{timeout:90000});
 const snapshot=()=>page.evaluate(()=>{
  const bus=window.__tyreTestBus, wheels=[];
  bus.traverse(o=>{if(/^(Front|Rear)[ _]wheel[ _]axle/i.test(o.name))wheels.push({name:o.name,rotation:o.quaternion.toArray(),tyres:o.children.filter(c=>/tire/i.test(c.name)).length});});
  return {position:bus.position.toArray(),wheels};
 });
 const canvas=page.locator('.drive-world canvas');
 const zoomState=()=>page.evaluate(()=>window.__zoomTest());
 await page.waitForTimeout(600);
 const walking=await zoomState();
 await canvas.dispatchEvent('wheel',{deltaY:-400});await page.waitForTimeout(800);
 assert.ok((await zoomState()).distance<walking.distance,'Scroll in moves walking camera closer');
 await canvas.dispatchEvent('wheel',{deltaY:400});await page.waitForTimeout(800);
 assert.ok((await zoomState()).distance>walking.distance*.95,'Scroll out restores walking camera distance');
 const cdp=await page.context().newCDPSession(page);
 const pinchStart=await zoomState();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:520,y:420,id:1},{x:700,y:420,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:470,y:420,id:1},{x:750,y:420,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok((await zoomState()).zoom<pinchStart.zoom,'Pinch out zooms in');
 await page.getByRole('button',{name:'F Enter bus',exact:true}).click();
 await page.waitForTimeout(800);
 const chase=await zoomState();
 await canvas.dispatchEvent('wheel',{deltaY:400});await page.waitForTimeout(800);
 assert.ok((await zoomState()).distance>chase.distance,'Scroll out increases chase distance');
 await page.keyboard.press('c');await page.waitForTimeout(300);
 const inside=await zoomState();
 await canvas.dispatchEvent('wheel',{deltaY:-200});await page.waitForTimeout(300);
 assert.ok((await zoomState()).fov<inside.fov,'Inside view zoom adjusts field of view');
 await page.keyboard.press('c');await page.keyboard.press('c');

 const before=await snapshot();
 assert.equal(before.wheels.length,4,'Real GLB exposes four wheel assemblies');
 assert.ok(before.wheels.every(w=>w.tyres>0),'Each rotating assembly contains real tyre geometry');
 await page.keyboard.down('w');await page.waitForTimeout(1400);await page.keyboard.up('w');
 const driven=await snapshot();
 assert.notDeepEqual(before.position,driven.position,'Bus travels');
 for(let i=0;i<4;i++)assert.notDeepEqual(before.wheels[i].rotation,driven.wheels[i].rotation,driven.wheels[i].name+' rotates');
 await page.getByRole('button',{name:'Pause game'}).click();
 const paused=await snapshot();await page.waitForTimeout(400);
 assert.deepEqual(await snapshot(),paused,'Pausing stops tyre rotation');
 await page.getByRole('button',{name:'Back to the road'}).click();
 await page.keyboard.down('Space');await page.waitForTimeout(1500);await page.keyboard.up('Space');
 await page.keyboard.down('s');await page.waitForTimeout(1000);await page.keyboard.up('s');
 const reversed=await snapshot();
 for(let i=0;i<4;i++)assert.notDeepEqual(paused.wheels[i].rotation,reversed.wheels[i].rotation,'Reverse updates '+reversed.wheels[i].name);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/tyre-rotation-verified.png'});
 console.log('PASS: scroll zoom on foot and in chase/inside views, touch pinch zoom; actual GLB tyres rotate in the active driving scene, reverse updates all four assemblies, pause freezes rotation, no browser errors.');
} finally {await browser.close();}
