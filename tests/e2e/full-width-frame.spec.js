import { test, expect } from '@playwright/test';

// The full-width frame (shell revision 14): the page frame fills the window, the Controls and
// Tasks keep their fixed widths at its edges, and the Display takes the rest up to the Tool's
// maxDisplayWidth, past which it centres in its region. The 1366×768 fit is in layouts.spec.js.

const WIDE = { width: 1920, height: 1080 };
const ACTIVITIES = [
  '/tools/oscilloscope/activities/phase-period-amplitude.html',
  '/tools/electrostatics/activities/conductor-properties.html',
  '/tools/spacetime/activities/lab10.html',
];
const STANDALONE = ['oscilloscope', 'electrostatics', 'spacetime', 'bench-scope', 'least-squares', 'vernier']
  .map((tool) => `/tools/${tool}/`);
const LAYOUTS = ['side', 'strip', 'banner'];
const fixture = (layout, { page = 'activity', max } = {}) =>
  `/tests/e2e/fixtures/layouts.html?layout=${layout}&page=${page}${max ? `&max=${max}` : ''}`;

async function openActivity(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.activityHost);
  // The name is stored site-wide (shell revision 06): after the first Activity the gate is skipped.
  const name = page.getByRole('textbox', { name: 'Your name' });
  const tabs = page.getByRole('tablist');
  await expect(name.or(tabs)).toBeVisible();
  if (await name.isVisible()) {
    await name.fill('Ada Lovelace');
    await page.getByRole('button', { name: 'Start' }).click();
  }
  await expect(tabs).toBeVisible();
}

async function openStandalone(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}

const box = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { left: r.left, right: r.right, width: r.width };
});
const shown = (page, selector) => page.locator(`.fw-tabpanel:not([hidden]) ${selector}`).first();

/** The Display's region: the Tool's area beside the Controls (side, strip) or all of it (banner). */
async function region(page, layout) {
  const tool = await box(shown(page, '.fw-tool'));
  const left = layout === 'banner' ? tool.left : (await box(shown(page, '.fw-controls'))).right;
  return { left, right: tool.right, width: tool.right - left };
}

/** Frame and header span the viewport. */
async function expectFullWidth(page, what) {
  const app = await box(page.locator('.fw-app'));
  expect(app.left, `${what}: frame left`).toBe(0);
  expect(app.right, `${what}: frame right`).toBe(WIDE.width);
  const header = await box(page.locator('.fw-header'));
  expect(header.left, `${what}: header left`).toBeLessThanOrEqual(1);
  expect(header.right, `${what}: header right`).toBeGreaterThanOrEqual(WIDE.width - 1);
}

test('at 1920×1080 every Activity and Standalone page spans the viewport, header row included', async ({ page }) => {
  await page.setViewportSize(WIDE);
  for (const url of ACTIVITIES) {
    await openActivity(page, url);
    await expectFullWidth(page, url);
  }
  for (const url of STANDALONE) {
    await openStandalone(page, url);
    await expectFullWidth(page, url);
  }
});

test('side at 1920×1080: the Controls are at the left edge and the Tasks at the right', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openActivity(page, fixture('side'));
  const controls = await box(shown(page, '.fw-controls'));
  const tasks = await box(shown(page, '.fw-part-tasks'));
  expect(controls.left).toBeLessThanOrEqual(1);
  expect(tasks.right).toBeGreaterThanOrEqual(WIDE.width - 1);
  expect(tasks.width).toBe(330);
});

for (const layout of LAYOUTS) {
  test(`${layout}: a Tool with a maxDisplayWidth has a Display no wider, centred in its region`, async ({ page }) => {
    await page.setViewportSize(WIDE);
    await openActivity(page, fixture(layout, { max: 900 }));
    const d = await box(shown(page, '.fw-displays'));
    const r = await region(page, layout);
    expect(r.width).toBeGreaterThan(900);
    expect(d.width).toBeLessThanOrEqual(900);
    expect(d.width).toBeGreaterThan(899);
    expect(Math.abs((d.left - r.left) - (r.right - d.right))).toBeLessThanOrEqual(1);
  });

  test(`${layout}: a Tool without a maxDisplayWidth has a Display that fills its region`, async ({ page }) => {
    await page.setViewportSize(WIDE);
    await openActivity(page, fixture(layout));
    const d = await box(shown(page, '.fw-displays'));
    const r = await region(page, layout);
    expect(Math.abs(d.left - r.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.right - r.right)).toBeLessThanOrEqual(1);
  });
}

test('in Standalone mode a maxDisplayWidth centres the Display too', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openStandalone(page, fixture('side', { page: 'standalone', max: 900 }));
  const d = await box(shown(page, '.fw-displays'));
  const r = await region(page, 'side');
  expect(d.width).toBeLessThanOrEqual(900);
  expect(Math.abs((d.left - r.left) - (r.right - d.right))).toBeLessThanOrEqual(1);
});
