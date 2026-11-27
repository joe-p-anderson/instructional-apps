import { test, expect } from '@playwright/test';

// The Phasors Tool's Circuit Mode on the Standalone page: a series R/L/C loop driven by V₀ cos(ωt).
// Defaults: V₀ = 5 V, R = 100 Ω, L = 50 mH, C = 2 µF, ω = 1000 rad/s, all three elements on, so
// Z = 100 + j50 − j500 = 100 − j450 Ω.

const CIRCUIT = 1; // toolHost.instances[1] is the Circuit Mode (Modes are [sum, circuit])

async function open(page) {
  await page.goto('/tools/phasors/');
  await page.waitForFunction(() => window.toolHost);
  await page.getByRole('tab', { name: 'Circuit' }).click();
}

const panel = (page) => page.locator('[data-mode="circuit"]');
const state = (page) => page.evaluate((i) => window.toolHost.instances[i].state.snapshot(), CIRCUIT);
const box = (page, name) => panel(page).getByRole('spinbutton', { name, exact: true });
async function enter(page, name, value) {
  await box(page, name).fill(String(value));
  await box(page, name).press('Enter');
}
const readout = (page, name) => panel(page).getByRole('status', { name, exact: true });
const include = (page, k) => panel(page).getByRole('checkbox', { name: `Include ${k}`, exact: true });
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** The colour the Circuit Display `id` draws at plot point (x, y), as [r, g, b]. */
const colourAt = (page, id, x, y) => page.evaluate(({ i, id, x, y }) => {
  const d = window.toolHost.instances[i].displays.find((e) => e.id === id);
  const p = d.toScreen(x, y);
  const cv = document.querySelector(`[data-mode="circuit"] [data-display="${id}"] canvas`);
  const r = cv.getBoundingClientRect();
  const k = cv.width / r.width;
  const px = cv.getContext('2d').getImageData(Math.round((p.x - r.left) * k), Math.round((p.y - r.top) * k), 1, 1).data;
  return [px[0], px[1], px[2]];
}, { i: CIRCUIT, id, x, y });
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 40);
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const colourOf = (page, key) => page.locator(`[data-mode="circuit"] .ph-swatch[data-color="${key}"]`)
  .evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));

const rad = (deg) => (deg * Math.PI) / 180;
const rect = (A, phi) => [A * Math.cos(rad(phi)), A * Math.sin(rad(phi))];

test('the Circuit tab loads with its Controls shown and unlocked, and two Displays', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab', { name: 'Circuit' })).toHaveAttribute('aria-selected', 'true');
  const out = await page.evaluate(async (i) => {
    const inst = window.toolHost.instances[i];
    const ids = inst.controls.ids();
    return {
      ids,
      open: ids.every((id) => !inst.controls.get(id).isLocked() && !inst.controls.get(id).isHidden()),
      shots: await Promise.all(inst.displays.map(async (d) => [d.id, await d.snapshot()])),
    };
  }, CIRCUIT);
  // the shared time Controls keep the Sum Mode's ids
  for (const id of ['omega', 'play', 't', 'cursor', 'includeR', 'includeL', 'includeC', 'V0', 'R', 'L', 'C',
    'vin', 'I', 'VR', 'VL', 'VC']) expect(out.ids, id).toContain(id);
  expect(out.open).toBe(true);
  expect(out.shots.map(([id]) => id)).toEqual(['phasor', 'time']);
  for (const [, png] of out.shots) expect(png).toMatch(/^data:image\/png;base64,/);
  for (const name of ['V₀ (V)', 'R (Ω)', 'L (mH)', 'C (µF)', 'ω (rad/s)']) await expect(box(page, name)).toBeEditable();
});

test('State publishes the Controls and the solved circuit, every key with a label and unit', async ({ page }) => {
  await open(page);
  const { s, info } = await page.evaluate((i) => {
    const inst = window.toolHost.instances[i];
    return { s: inst.state.snapshot(), info: inst.state.describe() };
  }, CIRCUIT);
  expect(s).toMatchObject({ mode: 'circuit', includeR: true, includeL: true, includeC: true,
    V0: 5, R: 100, L: 50, C: 2, omega: 1000, t: 0, playing: false, omegaMin: 1000, omegaMax: 1000 });
  expect(s.ZtotRe).toBeCloseTo(100, 9);
  expect(s.ZtotIm).toBeCloseTo(-450, 9);
  expect(s.ZtotMag).toBeCloseTo(Math.hypot(100, 450), 9);
  expect(s.angleZ).toBeCloseTo(-77.4712, 3);
  expect(s.Imag).toBeCloseTo(5 / Math.hypot(100, 450), 12);
  expect(s.angleI).toBeCloseTo(77.4712, 3);
  expect(s.VRmag).toBeCloseTo(500 / Math.hypot(100, 450), 9);
  expect(s.angleVR).toBeCloseTo(77.4712, 3);
  expect(s.VLmag).toBeCloseTo(250 / Math.hypot(100, 450), 9);
  expect(s.angleVL).toBeCloseTo(167.4712, 3);
  expect(s.VCmag).toBeCloseTo(2500 / Math.hypot(100, 450), 9);
  expect(s.angleVC).toBeCloseTo(-12.5288, 3);
  expect(s.omega0).toBeCloseTo(1 / Math.sqrt(0.05 * 2e-6), 6);
  expect(s.omegaC).toBeNull(); // L is on
  expect(info.L.unit).toBe('mH');
  expect(info.C.unit).toBe('µF');
  expect(info.R.unit).toBe('Ω');
  expect(info.ZtotMag.unit).toBe('Ω');
  expect(info.angleZ.unit).toBe('°');
  expect(info.Imag.unit).toBe('A');
  expect(info.VCmag.unit).toBe('V');
  expect(info.omega0.unit).toBe('rad/s');
  for (const k of Object.keys(s)) expect(info[k], k).toBeTruthy();
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});

test('readouts show each impedance in both forms, and ω₀ or ω_c where they apply', async ({ page }) => {
  await open(page);
  await expect(readout(page, 'Z_R rectangular')).toHaveText('100.00 + j0.00 Ω');
  await expect(readout(page, 'Z_L rectangular')).toHaveText('0.00 + j50.00 Ω');
  await expect(readout(page, 'Z_C rectangular')).toHaveText('0.00 − j500.00 Ω');
  await expect(readout(page, 'Z_C polar')).toHaveText('500.00∠−90.0° Ω');
  await expect(readout(page, 'Z_total rectangular')).toHaveText('100.00 − j450.00 Ω');
  await expect(readout(page, 'Z_total polar')).toHaveText('460.98∠−77.5° Ω');
  await expect(readout(page, 'I')).toHaveText('10.85∠77.5° mA');
  await expect(readout(page, 'ω₀')).toHaveText('3162 rad/s');
  await expect(readout(page, 'ω_c')).toBeHidden();
  // R and C without L: the RC corner instead of the resonance
  await include(page, 'L').uncheck();
  await expect(readout(page, 'ω_c')).toHaveText('5000 rad/s');
  await expect(readout(page, 'ω₀')).toBeHidden();
  await expect(readout(page, 'Z_L rectangular')).toBeHidden();
  await expect(readout(page, 'Z_total rectangular')).toHaveText('100.00 − j500.00 Ω');
});

test('moving ω changes the readouts', async ({ page }) => {
  await open(page);
  await enter(page, 'ω (rad/s)', 2000);
  await expect(readout(page, 'Z_L rectangular')).toHaveText('0.00 + j100.00 Ω');
  await expect(readout(page, 'Z_C rectangular')).toHaveText('0.00 − j250.00 Ω');
  await expect(readout(page, 'Z_total rectangular')).toHaveText('100.00 − j150.00 Ω');
  await expect(readout(page, 'f')).toHaveText('318.3 Hz');
  const s = await state(page);
  expect(s.omega).toBe(2000);
  expect(s.ZtotIm).toBeCloseTo(-150, 9);
  // the swept range, for sweep Conditions
  expect(s).toMatchObject({ omegaMin: 1000, omegaMax: 2000 });
});

test('toggling L or C adds or removes its phasor and its trace', async ({ page }) => {
  await open(page);
  await settle(page);
  const s = await state(page);
  const red = await colourOf(page, 'L'); const gold = await colourOf(page, 'C');
  // head to tail: V_R from the origin, V_L from V_R's tip, V_C from there to V_in
  const vr = rect(s.VRmag, s.angleVR); const vl = rect(s.VLmag, s.angleVL); const vc = rect(s.VCmag, s.angleVC);
  const vlMid = [vr[0] + vl[0] / 2, vr[1] + vl[1] / 2];
  const vcMid = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L drawn').toBe(true);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C drawn').toBe(true);
  // v_L(t) at its crest, where the other traces are well away from it
  const crestL = -rad(s.angleVL) / s.omega;
  expect(near(await colourAt(page, 'time', crestL, s.VLmag), red), 'v_L(t) drawn').toBe(true);

  await include(page, 'L').uncheck();
  await settle(page);
  expect((await state(page)).VLmag).toBeNull();
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L gone').toBe(false);
  expect(near(await colourAt(page, 'time', crestL, s.VLmag), red), 'v_L(t) gone').toBe(false);
  await include(page, 'L').check();
  await settle(page);
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L back').toBe(true);

  await include(page, 'C').uncheck();
  await settle(page);
  const rl = await state(page);
  expect(rl).toMatchObject({ includeC: false, VCmag: null, angleVC: null });
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C gone').toBe(false);
  // R and L alone still close on V_in
  const a = rect(rl.VRmag, rl.angleVR); const b = rect(rl.VLmag, rl.angleVL);
  expect(a[0] + b[0]).toBeCloseTo(5, 9);
  expect(a[1] + b[1]).toBeCloseTo(0, 9);
});

test('a trace toggle hides that quantity on the phasor plane and the time plot', async ({ page }) => {
  await open(page);
  await settle(page);
  const s = await state(page);
  const gold = await colourOf(page, 'C');
  const vr = rect(s.VRmag, s.angleVR); const vl = rect(s.VLmag, s.angleVL); const vc = rect(s.VCmag, s.angleVC);
  const vcMid = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  const crestC = -rad(s.angleVC) / s.omega;
  await panel(page).getByRole('checkbox', { name: 'Show V_C', exact: true }).uncheck();
  await settle(page);
  expect((await state(page)).showVC).toBe(false);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C hidden on the plane').toBe(false);
  expect(near(await colourAt(page, 'time', crestC, s.VCmag), gold), 'v_C(t) hidden').toBe(false);
});

test('at least one element stays in the loop', async ({ page }) => {
  await open(page);
  await include(page, 'L').uncheck();
  await include(page, 'C').uncheck();
  await include(page, 'R').click(); // the last element on: the click is refused
  await expect(include(page, 'R')).toBeChecked();
  expect(await state(page)).toMatchObject({ includeR: true, includeL: false, includeC: false });
  const viaApi = await page.evaluate((i) => {
    const c = window.toolHost.instances[i].controls.get('includeR');
    c.set(false);
    return c.get();
  }, CIRCUIT);
  expect(viaApi).toBe(true);
});

test('play, the scrubber and the time cursor work in the Circuit Mode', async ({ page }) => {
  await open(page);
  const play = panel(page).getByRole('button', { name: 'Play' });
  await play.click();
  await expect.poll(async () => (await state(page)).t).toBeGreaterThan(0);
  await play.click();
  expect((await state(page)).playing).toBe(false);
  await enter(page, 'ωt (°)', 90);
  expect((await state(page)).t).toBeCloseTo(Math.PI / 2 / 1000, 9);
  await expect(panel(page).getByRole('slider', { name: 'Time cursor' })).toHaveAttribute('aria-valuenow', '90');
  // the rotated V_in = 5∠90° now points straight up
  await settle(page);
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('[data-mode="circuit"] .ph-swatch[data-color="vin"]')).backgroundColor);
  const vin = ink.match(/\d+/g).slice(0, 3).map(Number);
  expect(near(await colourAt(page, 'phasor', 0, 4), vin), 'V_in rotated to 90°').toBe(true);
});

test('serialize and restore round-trip the Controls, ignoring bad values and clamping out-of-range ones', async ({ page }) => {
  await open(page);
  const out = await page.evaluate((i) => {
    const inst = window.toolHost.instances[i];
    let fired = 0;
    inst.state.onChange(() => { fired += 1; });
    inst.restore({ includeR: true, includeL: false, includeC: 'yes', V0: 'nope', R: 1e9, L: 20, C: 0.5,
      omega: 50, t: 'later', showVR: false });
    return { s: inst.state.snapshot(), saved: inst.serialize(), fired };
  }, CIRCUIT);
  expect(out.fired).toBe(1);
  expect(out.s).toMatchObject({ includeR: true, includeL: false, includeC: true, V0: 5, R: 1e4, L: 20, C: 0.5,
    omega: 100, t: 0, showVR: false });
  expect(out.saved).toMatchObject({ includeR: true, includeL: false, includeC: true, V0: 5, R: 1e4, L: 20,
    C: 0.5, omega: 100, t: 0, showVR: false });
});

test('the Circuit Mode mounts several times on one page, and destroy cancels play', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/phasors/phasors.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'circuit', { R: 200 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'circuit', { includeL: false });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('V0').set(2);
    const r = { a: a.state.snapshot(), b: b.state.snapshot() };
    a.controls.get('play').set(true);
    a.destroy();
    let aChanges = 0;
    a.state.onChange(() => { aChanges += 1; });
    await new Promise((res) => setTimeout(res, 300));
    b.destroy();
    return { ...r, aChanges, bChanges };
  });
  expect(out.a).toMatchObject({ R: 200, V0: 2, includeL: true });
  expect(out.b).toMatchObject({ R: 100, V0: 5, includeL: false });
  expect(out.aChanges).toBe(0);
  expect(out.bChanges).toBe(0);
});
