import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
const source = ts.transpileModule(
  fs.readFileSync('app/api/voice-config/route.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { GET } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const oldUrls = process.env.VOICE_TURN_URLS,
  oldSecret = process.env.VOICE_TURN_SECRET;
try {
  delete process.env.VOICE_TURN_URLS;
  delete process.env.VOICE_TURN_SECRET;
  let response = await GET(),
    config = await response.json();
  assert.equal(config.relay, false);
  assert.equal(config.iceServers.length, 1);
  process.env.VOICE_TURN_URLS =
    'turn:relay.example.test:3478,turns:relay.example.test:5349';
  process.env.VOICE_TURN_SECRET = 'test-only-shared-secret';
  response = await GET();
  config = await response.json();
  const relay = config.iceServers[1];
  assert.equal(config.relay, true);
  assert.equal(relay.urls.length, 2);
  assert.equal(
    relay.credential,
    createHmac('sha1', process.env.VOICE_TURN_SECRET)
      .update(relay.username)
      .digest('base64'),
  );
  const expiry = Number(relay.username.split(':')[0]);
  assert.ok(
    expiry > Date.now() / 1000 + 3500 && expiry < Date.now() / 1000 + 3610,
  );
  assert.ok(!JSON.stringify(config).includes(process.env.VOICE_TURN_SECRET));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  console.log(
    'PASS: STUN fallback, short-lived TURN credentials, HMAC verification, secret stays server-side, no response caching.',
  );
} finally {
  if (oldUrls === undefined) delete process.env.VOICE_TURN_URLS;
  else process.env.VOICE_TURN_URLS = oldUrls;
  if (oldSecret === undefined) delete process.env.VOICE_TURN_SECRET;
  else process.env.VOICE_TURN_SECRET = oldSecret;
}
