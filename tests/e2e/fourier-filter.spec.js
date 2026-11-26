// The RC filter in the Fourier Tool's Synthesis Mode.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/fourier/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const state = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

const traceY = (page, name) => page.evaluate((n) => {
  const plot = document.querySelector('[data-tool="fourier"] [data-display="time"] .js-plotly-plot');
  return Array.from(plot.data.find((t) => t.name === n).y);
}, name);

const LIMIT = 'N = ∞ (infinite series)';
const filterSelect = (page) => page.getByRole('combobox', { name: 'Filter', exact: true });
const fcBox = (page) => page.getByRole('spinbutton', { name: 'f_c (Hz)', exact: true });
const gainBox = (page) => page.getByRole('checkbox', { name: 'Apply gain', exact: true });
const phaseBox = (page) => page.getByRole('checkbox', { name: 'Apply phase shift', exact: true });
const readout = (page, name) => page.getByRole('status', { name, exact: true });

test('the filter Controls are kit Controls, off by default, and published in State with units', async ({ page }) => {
  await open(page);
  const options = await filterSelect(page).locator('option').allTextContents();
  expect(options).toEqual(['Off', 'RC low-pass', 'RC high-pass']);
  await expect(page.getByRole('slider', { name: 'f_c (Hz)', exact: true })).toBeVisible();
  await expect(gainBox(page)).toBeChecked();
  await expect(phaseBox(page)).toBeChecked();

  const { s, info, ids } = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return { s: i.state.snapshot(), info: i.state.describe(), ids: i.controls.ids() };
  });
  expect(ids).toEqual(expect.arrayContaining(['filter', 'fc', 'applyGain', 'applyPhase']));
  expect(s).toMatchObject({ filter: 'off', fc: 3000, applyGain: true, applyPhase: true, fcRatio: 3 });
  expect(s.tau).toBeCloseTo(1e3 / (2 * Math.PI * 3000), 9); // ms
  expect(info.fc.unit).toBe('Hz');
  expect(info.tau.unit).toBe('ms');
  expect(info.fcRatio.unit).toBe('');
  for (const k of ['filter', 'applyGain', 'applyPhase']) expect(info[k], k).toBeTruthy();
});

test('turning the filter on changes the N = ∞ curve and the partial sum, but not the input', async ({ page }) => {
  await open(page);
  await page.getByRole('spinbutton', { name: 'N', exact: true }).fill('9');
  await page.getByRole('spinbutton', { name: 'N', exact: true }).press('Enter');
  const before = { input: await traceY(page, 'Input'), limit: await traceY(page, LIMIT), sum: await traceY(page, 'Partial sum') };

  await filterSelect(page).selectOption('lowpass');
  expect((await state(page)).filter).toBe('lowpass');
  const lp = { limit: await traceY(page, LIMIT), sum: await traceY(page, 'Partial sum') };
  expect(await traceY(page, 'Input')).toEqual(before.input);
  expect(lp.limit).not.toEqual(before.limit);
  expect(lp.sum).not.toEqual(before.sum);
  // The low-pass square charges smoothly: its N = ∞ curve stays inside the input's ±1 V.
  expect(Math.max(...lp.limit.map(Math.abs))).toBeLessThan(1);

  await filterSelect(page).selectOption('highpass');
  // The high-pass square's spikes overshoot the input: they reach beyond 1 V.
  expect(Math.max(...(await traceY(page, LIMIT)).map(Math.abs))).toBeGreaterThan(1.5);
});

test('toggling gain and toggling phase each change the curves', async ({ page }) => {
  await open(page);
  await filterSelect(page).selectOption('lowpass');
  const both = { limit: await traceY(page, LIMIT), sum: await traceY(page, 'Partial sum') };

  await gainBox(page).uncheck();
  expect((await state(page)).applyGain).toBe(false);
  const phaseOnly = { limit: await traceY(page, LIMIT), sum: await traceY(page, 'Partial sum') };
  expect(phaseOnly.limit).not.toEqual(both.limit);
  expect(phaseOnly.sum).not.toEqual(both.sum);

  await gainBox(page).check();
  await phaseBox(page).uncheck();
  expect((await state(page)).applyPhase).toBe(false);
  const gainOnly = { limit: await traceY(page, LIMIT), sum: await traceY(page, 'Partial sum') };
  expect(gainOnly.limit).not.toEqual(both.limit);
  expect(gainOnly.limit).not.toEqual(phaseOnly.limit);
  expect(gainOnly.sum).not.toEqual(both.sum);
});

test('the f_c/f₀ and τ readouts update with f_c (and f₀)', async ({ page }) => {
  await open(page);
  await expect(readout(page, 'f_c/f₀')).toHaveText('3.00');
  await expect(readout(page, 'τ')).toHaveText('0.0531 ms');
  await fcBox(page).fill('500');
  await fcBox(page).press('Enter');
  await expect(readout(page, 'f_c/f₀')).toHaveText('0.500');
  await expect(readout(page, 'τ')).toHaveText('0.318 ms');
  expect(await state(page)).toMatchObject({ fc: 500, fcRatio: 0.5 });
  const f0 = page.getByRole('spinbutton', { name: 'f₀ (Hz)', exact: true });
  await f0.fill('250');
  await f0.press('Enter');
  await expect(readout(page, 'f_c/f₀')).toHaveText('2.00');
});

test('the filter settings serialize and restore', async ({ page }) => {
  await open(page);
  const restored = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    const set = (vals) => { for (const [k, v] of Object.entries(vals)) i.controls.get(k).set(v); };
    set({ filter: 'highpass', fc: 800, applyGain: false });
    const saved = JSON.parse(JSON.stringify(i.serialize()));
    set({ filter: 'off', fc: 3000, applyGain: true, applyPhase: false });
    i.restore(saved);
    return i.state.snapshot();
  });
  expect(restored).toMatchObject({ filter: 'highpass', fc: 800, applyGain: false, applyPhase: true });
});

test('an Activity Setup can start the filter on', async ({ page }) => {
  await open(page);
  const s = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/fourier/fourier.js');
    const i = tool.mount(document.body.appendChild(document.createElement('div')), 'synthesis',
      { filter: 'lowpass', fc: 2000, applyPhase: false });
    const snap = i.state.snapshot();
    i.destroy();
    return snap;
  });
  expect(s).toMatchObject({ filter: 'lowpass', fc: 2000, applyGain: true, applyPhase: false, fcRatio: 2 });
});
