import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const audio = Buffer.alloc(44 + 48000 * 3 * 2);
audio.write('RIFF');
audio.writeUInt32LE(audio.length - 8, 4);
audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16);
audio.writeUInt16LE(1, 20);
audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(48000, 24);
audio.writeUInt32LE(96000, 28);
audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34);
audio.write('data', 36);
audio.writeUInt32LE(audio.length - 44, 40);
for (let i = 0; i < 48000 * 3; i++)
  audio.writeInt16LE(
    Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 48000)),
    44 + i * 2,
  );
fs.writeFileSync('/tmp/world-voice-test.wav', audio);
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-audio-capture=/tmp/world-voice-test.wav',
  ],
});
const visits = new Set(),
  contexts = [];
try {
  async function player(name) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 760 },
      permissions: ['microphone'],
    });
    contexts.push(context);
    await context.addInitScript(() => {
      const Original = window.RTCPeerConnection;
      window.__voicePCs = [];
      window.RTCPeerConnection = class extends Original {
        constructor(...args) {
          super(...args);
          window.__voicePCs.push(this);
        }
      };
      const capture = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      window.__realCapture = capture;
      window.__voiceStreams = [];
      navigator.mediaDevices.getUserMedia = async (options) => {
        const stream = await capture(options);
        window.__voiceStreams.push(stream);
        return stream;
      };
    });
    const page = await context.newPage();
    page.on('pageerror', (error) =>
      console.log('Browser error:', error.message),
    );
    page.on('request', (request) => {
      if (
        request.url().includes('/functions/v1/world-visits') &&
        request.method() === 'POST'
      )
        visits.add(request.postDataJSON().id);
    });
    await page.route('**/app/alappuzha-world.ts*', async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      assert.ok(body.includes('const livePlayers = createWorldPlayers('));
      await route.fulfill({
        response,
        body: body.replace(
          'const livePlayers = createWorldPlayers(',
          'window.__voicePosition=pos; const livePlayers = createWorldPlayers(',
        ),
      });
    });
    await page.goto('http://localhost:3002', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.getByLabel('Your name').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByLabel('Your name').fill(name);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.area-demo').click();
    await page
      .waitForFunction(
        () => document.querySelector('canvas[data-live-status="online"]'),
        null,
        { timeout: 60000 },
      )
      .catch(async (error) => {
        console.log('World status:', await page.locator('body').innerText());
        throw error;
      });
    await page.getByRole('button', { name: 'Join voice', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('[data-voice-status="ready"]'),
      null,
      { timeout: 20000 },
    );
    assert.equal(
      await page.evaluate(
        () => window.__voiceStreams.at(-1).getAudioTracks()[0].enabled,
      ),
      false,
      'Microphone starts muted',
    );
    console.log(name + ': joined voice with microphone muted');
    return page;
  }
  const a = await player('Voice QA A'),
    b = await player('Voice QA B');
  await Promise.all(
    [a, b].map((p) =>
      p.waitForFunction(
        () => document.querySelector('[data-connected="1"]'),
        null,
        { timeout: 40000 },
      ),
    ),
  );
  console.log('Both WebRTC peers connected');
  await b.locator('.world-voice summary').click();
  await a.bringToFront();
  await a
    .getByRole('button', { name: 'Unmute microphone', exact: true })
    .click();
  await a.waitForFunction(
    () => window.__voiceStreams.at(-1).getAudioTracks()[0].enabled,
  );
  await b.waitForFunction(
    () =>
      document
        .querySelector('.world-voice li')
        ?.textContent.includes('● Voice QA A'),
    null,
    { timeout: 15000 },
  );
  await b.waitForFunction(
    async () => {
      for (const pc of window.__voicePCs) {
        const stats = await pc.getStats();
        for (const s of stats.values())
          if (
            s.type === 'inbound-rtp' &&
            (s.kind === 'audio' || s.mediaType === 'audio') &&
            (s.totalAudioEnergy || 0) > 0
          )
            return true;
      }
      return false;
    },
    null,
    { timeout: 10000 },
  );
  console.log('Remote WebRTC audio energy verified');
  await b.getByRole('button', { name: 'Mute Voice QA A', exact: true }).click();
  assert.equal(
    await b
      .getByRole('button', { name: 'Unmute Voice QA A', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await a.bringToFront();
  if (
    await a
      .getByRole('button', { name: 'Mute microphone', exact: true })
      .isVisible()
  )
    await a
      .getByRole('button', { name: 'Mute microphone', exact: true })
      .click();
  await a.keyboard.down('v');
  assert.equal(
    await a.evaluate(
      () => window.__voiceStreams.at(-1).getAudioTracks()[0].enabled,
    ),
    true,
  );
  await a.keyboard.up('v');
  assert.equal(
    await a.evaluate(
      () => window.__voiceStreams.at(-1).getAudioTracks()[0].enabled,
    ),
    false,
    'Releasing V mutes',
  );
  await a.screenshot({ path: '/tmp/world-voice-desktop.png' });
  await b.setViewportSize({ width: 390, height: 844 });
  await b.screenshot({ path: '/tmp/world-voice-mobile.png' });
  await a.evaluate(() => {
    window.__voicePosition.x += 100;
  });
  await Promise.all(
    [a, b].map((p) =>
      p.waitForFunction(
        () => document.querySelector('[data-connected="0"]'),
        null,
        { timeout: 15000 },
      ),
    ),
  );
  await a.evaluate(() => {
    window.__voicePosition.x -= 100;
  });
  await Promise.all(
    [a, b].map((p) =>
      p.waitForFunction(
        () => document.querySelector('[data-connected="1"]'),
        null,
        { timeout: 25000 },
      ),
    ),
  );
  await a.getByRole('button', { name: 'Leave voice chat' }).click();
  assert.ok(
    await a.evaluate(() =>
      window.__voiceStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    ),
    'Leaving releases microphone',
  );
  await b.waitForFunction(
    () => document.querySelector('[data-connected="0"]'),
    null,
    { timeout: 15000 },
  );
  await a.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
  });
  await a.getByRole('button', { name: 'Join voice', exact: true }).click();
  await a.waitForFunction(() =>
    document.querySelector('[data-voice-status="denied"]'),
  );
  await a.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const stream = await window.__realCapture({ audio: true });
      window.__lateStream = stream;
      return new Promise((resolve) => {
        window.__resolveMic = () => resolve(stream);
      });
    };
  });
  await a.getByRole('button', { name: 'Join voice', exact: true }).click();
  await a.waitForFunction(() => !!window.__resolveMic);
  await a.getByRole('button', { name: 'Cancel microphone request' }).click();
  await a.evaluate(() => window.__resolveMic());
  await a.waitForFunction(() =>
    window.__lateStream.getTracks().every((t) => t.readyState === 'ended'),
  );
  assert.equal(
    await a.locator('.world-voice').getAttribute('data-voice-status'),
    'off',
  );
  console.log(
    'PASS: two real Supabase sessions, WebRTC audio energy, mute-by-default, live microphone, push-to-talk, individual mute, distance disconnect/reconnect, release and denied permission.',
  );
} finally {
  const previous = fs.existsSync('/tmp/world-voice-test-visits.json')
    ? JSON.parse(fs.readFileSync('/tmp/world-voice-test-visits.json', 'utf8'))
    : [];
  fs.writeFileSync(
    '/tmp/world-voice-test-visits.json',
    JSON.stringify([...new Set([...previous, ...visits])]),
  );
  await browser.close();
}
