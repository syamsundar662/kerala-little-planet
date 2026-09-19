import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app/alappuzha-world.ts*',async route=>{
  const response=await route.fetch(),source=await response.text();
  await route.fulfill({response,body:source.replace('const water = environment.water;','window.__umbrellaTest={scene,setWeather:environment.setWeather}; const water = environment.water;')});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle',timeout:60000});
 const choose=page.getByRole('button',{name:'Explore Alappuzha instead',exact:true});if(await choose.isVisible())await choose.click();
 await page.getByRole('button',{name:'F Enter bus',exact:true}).waitFor({timeout:60000}).catch(async error=>{console.log('Errors:',errors,'Page:',await page.locator('body').innerText());throw error});
 const setRain=rain=>page.evaluate(rain=>window.__umbrellaTest.setWeather({temperature:28,precipitation:rain?4:0,cloud:rain?1:.1,wind:10,code:rain?63:0,observedAt:Date.now(),fetchedAt:Date.now()}),rain);
 const count=()=>page.evaluate(()=>{let visible=0,total=0;window.__umbrellaTest.scene.traverse(o=>{if(o.name==='Rain umbrella'){total++;if(o.visible)visible++}});return {visible,total}});
 await setRain(false);await page.waitForTimeout(500);assert.deepEqual(await count(),{visible:0,total:7});
 await setRain(true);await page.waitForTimeout(1000);assert.deepEqual(await count(),{visible:7,total:7});
 await page.screenshot({path:'/tmp/rain-umbrellas.png'});
 await page.getByRole('button',{name:'F Enter bus',exact:true}).click();await page.waitForTimeout(300);assert.equal((await count()).visible,6,'Driver puts umbrella away');
 await page.getByRole('button',{name:'F Exit vehicle',exact:true}).click();await page.waitForTimeout(300);assert.equal((await count()).visible,7,'Walker uses umbrella again');
 await setRain(false);await page.waitForTimeout(300);assert.equal((await count()).visible,0,'Everyone puts umbrellas away in dry weather');
 assert.deepEqual(errors,[]);console.log('PASS: rain opens umbrellas for all six pedestrians and player; entering/exiting bus and clear weather restore correct visibility; no browser errors.');
}finally{await browser.close();}
