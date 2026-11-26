import { test, expect } from '@playwright/test';

const PAGE = '/tools/least-squares/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}
const instance = (page, fn, arg) => page.evaluate(([src, a]) => {
  // eslint-disable-next-line no-new-func
  return new Function('i', 'a', src)(window.toolHost.instances[0], a);
}, [fn, arg]);
const snapshot = (page) => instance(page, 'return i.state.snapshot();');
const serialized = (page) => instance(page, 'return JSON.parse(JSON.stringify(i.serialize()));');

test('Standalone mode shows the fit Mode with every Control unlocked', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tab').first()).toHaveText('Fit');

  for (const name of ['Dataset', 'y-axis', 'x-axis', 'View']) {
    await expect(page.getByRole('combobox', { name, exact: true })).toBeEnabled();
  }
  for (const name of ['New data', 'Reset data', 'Optimize', 'Copy CSV', 'Check your g']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  }
  for (const name of ['Show residuals', 'Edit points', 'Through origin (b = 0)']) {
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeEnabled();
  }

  const controls = await instance(page, `return i.controls.ids().map((id) => i.controls.get(id))
    .map((c) => ({ id: c.id, locked: c.isLocked(), hidden: c.isHidden() }));`);
  expect(controls.map((c) => c.id).sort()).toEqual([
    'check', 'copy-csv', 'dataset', 'edit-points', 'line', 'new-data', 'optimize', 'points',
    'reset-data', 'show-residuals', 'through-origin', 'view', 'x-transform', 'y-transform',
  ]);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every State value has a label and a unit; displays give PNG snapshots', async ({ page }) => {
  await open(page);
  const { state, info, pngs } = await instance(page, `return (async () => ({
    state: i.state.snapshot(), info: i.state.describe(),
    pngs: await Promise.all(i.displays.map((d) => d.snapshot())) }))();`);
  for (const k of ['dataset', 'seed', 'xT', 'yT', 'm', 'b', 'SSE', 'SST', 'R2', 'ratio', 'hits', 'n',
    'mOLS', 'bOLS', 'm0', 'linear']) expect(state, k).toHaveProperty(k);
  expect(state).toMatchObject({ dataset: 'pendulum', seed: 0, xT: 'id', yT: 'id', linear: false, n: 11 });
  for (const k of Object.keys(state)) {
    expect(info[k], k).toBeDefined();
    expect(typeof info[k].label, k).toBe('string');
    expect(typeof info[k].unit, k).toBe('string');
  }
  expect(pngs).toHaveLength(3);
  for (const p of pngs) expect(p).toMatch(/^data:image\/png;base64,/);
});

test('linearizing axes publish the implied g', async ({ page }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'y-axis', exact: true }).selectOption({ label: 'T²' });
  const s = await snapshot(page);
  expect(s.linear).toBe(true);
  expect(s.g).toBeGreaterThan(9.81 * 0.95);
  expect(s.g).toBeLessThan(9.81 * 1.05);
  await page.getByRole('button', { name: 'Check your g' }).click();
  await expect(page.locator('.ls-big')).toHaveText(/^g = (9\.[5-9]\d\d|10\.[0-4]\d) m\/s²$/);
});

test('dragging the (m, b) handle updates the State', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.toolHost.instances[0].displays[2].toScreen(0, 0));
  const { from, to, target } = await instance(page, `
    const s = i.state.snapshot(), plane = i.displays[2];
    const target = { m: s.mOLS, b: s.bOLS };
    return { from: plane.toScreen(s.m, s.b), to: plane.toScreen(target.m, target.b), target };`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const s = await snapshot(page);
  const tol = (v) => Math.abs(v) * 0.05 + 0.02;
  expect(Math.abs(s.m - target.m)).toBeLessThan(tol(target.m));
  expect(Math.abs(s.b - target.b)).toBeLessThan(tol(target.b));
  expect(s.R2).toBeGreaterThan(0.95);
});

test('a reload and a share link restore the same data, edited points and line', async ({ page, context }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'Dataset', exact: true }).selectOption('ohm');
  await page.getByRole('button', { name: 'New data', exact: true }).click();
  await page.getByRole('button', { name: 'New data', exact: true }).click();
  await page.getByRole('combobox', { name: 'x-axis', exact: true }).selectOption({ label: 'V²' });
  await page.getByRole('combobox', { name: 'x-axis', exact: true }).selectOption({ label: 'V' });

  // Edit a point by dragging it upwards on the scatter.
  await page.getByRole('checkbox', { name: 'Edit points', exact: true }).check();
  await page.waitForFunction(() => window.toolHost.instances[0].displays[0].toScreen(0, 0));
  const before = await instance(page, 'return i.controls.get("points").get();');
  const p = await instance(page, `const ys = i.controls.get("points").get();
    return { at: i.displays[0].toScreen(5, ys[4]), up: i.displays[0].toScreen(5, ys[4] + 6) };`);
  await page.mouse.move(p.at.x, p.at.y);
  await page.mouse.down();
  await page.mouse.move(p.up.x, p.up.y, { steps: 5 });
  await page.mouse.up();
  const edited = await instance(page, 'return i.controls.get("points").get();');
  expect(edited[4]).toBeGreaterThan(before[4] + 4);
  expect(edited.filter((y, k) => y !== before[k])).toHaveLength(1);

  await instance(page, 'i.controls.get("line").set({ m: 4.1, b: 1.2 }); i.controls.get("check").set(true);');
  const state = await snapshot(page);
  const saved = await serialized(page);
  expect(state).toMatchObject({ dataset: 'ohm', seed: 2, m: 4.1, b: 1.2, checked: true, edited: true });
  expect(saved).toMatchObject({ dataset: 'ohm', seed: 2, m: 4.1, b: 1.2, checked: true });

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toEqual(state);
  expect(await instance(page, 'return i.controls.get("points").get();')).toEqual(edited);

  const link = await page.evaluate(() => window.toolHost.shareLink());
  const fresh = await context.browser().newContext();
  const other = await fresh.newPage();
  await open(other, link);
  expect(await snapshot(other)).toEqual(state);
  expect(await instance(other, 'return i.controls.get("points").get();')).toEqual(edited);
  await fresh.close();
});

test('the handle\'s starting line is drawn from the seed: the whole class starts in the same place', async ({ page, context }) => {
  await open(page);
  const a = await snapshot(page);
  const fresh = await context.browser().newContext();
  const other = await fresh.newPage();
  await open(other);
  const b = await snapshot(other);
  expect([b.m, b.b]).toEqual([a.m, a.b]);
  await fresh.close();
});

// The Display never scrolls inside itself: the Fit panel stays on screen while you fit.
const displayArea = (page) => page.locator('.fw-displays');
const scrollsInside = (page) => displayArea(page).evaluate((e) => e.scrollHeight > e.clientHeight);

test('at 1366×768 the Fit panel\'s R² is on screen without scrolling, with residuals off and on', async ({ page }) => {
  await open(page);
  const r2 = page.getByRole('status', { name: 'R²', exact: true });
  for (const on of [false, true]) {
    await page.getByRole('checkbox', { name: 'Show residuals', exact: true }).setChecked(on);
    expect(await scrollsInside(page), `residuals ${on ? 'on' : 'off'}`).toBe(false);
    await expect(r2).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('SSE', { exact: true })).toBeInViewport({ ratio: 1 });
  }
});

test('with residuals off no residual frame is shown; with them on the residual plot is', async ({ page }) => {
  await open(page);
  const plot = page.getByRole('img', { name: 'Residuals', exact: true });
  await expect(plot).toBeHidden();
  await expect(page.getByText(/^Residuals\s+y − \(m x \+ b\)$/)).toBeHidden();
  await page.getByRole('checkbox', { name: 'Show residuals', exact: true }).check();
  await expect(plot).toBeVisible();
  await page.getByRole('checkbox', { name: 'Show residuals', exact: true }).uncheck();
  await expect(plot).toBeHidden();
});

test('the residual-pattern guide is a collapsed note that opens and closes', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Show residuals', exact: true }).check();
  const guide = page.getByText(/^Random scatter about 0/);
  const toggle = page.getByText('Reading the residuals', { exact: true });
  await expect(toggle).toBeVisible();
  await expect(guide).toBeHidden();
  await toggle.click();
  await expect(guide).toBeVisible();
  await toggle.click();
  await expect(guide).toBeHidden();
});
