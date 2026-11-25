// Seam 2 (Spec 0002), ticket 05: the softkey menus on the real bench-scope Standalone page.
import { test, expect } from '@playwright/test';
import { installScreenReader } from './helpers/bench-screen.js';

test.beforeEach(({ page }) => installScreenReader(page));

const PAGE = '/tools/bench-scope/';
const SKINS = [
  { id: 'tbs2072b', model: 'TBS2072B', plot: { y: 30, h: 400, right: 775 }, menu: { x: 650, y: 43, w: 150, h: 413 } },
  { id: 'tds2001c', model: 'TDS2001C', plot: { y: 15, h: 200, right: 253 }, menu: { x: 258, y: 11, w: 62, h: 204 } },
];

async function open(page, skin) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  if (skin.id !== 'tbs2072b') {
    await page.getByRole('combobox', { name: 'Oscilloscope model', exact: true }).selectOption(skin.id);
  }
  await expect(page.locator(`svg[data-model="${skin.model}"]`)).toBeVisible();
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const control = (page, skin, id) => page.locator(`svg[data-model="${skin.model}"] .osc-control[data-control="${id}"]`);

/** Mean row (screen px) of the CH1-yellow pixels in the plot, left of the menu and trigger arrow. */
const ch1MeanRow = (page, skin) => page.evaluate(async ({ plot, menu }) => {
  const cv = await window.nativeScreen();
  const w = Math.min(menu.x, plot.right - 15); // not the menu, not the trigger-level arrow
  const d = cv.getContext('2d').getImageData(0, 0, w, cv.height).data;
  let n = 0;
  let sum = 0;
  for (let y = plot.y; y < plot.y + plot.h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i] > 180 && d[i + 1] > 180 && d[i + 2] < 120) { n += 1; sum += y; }
    }
  }
  return n ? sum / n : NaN;
}, { plot: skin.plot, menu: skin.menu });

/** Non-black pixels in the menu column (the menu boxes and text). */
const menuPixels = (page, skin) => page.evaluate(async ({ menu }) => {
  const cv = await window.nativeScreen();
  const d = cv.getContext('2d').getImageData(menu.x + 2, menu.y + 2, menu.w - 4, menu.h - 4).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60 && !(d[i] > 180 && d[i + 2] < 120)) n += 1;
  return n;
}, { menu: skin.menu });

for (const skin of SKINS) {
  test(`${skin.model}: the CH1 menu's Coupling softkey switches to AC and the DC offset leaves the trace`, async ({ page }) => {
    await open(page, skin);
    await page.evaluate(() => window.toolHost.instances[0].controls.get('gen1-offset').set(2));
    const centre = skin.plot.y + skin.plot.h / 2;
    const divPx = skin.plot.h / 8;
    await expect.poll(async () => centre - (await ch1MeanRow(page, skin))).toBeGreaterThan(1.5 * divPx); // 2 V up at 1 V/div

    const before = await menuPixels(page, skin);
    await control(page, skin, 'ch1-menu').click();
    await expect.poll(() => menuPixels(page, skin)).toBeGreaterThan(before + 500);
    await control(page, skin, 'softkey-1').click();
    await expect.poll(async () => (await snapshot(page)).ch1Coupling).toBe('ac');
    await expect.poll(async () => Math.abs(centre - (await ch1MeanRow(page, skin)))).toBeLessThan(0.3 * divPx);
  });
}

test('TBS2072B: a second press of the CH1 button turns CH1 off; Menu On/Off hides the menu', async ({ page }) => {
  const skin = SKINS[0];
  await open(page, skin);
  const none = await menuPixels(page, skin); // the graticule under the menu column
  await control(page, skin, 'trig-menu').click();
  await expect.poll(() => menuPixels(page, skin)).toBeGreaterThan(none + 500);
  await control(page, skin, 'menu-onoff').click();
  await expect.poll(() => menuPixels(page, skin)).toBeLessThan(none + 100);
  await control(page, skin, 'ch1-menu').click();
  await control(page, skin, 'ch1-menu').click();
  await expect.poll(async () => (await snapshot(page)).ch1Display).toBe(false);
});

test('TDS2001C: Trig View shows the trigger signal only while held', async ({ page }) => {
  const skin = SKINS[1];
  await open(page, skin);
  await control(page, skin, 'ch1-menu').click(); // open the CH1 menu
  await control(page, skin, 'ch1-menu').click(); // CH1 off
  await expect.poll(() => ch1MeanRow(page, skin)).toBeNaN();
  const b = await control(page, skin, 'trig-view').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect.poll(() => ch1MeanRow(page, skin)).not.toBeNaN();
  await page.mouse.up();
  await expect.poll(() => ch1MeanRow(page, skin)).toBeNaN();
});
