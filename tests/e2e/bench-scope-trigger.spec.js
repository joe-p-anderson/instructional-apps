// Seam 2 (Spec 0002), ticket 04: horizontal controls and the edge trigger on the real
// bench-scope Standalone page, on both skins.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/bench-scope/';

const SKINS = [
  // Set to 50%: a push on the TBS Level knob, a button on the TDS. Recentre: a push on the TBS
  // Position knob, the Set to Zero button on the TDS.
  { id: 'tbs2072b', model: 'TBS2072B', set50: 'trig-level', zero: 'hor-position', step: 2e-3 },
  { id: 'tds2001c', model: 'TDS2001C', set50: 'trig-50', zero: 'set-to-zero', step: 2.5e-3 },
];

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

async function open(page, skin) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  if (skin.id !== 'tbs2072b') {
    await page.getByRole('combobox', { name: 'Oscilloscope model', exact: true }).selectOption(skin.id);
  }
  await expect(page.locator(`svg[data-model="${skin.model}"]`)).toBeVisible();
}

const control = (page, skin, id) => page.locator(`svg[data-model="${skin.model}"] .osc-control[data-control="${id}"]`);

/** The screen pixels as a string, to compare before and after. */
const screenPixels = (page) => page.evaluate(() => {
  const cv = document.querySelector('canvas.bs-screen');
  return Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data).join(',');
});

for (const skin of SKINS) {
  test(`${skin.model}: turning the level off the signal loses the trigger, and Set to 50% brings it back`, async ({ page }) => {
    await open(page, skin);
    await expect.poll(async () => (await snapshot(page)).traceStable).toBe(true);
    const level = control(page, skin, 'trig-level');
    await level.focus();
    for (let i = 0; i < 70; i++) await page.keyboard.press('ArrowUp'); // 70 × 0.04 V: above the 2 V peak
    await expect.poll(async () => (await snapshot(page)).trigLevel).toBeGreaterThan(2.5);
    await expect.poll(async () => (await snapshot(page)).traceStable).toBe(false);

    await control(page, skin, skin.set50).click();
    await expect.poll(async () => (await snapshot(page)).traceStable).toBe(true);
    expect(Math.abs((await snapshot(page)).trigLevel)).toBeLessThan(0.05);
  });

  test(`${skin.model}: the horizontal knobs set s/div and the trigger point; recentre and Run/Stop work`, async ({ page }) => {
    await open(page, skin);
    const scale = control(page, skin, 'hor-scale');
    const b = await scale.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 100); // one notch down: anticlockwise, slower
    await expect.poll(async () => (await snapshot(page)).hScale).toBe(skin.step);

    await control(page, skin, 'hor-position').focus();
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).hPosition).toBeGreaterThan(0);
    await control(page, skin, skin.zero).click();
    await expect.poll(async () => (await snapshot(page)).hPosition).toBe(0);

    await control(page, skin, 'run-stop').click();
    await expect.poll(async () => (await snapshot(page)).runState).toBe('stopped');
    const frozen = await screenPixels(page);
    await page.waitForTimeout(100);
    expect(await screenPixels(page)).toBe(frozen);
    await control(page, skin, 'run-stop').click();
    await expect.poll(async () => (await snapshot(page)).runState).toBe('running');
  });
}
