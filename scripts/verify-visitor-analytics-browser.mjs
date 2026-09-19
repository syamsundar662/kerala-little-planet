import { chromium } from 'playwright';
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
const endpoint = `${config.VITE_SUPABASE_URL}/functions/v1/world-visits`;
const stats = async () => {
  const r = await fetch(endpoint, {
    headers: {
      apikey: config.VITE_SUPABASE_PUBLISHABLE_KEY,
      'x-admin-key': password,
    },
  });
  assert.equal(r.status, 200);
  return r.json();
};
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const name = `Visitor QA ${Date.now().toString().slice(-6)}`;
const ids = new Set();
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url() === endpoint && r.method() === 'POST') {
      const b = r.postDataJSON();
      ids.add(b.id);
    }
  });
  await page.goto('http://localhost:3002', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.getByLabel('Your name').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.area-demo').click();
  await page.waitForFunction(
    () => document.querySelector('canvas[data-live-status="online"]'),
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(2500);
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await page.waitForTimeout(1500);
  let data = await stats(),
    visit = data.recent.find((r) => r.name === name);
  assert.ok(visit, 'Name stored from browser');
  assert.ok(visit.entered_world);
  assert.ok(visit.areas.includes('Alappuzha'));
  assert.ok(visit.active_seconds >= 2);
  assert.ok(visit.online);
  const visitorId = await page.evaluate(() =>
    localStorage.getItem('open-world-visitor-id'),
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(
    await page.evaluate(() => localStorage.getItem('open-world-visitor-id')),
    visitorId,
    'Repeat visits retain browser identity',
  );
  await page.getByLabel('Your name').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(1000);
  data = await stats();
  assert.equal(data.recent.filter((r) => r.name === name).length, 2);
  assert.ok(data.totals.returning_visitors >= 1);
  await page.goto('http://localhost:3002/admin', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', {timeout: 60000});
  assert.equal(await page.locator('table').count(), 0, 'Admin starts locked');
  await page.getByLabel('Admin password').fill(password);
  await page.getByRole('button', { name: 'View overview' }).click();
  await page.locator('table').waitFor();
  assert.ok((await page.getByRole('cell', { name, exact: true }).count()) >= 2);
  await page.screenshot({
    path: '/tmp/visitor-overview-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/visitor-overview-mobile.png',
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile overview fits viewport',
  );
  await page.getByRole('button', { name: 'Lock overview' }).click();
  assert.equal(await page.locator('table').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: browser visit, entered name, area, active time, repeat browser identity, locked admin overview, desktop and mobile layout.',
  );
} finally {
  const previous = JSON.parse(
    fs.readFileSync('/tmp/world-analytics-test-ids.json', 'utf8'),
  );
  fs.writeFileSync(
    '/tmp/world-analytics-test-ids.json',
    JSON.stringify({ ids: [...previous.ids, ...ids] }),
  );
  await browser.close();
}
