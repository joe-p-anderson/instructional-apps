// Seam 2 (Spec 0002), ticket 08: Measure on the real bench-scope Standalone page, on every skin.
// Adding a frequency readout through the skin's Measure menu shows it on screen and in State.
import { test, expect } from '@playwright/test';
import { installScreenReader } from './helpers/bench-screen.js';

test.beforeEach(({ page }) => installScreenReader(page));

const PAGE = '/tools/bench-scope/';

// Where the first readout appears: TBS readout slot 'measure-1' along the bottom of the
// graticule; TDS the first Measure menu box.
const SKINS = [
  {
    id: 'tbs2072b', model: 'TBS2072B', where: { x: 30, y: 380, w: 200, h: 24 },
    // Source CH1 and Type Freq are the defaults: Add.
    add: ['softkey-3'],
  },
  {
    id: 'tds2001c', model: 'TDS2001C', where: { x: 260, y: 13, w: 58, h: 37 },
    // Open slot 1, Type None → Freq, Back.
    add: ['softkey-1', 'softkey-2', 'softkey-5'],
  },
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

/** Which pixels of a screen region are lit (bright), one 0/1 per pixel. */
const pixels = (page, r) => page.evaluate(async ({ x, y, w, h }) => {
  const d = (await window.nativeScreen()).getContext('2d').getImageData(x, y, w, h).data;
  const lit = [];
  for (let i = 0; i < d.length; i += 4) lit.push(d[i] + d[i + 1] + d[i + 2] > 450 ? 1 : 0);
  return lit;
}, r);
const changed = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

for (const skin of SKINS) {
  test(`${skin.model}: adding a frequency readout shows it on screen and in State`, async ({ page }) => {
    await open(page, skin);
    await page.evaluate(() => window.toolHost.instances[0].controls.get('hor-scale').set(200e-6));
    await control(page, skin, 'measure').click();
    const before = await pixels(page, skin.where);
    for (const id of skin.add) await control(page, skin, id).click();

    await expect.poll(async () => (await snapshot(page)).measureCount).toBe(1);
    const s = await snapshot(page);
    expect([s.measure1Source, s.measure1Type, s.measure1Valid]).toEqual(['ch1', 'freq', true]);
    expect(Math.abs(s.measure1Value - 1000)).toBeLessThan(10);
    await expect.poll(async () => changed(await pixels(page, skin.where), before)).toBeGreaterThan(40);
  });
}
