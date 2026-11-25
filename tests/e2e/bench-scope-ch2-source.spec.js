// Seam 2 (Spec 0002), ticket 06: the CH2 source Controls on the real bench-scope Standalone page.
import { test, expect } from '@playwright/test';
import { installScreenReader } from './helpers/bench-screen.js';

test.beforeEach(({ page }) => installScreenReader(page));

const PAGE = '/tools/bench-scope/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

/** The CH2-coloured (#22c4e8) part of the screen canvas, as a string to compare. */
const ch2Image = (page) => page.evaluate(async () => {
  const cv = await window.nativeScreen();
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  let sig = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 90 && d[i + 1] > 150 && d[i + 2] > 190) { n += 1; sig = (sig * 31 + i) % 1e9; }
  }
  return { n, sig };
});

test('choosing band-pass reveals the Q Control, switching away hides it, and CH2 changes on screen', async ({ page }) => {
  await open(page);
  const svg = page.locator('svg[data-model]');
  await svg.locator('.osc-control[data-control="ch2-menu"]').click(); // show CH2
  const sourceSel = page.getByRole('combobox', { name: 'CH2 source', exact: true });
  const q = page.getByRole('spinbutton', { name: 'CH2 Q', exact: true });
  const f0 = page.getByRole('spinbutton', { name: 'CH2 centre frequency', exact: true });
  const fc = page.getByRole('spinbutton', { name: 'CH2 cutoff', exact: true });

  await expect(sourceSel).toHaveValue('copy');
  await expect(q).toBeHidden();
  await expect(f0).toBeHidden();
  await expect(fc).toBeHidden();
  await expect.poll(async () => (await ch2Image(page)).n).toBeGreaterThan(500);
  const copyImage = await ch2Image(page);

  // A square wave makes the band-pass pick out its third harmonic.
  await page.getByRole('combobox', { name: 'CH1 waveform', exact: true }).selectOption('square');
  await sourceSel.selectOption('bandpass');
  await expect(q).toBeVisible();
  await expect(f0).toBeVisible();
  await expect(fc).toBeHidden();
  await f0.fill('3000');
  await f0.press('Enter');
  await q.fill('20');
  await q.press('Enter');
  const st = await snapshot(page);
  expect(st.ch2Source).toBe('bandpass');
  expect(st.ch2F0).toBe(3000);
  expect(st.ch2Q).toBe(20);
  expect(st.ch2Gain).toBeLessThan(0.05);
  await expect.poll(async () => (await ch2Image(page)).sig).not.toBe(copyImage.sig);

  await sourceSel.selectOption('lowpass');
  await expect(q).toBeHidden();
  await expect(fc).toBeVisible();

  await sourceSel.selectOption('independent');
  await expect(fc).toBeHidden();
  await expect(page.getByRole('spinbutton', { name: 'CH2 phase', exact: true })).toBeVisible();

  await sourceSel.selectOption('off');
  // Only the CH2 readout badge is left in the CH2 colour.
  await expect.poll(async () => (await ch2Image(page)).n).toBeLessThan(copyImage.n / 2);
});

test('the CH2 source Controls are registered, and the right ones show after a restore', async ({ page }) => {
  await open(page);
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids());
  for (const id of ['ch2-source', 'ch2-fc', 'ch2-f0', 'ch2-q', 'gen2-wave', 'gen2-freq', 'gen2-vpp', 'gen2-offset', 'gen2-phase']) {
    expect(ids).toContain(id);
  }
  await page.evaluate(() => {
    const inst = window.toolHost.instances[0];
    const saved = inst.serialize();
    inst.restore({ ...saved, source: { ...saved.source, ch2Source: 'bandpass', ch2Q: 7 } });
  });
  await expect(page.getByRole('combobox', { name: 'CH2 source', exact: true })).toHaveValue('bandpass');
  await expect(page.getByRole('spinbutton', { name: 'CH2 Q', exact: true })).toHaveValue('7.0');
});
