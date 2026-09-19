import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const context=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:9.4981,longitude:76.3388,accuracy:30},viewport:{width:1440,height:900}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.geoCalls=0;
  const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition=(ok,fail,options)=>{window.geoCalls++;window.geoOptions=options;if(window.geoError)fail({code:window.geoError});else original(ok,fail,options);};
 });
 await page.goto('http://localhost:3002',{waitUntil:'domcontentloaded'});
 const open=page.getByRole('button',{name:'Open full district map'});
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Open full district map"]')?.disabled,{timeout:90000});
 assert.equal(await page.evaluate(()=>window.geoCalls),0);
 await open.click();
 const locate=page.getByRole('button',{name:'Use my location',exact:true});
 await locate.click();
 await page.getByText('Your location is marked in blue.',{exact:true}).waitFor();
 await page.getByText(/Nearest mapped town: Alappuzha/).waitFor();
 assert.equal(await page.evaluate(()=>window.geoCalls),1);
 await page.screenshot({path:'/tmp/kerala-location-desktop.png'});
 await page.getByRole('button',{name:'Travel in game to Alappuzha'}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await open.click();
 for(const [code,pattern] of [[1,/permission was denied/],[2,/location is unavailable/],[3,/took too long/]]){
  await page.evaluate(code=>window.geoError=code,code);await locate.click();await page.locator('.current-location output').filter({hasText:pattern}).waitFor();
 }
 await page.evaluate(()=>window.geoError=0);
 await context.setGeolocation({latitude:51.5072,longitude:-0.1276,accuracy:2000});
 await locate.click();await page.getByText(/You are outside this map/).waitFor();
 await page.getByText(/This is an approximate location/).waitFor();
 await page.setViewportSize({width:390,height:700});
 await locate.scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/kerala-location-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: opt-in permission, real browser geolocation, marker, town travel, denied/unavailable/timeout/retry, outside area, mobile layout; no JavaScript errors.');
} finally {await browser.close();}
