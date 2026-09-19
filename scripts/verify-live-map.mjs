import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
 const pages = await Promise.all(['Map Test A','Map Test B'].map(async name => {
   const context = await browser.newContext({viewport:{width:1280,height:850}});
   const page = await context.newPage();
   await page.addInitScript(() => {
     const original = CanvasRenderingContext2D.prototype.fillText;
     CanvasRenderingContext2D.prototype.fillText = function(text,x,y,...args) {
       if (text === 'Map Test B' && this.canvas.getAttribute('aria-label') === 'Live nearby players') window.lastMapPeerPosition = [x,y];
       return original.call(this,text,x,y,...args);
     };
   });
   await page.goto('http://localhost:3002',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForTimeout(2000);
   await page.getByLabel('Your name',{exact:true}).fill(name);
   await page.getByRole('button',{name:'Continue',exact:true}).click();
   await page.locator('.area-demo').click();
   await page.locator('.drive-enter').waitFor({timeout:90000});
   return page;
 }));
 const [a,b] = pages;
 await a.waitForFunction(()=>document.querySelector('.drive-navigation [data-player-id]'),{timeout:30000});
 await a.getByRole('button',{name:'Open full district map'}).first().click();
 await a.locator('.world-map-overlay [data-player-id]').filter({hasText:'Map Test B'}).waitFor({timeout:20000});
 assert(Number(await a.getByLabel('Live nearby players',{exact:true}).getAttribute('data-player-count'))>=1);
 const before = await a.evaluate(() => window.lastMapPeerPosition);
 assert(before, 'named peer drawn on map');
 await b.keyboard.down('w'); await b.waitForTimeout(1000); await b.keyboard.up('w');
 await a.waitForFunction(([x,y]) => window.lastMapPeerPosition && (window.lastMapPeerPosition[0] !== x || window.lastMapPeerPosition[1] !== y), before);
 await a.screenshot({path:'/tmp/kerala-live-map.png'});
 await b.close();
 await a.waitForFunction(()=>![...document.querySelectorAll('.world-map-overlay [data-player-id]')].some(el=>el.textContent.includes('Map Test B')),{timeout:25000});
 console.log('PASS: two live clients, minimap marker, full map named marker while paused, disconnect removal while map remains open.');
} finally { await browser.close(); }
