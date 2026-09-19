import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:390,height:700},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{time:Math.floor(Date.now()/1000),temperature_2m:26,precipitation:.6,cloud_cover:95,wind_speed_10m:14,weather_code:95}}}));
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});await page.waitForTimeout(700);await page.getByRole('button',{name:'Explore Alappuzha instead'}).click();
 await page.locator('.drive-enter').waitFor({timeout:30000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(0,1800),errors);await page.screenshot({path:'/tmp/alappuzha-mobile-failure.png'});throw e});
 await page.waitForTimeout(3000);
 const canvas=page.locator('.drive-world canvas');
 assert.equal(await canvas.getAttribute('data-quality'),'mobile');
 assert.equal(await canvas.evaluate(c=>c.width),390,'phone framebuffer capped to 1x');
 assert.equal(await page.locator('.drive-mission h1').isVisible(),false);
 assert.equal(await page.locator('.drive-actions').isVisible(),false);
 await page.screenshot({path:'/tmp/alappuzha-mobile-clean.png'});
 for(const size of [{width:390,height:700},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);await page.waitForTimeout(300);
  const boxes=await page.locator('.drive-joystick,.drive-enter,.drive-mobile-toolbar button,.drive-place').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({label:n.getAttribute('aria-label')||n.textContent, x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
  for(const b of boxes){assert(b.w>=44&&b.h>=44,`${b.label} target >=44px`);assert(b.x>=0&&b.y>=0&&b.x+b.w<=size.width+1&&b.y+b.h<=size.height+1,`${b.label} inside viewport`);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`${a.label} overlaps ${b.label}`);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:390,height:700});
 await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'Change camera'}).click();await page.screenshot({path:'/tmp/alappuzha-mobile-menu.png'});
 await page.getByRole('button',{name:'Close game menu'}).click();
 await page.getByRole('button',{name:'Open full district map',exact:true}).click();await page.getByRole('button',{name:'Close district map'}).click();
 await page.locator('.drive-enter').click();
 const stick=page.getByRole('group',{name:'Movement joystick'});const b=await stick.boundingBox();
 assert.equal(await page.locator('.drive-touch button').count(),0,'joystick replaces movement buttons');
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+10);await page.waitForTimeout(1500);
 assert(Number(await page.locator('.drive-speed strong').innerText())>0,'joystick forward drives');
 const heading=()=>page.locator('.drive-navigation path[transform]').getAttribute('transform');const before=await heading();
 await page.mouse.move(b.x+b.width-8,b.y+15);await page.waitForTimeout(650);assert.notEqual(await heading(),before,'diagonal input steers while accelerating');
 await page.mouse.up();await page.waitForTimeout(1800);assert.equal(Number(await page.locator('.drive-speed strong').innerText()),0,'release brakes to stop');
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height-8);await page.waitForTimeout(1300);assert(Number(await page.locator('.drive-speed strong').innerText())>0,'backward input reverses');
 await stick.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await page.waitForTimeout(1800);assert.equal(Number(await page.locator('.drive-speed strong').innerText()),0,'cancellation clears throttle');
 await page.screenshot({path:'/tmp/alappuzha-mobile-joystick.png'});
 console.log('PASS: portrait, small phone, landscape; no control overlaps; menu/map; analog joystick steering, acceleration, reverse and release; mobile GPU budget.',await canvas.evaluate(c=>({quality:c.dataset.quality,calls:c.dataset.drawCalls,triangles:c.dataset.triangles,buffer:[c.width,c.height]})));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
