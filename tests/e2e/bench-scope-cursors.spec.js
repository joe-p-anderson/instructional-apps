// Seam 2 (Spec 0002), ticket 09: cursors on the real bench-scope Standalone page.
// Turn on time cursors from the Cursor menu, turn the multipurpose knob, and the Δt readout changes.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/bench-scope/';
const SKINS = [
  { id: 'tbs2072b', model: 'TBS2072B', plot: { x: 25, y: 30, w: 625 } },
  { id: 'tds2001c', model: 'TDS2001C', plot: { x: 3, y: 15, w: 250 } },
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

/** The canvas's top strip (status row, where the cursor readouts go) as a string of pixel bytes. */
const topStrip = (page, skin) => page.evaluate(({ plot }) => {
  const cv = document.querySelector('canvas.bs-screen');
  return Array.from(cv.getContext('2d').getImageData(0, 0, plot.x + plot.w, plot.y).data).join(',');
}, { plot: skin.plot });

async function wheel(page, skin, id, notches) {
  const b = await control(page, skin, id).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < Math.abs(notches); i++) await page.mouse.wheel(0, notches > 0 ? -100 : 100);
}

for (const skin of SKINS) {
  test(`${skin.model}: time cursors, moved with the multipurpose knob, change the Δt readout`, async ({ page }) => {
    await open(page, skin);
    await control(page, skin, 'cursors').click();
    await control(page, skin, 'softkey-1').click(); // Type: Time
    await expect.poll(async () => (await snapshot(page)).cursorMode).toBe('time');
    const dt0 = (await snapshot(page)).cursorDt;
    const strip0 = await topStrip(page, skin);

    await wheel(page, skin, 'mp-knob', 5);
    await expect.poll(async () => (await snapshot(page)).cursorDt).toBeLessThan(dt0);
    await expect.poll(() => topStrip(page, skin)).not.toBe(strip0);
  });
}

test('TDS2001C: the multipurpose LEDs light while the knob moves a cursor', async ({ page }) => {
  const skin = SKINS[1];
  await open(page, skin);
  for (const id of ['mp-led-left', 'mp-led-right']) await expect(control(page, skin, id)).toHaveAttribute('data-lit', 'false');
  await control(page, skin, 'cursors').click();
  await control(page, skin, 'softkey-1').click();
  for (const id of ['mp-led-left', 'mp-led-right']) await expect(control(page, skin, id)).toHaveAttribute('data-lit', 'true');
});

test('TBS2072B: the cursors are Controls; a locked cursor ignores the knob, Fine slows it', async ({ page }) => {
  const skin = SKINS[0];
  await open(page, skin);
  await control(page, skin, 'cursors').click();
  await control(page, skin, 'softkey-1').click();
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids());
  expect(ids).toEqual(expect.arrayContaining(['cursor-1', 'cursor-2']));
  await page.evaluate(() => window.toolHost.instances[0].controls.get('cursor-1').set(0));
  await expect.poll(async () => (await snapshot(page)).cursor1).toBe(0);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('cursor-1').lock());
  await wheel(page, skin, 'mp-knob', 3);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).cursor1).toBe(0);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('cursor-1').unlock());
  await control(page, skin, 'fine').click();
  await expect.poll(async () => (await snapshot(page)).cursorFine).toBe(true);
  await wheel(page, skin, 'mp-knob', 1);
  // 1 ms/div × 0.02 div = 20 µs
  await expect.poll(async () => (await snapshot(page)).cursor1).toBeCloseTo(20e-6, 9);
});
