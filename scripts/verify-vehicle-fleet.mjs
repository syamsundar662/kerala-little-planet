import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3002',{waitUntil:'networkidle'});await page.waitForTimeout(600);await page.locator('.area-demo').click();await page.locator('.drive-enter').waitFor({timeout:90000});
for(const kind of ['car','bike','lorry','bus']){
 await page.getByRole('button',{name:'Open game menu'}).click();await page.getByLabel('Choose vehicle',{exact:true}).selectOption(kind);await page.waitForTimeout(500);
 assert.equal(await page.getByLabel('Choose vehicle',{exact:true}).inputValue(),kind);
 await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');assert(Number(await page.locator('.drive-speed strong').innerText())>0,`${kind} accelerates`);
 await page.keyboard.down('a');await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('a');await page.keyboard.up('w');
 await page.screenshot({path:`/tmp/kerala-${kind}.png`});await page.keyboard.down('Space');await page.waitForTimeout(2000);await page.keyboard.up('Space');
 await page.locator('.drive-enter').click();await page.waitForFunction(()=>document.querySelector('.drive-game')?.dataset.mode==='walk');
}
assert.deepEqual(errors,[]);console.log('PASS: select, accelerate, steer, brake and exit car, bike, lorry and bus.');
}finally{await browser.close();}
