import fs from 'node:fs';
import assert from 'node:assert/strict';
const env = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
const config = env('.env.local'),
  password = env('.env.analytics.local').WORLD_ANALYTICS_ADMIN_PASSWORD;
const url = `${config.VITE_SUPABASE_URL}/functions/v1/world-visits`;
const headers = {
  apikey: config.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
};
const get = (key) =>
  fetch(url, {
    headers: { ...headers, ...(key ? { 'x-admin-key': key } : {}) },
  });
const post = (body) =>
  fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
const id = crypto.randomUUID(),
  visitorId = crypto.randomUUID(),
  token = crypto.randomUUID();
fs.writeFileSync(
  '/tmp/world-analytics-test-ids.json',
  JSON.stringify({ ids: [id], visitorId }),
);
assert.equal((await get()).status, 401, 'Overview requires password');
assert.equal((await get('incorrect')).status, 401, 'Wrong password rejected');
const base = {
  id,
  visitorId,
  token,
  sequence: 0,
  action: 'start',
  device: 'desktop',
  language: 'en-IN',
  timezone: 'Asia/Kolkata',
  referrer: 'https://example.com/private?secret=hidden',
  visible: true,
};
let response = await post(base);
assert.equal(response.status, 200, await response.text());
response = await post({
  ...base,
  sequence: 1,
  action: 'update',
  name: 'Analytics QA',
  area: 'Alappuzha',
  enteredWorld: true,
});
assert.equal(response.status, 200, await response.text());
assert.equal(
  (
    await post({
      ...base,
      sequence: 2,
      action: 'update',
      token: crypto.randomUUID(),
      name: 'Impostor',
    })
  ).status,
  404,
  'Cannot change another visitor',
);
assert.equal(
  (await post({ ...base, sequence: 2, action: 'end', visible: false })).status,
  200,
);
assert.equal(
  (await post({ ...base, sequence: 1, action: 'update', name: 'Stale update' }))
    .status,
  200,
);
response = await get(password);
assert.equal(response.status, 200, await response.clone().text());
const data = await response.json();
const row = data.recent.find((r) => r.id === id);
assert.ok(row);
assert.equal(row.name, 'Analytics QA');
assert.ok(row.ended_at);
assert.equal(row.online, false);
assert.equal(row.referrer_host, 'example.com');
assert.deepEqual(row.areas, ['Alappuzha']);
assert.ok(!('token_hash' in row));
assert.ok(!('visitor_id' in row));
assert.ok(data.totals.visits >= 1);
const direct = await fetch(
  `${config.VITE_SUPABASE_URL}/rest/v1/visits?select=*`,
  { headers },
);
assert.ok(direct.status >= 400, 'Raw visits not exposed to public API');
console.log(
  'PASS: persisted visit/name/area, admin password, session ownership, out-of-order updates, private records and sanitized source.',
);
