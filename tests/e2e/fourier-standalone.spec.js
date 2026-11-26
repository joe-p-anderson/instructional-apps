import { test, expect } from '@playwright/test';

const PAGE = '/tools/fourier/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const state = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

/** The y values of the time plot's trace with this legend name (what the Display draws). */
const traceY = (page, name) => page.evaluate((n) => {
  const plot = document.querySelector('[data-tool="fourier"] [data-display="time"] .js-plotly-plot');
  return Array.from(plot.data.find((t) => t.name === n).y);
}, name);

const nBox = (page) => page.getByRole('spinbutton', { name: 'N', exact: true });
const setN = async (page, n) => { await nBox(page).fill(String(n)); await nBox(page).press('Enter'); };

test('the Standalone page opens on the Synthesis Mode with every Control shown and unlocked', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab', { name: 'Synthesis' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('slider', { name: 'N', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  const controls = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return i.controls.ids().map((id) => ({ id, locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }));
  });
  expect(controls.map((c) => c.id).sort()).toEqual(['N', 'play']);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
});

test('State publishes the Mode, the input and N with units', async ({ page }) => {
  await open(page);
  const { s, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return { s: i.state.snapshot(), info: i.state.describe() };
  });
  expect(s).toEqual({ mode: 'synthesis', waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0, N: 1 });
  expect(info.amp.unit).toBe('V');
  expect(info.f0.unit).toBe('Hz');
  expect(info.offset.unit).toBe('V');
  expect(info.shift.unit).toBe('°');
  expect(info.N.unit).toBe('');
  for (const k of Object.keys(s)) expect(info[k], k).toBeTruthy();
});

test('the time plot draws the input, the partial sum, the N = ∞ curve and the highest harmonic', async ({ page }) => {
  await open(page);
  const names = await page.evaluate(() => document
    .querySelector('[data-tool="fourier"] [data-display="time"] .js-plotly-plot').data.map((t) => t.name));
  expect(names).toEqual(['Input', 'N = ∞ (infinite series)', 'Highest harmonic', 'Partial sum']);
  await expect(page.locator('[data-tool="fourier"] .fw-legend-row')).toHaveCount(4);
  await expect(page.locator('[data-tool="fourier"] .xtitle')).toHaveText('Time (ms)');
  await expect(page.locator('[data-tool="fourier"] .ytitle')).toHaveText('Voltage (V)');
});

test('moving N changes the partial sum; N = 0 is the DC term alone; an even N adds nothing', async ({ page }) => {
  await open(page);
  const at1 = await traceY(page, 'Partial sum');
  await setN(page, 3);
  expect((await state(page)).N).toBe(3);
  const at3 = await traceY(page, 'Partial sum');
  expect(at3).not.toEqual(at1);

  await setN(page, 4);
  expect(await traceY(page, 'Partial sum')).toEqual(at3);
  expect((await traceY(page, 'Highest harmonic')).every((v) => v === 0)).toBe(true);

  await setN(page, 0);
  expect((await traceY(page, 'Partial sum')).every((v) => v === 0)).toBe(true);
});

test('play advances N and pause stops it', async ({ page }) => {
  await open(page);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await state(page)).N, { timeout: 5000 }).toBeGreaterThanOrEqual(4);
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const paused = (await state(page)).N;
  await page.waitForTimeout(800);
  expect((await state(page)).N).toBe(paused);
});

test('play stops at N = 100, and pressing it again starts over from 0', async ({ page }) => {
  await open(page);
  await setN(page, 98);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  await expect.poll(async () => (await state(page)).N, { timeout: 5000 }).toBe(100);
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await play.click();
  await expect.poll(async () => (await state(page)).N, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  expect((await state(page)).N).toBeLessThan(10);
});

test('the Tool mounts several times on one page with independent State, and destroy cancels play', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/fourier/fourier.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'synthesis', { N: 5 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'synthesis', { N: 9 });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('N').set(7);
    const s = { a: a.state.snapshot().N, b: b.state.snapshot().N };
    a.controls.get('play').set(true);
    a.destroy();
    let aChanges = 0;
    a.state.onChange(() => { aChanges += 1; });
    await new Promise((r) => setTimeout(r, 800));
    b.destroy();
    return { ...s, bChanges, aChanges };
  });
  expect(result).toEqual({ a: 7, b: 9, bChanges: 0, aChanges: 0 });
});

test('State serializes and restores', async ({ page }) => {
  await open(page);
  const restored = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    i.controls.get('N').set(12);
    const saved = JSON.parse(JSON.stringify(i.serialize()));
    i.controls.get('N').set(40);
    i.restore(saved);
    return i.state.snapshot().N;
  });
  expect(restored).toBe(12);
});

test('the Display snapshot is a PNG', async ({ page }) => {
  await open(page);
  const png = await page.evaluate(() => window.toolHost.instances[0].displays[0].snapshot());
  expect(png).toMatch(/^data:image\/png;base64,/);
});
