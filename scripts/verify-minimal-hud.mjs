import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{time:Math.floor(Date.now()/1000),temperature_2m:28,precipitation:0,cloud_cover:80,wind_speed_10m:8,weather_code:3}}}));
 await page.goto('http://localhost:3002',{waitUntil:'networkidle'});await page.waitForTimeout(600);await page.getByRole('button',{name:'Explore Alappuzha instead'}).click();await page.locator('.drive-enter').waitFor({timeout:90000});await page.waitForTimeout(1500);
 for(const sel of ['.drive-mission h1','.drive-mission p','.drive-help','.drive-actions','.drive-daily','.drive-speed','.drive-logo small','.drive-weather small'])assert.equal(await page.locator(sel).isVisible(),false,`${sel} hidden during walking`);
 assert.equal(await page.getByRole('button',{name:'Open full district map',exact:true}).count(),1);
 await page.screenshot({path:'/tmp/kerala-minimal-hud.png'});
 await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'Change camera'}).click();assert(await page.locator('.drive-help').isVisible());await page.screenshot({path:'/tmp/kerala-minimal-menu.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('.drive-actions').isVisible(),false);
 await page.locator('.drive-enter').click();await page.locator('.drive-speed').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Open full district map',exact:true}).click();await page.getByRole('button',{name:'Close district map'}).click();assert.deepEqual(errors,[]);
 console.log('PASS: compact desktop HUD, one map control, menu/keyboard help, Escape dismissal, driving-only speed, full map.');
}finally{await browser.close();}
