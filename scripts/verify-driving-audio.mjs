import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Original=window.AudioContext;
  window.__audio={oscillators:[],gains:[]};
  window.AudioContext=class extends Original {
   constructor(...args){super(...args);window.__audio.context=this;}
   createOscillator(){const o=super.createOscillator();window.__audio.oscillators.push(o);return o;}
   createGain(){const g=super.createGain();window.__audio.gains.push(g);return g;}
   createDynamicsCompressor(){const c=super.createDynamicsCompressor(),a=this.createAnalyser();a.fftSize=2048;c.connect(a);window.__audio.analyser=a;return c;}
  };
 });
 await page.goto('http://localhost:3002',{waitUntil:'networkidle',timeout:60000});
 await page.getByRole('button',{name:'F Enter bus',exact:true}).click();
 await page.waitForTimeout(600);
 const audio=()=>page.evaluate(()=>{const a=window.__audio,b=new Float32Array(a.analyser.fftSize);a.analyser.getFloatTimeDomainData(b);return {state:a.context.state,rms:Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length),pitch:a.oscillators[0].frequency.value,count:a.oscillators.length,gains:a.gains.map(g=>g.gain.value)};});
 const idle=await audio();assert.equal(idle.state,'running');assert.ok(idle.rms>.001,'Engine produces an audio signal');
 await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
 assert.ok((await audio()).pitch>idle.pitch,'Acceleration raises engine pitch');
 await page.getByRole('button',{name:'Sound horn',exact:true}).click();assert.ok((await audio()).count>=4,'Horn generates two tones');
 await page.keyboard.down('Space');await page.waitForTimeout(100);assert.ok((await audio()).gains[3]>.001,'Braking produces tyre noise');await page.keyboard.up('Space');
 await page.getByRole('button',{name:'Mute sounds',exact:true}).click();await page.waitForTimeout(400);assert.ok((await audio()).rms<.0001,'Mute silences output');
 await page.getByRole('button',{name:'Unmute sounds',exact:true}).click();await page.waitForTimeout(400);assert.ok((await audio()).rms>.001,'Unmute restores output');
 await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.waitForTimeout(200);assert.equal((await audio()).state,'suspended');
 await page.getByRole('button',{name:'Back to the road',exact:true}).click();await page.waitForTimeout(200);assert.equal((await audio()).state,'running');
 await page.keyboard.down('Space');await page.waitForTimeout(1400);await page.keyboard.up('Space');await page.getByRole('button',{name:'F Exit vehicle',exact:true}).click();await page.waitForTimeout(1200);
 const exited=await audio();assert.ok(exited.gains[1]<.0001&&exited.gains[7]<.0001,'Exiting stops both engine layers while weather ambience continues');
 assert.deepEqual(errors,[]);
 console.log('PASS: audible engine signal, acceleration pitch, horn, braking, mute/unmute, pause/resume, quiet on exit, no browser exceptions.');
}finally{await browser.close();}
