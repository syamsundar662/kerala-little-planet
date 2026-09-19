import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.__sound = { gains: [], buffers: [], tones: [] };
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        window.__sound.ctx = this;
      }
      createGain() {
        const g = super.createGain();
        window.__sound.gains.push(g);
        return g;
      }
      createBufferSource() {
        const b = super.createBufferSource();
        window.__sound.buffers.push(b);
        return b;
      }
      createOscillator() {
        const o = super.createOscillator();
        window.__sound.tones.push(o);
        return o;
      }
    };
  });
  await page.route('**/app/alappuzha-world.ts*', async (route) => {
    const response = await route.fetch(),
      source = await response.text();
    assert.ok(source.includes('const water = environment.water;'));
    await route.fulfill({
      response,
      body: source.replace(
        'const water = environment.water;',
        'window.__weatherTest = environment.setWeather; const water = environment.water;',
      ),
    });
  });
  await page.goto('http://localhost:3002', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'F Enter bus', exact: true }).click();
  await page.waitForFunction(() =>
    window.__sound.buffers.some((b) => b.buffer?.duration > 5),
  );
  const state = () =>
    page.evaluate(() => ({
      gains: window.__sound.gains.map((g) => g.gain.value),
      buffers: window.__sound.buffers.length,
      tones: window.__sound.tones.length,
      rate: window.__sound.buffers[1].playbackRate.value,
      status: window.__sound.ctx.state,
    }));
  const weather = async (code, precipitation, wind) =>
    page.evaluate(
      ({ code, precipitation, wind }) =>
        window.__weatherTest({
          temperature: 27,
          cloud: code === 0 ? 0.1 : 1,
          code,
          precipitation,
          wind,
          observedAt: Date.now(),
          fetchedAt: Date.now(),
        }),
      { code, precipitation, wind },
    );
  await weather(0, 0, 0);
  await page.waitForTimeout(1200);
  const idle = await state();
  assert.ok(idle.gains[7] > 0.4, 'Recorded diesel plays');
  assert.ok(idle.gains[1] < 0.001, 'Synth bus fallback fades out');
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  assert.ok(
    (await state()).rate > idle.rate,
    'Recording responds to acceleration',
  );
  await weather(65, 5, 40);
  await page.waitForTimeout(2500);
  const rain = await state();
  assert.ok(rain.gains[5] > 0.15, 'Heavy rain is audible');
  assert.ok(rain.gains[6] > 0.08, 'Strong wind is audible');
  await page.keyboard.press('c');
  await page.waitForTimeout(1000);
  assert.ok((await state()).gains[4] < 0.5, 'Cabin muffles ambience');
  await weather(95, 5, 40);
  const beforeStorm = await state();
  await page.waitForFunction(
    (count) => window.__sound.buffers.length > count,
    beforeStorm.buffers,
    { timeout: 30000 },
  );
  assert.ok(
    (await state()).buffers > beforeStorm.buffers,
    'Thunder follows a storm flash',
  );
  await weather(0, 0, 0);
  await page.waitForTimeout(8500);
  const clear = await state();
  assert.ok(
    clear.gains[5] < 0.002 && clear.gains[6] < 0.002,
    'Rain and wind fade when weather clears',
  );
  await page.getByRole('button', { name: 'Mute sounds', exact: true }).click();
  await page.waitForTimeout(300);
  assert.ok(
    (await state()).gains[0] < 0.0001,
    'Mute controls all weather layers',
  );
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal((await state()).status, 'suspended');
  await page.evaluate(async () => {
    window.__sound = { gains: [], buffers: [], tones: [] };
    const { createDrivingAudio } = await import('/app/driving-audio.ts');
    window.__soundProbe = createDrivingAudio();
    window.__soundProbe.mute(false);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() =>
    window.__soundProbe.update({
      active: true,
      bus: false,
      speed: 10,
      throttle: true,
      braking: false,
      daylight: 1,
      rain: 0,
      wind: 0,
      storm: false,
    }),
  );
  await page.waitForTimeout(400);
  const car = await state();
  assert.ok(
    car.gains[1] > 0.05 && car.gains[7] < 0.001,
    'Car uses its separate engine instead of diesel',
  );
  assert.equal(car.tones, 5, 'Dry daylight produces three bird chirps');
  await page.waitForTimeout(12500);
  await page.evaluate(() =>
    window.__soundProbe.update({
      active: false,
      bus: false,
      speed: 0,
      throttle: false,
      braking: false,
      daylight: 0,
      rain: 1,
      wind: 40,
      storm: true,
    }),
  );
  assert.equal(
    (await state()).tones,
    car.tones,
    'No birds during wet stormy night',
  );
  await page.evaluate(() => window.__soundProbe.dispose());
  assert.deepEqual(errors, []);
  console.log(
    'PASS: recorded diesel loading and acceleration, heavy rain, wind, cabin muffling, storm thunder, clear-weather fade, master mute, pause, distinct car engine, daytime birds and storm/night suppression.',
  );
} finally {
  await browser.close();
}
