import { test, expect } from '@playwright/test';

// The Fourier Tool's Analysis Mode on the Standalone page (instances[1]; Synthesis is [0]).

const PAGE = '/tools/fourier/';

async function openAnalysis(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  await page.getByRole('tab', { name: 'Analysis' }).click();
}

const state = (page) => page.evaluate(() => window.toolHost.instances[1].state.snapshot());

/** The y values of the product plot's trace with this name (what the Display draws). */
const traceY = (page, name) => page.evaluate((n) => {
  const plot = document.querySelector('[data-mode="analysis"] [data-display="product"] .js-plotly-plot');
  return Array.from(plot.data.find((t) => t.name === n).y);
}, name);

const testSelect = (page) => page.getByRole('combobox', { name: 'Test function', exact: true });
const nBox = (page) => page.getByRole('spinbutton', { name: 'n', exact: true });
const setN = async (page, n) => { await nBox(page).fill(String(n)); await nBox(page).press('Enter'); };

test('the Standalone page has Synthesis and Analysis tabs', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  await expect(page.getByRole('tab')).toHaveText(['Synthesis', 'Analysis']);
});

test('Analysis has the shared input and filter Controls with the Synthesis ids, plus its own', async ({ page }) => {
  await openAnalysis(page);
  const ids = await page.evaluate(() => window.toolHost.instances.map((i) => i.controls.ids()));
  expect(ids[1].sort()).toEqual(['amp', 'applyGain', 'applyPhase', 'f0', 'fc', 'filter', 'filter-curves', 'n',
    'offset', 'shift', 'spectrum', 'spectrumSource', 'testFunction', 'waveform']);
  for (const id of ['waveform', 'amp', 'f0', 'offset', 'shift', 'filter', 'fc', 'applyGain', 'applyPhase']) {
    expect(ids[0], id).toContain(id);
  }
  const options = await testSelect(page).locator('option').allTextContents();
  expect(options).toHaveLength(2);
  expect(options[0]).toMatch(/^cos/);
  expect(options[1]).toMatch(/^sin/);
});

test('State publishes the Mode, the input, the test function and n, with descriptions', async ({ page }) => {
  await openAnalysis(page);
  const { s, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[1];
    return { s: i.state.snapshot(), info: i.state.describe() };
  });
  expect(s).toEqual({ mode: 'analysis', waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0,
    filter: 'off', fc: 3000, applyGain: true, applyPhase: true, fcRatio: 3, tau: 1e3 / (2 * Math.PI * 3000),
    testFunction: 'sin', n: 1, spectrumSource: 'input' });
  for (const k of Object.keys(s)) expect(info[k], k).toBeTruthy();
  expect(info.f0.unit).toBe('Hz');
});

test('the product plot spans one period and draws the input, the test function, the product and its shaded areas', async ({ page }) => {
  await openAnalysis(page);
  const { names, xMax, fills } = await page.evaluate(() => {
    const plot = document.querySelector('[data-mode="analysis"] [data-display="product"] .js-plotly-plot');
    return {
      names: plot.data.map((t) => t.name),
      xMax: Math.max(...plot.data[0].x),
      fills: plot.data.filter((t) => t.fill).map((t) => t.fillcolor),
    };
  });
  expect(names).toEqual(['Positive area', 'Negative area', 'Input', 'Test function', 'Product']);
  expect(xMax).toBeCloseTo(1, 9); // ms: one period of 1 kHz
  expect(fills).toHaveLength(2);
  expect(fills[0]).not.toEqual(fills[1]);
  const pos = await traceY(page, 'Positive area');
  const neg = await traceY(page, 'Negative area');
  expect(pos.every((v) => v >= 0)).toBe(true);
  expect(neg.every((v) => v <= 0)).toBe(true);
});

test('changing cos/sin and changing n each change the shaded product', async ({ page }) => {
  await openAnalysis(page);
  const sin1 = { pos: await traceY(page, 'Positive area'), neg: await traceY(page, 'Negative area') };
  // square × sin at n = 1 is never negative
  expect(sin1.neg.every((v) => Math.abs(v) < 1e-12)).toBe(true);

  await testSelect(page).selectOption('cos');
  expect((await state(page)).testFunction).toBe('cos');
  const cos1 = { pos: await traceY(page, 'Positive area'), neg: await traceY(page, 'Negative area') };
  expect(cos1.pos).not.toEqual(sin1.pos);
  expect(cos1.neg).not.toEqual(sin1.neg);

  await setN(page, 3);
  expect((await state(page)).n).toBe(3);
  expect(await traceY(page, 'Positive area')).not.toEqual(cos1.pos);
  expect(await traceY(page, 'Negative area')).not.toEqual(cos1.neg);
});

test('n = 0 is the DC test: the cos product is the input itself', async ({ page }) => {
  await openAnalysis(page);
  await testSelect(page).selectOption('cos');
  await setN(page, 0);
  expect(await traceY(page, 'Product')).toEqual(await traceY(page, 'Input'));
  expect((await traceY(page, 'Test function')).every((v) => v === 1)).toBe(true);
});

test('n is an integer from 0 to 10', async ({ page }) => {
  await openAnalysis(page);
  const n = await page.evaluate(() => {
    const c = window.toolHost.instances[1].controls.get('n');
    const out = [];
    for (const v of [15, -3, 2.6]) { c.set(v); out.push(window.toolHost.instances[1].state.snapshot().n); }
    return out;
  });
  expect(n).toEqual([10, 0, 3]);
});

// The spectrum Display does show Aₙ and φₙ: an Activity hides it until the matching Task is done.
test('no readout shows an integral or a coefficient', async ({ page }) => {
  await openAnalysis(page);
  const panel = page.locator('[data-mode="analysis"]');
  // The only readouts are the filter's f_c/f₀ and τ.
  await expect(panel.locator('.fw-metric')).toHaveCount(2);
  const text = [await panel.locator('.fw-controls').innerText(),
    await panel.locator('[data-display="product"]').innerText()].join('\n');
  expect(text).not.toMatch(/[ab]ₙ|Aₙ|φₙ|integral|=\s*-?\d+\.\d/i);
});

test('State serializes and restores the test function, n and the input', async ({ page }) => {
  await openAnalysis(page);
  const restored = await page.evaluate(() => {
    const i = window.toolHost.instances[1];
    const set = (vals) => { for (const [k, v] of Object.entries(vals)) i.controls.get(k).set(v); };
    set({ testFunction: 'cos', n: 4, waveform: 'sine', shift: 30 });
    const saved = JSON.parse(JSON.stringify(i.serialize()));
    set({ testFunction: 'sin', n: 1, waveform: 'square', shift: 0 });
    i.restore(saved);
    const afterGood = i.state.snapshot();
    i.restore({ testFunction: 'tan', n: 99 });
    return { afterGood, afterBad: i.state.snapshot() };
  });
  expect(restored.afterGood).toMatchObject({ mode: 'analysis', waveform: 'sine', amp: 1, f0: 1000, offset: 0, shift: 30, testFunction: 'cos', n: 4 });
  expect(restored.afterBad).toMatchObject({ testFunction: 'cos', n: 10 });
});

test('the Analysis Mode mounts several times with independent State', async ({ page }) => {
  await openAnalysis(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/fourier/fourier.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'analysis', { n: 2 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'analysis', { n: 5, testFunction: 'cos' });
    a.controls.get('n').set(7);
    const s = { a: a.state.snapshot(), b: b.state.snapshot() };
    a.destroy(); b.destroy();
    return s;
  });
  expect(result.a).toMatchObject({ n: 7, testFunction: 'sin' });
  expect(result.b).toMatchObject({ n: 5, testFunction: 'cos' });
});

test('the product Display snapshot is a PNG', async ({ page }) => {
  await openAnalysis(page);
  const png = await page.evaluate(() => window.toolHost.instances[1].displays.find((d) => d.id === 'product').snapshot());
  expect(png).toMatch(/^data:image\/png;base64,/);
});
