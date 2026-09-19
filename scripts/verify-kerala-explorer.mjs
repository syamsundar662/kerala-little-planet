import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const requests=[],errors=[];
 page.on('request',r=>requests.push(r.url()));
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/api/world-map?*',r=>{
  const p=new URL(r.request().url()).searchParams,lon=Number(p.get('lon')),lat=Number(p.get('lat'));
  return r.fulfill({json:{elements:[{type:'way',id:1,nodes:[1,2,3],tags:{highway:'residential',name:'Test road'},geometry:[{lon:lon-.008,lat},{lon,lat},{lon:lon+.008,lat}]}]}});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.kerala-district-list button').count(),14);
 for(const button of await page.locator('.kerala-district-list button').all()){
  await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
 }
 assert.ok(!requests.some(u=>/api\/world-map|\.glb|\/maps\//.test(u)));
 await page.getByLabel('Find a district or town').fill('Kalpetta');
 assert.equal(await page.locator('.kerala-district-list button').count(),1);
 await page.locator('.kerala-district-list button').click();
 await page.getByRole('button',{name:'Explore Kalpetta'}).waitFor();
 await page.getByLabel('Find a district or town').fill('');
 await page.screenshot({path:'/tmp/kerala-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/kerala-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 for(const town of ['Kasaragod','Thiruvananthapuram']){
  await page.getByLabel('Find a district or town').fill(town);
  await page.locator('.kerala-district-list button').click();
  await page.getByRole('button',{name:`Explore ${town}`}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Open full district map"]')?.disabled===false,{timeout:60000});
  assert.equal(await page.locator('.drive-world canvas').count(),1);
  assert.equal(await page.locator('.drive-world').getAttribute('aria-label'),`Playable 3D Kerala · from ${town} world`);
  if(!await page.getByRole('button',{name:'Change world location'}).isVisible()) await page.getByRole('button',{name:'Open game menu'}).click();
  await page.getByRole('button',{name:'Change world location'}).click();
  assert.equal(await page.locator('canvas').count(),0);
 }
 assert.equal(requests.filter(u=>u.includes('/api/world-map?')).length,2);
 assert.deepEqual(errors,[]);
 console.log('PASS: all 14 district selections, town search, zero initial map downloads, mobile layout, north/south starts, renderer disposal. Map responses mocked.');
} finally {await browser.close();}
