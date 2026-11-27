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
  expect(controls.map((c) => c.id).sort()).toEqual(['A1', 'A2', 'crest1', 'crest2', 'cursor', 'omega', 'phi1', 'phi2', 'play', 'sum', 't', 'tip1', 'tip2']);
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
  expect(s).toMatchObject({ t: 0, playing: false });
  expect(info.t.unit).toBe('s');
  expect(info.playing).toBeTruthy();
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

test('the Tool starts paused at t = 0; play advances t and pause stops it', async ({ page }) => {
  await open(page);
  const play = page.getByRole('button', { name: 'Play' });
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  expect(await state(page)).toMatchObject({ t: 0, playing: false });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).playing).toBe(true);
  await expect.poll(async () => (await state(page)).t).toBeGreaterThan(0);
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const paused = await state(page);
  expect(paused.playing).toBe(false);
  await page.waitForTimeout(300);
  expect((await state(page)).t).toBe(paused.t);
});

test('play loops t within one period, which takes a few seconds whatever ω is', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const i = window.toolHost.instances[0];
    i.controls.get('omega').set(1e5);
    const T = (2 * Math.PI) / 1e5;
    let max = 0;
    i.state.onChange((s) => { max = Math.max(max, s.t); });
    i.controls.get('play').set(true);
    const t0 = i.state.snapshot().t;
    await new Promise((r) => setTimeout(r, 500));
    const t1 = i.state.snapshot().t;
    i.controls.get('play').set(false);
    return { T, max, advanced: (t1 - t0 + T) % T };
  });
  expect(out.max).toBeLessThanOrEqual(out.T);
  // half a second of play moves t by between a twentieth and a half of a period
  expect(out.advanced / out.T).toBeGreaterThan(0.05);
  expect(out.advanced / out.T).toBeLessThan(0.5);
});

test('the t-scrubber and the time cursor set the same t', async ({ page }) => {
  await open(page);
  const omega = 1000;
  // the scrubber is ωt in degrees: 90° is a quarter period
  await enter(page, 'ωt (°)', 90);
  expect((await state(page)).t).toBeCloseTo(Math.PI / 2 / omega, 9);
  const cursor = page.getByRole('slider', { name: 'Time cursor' });
  await expect(cursor).toHaveAttribute('aria-valuenow', '90');
  // keyboard moves the cursor, and the scrubber follows
  await cursor.focus();
  await cursor.press('ArrowRight');
  const t = (await state(page)).t;
  expect(t).toBeGreaterThan(Math.PI / 2 / omega);
  await expect(box(page, 'ωt (°)')).not.toHaveValue('90');
});

test('dragging the time cursor changes t', async ({ page }) => {
  await open(page);
  await settle(page);
  const cursor = page.getByRole('slider', { name: 'Time cursor' });
  const b = await cursor.boundingBox();
  const T = (2 * Math.PI) / 1000;
  const target = await page.evaluate((T) => window.toolHost.instances[0].displays
    .find((d) => d.id === 'time').toScreen(T / 2, 0), T);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  const s = await state(page);
  expect(s.t / T).toBeGreaterThan(0.45);
  expect(s.t / T).toBeLessThan(0.55);
});

test('changing ω updates the f readout', async ({ page }) => {
  await open(page);
  const f = page.getByRole('status', { name: 'f', exact: true });
  await expect(f).toHaveText('159.2 Hz');
  await enter(page, 'ω (rad/s)', 2000);
  await expect(f).toHaveText('318.3 Hz');
  const s = await state(page);
  expect(s.omega).toBe(2000);
  expect(s.f).toBeCloseTo(2000 / (2 * Math.PI), 9);
});

test('the phasors rotate to ωt + φ, and each projection meets its curve at the cursor', async ({ page }) => {
  await open(page);
  const omega = 1000;
  await settle(page);
  const red = await colourAt(page, 'plane', 3, 2); // v₂'s static tip, head-to-tail from v₁ = (3, 0)
  await enter(page, 'ωt (°)', 60);
  await settle(page);
  const t = (await state(page)).t;
  const blue = await colourAt(page, 'time', -Math.PI / omega, -3); // v₁ = 3 cos(ωt), its trough at t = −T/2
  const rad = Math.PI / 180;
  // v₁ = 3∠0 is now at 3∠60°; its tip and its real-axis projection 3 cos 60° = 1.5
  expect(near(await colourAt(page, 'plane', 3 * Math.cos(60 * rad), 3 * Math.sin(60 * rad)), blue), 'v₁ tip rotated').toBe(true);
  expect(near(await colourAt(page, 'plane', 1.5, 0), blue), 'v₁ projection on the real axis').toBe(true);
  expect(near(await colourAt(page, 'time', t, 1.5), blue), 'v₁ curve at the cursor').toBe(true);
  // the relative angle stays put: v₂ (2∠90°) is now 2∠150°, still 90° ahead of v₁
  const tip = [1.5 + 2 * Math.cos(150 * rad), 3 * Math.sin(60 * rad) + 2 * Math.sin(150 * rad)];
  expect(near(await colourAt(page, 'plane', ...tip), red), 'v₂ tip rotated with v₁').toBe(true);
  expect(near(await colourAt(page, 'plane', 3, 2), red), 'nothing left at v₂’s static tip').toBe(false);
  expect(near(await colourAt(page, 'time', t, 2 * Math.cos(150 * rad)), red), 'v₂ curve at the cursor').toBe(true);
});

test('serialize and restore round-trip the inputs, ignoring bad values and clamping out-of-range ones', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    let fired = 0;
    i.state.onChange(() => { fired += 1; });
    i.restore({ A1: 1.5, phi1: 'nope', A2: 999, phi2: 270, omega: 5e7, t: 'later', showSum: false });
    const first = { s: i.state.snapshot(), saved: i.serialize(), fired };
    i.controls.get('play').set(true);
    i.restore({ omega: 2000, t: 0.001 });
    return { ...first, after: i.state.snapshot(), saved2: i.serialize() };
  });
  expect(out.fired).toBe(1);
  expect(out.s).toMatchObject({ A1: 1.5, phi1: 0, A2: 10, phi2: -90, omega: 1e6, t: 0, showSum: false });
  expect(out.saved).toEqual({ A1: 1.5, phi1: 0, A2: 10, phi2: -90, omega: 1e6, t: 0, showSum: false });
  // restore stops play, and t comes back within one period
  expect(out.after).toMatchObject({ omega: 2000, playing: false });
  expect(out.after.t).toBeCloseTo(0.001, 9);
  expect(out.saved2.t).toBeCloseTo(0.001, 9);
});

test('the Tool mounts several times on one page, each instance on its own State, and destroy cancels play', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/phasors/phasors.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'sum', { A1: 1 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'sum', { A1: 2 });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('A2').set(5);
    a.controls.get('t').set(0.002);
    const r = { a: a.state.snapshot(), b: b.state.snapshot() };
    a.controls.get('play').set(true);
    a.destroy();
    let aChanges = 0;
    a.state.onChange(() => { aChanges += 1; });
    await new Promise((res) => setTimeout(res, 400));
    b.destroy();
    return { ...r, aChanges, bChanges };
  });
  expect(out.a).toMatchObject({ A1: 1, A2: 5 });
  expect(out.a.t).toBeCloseTo(0.002, 9);
  expect(out.b).toMatchObject({ A1: 2, A2: 2, t: 0 });
  expect(out.aChanges).toBe(0);
  expect(out.bChanges).toBe(0);
});

test('locking play pauses it', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    i.controls.get('play').set(true);
    const on = i.state.snapshot().playing;
    i.controls.get('play').lock();
    const locked = i.state.snapshot().playing;
    i.controls.get('play').set(true);
    return { on, locked, still: i.state.snapshot().playing };
  });
  expect(out).toEqual({ on: true, locked: false, still: false });
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

test('tip handles ride the rotated tips, and crest handles follow a new ω', async ({ page }) => {
  await open(page);
  await enter(page, 'ωt (°)', 90);
  await settle(page);
  // a quarter period on, v₁ = 3∠0° is at 3∠90° = (0, 3) and v₂ = 2∠90° at 2∠180°, so v₂'s tip is (−2, 3)
  await expectAt(page, 'v₁ tip', await toScreen(page, 'plane', 0, 3));
  await expectAt(page, 'v₂ tip', await toScreen(page, 'plane', -2, 3));
  // dragging the rotated v₁ tip to (−3, 0), i.e. 3∠180° at ωt = 90°, sets the static v₁ to 3∠90°
  await drag(page, await centreOf(page, 'v₁ tip'), await toScreen(page, 'plane', -3, 0));
  await settle(page);
  const s = await state(page);
  expect(s.A1).toBeCloseTo(3, 1);
  expect(s.phi1).toBeCloseTo(90, 0);

  await enter(page, 'ω (rad/s)', 4000);
  await settle(page);
  await expectAt(page, 'v₂ crest', await toScreen(page, 'time', (-Math.PI / 2) / 4000, 2));
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

test('the resultant is a layer: hiding it removes it from both Displays and hides its readouts', async ({ page }) => {
  await open(page);
  await settle(page);
  const green = await page.locator('[data-mode="sum"] .ph-swatch[data-color="sum"]').first()
    .evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
  const s = await state(page);
  const mid = [1.5, 1]; // halfway along v₁ + v₂ = 3 + j2 V
  const crestT = -((s.phi * Math.PI) / 180) / s.omega; // the sum's crest, above v₁'s and v₂'s
  const toggle = page.locator('[data-mode="sum"]').getByRole('checkbox', { name: 'Show v₁ + v₂', exact: true });
  await expect(toggle).toBeChecked(); // Standalone shows every layer
  expect(near(await colourAt(page, 'plane', ...mid), green), 'resultant drawn').toBe(true);
  expect(near(await colourAt(page, 'time', crestT, s.A), green), 'sum curve drawn').toBe(true);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('sum').hide());
  await settle(page);
  await expect(toggle).toBeHidden();
  expect(near(await colourAt(page, 'plane', ...mid), green), 'resultant hidden').toBe(false);
  expect(near(await colourAt(page, 'time', crestT, s.A), green), 'sum curve hidden').toBe(false);
  await expect(page.getByRole('status', { name: 'v₁ + v₂ rectangular', exact: true })).toBeHidden();
  await expect(page.getByRole('status', { name: 'v₁ + v₂ polar', exact: true })).toBeHidden();
  await expect(page.getByRole('status', { name: 'v₁ polar', exact: true })).toBeVisible();

  await page.evaluate(() => window.toolHost.instances[0].controls.get('sum').show());
  await settle(page);
  expect(near(await colourAt(page, 'plane', ...mid), green), 'resultant back').toBe(true);
  await expect(page.getByRole('status', { name: 'v₁ + v₂ polar', exact: true })).toBeVisible();
  // unticking the toggle hides it too, and the State says so
  await toggle.uncheck();
  await settle(page);
  expect((await state(page)).showSum).toBe(false);
  expect(near(await colourAt(page, 'plane', ...mid), green), 'unticked').toBe(false);
});