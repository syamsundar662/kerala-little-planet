import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 for(const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:700}:{width:1440,height:900},deviceScaleFactor:mobile?3:1,hasTouch:mobile,isMobile:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3002',{waitUntil:'domcontentloaded',timeout:60000});
  const graphics=page.getByLabel('Graphics quality');
  await graphics.waitFor({timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('[aria-label="Graphics quality"]')?.disabled,{timeout:60000});
  await page.getByRole('button',{name:'Just watch',exact:true}).click();
  await graphics.selectOption('smooth');
  assert.equal(await graphics.inputValue(),'smooth');
  const dimensions=await page.locator('canvas').first().evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}));
  assert.ok(dimensions.width*dimensions.height<=1_500_000);
  await graphics.selectOption('detail');
  await graphics.selectOption('auto');
  await page.getByRole('button',{name:/Explore Kerala/}).click();
  await page.locator('.district-atlas').waitFor({state:'visible'});
  await page.locator('.atlas-close').click();
  if(!mobile){
   for(const name of ['2 · Chase','3 · Inside','1 · Top'])await page.getByRole('button',{name,exact:true}).click();
  }
  await page.getByRole('button',{name:'Walk',exact:true}).click();
  await page.getByRole('textbox',{name:'Your name'}).fill('Graphics check');
  await page.getByRole('button',{name:'Walk in',exact:true}).click();
  await page.waitForTimeout(1000);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,footerBottom:document.querySelector('footer').getBoundingClientRect().bottom,height:innerHeight}));
  assert.equal(layout.overflow,false);assert.ok(layout.footerBottom<=layout.height+1);
  await page.screenshot({path:mobile?'/tmp/kerala-graphics-mobile.png':'/tmp/kerala-graphics-desktop.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mobile,dimensions,layout,errors,status:'PASS'}));
  await page.close();
 }
} finally {await browser.close();}
