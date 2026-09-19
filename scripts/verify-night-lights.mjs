import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/shader error|VALIDATE_STATUS|THREE.WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.clock.setFixedTime(new Date('2026-09-19T18:30:00Z'));
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/api/world-map?*',r=>{
  const p=new URL(r.request().url()).searchParams,lon=Number(p.get('lon')),lat=Number(p.get('lat'));
  return r.fulfill({json:{elements:[{type:'way',id:1,nodes:[1,2,3],tags:{highway:'residential',name:'Night test road'},geometry:[{lon:lon-.008,lat},{lon,lat},{lon:lon+.008,lat}]}]}});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Explore Kochi'}).click();
 await page.waitForFunction(()=>Number(document.querySelector('.drive-world canvas')?.dataset.streetLights)>0,null,{timeout:60000}).catch(async e=>{console.log(await page.locator('body').innerText(),await page.locator('canvas').evaluateAll(cs=>cs.map(c=>({...c.dataset}))),errors);throw e;});
 const canvas=page.locator('.drive-world canvas');
 assert.equal(await canvas.getAttribute('data-moon-visible'),'true');
 assert.ok(Number(await canvas.getAttribute('data-street-lights'))<=4);
 await page.screenshot({path:'/tmp/night-street-lights.png'});
 await page.clock.setFixedTime(new Date('2026-09-19T06:30:00Z'));
 await page.waitForFunction(()=>document.querySelector('.drive-world canvas')?.dataset.streetLights==='0');
 assert.equal(await canvas.getAttribute('data-moon-visible'),'false');
 assert.deepEqual(errors,[]);
 console.log('PASS: night lamps on, fixed light budget, moon visible, daytime lights/moon off, no shader errors (mock map).');
} finally {await browser.close();}
