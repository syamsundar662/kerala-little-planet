import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/api/world-map?*',r=>r.fulfill({json:{elements:[{type:'way',id:1,nodes:[1,2,3,4],tags:{highway:'secondary',name:'Avinashi Road'},geometry:[{lon:76.3388,lat:9.4981},{lon:76.3418,lat:9.4981},{lon:76.3448,lat:9.4981},{lon:76.3478,lat:9.4981}]}]}}));
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});
 await page.getByLabel('Latitude',{exact:true}).fill('9.4981');await page.getByLabel('Longitude',{exact:true}).fill('76.3388');
 await page.getByRole('button',{name:'Load nearby streets',exact:true}).click();
 await page.getByRole('button',{name:'F Enter bus',exact:true}).waitFor({timeout:60000});
 for(const [width,height] of [[1440,900],[1024,768],[1280,650],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  const result=await page.evaluate(()=>{
   const selectors=['.drive-mission','.drive-weather','.drive-actions','.drive-navigation','.drive-speed','.drive-daily','.drive-enter','.drive-help','.area-coverage','.drive-place','.drive-coins'];
   const boxes=selectors.flatMap(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return r.width&&r.height?[{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom}]:[]});
   const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([a.selector,b.selector]);}
   return {overlaps,outside:boxes.filter(r=>r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(result.overlaps,[],`${width}x${height} overlapping HUD`);assert.deepEqual(result.outside,[]);assert.equal(result.overflow,false);
  await page.screenshot({path:`/tmp/clean-hud-${width}.png`});console.log(width,height,'PASS',result);
 }
 await page.getByRole('button',{name:'Open game menu',exact:true}).click();await page.getByRole('button',{name:'Change camera',exact:true}).click();await page.getByRole('button',{name:'Close game menu',exact:true}).click();
 await page.setViewportSize({width:1440,height:900});
 const dimensions=await page.locator('.drive-actions button').evaluateAll(buttons=>buttons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
 assert.ok(dimensions.every(d=>d.width===dimensions[0].width&&d.height===44));
 await page.getByRole('button',{name:'Mute sounds',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Unmute sounds',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Open full district map',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close district map',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS: equal action sizes, sound state, full map, mobile menu and no browser exceptions.');
}finally{await browser.close();}
