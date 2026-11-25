// Seam 2 (Spec 0002), ticket 07: Autoset on the real bench-scope Standalone page, on every skin.
// Scramble the knobs from the panel, press Autoset, and the trace is stable and sensibly scaled.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/bench-scope/';

// The default source is a 1 kHz, 4 Vpp sine: Autoset picks 1 V/div (4 div) and the s/div
// nearest 2.5 cycles (TBS 15 div: 200 µs = 3 cycles; TDS 10 div: 250 µs = 2.5 cycles).
const SKINS = [
  { id: 'tbs2072b', model: 'TBS2072B', sPerDiv: 200e-6 },
  { id: 'tds2001c', model: 'TDS2001C', sPerDiv: 250e-6 },
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

async function turn(page, skin, id, key, n) {
  await control(page, skin, id).focus();
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}

for (const skin of SKINS) {
  test(`${skin.model}: scramble the knobs, press Autoset, and the trace is stable`, async ({ page }) => {
    await open(page, skin);
    await turn(page, skin, 'trig-level', 'ArrowUp', 70); // 70 × 0.04 V: above the 2 V peak
    await turn(page, skin, 'ch1-scale', 'ArrowUp', 6); // 1 V/div → 10 mV/div
    await turn(page, skin, 'ch1-position', 'ArrowUp', 30);
    await turn(page, skin, 'hor-scale', 'ArrowUp', 6); // much faster
    await control(page, skin, 'run-stop').click();
    await expect.poll(async () => (await snapshot(page)).runState).toBe('stopped');
    const scrambled = await snapshot(page);
    expect(scrambled.ch1VPerDiv).toBeLessThan(0.05);
    expect(scrambled.trigLevel).toBeGreaterThan(2);

    await control(page, skin, 'autoset').click();
    await expect.poll(async () => (await snapshot(page)).traceStable).toBe(true);
    const s = await snapshot(page);
    expect(s.runState).toBe('running');
    expect(s.ch1VPerDiv).toBe(1);
    expect(s.ch1Position).toBe(0);
    expect(s.hScale).toBeCloseTo(skin.sPerDiv, 12);
    expect(s.hPosition).toBe(0);
    expect(s.trigSource).toBe('ch1');
    expect(s.trigSlope).toBe('rising');
    expect(s.trigMode).toBe('auto');
    expect(Math.abs(s.trigLevel)).toBeLessThan(0.05);
    expect(s.displayFormat).toBe('yt');
  });
}
