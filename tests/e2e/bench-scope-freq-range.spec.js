// Seam 2 (Spec 0002): the source panel's frequency Controls work like an analog function
// generator's: a decade Range selector plus a linear dial within that range.
import { test, expect } from '@playwright/test';
import { openSourceDrawer } from './helpers/bench-drawer.js';

const PAGE = '/tools/bench-scope/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

test('the CH1 frequency has a decade range selector, and the dial steps finely within it', async ({ page }) => {
  await open(page);
  const range = page.getByRole('combobox', { name: 'CH1 frequency range', exact: true });
  const dial = page.getByRole('slider', { name: 'CH1 frequency', exact: true });
  const num = page.getByRole('spinbutton', { name: 'CH1 frequency', exact: true });

  // The default 1 kHz sits at the top of the 100 Hz – 1 kHz range.
  await expect(range).toHaveValue('1000');
  expect((await snapshot(page)).gen1Freq).toBe(1000);

  // One arrow-key step on the dial is 1/1000 of the range: 1 Hz here.
  await dial.focus();
  await dial.press('ArrowLeft');
  expect((await snapshot(page)).gen1Freq).toBe(999);
  await expect(num).toHaveValue('999');

  // Switching range keeps the dial position and scales the frequency, as on an analog generator.
  await range.selectOption('10000');
  expect((await snapshot(page)).gen1Freq).toBe(9990);
  await dial.press('ArrowLeft');
  expect((await snapshot(page)).gen1Freq).toBe(9980);

  // Typing a frequency outside the range moves to the range that holds it.
  await num.fill('47');
  await num.press('Enter');
  await expect(range).toHaveValue('100');
  expect((await snapshot(page)).gen1Freq).toBe(47);
});

test('the range selectors are registered Controls, and locking the frequency locks its range too', async ({ page }) => {
  await open(page);
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids());
  for (const id of ['gen1-freq-range', 'gen2-freq-range', 'ch2-fc-range', 'ch2-f0-range']) expect(ids).toContain(id);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('gen1-freq').lock());
  await expect(page.getByRole('combobox', { name: 'CH1 frequency range', exact: true })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'CH1 frequency', exact: true })).toBeDisabled();

  // An Activity can still set the frequency; the range follows.
  await page.evaluate(() => window.toolHost.instances[0].controls.get('gen1-freq').set(25000));
  await expect(page.getByRole('combobox', { name: 'CH1 frequency range', exact: true })).toHaveValue('100000');
  expect((await snapshot(page)).gen1Freq).toBe(25000);
});

test('the band-pass centre frequency has its own range selector', async ({ page }) => {
  await open(page);
  await openSourceDrawer(page);
  await page.getByRole('combobox', { name: 'CH2 source', exact: true }).selectOption('bandpass');
  const range = page.getByRole('combobox', { name: 'CH2 centre frequency range', exact: true });
  await expect(range).toBeVisible();
  await range.selectOption('1000000');
  const f0 = (await snapshot(page)).ch2F0;
  expect(f0).toBeGreaterThan(100e3);
  expect(f0).toBeLessThanOrEqual(1e6);
});
