import { test, expect } from '@playwright/test';

// The spectrum and filter-curve Displays in the Fourier Tool's Analysis Mode.

const PAGE = '/tools/fourier/';

async function openAnalysis(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  await page.getByRole('tab', { name: 'Analysis' }).click();
}

const state = (page) => page.evaluate(() => window.toolHost.instances[1].state.snapshot());

/** A trace of a Display's plot by name: { x, y, visible }. */
const trace = (page, display, name) => page.evaluate(([d, n]) => {
  const plot = document.querySelector(`[data-mode="analysis"] [data-display="${d}"] .js-plotly-plot`);
  const t = plot.data.find((tr) => tr.name === n);
  return t && { x: Array.from(t.x), y: Array.from(t.y) };
}, [display, name]);

const panel = (page) => page.locator('[data-mode="analysis"]');
const filterSelect = (page) => panel(page).getByRole('combobox', { name: 'Filter', exact: true });
const sourceSelect = (page) => panel(page).getByRole('combobox', { name: 'Spectrum of', exact: true });
const fcBox = (page) => panel(page).getByRole('spinbutton', { name: 'f_c (Hz)', exact: true });
const setFc = async (page, v) => { await fcBox(page).fill(String(v)); await fcBox(page).press('Enter'); };

test('Analysis has the filter Controls with the Synthesis ids, the spectrum source, and one Control per new Display', async ({ page }) => {
  await openAnalysis(page);
  const { ids, displays, s, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[1];
    return { ids: i.controls.ids(), displays: i.displays.map((d) => d.id), s: i.state.snapshot(), info: i.state.describe() };
  });
  expect(ids).toEqual(expect.arrayContaining(['filter', 'fc', 'applyGain', 'applyPhase', 'spectrumSource', 'spectrum', 'filter-curves']));
  expect(displays).toEqual(['product', 'spectrum', 'filter-curves']);
  expect(s).toMatchObject({ filter: 'off', fc: 3000, applyGain: true, applyPhase: true, fcRatio: 3, spectrumSource: 'input' });
  for (const k of Object.keys(s)) expect(info[k], k).toBeTruthy();
  expect(await sourceSelect(page).locator('option').allTextContents()).toEqual(['Input', 'Filtered output']);
});

test('the spectrum draws Aₙ bars and φₙ stems in degrees for n = 0 to 10', async ({ page }) => {
  await openAnalysis(page);
  const bars = await trace(page, 'spectrum', 'Aₙ');
  expect(bars.x).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(bars.y[1]).toBeCloseTo(4 / Math.PI, 9);
  expect(bars.y[2]).toBe(0);
  const stems = await trace(page, 'spectrum', 'φₙ');
  // A square wave's harmonics are all at −90°; the zero terms have no phase to draw.
  // Each stem sits just right of its bar.
  expect(stems.x.map(Math.round)).toEqual([1, 3, 5, 7, 9]);
  for (const x of stems.x) expect(x - Math.round(x)).toBeGreaterThan(0);
  for (const v of stems.y) expect(v).toBeCloseTo(-90, 9);
});

test('with a filter on, switching the spectrum source changes the bars', async ({ page }) => {
  await openAnalysis(page);
  await filterSelect(page).selectOption('lowpass');
  const input = await trace(page, 'spectrum', 'Aₙ');
  await sourceSelect(page).selectOption('output');
  expect((await state(page)).spectrumSource).toBe('output');
  const output = await trace(page, 'spectrum', 'Aₙ');
  expect(output.y).not.toEqual(input.y);
  // f_c = 3 kHz, f0 = 1 kHz: the fundamental is scaled by 1/√(1 + (1/3)²).
  expect(output.y[1]).toBeCloseTo(input.y[1] / Math.sqrt(1 + 1 / 9), 9);
  const phase = await trace(page, 'spectrum', 'φₙ');
  expect(phase.y[0]).toBeCloseTo(-90 - (Math.atan(1 / 3) * 180) / Math.PI, 9);
});

test('the filter curves plot gain and phase against f, with a marker at each harmonic', async ({ page }) => {
  await openAnalysis(page);
  await filterSelect(page).selectOption('highpass');
  const gain = await trace(page, 'filter-curves', 'Gain |H|');
  const phase = await trace(page, 'filter-curves', 'Phase ∠H');
  expect(gain.x.length).toBeGreaterThan(50);
  expect(phase.x).toEqual(gain.x);
  const hg = await trace(page, 'filter-curves', 'Harmonics on the gain');
  const hp = await trace(page, 'filter-curves', 'Harmonics on the phase');
  expect(hg.x).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => n * 1000));
  expect(hp.x).toEqual(hg.x);
  const x = 1000 / 3000; // the fundamental, on the high-pass
  expect(hg.y[0]).toBeCloseTo(x / Math.sqrt(1 + x * x), 9);
  expect(hp.y[0]).toBeCloseTo(90 - (Math.atan(x) * 180) / Math.PI, 9);
  await expect(panel(page).locator('[data-display="filter-curves"]')).toContainText('RC high-pass');
});

test('changing f_c moves the f_c marker', async ({ page }) => {
  await openAnalysis(page);
  await filterSelect(page).selectOption('lowpass');
  expect((await trace(page, 'filter-curves', 'f_c')).x).toEqual([3000, 3000]);
  await setFc(page, 500);
  expect((await state(page)).fc).toBe(500);
  expect((await trace(page, 'filter-curves', 'f_c')).x).toEqual([500, 500]);
});

test('with the filter off the filter-curve Display says so instead of drawing flat lines', async ({ page }) => {
  await openAnalysis(page);
  const curves = panel(page).locator('[data-display="filter-curves"]');
  await expect(curves.getByText('The filter is off')).toBeVisible();
  expect(await trace(page, 'filter-curves', 'Gain |H|')).toBeFalsy();
  await filterSelect(page).selectOption('lowpass');
  await expect(curves.getByText('The filter is off')).toBeHidden();
  expect(await trace(page, 'filter-curves', 'Gain |H|')).toBeTruthy();
});

test('hiding the spectrum and the filter curves by id leaves the product Display usable', async ({ page }) => {
  await openAnalysis(page);
  const display = (id) => panel(page).locator(`[data-display="${id}"]`);
  const before = await display('product').boundingBox();
  await page.evaluate(() => { const c = window.toolHost.instances[1].controls; c.get('spectrum').hide(); c.get('filter-curves').hide(); });
  await expect(display('spectrum')).toBeHidden();
  await expect(display('filter-curves')).toBeHidden();
  await expect(display('product')).toBeVisible();
  // The product plot grows into the freed space and still follows its Controls.
  await expect.poll(async () => (await display('product').locator('.main-svg').first().boundingBox()).height)
    .toBeGreaterThan(before.height + 50);
  await panel(page).getByRole('spinbutton', { name: 'n', exact: true }).fill('3');
  await panel(page).getByRole('spinbutton', { name: 'n', exact: true }).press('Enter');
  expect((await state(page)).n).toBe(3);
  await page.evaluate(() => window.toolHost.instances[1].controls.get('spectrum').show());
  await expect(display('spectrum')).toBeVisible();
});

test('in Standalone mode the spectrum and the filter curves are shown', async ({ page }) => {
  await openAnalysis(page);
  await expect(panel(page).locator('[data-display="spectrum"]')).toBeVisible();
  await expect(panel(page).locator('[data-display="filter-curves"]')).toBeVisible();
  const hidden = await page.evaluate(() => ['spectrum', 'filter-curves', 'spectrumSource']
    .map((id) => window.toolHost.instances[1].controls.get(id).isHidden()));
  expect(hidden).toEqual([false, false, false]);
});

test('the spectrum source and the filter settings serialize and restore', async ({ page }) => {
  await openAnalysis(page);
  const restored = await page.evaluate(() => {
    const i = window.toolHost.instances[1];
    const set = (vals) => { for (const [k, v] of Object.entries(vals)) i.controls.get(k).set(v); };
    set({ spectrumSource: 'output', filter: 'highpass', fc: 800, applyPhase: false });
    const saved = JSON.parse(JSON.stringify(i.serialize()));
    set({ spectrumSource: 'input', filter: 'off', fc: 3000, applyPhase: true });
    i.restore(saved);
    const good = i.state.snapshot();
    i.restore({ spectrumSource: 'sideways' });
    return { saved, good, bad: i.state.snapshot() };
  });
  expect(restored.saved).toMatchObject({ spectrumSource: 'output', filter: 'highpass', fc: 800, applyPhase: false });
  expect(restored.good).toMatchObject({ spectrumSource: 'output', filter: 'highpass', fc: 800, applyPhase: false });
  expect(restored.bad.spectrumSource).toBe('output');
});

test('the spectrum and filter-curve snapshots are PNGs, and a hidden Display leaves the displays list', async ({ page }) => {
  await openAnalysis(page);
  const { pngs, hiddenIds, shownIds } = await page.evaluate(async () => {
    const i = window.toolHost.instances[1];
    const shots = await Promise.all(['spectrum', 'filter-curves'].map((id) => i.displays.find((d) => d.id === id).snapshot()));
    i.controls.get('spectrum').hide();
    const hidden = i.displays.map((d) => d.id);
    i.controls.get('spectrum').show();
    return { pngs: shots, hiddenIds: hidden, shownIds: i.displays.map((d) => d.id) };
  });
  for (const png of pngs) expect(png).toMatch(/^data:image\/png;base64,/);
  // So the Report at Submit holds no picture of a spectrum the Task hid.
  expect(hiddenIds).toEqual(['product', 'filter-curves']);
  expect(shownIds).toEqual(['product', 'spectrum', 'filter-curves']);
});
