import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 let code=80, precipitation=.6;
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{time:Math.floor(Date.now()/1000),temperature_2m:27,precipitation,cloud_cover:99,wind_speed_10m:14,weather_code:code}}}));
 await page.goto('http://localhost:3002');
 await page.waitForFunction(()=>document.querySelector('.drive-world canvas')?.dataset.raining==='true',{timeout:90000});
 await page.screenshot({path:'/tmp/alappuzha-rain.png'});
 assert.match(await page.locator('.drive-weather').innerText(),/Rain/);
 const solar=await page.evaluate(async()=>{const {solarPosition}=await import('/app/alappuzha-weather.ts');return [solarPosition(new Date('2026-09-19T01:30:00Z')),solarPosition(new Date('2026-09-19T06:30:00Z')),solarPosition(new Date('2026-09-19T18:30:00Z'))];});
 assert(solar[0].x>0,'morning sun east');assert(solar[1].elevation>60,'midday sun overhead');assert(solar[2].elevation<0,'night sun below horizon');
 code=0;precipitation=0;
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForFunction(()=>document.querySelector('.drive-world canvas')?.dataset.raining==='false');
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{temperature_2m:null}}}));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.getByText(/Last reading/).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: reported rain renders, dry weather stops rain, malformed update retains labeled last reading, solar morning/noon/night, no shader errors.');
} finally {await browser.close();}
