import { test, expect } from '@playwright/test';
import { copyShareLink } from './helpers/share-link.js';

// Standalone smoke test of the electrostatics Tool's potential Mode (the second tab).
const PAGE = '/tools/electrostatics/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
  await page.getByRole('tab', { name: 'Potential' }).click();
  await expect(page.getByRole('tab', { name: 'Potential' })).toHaveAttribute('aria-selected', 'true');
}

// window.potential: the potential Mode's instance, on every page load.
const definePotential = () => Object.defineProperty(window, 'potential', {
  get: () => window.toolHost?.instances[window.toolHost.modes.findIndex((m) => m.id === 'potential')],
});
test.beforeEach(({ page }) => page.addInitScript(definePotential));

const snapshot = (page) => page.evaluate(() => window.potential.state.snapshot());

async function setNumber(page, name, value) {
  const box = page.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

/** Screen position of plot point (x, y) cm, once the plot has its size. */
async function screenAt(page, x, y) {
  await page.waitForFunction(() => window.potential.displays[0].toScreen(0, 0));
  return page.evaluate(([px, py]) => window.potential.displays[0].toScreen(px, py), [x, y]);
}

async function drag(page, from, to) {
  const a = await screenAt(page, ...from);
  const b = await screenAt(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('the Potential tab has every Control shown and unlocked, with the old defaults', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('slider', { name: 'Q (nC)', exact: true })).toBeEnabled();
  await expect(page.getByRole('spinbutton', { name: 'Q (nC)', exact: true })).toHaveValue('1.0');
  await expect(page.getByRole('checkbox', { name: 'Lock to surface' })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'Measure at infinity' })).toBeEnabled();

  const controls = await page.evaluate(() => { const i = window.potential; return i.controls.ids().map((id) =>
    ({ id, value: i.controls.get(id).get(), locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() })); });
  expect(controls.map((c) => c.id).sort()).toEqual(['P1', 'P2', 'Q', 'lockToSurface', 'measureAtInfinity']);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
  const value = Object.fromEntries(controls.map((c) => [c.id, c.value]));
  expect(value).toEqual({ Q: 1, P1: { x: -6, y: -6 }, P2: { x: 7, y: 7 }, lockToSurface: false, measureAtInfinity: false });
});

test('the State carries every value with a label and unit', async ({ page }) => {
  await open(page);
  const { state, info } = await page.evaluate(() => ({ state: window.potential.state.snapshot(), info: window.potential.state.describe() }));
  expect(Object.keys(state).sort()).toEqual(
    ['Q', 'V1', 'V2', 'dV', 'lockToSurface', 'measureAtInfinity', 'r1', 'r2', 'x1', 'x2', 'y1', 'y2']);
  for (const k of Object.keys(state)) {
    expect(typeof info[k].label, k).toBe('string');
    expect(typeof info[k].unit, k).toBe('string');
  }
  expect(info.V1.unit).toBe('V');
  expect(info.r1.unit).toBe('cm');
  expect(state).toMatchObject({ Q: 1, x1: -6, y1: -6, x2: 7, y2: 7, lockToSurface: false, measureAtInfinity: false });
  expect(state.dV).toBeCloseTo(15.15, 2);
  await expect(page.getByRole('status', { name: 'ΔV' })).toContainText('15.2 V');
});

test('dragging P1 into the conductor updates the State; P2 follows when dragged too', async ({ page }) => {
  await open(page);
  await drag(page, [-6, -6], [-1, -2]);
  let s = await snapshot(page);
  expect(s.r1).toBeLessThan(5);
  expect(s.V1).toBeCloseTo(180, 6);

  await drag(page, [7, 7], [2, 1]);
  s = await snapshot(page);
  expect(s.r2).toBeLessThan(5);
  expect(s.dV).toBeCloseTo(0, 9);

  await page.evaluate(() => window.potential.controls.get('P2').lock());
  const before = await snapshot(page);
  await drag(page, [before.x2, before.y2], [8, 8]);
  s = await snapshot(page);
  expect([s.x2, s.y2]).toEqual([before.x2, before.y2]);
});

test('lock to surface and measure at infinity are never on together', async ({ page }) => {
  await open(page);
  const lock = page.getByRole('checkbox', { name: 'Lock to surface' });
  const inf = page.getByRole('checkbox', { name: 'Measure at infinity' });

  await lock.check();
  await expect(inf).toBeDisabled();
  let s = await snapshot(page);
  expect(s).toMatchObject({ lockToSurface: true, measureAtInfinity: false });
  expect(s.r1).toBeCloseTo(5, 9);
  expect(s.r2).toBeCloseTo(5, 9);

  await lock.uncheck();
  await inf.check();
  await expect(lock).toBeDisabled();
  s = await snapshot(page);
  expect(s).toMatchObject({ lockToSurface: false, measureAtInfinity: true, V2: 0 });
  await expect(page.getByRole('status', { name: 'P2 position' })).toHaveText('∞');

  // An Activity's set on the other toggle switches this one off, unless this one is locked.
  await page.evaluate(() => window.potential.controls.get('lockToSurface').set(true));
  expect(await snapshot(page)).toMatchObject({ lockToSurface: true, measureAtInfinity: false });
  const locked = await page.evaluate(() => {
    const i = window.potential;
    i.controls.get('lockToSurface').lock();
    i.controls.get('measureAtInfinity').set(true);
    return i.state.snapshot();
  });
  expect(locked).toMatchObject({ lockToSurface: true, measureAtInfinity: false });
  await expect(inf).toBeDisabled();
  await expect(inf).not.toBeChecked();
  // Unlocking the other toggle keeps this one disabled while lock to surface is on.
  await page.evaluate(() => window.potential.controls.get('measureAtInfinity').unlock());
  await expect(inf).toBeDisabled();
});

test('a reload and a share link restore the same setup', async ({ page, browser }) => {
  await open(page);
  await setNumber(page, 'Q (nC)', -2.4);
  await drag(page, [-6, -6], [3, -8]);
  await page.getByRole('checkbox', { name: 'Measure at infinity' }).check();
  const want = await snapshot(page);
  expect(want).toMatchObject({ Q: -2.4, measureAtInfinity: true });

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toEqual(want);

  await page.getByRole('tab', { name: 'Potential' }).click();
  const url = await copyShareLink(page);
  expect(url).toMatch(/#s=/);
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await theirs.addInitScript(definePotential);
  await theirs.goto(url);
  await theirs.waitForFunction(() => window.toolHost);
  await expect(theirs.getByRole('tab', { name: 'Potential' })).toHaveAttribute('aria-selected', 'true');
  expect(await snapshot(theirs)).toEqual(want);
  await other.close();
});

test('the Display gives a PNG snapshot', async ({ page }) => {
  await open(page);
  const png = await page.evaluate(() => window.potential.displays[0].snapshot());
  expect(png).toMatch(/^data:image\/png;base64,/);
});
