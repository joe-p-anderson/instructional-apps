import { test, expect } from '@playwright/test';

const PAGE = '/tools/phasors/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const state = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

const box = (page, name) => page.getByRole('spinbutton', { name, exact: true });
async function enter(page, name, value) {
  await box(page, name).fill(String(value));
  await box(page, name).press('Enter');
}

/** The colour the Display `id` draws at plot point (x, y), as [r, g, b]. */
const colourAt = (page, id, x, y) => page.evaluate(({ id, x, y }) => {
  const d = window.toolHost.instances[0].displays.find((e) => e.id === id);
  const p = d.toScreen(x, y);
  const cv = document.querySelector(`[data-mode="sum"] [data-display="${id}"] canvas`);
  const r = cv.getBoundingClientRect();
  const k = cv.width / r.width;
  const px = cv.getContext('2d').getImageData(Math.round((p.x - r.left) * k), Math.round((p.y - r.top) * k), 1, 1).data;
  return [px[0], px[1], px[2]];
}, { id, x, y });

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 40);

test('the Standalone page opens on the Sum Mode with its inputs shown and unlocked', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Phasors and Impedance');
  await expect(page.getByRole('tab', { name: 'Sum' })).toHaveAttribute('aria-selected', 'true');
  for (const name of ['A₁ (V)', 'φ₁ (°)', 'A₂ (V)', 'φ₂ (°)']) await expect(box(page, name)).toBeEditable();
  const controls = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return i.controls.ids().map((id) => ({ id, locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }));
  });
  expect(controls.map((c) => c.id).sort()).toEqual(['A1', 'A2', 'crest1', 'crest2', 'phi1', 'phi2', 'tip1', 'tip2']);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
  const shots = await page.evaluate(() => Promise.all(window.toolHost.instances[0].displays.map(async (d) => [d.id, await d.snapshot()])));
  expect(shots.map(([id]) => id)).toEqual(['plane', 'time']);
  for (const [, png] of shots) expect(png).toMatch(/^data:image\/png;base64,/);
});

test('State publishes the Mode, both sinusoids, ω and the resultant, with units', async ({ page }) => {
  await open(page);
  const { s, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return { s: i.state.snapshot(), info: i.state.describe() };
  });
  expect(s).toMatchObject({ mode: 'sum', A1: 3, phi1: 0, A2: 2, phi2: 90, omega: 1000 });
  expect(s.A).toBeCloseTo(Math.sqrt(13), 9);
  expect(s.phi).toBeCloseTo((Math.atan2(2, 3) * 180) / Math.PI, 9);
  expect(s.f).toBeCloseTo(1000 / (2 * Math.PI), 9);
  expect(info.A1.unit).toBe('V');
  expect(info.phi1.unit).toBe('°');
  expect(info.omega.unit).toBe('rad/s');
  expect(info.A.unit).toBe('V');
  expect(info.phi.unit).toBe('°');
  expect(info.f.unit).toBe('Hz');
  for (const k of Object.keys(s)) expect(info[k], k).toBeTruthy();
});

test('readouts show every phasor in a + jb and A∠φ° form, using j', async ({ page }) => {
  await open(page);
  const readout = (name) => page.getByRole('status', { name, exact: true });
  await expect(readout('v₁ rectangular')).toHaveText('3.00 + j0.00 V');
  await expect(readout('v₁ polar')).toHaveText('3.00∠0.0° V');
  await expect(readout('v₂ rectangular')).toHaveText('0.00 + j2.00 V');
  await expect(readout('v₂ polar')).toHaveText('2.00∠90.0° V');
  await expect(readout('v₁ + v₂ rectangular')).toHaveText('3.00 + j2.00 V');
  await expect(readout('v₁ + v₂ polar')).toHaveText('3.61∠33.7° V');
  await enter(page, 'φ₂ (°)', -90);
  await expect(readout('v₂ rectangular')).toHaveText('0.00 − j2.00 V');
  await expect(readout('v₁ + v₂ polar')).toHaveText('3.61∠−33.7° V');
});

test('changing an input moves the phasor and its curve', async ({ page }) => {
  await open(page);
  await settle(page);
  const omega = 1000;
  // v₂ is drawn from v₁'s tip (3, 0): at φ₂ = 90° its tip is (3, 2).
  const red = await colourAt(page, 'plane', 3, 2);
  const crest = (phi) => [(-phi * Math.PI) / 180 / omega, 2]; // v₂'s crest nearest t = 0, at t = −φ/ω
  expect(near(await colourAt(page, 'time', ...crest(90)), red), 'v₂ crest at φ₂ = 90°').toBe(true);

  await enter(page, 'φ₂ (°)', 45);
  await settle(page);
  expect((await state(page)).phi2).toBe(45);
  const tip = [3 + Math.SQRT2, Math.SQRT2];
  expect(near(await colourAt(page, 'plane', ...tip), red), 'v₂ tip moved to φ₂ = 45°').toBe(true);
  expect(near(await colourAt(page, 'plane', 3, 2), red), 'nothing left at the old tip').toBe(false);
  expect(near(await colourAt(page, 'time', ...crest(45)), red), 'v₂ crest moved to t = −φ₂/ω').toBe(true);
  expect(near(await colourAt(page, 'time', ...crest(90)), red), 'nothing left at the old crest').toBe(false);
});

test('serialize and restore round-trip the inputs, ignoring bad values and clamping out-of-range ones', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    let fired = 0;
    i.state.onChange(() => { fired += 1; });
    i.restore({ A1: 1.5, phi1: 'nope', A2: 999, phi2: 270 });
    return { s: i.state.snapshot(), saved: i.serialize(), fired };
  });
  expect(out.fired).toBe(1);
  expect(out.s).toMatchObject({ A1: 1.5, phi1: 0, A2: 10, phi2: -90 });
  expect(out.saved).toEqual({ A1: 1.5, phi1: 0, A2: 10, phi2: -90 });
});

test('the Tool mounts several times on one page, each instance on its own State', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/phasors/phasors.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'sum', { A1: 1 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'sum', { A1: 2 });
    a.controls.get('A2').set(5);
    const r = { a: a.state.snapshot(), b: b.state.snapshot() };
    a.destroy(); b.destroy();
    return r;
  });
  expect(out.a).toMatchObject({ A1: 1, A2: 5 });
  expect(out.b).toMatchObject({ A1: 2, A2: 2 });
});

// ── Drag handles: each phasor's tip on the plane, and its crest on the time plot ──

const handleEl = (page, name) => page.getByRole('group', { name, exact: true });
async function centreOf(page, name) {
  const b = await handleEl(page, name).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const toScreen = (page, id, x, y) => page.evaluate(({ id, x, y }) =>
  window.toolHost.instances[0].displays.find((d) => d.id === id).toScreen(x, y), { id, x, y });
async function expectAt(page, name, at) {
  const c = await centreOf(page, name);
  expect(Math.abs(c.x - at.x), `${name} x`).toBeLessThanOrEqual(1.5);
  expect(Math.abs(c.y - at.y), `${name} y`).toBeLessThanOrEqual(1.5);
}
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}
const OMEGA = 1000;
const crestAt = (A, phi) => [(-phi * Math.PI) / 180 / OMEGA, A]; // (t, v) of the crest nearest t = 0
const rad = (deg) => (deg * Math.PI) / 180;

test('each phasor has a tip handle on the plane and a crest handle on the time plot', async ({ page }) => {
  await open(page);
  await settle(page);
  // v₁ = 3∠0° has its tip at (3, 0); v₂ = 2∠90° is drawn from v₁'s tip, so its tip is at (3, 2).
  await expectAt(page, 'v₁ tip', await toScreen(page, 'plane', 3, 0));
  await expectAt(page, 'v₂ tip', await toScreen(page, 'plane', 3, 2));
  await expectAt(page, 'v₁ crest', await toScreen(page, 'time', ...crestAt(3, 0)));
  await expectAt(page, 'v₂ crest', await toScreen(page, 'time', ...crestAt(2, 90)));
  await expect(handleEl(page, 'v₂ tip')).toHaveAccessibleDescription(/2\.00∠90\.0° V/);
});

test('dragging a phasor tip moves the matching crest handle and the number inputs', async ({ page }) => {
  await open(page);
  await settle(page);
  // Drag v₂'s tip from (3, 2) to (3, −2): v₂ becomes 2∠−90°.
  await drag(page, await centreOf(page, 'v₂ tip'), await toScreen(page, 'plane', 3, -2));
  await settle(page);
  const s = await state(page);
  expect(s.A1).toBe(3);
  expect(s.A2).toBeCloseTo(2, 1);
  expect(s.phi2).toBeCloseTo(-90, 0);
  await expect(box(page, 'φ₂ (°)')).toHaveValue(String(Number(s.phi2.toFixed(1))));
  await expectAt(page, 'v₂ crest', await toScreen(page, 'time', ...crestAt(s.A2, s.phi2)));
  await expectAt(page, 'v₂ tip', await toScreen(page, 'plane', 3 + s.A2 * Math.cos(rad(s.phi2)), s.A2 * Math.sin(rad(s.phi2))));
});

test('dragging a crest handle sets A and φ, and moves the matching phasor tip', async ({ page }) => {
  await open(page);
  await settle(page);
  // Drag v₁'s crest from (0, 3) up and left to the crest of 4∠60°.
  await drag(page, await centreOf(page, 'v₁ crest'), await toScreen(page, 'time', ...crestAt(4, 60)));
  await settle(page);
  const s = await state(page);
  expect(s.A1).toBeCloseTo(4, 1);
  expect(s.phi1).toBeCloseTo(60, 0);
  await expect(box(page, 'A₁ (V)')).toHaveValue(String(Number(s.A1.toFixed(2))));
  const z1 = [s.A1 * Math.cos(rad(s.phi1)), s.A1 * Math.sin(rad(s.phi1))];
  await expectAt(page, 'v₁ tip', await toScreen(page, 'plane', ...z1));
  await expectAt(page, 'v₁ crest', await toScreen(page, 'time', ...crestAt(s.A1, s.phi1)));
  await expectAt(page, 'v₂ tip', await toScreen(page, 'plane', z1[0], z1[1] + 2)); // still head to tail
});

test('the keyboard nudges a handle: arrows step, Shift steps further', async ({ page }) => {
  await open(page);
  await handleEl(page, 'v₁ tip').focus();
  await page.keyboard.press('ArrowRight'); // Re 3 → 3.1
  expect((await state(page)).A1).toBeCloseTo(3.1, 9);
  await page.keyboard.press('Shift+ArrowLeft'); // Re 3.1 → 2.1
  expect((await state(page)).A1).toBeCloseTo(2.1, 9);
  await expect(box(page, 'A₁ (V)')).toHaveValue('2.1');

  await handleEl(page, 'v₂ crest').focus();
  await page.keyboard.press('ArrowUp'); // A₂ 2 → 2.1
  expect((await state(page)).A2).toBeCloseTo(2.1, 9);
  await page.keyboard.press('ArrowRight'); // the crest slides 1° later: φ₂ 90° → 89°
  expect((await state(page)).phi2).toBeCloseTo(89, 9);
  await page.keyboard.press('Shift+ArrowLeft'); // 15° earlier: φ₂ → 104°
  expect((await state(page)).phi2).toBeCloseTo(104, 9);
  await expect(handleEl(page, 'v₂ crest')).toHaveAccessibleDescription(/A = 2\.10 V/);
});

test('handles lock and hide like any Control', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const c = window.toolHost.instances[0].controls;
    c.get('tip1').lock();
    c.get('crest2').hide();
  });
  await handleEl(page, 'v₁ tip').focus();
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).A1).toBe(3);
  await expect(page.locator('[data-mode="sum"] .fw-handle[aria-label="v₂ crest"]')).toBeHidden();
  await page.evaluate(() => {
    const c = window.toolHost.instances[0].controls;
    c.get('tip1').unlock();
    c.get('crest2').show();
  });
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).A1).toBeCloseTo(3.1, 9);
  await expect(handleEl(page, 'v₂ crest')).toBeVisible();
});
