import { test, expect } from '@playwright/test';
import { installCanvasTextRecorder, displayTexts } from './helpers/display-text.js';

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

test('the Circuit tab loads with its Controls shown and unlocked, and four Displays', async ({ page }) => {
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
    'vin', 'I', 'VR', 'VL', 'VC', 'Ztotal', 'kvl']) expect(out.ids, id).toContain(id);
  expect(out.open).toBe(true);
  expect(out.shots.map(([id]) => id)).toEqual(['impedance', 'phasor', 'time', 'schematic']);
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
  expect(s.IMag).toBeCloseTo(5 / Math.hypot(100, 450), 12);
  expect(s.angleI).toBeCloseTo(77.4712, 3);
  expect(s.VRMag).toBeCloseTo(500 / Math.hypot(100, 450), 9);
  expect(s.angleVR).toBeCloseTo(77.4712, 3);
  expect(s.VLMag).toBeCloseTo(250 / Math.hypot(100, 450), 9);
  expect(s.angleVL).toBeCloseTo(167.4712, 3);
  expect(s.VCMag).toBeCloseTo(2500 / Math.hypot(100, 450), 9);
  expect(s.angleVC).toBeCloseTo(-12.5288, 3);
  expect(s.omega0).toBeCloseTo(1 / Math.sqrt(0.05 * 2e-6), 6);
  expect(s.omegaC).toBeNull(); // L is on
  expect(info.L.unit).toBe('mH');
  expect(info.C.unit).toBe('µF');
  expect(info.R.unit).toBe('Ω');
  expect(info.ZtotMag.unit).toBe('Ω');
  expect(info.angleZ.unit).toBe('°');
  expect(info.IMag.unit).toBe('A');
  expect(info.VCMag.unit).toBe('V');
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
  await expect(readout(page, 'I polar')).toHaveText('10.85∠77.5° mA');
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
  const vr = rect(s.VRMag, s.angleVR); const vl = rect(s.VLMag, s.angleVL); const vc = rect(s.VCMag, s.angleVC);
  const vlMid = [vr[0] + vl[0] / 2, vr[1] + vl[1] / 2];
  const vcMid = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L drawn').toBe(true);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C drawn').toBe(true);
  // v_L(t) at its crest, where the other traces are well away from it
  const crestL = -rad(s.angleVL) / s.omega;
  expect(near(await colourAt(page, 'time', crestL, s.VLMag), red), 'v_L(t) drawn').toBe(true);

  await include(page, 'L').uncheck();
  await settle(page);
  expect((await state(page)).VLMag).toBeNull();
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L gone').toBe(false);
  expect(near(await colourAt(page, 'time', crestL, s.VLMag), red), 'v_L(t) gone').toBe(false);
  await include(page, 'L').check();
  await settle(page);
  expect(near(await colourAt(page, 'phasor', ...vlMid), red), 'V_L back').toBe(true);

  await include(page, 'C').uncheck();
  await settle(page);
  const rl = await state(page);
  expect(rl).toMatchObject({ includeC: false, VCMag: null, angleVC: null });
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C gone').toBe(false);
  // R and L alone still close on V_in
  const a = rect(rl.VRMag, rl.angleVR); const b = rect(rl.VLMag, rl.angleVL);
  expect(a[0] + b[0]).toBeCloseTo(5, 9);
  expect(a[1] + b[1]).toBeCloseTo(0, 9);
});

// The impedance plane at the defaults: Z_R from 0 to 100, Z_L up to 100 + j50, Z_C down to 100 − j450.
const schematic = (page) => panel(page).locator('[data-display="schematic"]').getByRole('img');

test('toggling an element updates the schematic and the impedance plane', async ({ page }) => {
  await open(page);
  await settle(page);
  await expect(schematic(page)).toHaveAccessibleName('Series loop: the source, R, L and C');
  const red = await colourOf(page, 'L'); const gold = await colourOf(page, 'C');
  expect(near(await colourAt(page, 'impedance', 100, -300), gold), 'Z_C drawn').toBe(true);
  await include(page, 'C').uncheck();
  await settle(page);
  await expect(schematic(page)).toHaveAccessibleName('Series loop: the source, R and L');
  expect(near(await colourAt(page, 'impedance', 100, -300), gold), 'Z_C gone').toBe(false);
  expect(near(await colourAt(page, 'impedance', 100, 30), red), 'Z_L drawn').toBe(true);
  await include(page, 'L').uncheck();
  await settle(page);
  await expect(schematic(page)).toHaveAccessibleName('Series loop: the source, R');
  expect(near(await colourAt(page, 'impedance', 100, 30), red), 'Z_L gone').toBe(false);
  await include(page, 'C').check();
  await settle(page);
  await expect(schematic(page)).toHaveAccessibleName('Series loop: the source, R and C');
  expect(near(await colourAt(page, 'impedance', 100, -300), gold), 'Z_C back').toBe(true);
});

test('raising ω lengthens Z_L and shortens Z_C on the impedance plane', async ({ page }) => {
  await open(page);
  await settle(page);
  const red = await colourOf(page, 'L'); const gold = await colourOf(page, 'C');
  // ω = 1000: Z_L = j50 stops below j90, and Z_C = −j500 reaches down past −j300
  expect(near(await colourAt(page, 'impedance', 100, 90), red)).toBe(false);
  expect(near(await colourAt(page, 'impedance', 100, -300), gold)).toBe(true);
  await enter(page, 'ω (rad/s)', 2000);
  await settle(page);
  // ω = 2000: Z_L = j100, and Z_C = −j250 runs from j100 down to −j150
  expect(near(await colourAt(page, 'impedance', 100, 90), red)).toBe(true);
  expect(near(await colourAt(page, 'impedance', 100, -300), gold)).toBe(false);
});

test('the impedance plane scales to fit the whole chain, with its axes in Ω, kΩ or MΩ', async ({ page }) => {
  await installCanvasTextRecorder(page);
  await open(page);
  const fits = () => page.evaluate((i) => {
    const inst = window.toolHost.instances[i];
    const s = inst.state.snapshot();
    const d = inst.displays.find((e) => e.id === 'impedance');
    const r = document.querySelector('[data-mode="circuit"] [data-display="impedance"] canvas').getBoundingClientRect();
    const inside = (p) => p && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    // the chain's corners: Z_R, then up by Z_L, then Z_total
    const ZL = s.includeL ? s.omega * s.L * 1e-3 : 0;
    const R = s.includeR ? s.R : 0;
    const total = d.toScreen(s.ZtotRe, s.ZtotIm);
    const o = d.toScreen(0, 0);
    return { fits: [d.toScreen(R, 0), d.toScreen(R, ZL), total].every(inside),
      // Z_total is no shorter than a quarter of the plane's height
      big: Math.hypot(total.x - o.x, total.y - o.y) > r.height / 8 };
  }, CIRCUIT);
  await settle(page);
  expect(await fits()).toEqual({ fits: true, big: true });
  expect((await displayTexts(page)).map((t) => t.text)).toContain('Re (Ω)');
  await enter(page, 'L (mH)', 1000);
  await enter(page, 'ω (rad/s)', 100000);
  await settle(page);
  expect(await fits()).toEqual({ fits: true, big: true });
  expect((await displayTexts(page)).map((t) => t.text)).toContain('Im (kΩ)');
  await enter(page, 'ω (rad/s)', 100);
  await settle(page);
  expect(await fits()).toEqual({ fits: true, big: true });
});

// In an Activity the four Displays fit the side layout in both its forms: beside the Tasks column
// at 1366×768, and under the Task drawer bar (open, with its form) on a narrower screen.
for (const { name, size, form } of [
  { name: '1366×768, Tasks column', size: { width: 1366, height: 768 }, form: 'column' },
  { name: '1024×768, Task drawer', size: { width: 1024, height: 768 }, form: 'drawer' },
  { name: '768×1024, Task drawer', size: { width: 768, height: 1024 }, form: 'drawer' },
]) {
  test(`${name}: the four Circuit Displays fit without scrolling, text at 12 px or more`, async ({ page }) => {
    await page.setViewportSize(size);
    await installCanvasTextRecorder(page);
    await page.goto('/tests/e2e/fixtures/phasors-circuit.html');
    await page.waitForFunction(() => window.activityHost);
    await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('.fw-app')).toHaveAttribute('data-side-form', form);
    if (form === 'drawer') {
      await page.getByRole('group', { name: 'Current Task' }).getByRole('button', { name: /^Task 1\.1/ }).click();
      await expect(page.getByRole('region', { name: 'Task 1.1' }).getByRole('textbox')).toBeVisible();
    }
    await settle(page);
    const displays = page.locator('.fw-displays:visible');
    expect(await displays.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0);
    const boxes = await page.locator('[data-mode="circuit"] .fw-display').evaluateAll((els) =>
      els.map((e) => [e.dataset.display, Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]));
    expect(boxes.map(([id]) => id)).toEqual(['impedance', 'phasor', 'time', 'schematic']);
    for (const [id, w, hgt] of boxes) {
      expect(w, `${id} width`).toBeGreaterThanOrEqual(220);
      expect(hgt, `${id} height`).toBeGreaterThanOrEqual(200);
    }
    const small = (await displayTexts(page)).filter((t) => t.px < 12);
    expect(small).toEqual([]);
  });
}

test('a trace toggle hides that quantity on the phasor plane and the time plot', async ({ page }) => {
  await open(page);
  await settle(page);
  const s = await state(page);
  const gold = await colourOf(page, 'C');
  const vr = rect(s.VRMag, s.angleVR); const vl = rect(s.VLMag, s.angleVL); const vc = rect(s.VCMag, s.angleVC);
  const vcMid = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  const crestC = -rad(s.angleVC) / s.omega;
  await panel(page).getByRole('checkbox', { name: 'Show V_C', exact: true }).uncheck();
  await settle(page);
  expect((await state(page)).showVC).toBe(false);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C hidden on the plane').toBe(false);
  expect(near(await colourAt(page, 'time', crestC, s.VCMag), gold), 'v_C(t) hidden').toBe(false);
});

// ── Revealable layers: the Controls an Activity's Task hide/show lists act on ──
const layer = (page, id, how) => page.evaluate(({ i, id, how }) => {
  window.toolHost.instances[i].controls.get(id)[how]();
}, { i: CIRCUIT, id, how });
const texts = async (page) => (await displayTexts(page)).map((t) => t.text);

test('each Mode registers a Control for every one of its revealable layers', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { LAYERS } = await import('/tools/phasors/layers.js');
    const ids = window.toolHost.instances.map((inst) => inst.controls.ids());
    return { LAYERS, ids };
  });
  // Modes are [sum, circuit]
  expect(out.LAYERS.sum.length).toBeGreaterThan(0);
  expect(out.LAYERS.circuit.length).toBeGreaterThan(0);
  for (const id of out.LAYERS.sum) expect(out.ids[0], id).toContain(id);
  for (const id of out.LAYERS.circuit) expect(out.ids[1], id).toContain(id);
});

test('every layer is shown by default in Standalone, each with its toggle', async ({ page }) => {
  await open(page);
  for (const name of ['Show Z_total', 'Show I', 'Show V_R', 'Show V_L', 'Show V_C', 'Show KVL closure']) {
    await expect(panel(page).getByRole('checkbox', { name, exact: true }), name).toBeChecked();
  }
  expect(await state(page)).toMatchObject({ showZtotal: true, showKVL: true });
});

test('hiding Z_total hides its arrow, ∠Z and its readout, but not Z_R, Z_L or Z_C', async ({ page }) => {
  await installCanvasTextRecorder(page);
  await open(page);
  await settle(page);
  const ink = await colourOf(page, 'vin');
  const mid = [50, -225]; // halfway along Z_total = 100 − j450 Ω
  expect(near(await colourAt(page, 'impedance', ...mid), ink), 'Z_total drawn').toBe(true);
  expect(await texts(page)).toContain('∠Z');
  await layer(page, 'Ztotal', 'hide');
  await settle(page);
  await expect(panel(page).getByRole('checkbox', { name: 'Show Z_total', exact: true })).toBeHidden();
  expect(near(await colourAt(page, 'impedance', ...mid), ink), 'Z_total hidden').toBe(false);
  expect(await texts(page)).not.toContain('∠Z');
  await expect(readout(page, 'Z_total rectangular')).toBeHidden();
  await expect(readout(page, 'Z_total polar')).toBeHidden();
  for (const k of ['R', 'L', 'C']) await expect(readout(page, `Z_${k} polar`)).toBeVisible();
  const blue = await colourOf(page, 'R');
  const zr = await Promise.all([20, 40, 60, 80].map((re) => colourAt(page, 'impedance', re, 0)));
  expect(zr.some((c) => near(c, blue)), `Z_R still drawn: ${JSON.stringify(zr)}`).toBe(true);
  await layer(page, 'Ztotal', 'show');
  await settle(page);
  expect(near(await colourAt(page, 'impedance', ...mid), ink), 'Z_total back').toBe(true);
  await expect(readout(page, 'Z_total polar')).toBeVisible();
});

test('hiding I hides I on the phasor plane, i(t) and its axis, the I scale and the I readout', async ({ page }) => {
  await installCanvasTextRecorder(page);
  await open(page);
  await settle(page);
  const s = await state(page);
  const iTexts = (all) => all.filter((t) => t === 'I' || t.startsWith('I scale') || t.startsWith('i ('));
  expect(iTexts(await texts(page)).length).toBeGreaterThanOrEqual(3);
  await layer(page, 'I', 'hide');
  await settle(page);
  expect(iTexts(await texts(page))).toEqual([]);
  await expect(readout(page, 'I polar')).toBeHidden();
  await expect(panel(page).getByRole('checkbox', { name: 'Show I', exact: true })).toBeHidden();
  expect((await state(page)).IMag).toBeCloseTo(s.IMag, 12); // State still publishes it
  await layer(page, 'I', 'show');
  await settle(page);
  expect(iTexts(await texts(page)).length).toBeGreaterThanOrEqual(3);
  await expect(readout(page, 'I polar')).toBeVisible();
});

test('hiding a device voltage hides it on both plots and its readout', async ({ page }) => {
  await open(page);
  await settle(page);
  const s = await state(page);
  const gold = await colourOf(page, 'C');
  const vr = rect(s.VRMag, s.angleVR); const vl = rect(s.VLMag, s.angleVL); const vc = rect(s.VCMag, s.angleVC);
  const vcMid = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  await layer(page, 'VC', 'hide');
  await settle(page);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C hidden on the plane').toBe(false);
  expect(near(await colourAt(page, 'time', -rad(s.angleVC) / s.omega, s.VCMag), gold), 'v_C(t) hidden').toBe(false);
  await expect(readout(page, 'V_C polar')).toBeHidden();
  await layer(page, 'VC', 'show');
  await settle(page);
  expect(near(await colourAt(page, 'phasor', ...vcMid), gold), 'V_C back').toBe(true);
  await expect(readout(page, 'V_C polar')).toBeVisible();
});

test('hiding the KVL closure draws each device voltage from the origin instead of head to tail', async ({ page }) => {
  await open(page);
  await settle(page);
  const s = await state(page);
  const gold = await colourOf(page, 'C');
  const vr = rect(s.VRMag, s.angleVR); const vl = rect(s.VLMag, s.angleVL); const vc = rect(s.VCMag, s.angleVC);
  const chained = [vr[0] + vl[0] + vc[0] / 2, vr[1] + vl[1] + vc[1] / 2];
  const fromOrigin = [vc[0] / 2, vc[1] / 2];
  expect(near(await colourAt(page, 'phasor', ...chained), gold), 'head to tail').toBe(true);
  await layer(page, 'kvl', 'hide');
  await settle(page);
  await expect(panel(page).getByRole('checkbox', { name: 'Show KVL closure', exact: true })).toBeHidden();
  expect(near(await colourAt(page, 'phasor', ...chained), gold), 'no longer head to tail').toBe(false);
  expect(near(await colourAt(page, 'phasor', ...fromOrigin), gold), 'from the origin').toBe(true);
  await layer(page, 'kvl', 'show');
  await panel(page).getByRole('checkbox', { name: 'Show KVL closure', exact: true }).uncheck();
  await settle(page);
  expect((await state(page)).showKVL).toBe(false);
  expect(near(await colourAt(page, 'phasor', ...fromOrigin), gold), 'unticked: from the origin').toBe(true);
});

test('the volt axes never widen for a hidden device voltage', async ({ page }) => {
  await open(page);
  await enter(page, 'R (Ω)', 20);
  await enter(page, 'ω (rad/s)', 3000); // near ω₀ with a small R: |V_L| and |V_C| are several times V₀
  await settle(page);
  // the plot's half-width in V, from where the frame puts 1 V
  const reach = () => page.evaluate(async (i) => {
    await new Promise((r) => requestAnimationFrame(r));
    const d = window.toolHost.instances[i].displays.find((e) => e.id === 'phasor');
    const r = document.querySelector('[data-mode="circuit"] [data-display="phasor"] canvas').getBoundingClientRect();
    const o = d.toScreen(0, 0); const one = d.toScreen(1, 0);
    return (r.right - o.x) / (one.x - o.x);
  }, CIRCUIT);
  const s = await state(page);
  expect(s.VLMag).toBeGreaterThan(2 * s.V0);
  expect(await reach()).toBeGreaterThan(s.VLMag);
  for (const id of ['VR', 'VL', 'VC', 'kvl']) await layer(page, id, 'hide');
  const hidden = await reach();
  expect(hidden).toBeLessThan(s.VLMag);
  expect(hidden).toBeGreaterThan(s.V0);
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

test('the swept ω range survives serialize and restore, and widens with the current ω', async ({ page }) => {
  await open(page);
  const out = await page.evaluate((i) => {
    const inst = window.toolHost.instances[i];
    inst.controls.get('omega').set(300);
    inst.controls.get('omega').set(5000);
    inst.controls.get('omega').set(1000);
    const saved = inst.serialize();
    inst.restore({}); // a fresh range from the current ω
    const reset = inst.state.snapshot();
    inst.restore(saved); // a reload
    const back = inst.state.snapshot();
    inst.restore({ ...saved, omega: 8000 });
    const wider = inst.state.snapshot();
    inst.restore({ ...saved, omegaMin: 'low', omegaMax: true });
    const bad = inst.state.snapshot();
    inst.restore({ ...saved, omegaMin: 1, omegaMax: 1e9 });
    const clamped = inst.state.snapshot();
    return { saved, reset, back, wider, bad, clamped };
  }, CIRCUIT);
  expect(out.saved).toMatchObject({ omegaMin: 300, omegaMax: 5000 });
  expect(out.reset).toMatchObject({ omegaMin: 1000, omegaMax: 1000 });
  expect(out.back).toMatchObject({ omega: 1000, omegaMin: 300, omegaMax: 5000 });
  expect(out.wider).toMatchObject({ omega: 8000, omegaMin: 300, omegaMax: 8000 });
  expect(out.bad).toMatchObject({ omegaMin: 1000, omegaMax: 1000 });
  expect(out.clamped).toMatchObject({ omegaMin: 100, omegaMax: 1e6 });
});

test('every phasor readout shows both a + jb and A∠φ°, and hides with its layer', async ({ page }) => {
  await open(page);
  await expect(readout(page, 'V_in rectangular')).toHaveText('5.00 + j0.00 V');
  await expect(readout(page, 'V_in polar')).toHaveText('5.00∠0.0° V');
  await expect(readout(page, 'I polar')).toHaveText('10.85∠77.5° mA');
  await expect(readout(page, 'I rectangular')).toHaveText('2.35 + j10.59 mA');
  for (const k of ['R', 'L', 'C']) {
    await expect(readout(page, `V_${k} rectangular`)).toBeVisible();
    await expect(readout(page, `V_${k} polar`)).toBeVisible();
  }
  await layer(page, 'VL', 'hide');
  await expect(readout(page, 'V_L rectangular')).toBeHidden();
  await expect(readout(page, 'V_L polar')).toBeHidden();
  await layer(page, 'I', 'hide');
  await expect(readout(page, 'I rectangular')).toBeHidden();
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
