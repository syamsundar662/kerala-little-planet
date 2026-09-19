import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const origin=[-.1276,51.5072],scale=111.32*Math.cos(origin[1]*Math.PI/180);
const geo=x=>({lon:origin[0]+x/1000/scale,lat:origin[1]});
const fixture=expanded=>({elements:[{type:'way',id:100,nodes:expanded?[1,2,3,4,5]:[1,2,3],tags:{highway:'secondary',name:'Continuous road'},geometry:(expanded?[850,1000,1100,1700,2500]:[850,1000,1100]).map(geo)}]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});let calls=0,release;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/overpass.private.coffee/api/interpreter',async r=>{
  calls++;
  if(calls>1){await new Promise(resolve=>release=resolve);}
  await r.fulfill({json:fixture(calls>1)});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});
 await page.getByLabel('Latitude',{exact:true}).fill(String(origin[1]));await page.getByLabel('Longitude',{exact:true}).fill(String(origin[0]));
 await page.getByRole('button',{name:'Load nearby streets',exact:true}).click();
 await page.getByRole('button',{name:'F Enter bus',exact:true}).waitFor({timeout:60000});
 await page.waitForTimeout(500);assert.equal(calls,1,'Standing still does not fetch another region');
 await page.locator('.drive-world canvas').evaluate(c=>window.originalCanvas=c);
 await page.getByRole('button',{name:'F Enter bus',exact:true}).click();
 await page.keyboard.down('w');
 await page.getByText('Loading roads ahead…',{exact:true}).waitFor({timeout:15000});
 await page.waitForTimeout(700);assert.equal(calls,2);assert.ok(Number(await page.locator('.drive-speed strong').innerText())>0);
 const before=Number(await page.locator('.drive-speed strong').innerText());
 release();
 await page.getByText('Live map · loads ahead as you travel',{exact:true}).waitFor({timeout:15000});
 assert.equal(await page.locator('.drive-world canvas').evaluate(c=>c===window.originalCanvas),true,'Renderer must not be recreated');
 assert.equal(await page.locator('.drive-world canvas').count(),1);
 assert.ok(Number(await page.locator('.drive-speed strong').innerText())>=before-2,'Velocity survives data update');
 await page.getByRole('button',{name:/Stop to exit|Exit vehicle/}).waitFor();
 await page.keyboard.up('w');await page.keyboard.down('Space');await page.waitForTimeout(800);await page.keyboard.up('Space');
 await page.getByRole('button',{name:'Open full district map'}).click();
 await page.getByRole('dialog',{name:'Nearby world map'}).waitFor();
 await page.screenshot({path:'/tmp/world-stream-map.png'});
 assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Close district map'}).click();
 await page.getByRole('button',{name:'Change world location'}).click();
 assert.equal(await page.locator('canvas').count(),0);
 console.log('PASS: actual driving triggers prefetch; delayed response keeps game running; streamed roads preserve canvas, vehicle and speed; map updates; cleanup; no browser exceptions.');
}finally{await browser.close();}
