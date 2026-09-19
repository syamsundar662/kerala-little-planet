import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const fixture=([lon,lat])=>({elements:[
 {type:'way',id:100,nodes:[1,2,3,4,5],tags:{highway:'residential',name:'Local test road'},geometry:[{lon:lon-.006,lat},{lon:lon-.003,lat},{lon,lat},{lon:lon+.003,lat},{lon:lon+.006,lat}]},
 {type:'way',id:101,nodes:[6,7,3,8,9],tags:{highway:'secondary',name:'Cross street'},geometry:[{lon,lat:lat-.006},{lon,lat:lat-.003},{lon,lat},{lon,lat:lat+.003},{lon,lat:lat+.006}]},
 {type:'way',id:102,nodes:[11,12,13,14,11],tags:{building:'house',height:'12','building:levels':'3','roof:shape':'hipped','roof:height':'2','roof:colour':'#855746','building:colour':'#c4b596'},geometry:[{lon:lon+.0003,lat:lat+.0003},{lon:lon+.0005,lat:lat+.0003},{lon:lon+.0005,lat:lat+.0005},{lon:lon+.0003,lat:lat+.0005},{lon:lon+.0003,lat:lat+.0003}]}
]});
try {
 const context=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:51.5072,longitude:-.1276,accuracy:25},viewport:{width:1440,height:900}});
 const page=await context.newPage();const requests=[],errors=[];let queryCount=0,fail=false,delay=false;
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|THREE.WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/api/world-map?*',async r=>{
  queryCount++;
  if(delay){await new Promise(resolve=>setTimeout(resolve,2000));}
  if(fail){await r.fulfill({status:503,json:{error:'Nearby map download failed. Please retry.'}});return;}
  const params=new URL(r.request().url()).searchParams;
  const center=[Number(params.get('lon')),Number(params.get('lat'))];
  await r.fulfill({json:fixture(center)});
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});
 assert.equal(await page.locator('canvas').count(),0);
 assert.ok(!requests.some(u=>/\/maps\/|\.glb|open-meteo|overpass/.test(u)),'No map, model or weather downloads before choosing a location');
 await page.getByRole('button',{name:'Use my location',exact:true}).click();
 await page.getByRole('button',{name:'Explore around my location'}).waitFor();
 assert.equal(queryCount,0,'GPS alone does not download a world');
 await page.getByRole('button',{name:'Explore around my location'}).click();
 const ready=()=>page.waitForFunction(()=>document.querySelector('[aria-label="Open full district map"]')?.disabled===false,{timeout:60000});
 await ready();await page.screenshot({path:'/tmp/world-area-game.png'});assert.equal(queryCount,1);assert.equal(await page.locator('.drive-world canvas').count(),1);
 assert.ok(!requests.some(u=>u.includes('/maps/alappuzha')||u.includes('/maps/terrain')),'Worldwide area never downloads Alappuzha');
 await page.getByRole('button',{name:'Open full district map'}).click();
 await page.getByRole('dialog',{name:'Nearby world map'}).waitFor();
 await page.getByText('Nearby roads load automatically in your direction of travel.').waitFor();
 await page.screenshot({path:'/tmp/world-area-map.png'});
 await page.getByRole('button',{name:'Close district map'}).click();
 await page.getByRole('button',{name:'Change world location'}).click();
 assert.equal(await page.locator('canvas').count(),0,'Old renderer disposed when switching area');
 await page.getByLabel('Latitude',{exact:true}).fill('-33.8688');await page.getByLabel('Longitude',{exact:true}).fill('151.2093');
 await page.getByRole('button',{name:'Load nearby streets',exact:true}).click();await ready();assert.equal(queryCount,2);
 await page.getByRole('button',{name:'Change world location'}).click();
 fail=true;
 await page.getByLabel('Latitude',{exact:true}).fill('40.7128');await page.getByLabel('Longitude',{exact:true}).fill('-74.006');
 await page.getByRole('button',{name:'Load nearby streets',exact:true}).click();await page.getByText(/Nearby map download failed/).waitFor();
 fail=false;await page.getByRole('button',{name:'Retry this location',exact:true}).click();await ready();
 await page.getByRole('button',{name:'Change world location'}).click();
 fail=false;delay=true;
 await page.getByLabel('Latitude',{exact:true}).fill('40.7228');await page.getByLabel('Longitude',{exact:true}).fill('-74.006');
 await page.getByRole('button',{name:'Load nearby streets',exact:true}).click();await page.getByRole('button',{name:'Cancel loading'}).click();await page.waitForTimeout(2200);
 assert.equal(await page.locator('canvas').count(),0,'Cancelled request cannot mount a stale world');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/world-area-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: zero initial world requests; opt-in GPS; London/Sydney loading; regional map; single renderer; no Alappuzha download; provider error/retry; cancellation; mobile layout.');
} finally {await browser.close();}
