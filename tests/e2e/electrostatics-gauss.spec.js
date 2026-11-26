import { test, expect } from '@playwright/test';

// Standalone smoke test of the electrostatics Tool's Gauss's-law Mode (third tab).

const PAGE = '/tools/electrostatics/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
  await page.getByRole('tab', { name: 'Gauss’s law' }).click();
  await page.waitForFunction(() => {
    const h = window.toolHost;
    const i = h.instances[h.modes.findIndex((m) => m.id === 'gauss')];
    return i && i.displays[0].toScreen(0, 0);
  });
}

const inGauss = (fn) => `(() => { const h = window.toolHost;
  const i = h.instances[h.modes.findIndex((m) => m.id === 'gauss')]; return (${fn})(i); })()`;
const snapshot = (page) => page.evaluate(inGauss('(i) => i.state.snapshot()'));
const toScreen = (page, x, y) => page.evaluate(inGauss(`(i) => i.displays[0].toScreen(${x}, ${y})`));
const panel = (page) => page.getByRole('tabpanel', { name: 'Gauss’s law' });

async function drag(page, from, to) {
  const a = await toScreen(page, ...from);
  const b = await toScreen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('the Tool shows a third tab, Gauss’s law, with every Control shown and unlocked', async ({ page }) => {
  await open(page);
  const tabs = page.getByRole('tab');
  await expect(tabs.last()).toHaveText('Gauss’s law');
  await expect(page.getByRole('tab', { name: 'Gauss’s law' })).toHaveAttribute('aria-selected', 'true');

  const lambda = panel(page).getByRole('slider', { name: 'λ', exact: true });
  await expect(lambda).toHaveAttribute('min', '-1');
  await expect(lambda).toHaveAttribute('max', '1');
  await expect(lambda).toHaveAttribute('step', '0.05');
  await expect(panel(page).getByRole('spinbutton', { name: 'λ', exact: true })).toHaveValue('1.00');
  await expect(panel(page).getByLabel('E₀ joystick')).toBeVisible();
  for (const name of ['E₀x', 'E₀y']) await expect(panel(page).getByRole('spinbutton', { name, exact: true })).toBeEnabled();

  const controls = await page.evaluate(inGauss(`(i) => i.controls.ids().map((id) => ({ id,
    locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }))`));
  expect(controls.map((c) => c.id).sort()).toEqual(['E0', 'center', 'lambda', 'radius']);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
});

test('the State carries every value with a label and unit', async ({ page }) => {
  await open(page);
  const { state, info } = await page.evaluate(inGauss('(i) => ({ state: i.state.snapshot(), info: i.state.describe() })'));
  expect(state).toEqual({ lambda: 1, E0x: 0, E0y: 0, xc: 0, yc: 0, r: 2, dist: 0, outer: 2, inner: -2, Qenc: 0 });
  for (const k of Object.keys(state)) {
    expect(typeof info[k].label, k).toBe('string');
    expect(typeof info[k].unit, k).toBe('string');
  }
  expect(info.lambda.unit).toBe('nC/m');
  expect(info.Qenc.unit).toBe('nC/m');
  expect(info.r.unit).toBe('cm');
  await expect(page.getByRole('status', { name: 'Q_enc' })).toContainText('0.000 nC/m');
});

test('dragging the surface across the edge encloses charge, and the radius handle resizes it', async ({ page }) => {
  await open(page);
  await drag(page, [0, 0], [5, 0]);
  let s = await snapshot(page);
  expect(s.xc).toBeCloseTo(5, 0);
  expect(Math.abs(s.yc)).toBeLessThan(0.3);
  expect(s.outer).toBeGreaterThan(5);
  expect(s.inner).toBeLessThan(5);
  expect(s.Qenc).toBeGreaterThan(0.1);
  await expect(page.getByRole('status', { name: 'Q_enc' })).not.toContainText('0.000');

  // The radius handle starts on +x of the centre: drag it out to 9 cm, then far in (r ≥ 0.3).
  await drag(page, [s.xc + s.r, s.yc], [9, 0]);
  s = await snapshot(page);
  expect(s.r).toBeCloseTo(9 - s.xc, 0);
  await drag(page, [s.xc + s.r, s.yc], [s.xc, s.yc + 0.05]);
  s = await snapshot(page);
  expect(s.r).toBeCloseTo(0.3, 5);

  // Locked, the centre stays put.
  await page.evaluate(inGauss("(i) => i.controls.get('center').lock()"));
  await drag(page, [s.xc, s.yc], [-6, 3]);
  expect((await snapshot(page)).xc).toBeCloseTo(s.xc, 9);
});

test('a reload restores the setup, and the Display gives a PNG snapshot', async ({ page }) => {
  await open(page);
  await page.evaluate(inGauss(`(i) => { i.controls.get('lambda').set(-0.5); i.controls.get('E0').set({ x: 300, y: -400 });
    i.controls.get('center').set({ x: 3, y: 4 }); i.controls.get('radius').set(1.5); }`));
  const want = await snapshot(page);
  expect(want).toMatchObject({ lambda: -0.5, E0x: 300, E0y: -400, xc: 3, yc: 4, r: 1.5, dist: 5, outer: 6.5, inner: 3.5 });

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toEqual(want);

  const png = await page.evaluate(inGauss('(i) => i.displays[0].snapshot()'));
  expect(png).toMatch(/^data:image\/png;base64,/);
});

test('the E₀ joystick moves with the arrow keys here too', async ({ page }) => {
  await open(page);
  const stick = panel(page).getByRole('group', { name: 'E₀ joystick' });
  await stick.focus();
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await snapshot(page)).toMatchObject({ E0x: 0, E0y: 200 });
  await expect(panel(page).getByRole('spinbutton', { name: 'E₀y', exact: true })).toHaveValue('200');
});
