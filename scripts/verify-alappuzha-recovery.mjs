import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: 'F Enter bus', exact: true })
    .waitFor({ timeout: 60000 });
  const point = () =>
    page
      .locator('.drive-navigation polyline[stroke="#edc278"]')
      .getAttribute('points')
      .then((s) => s.split(' ')[0].split(',').map(Number));
  await page.keyboard.press('r');
  await page.waitForTimeout(250);
  const before = await point();
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await page.waitForTimeout(150);
  const after = await point();
  assert(
    Math.hypot(before[0] - after[0], before[1] - after[1]) > 0.1,
    'Recover on foot must not trap the player inside the parked bus',
  );
  await page.getByRole('button', { name: 'Open full district map' }).click();
  const pausedPosition = await point();
  await page.keyboard.press('r');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.deepEqual(
    await point(),
    pausedPosition,
    'Recovery hotkey must not move the player while the map is open',
  );
  console.log(
    'PASS: recover on foot remains walkable; map blocks recovery movement.',
  );
} finally {
  await browser.close();
}
