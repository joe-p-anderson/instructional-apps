import { test, expect } from '@playwright/test';

// Per-Tool panel layouts (side, strip, banner): the frame applies the Tool's layout in the
// Activity runner and in Standalone mode. tests/e2e/fixtures/layouts.html mounts the
// oscilloscope under any layout; the real pages show the oscilloscope's own (side).

const LAYOUTS = ['side', 'strip', 'banner'];
const fixture = (layout, page = 'activity') => `/tests/e2e/fixtures/layouts.html?layout=${layout}&page=${page}`;

async function openActivity(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
}

async function openStandalone(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const box = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

async function setNumber(scope, name, value) {
  const field = scope.getByRole('spinbutton', { name, exact: true });
  await field.fill(String(value));
  await field.press('Enter');
}

test('the oscilloscope declares the side layout, on its Activity and Standalone pages', async ({ page }) => {
  await openActivity(page, '/tools/oscilloscope/activities/phase-period-amplitude.html');
  await expect(page.locator('.fw-app')).toHaveClass(/\bfw-layout-side\b/);
  await openStandalone(page, '/tools/oscilloscope/');
  await expect(page.locator('.fw-app')).toHaveClass(/\bfw-layout-side\b/);
});

for (const layout of LAYOUTS) {
  test(`${layout}: the page fits 1366×768 with no page scroll and the current Task's Submit in view`, async ({ page }) => {
    await openActivity(page, fixture(layout));
    await expect(page.locator('.fw-app')).toHaveClass(new RegExp(`\\bfw-layout-${layout}\\b`));
    const noPageScroll = () => page.evaluate(() => {
      const s = document.scrollingElement;
      return s.scrollHeight <= innerHeight && s.scrollWidth <= innerWidth;
    });

    // Part 1 with the Hint showing, then Part 1's next Task, then Part 2.
    const p1 = part(page, 1);
    const submit11 = p1.getByRole('button', { name: 'Submit Task 1.1' });
    for (let i = 0; i < 3; i++) await submit11.click();
    await expect(p1.getByText(/Hint:/)).toBeVisible();
    expect(await noPageScroll()).toBe(true);
    await expect(submit11).toBeInViewport({ ratio: 1 });

    await setNumber(p1, 'Δt', 0.5);
    await submit11.click();
    await expect(p1.getByRole('button', { name: 'Submit Task 1.2' })).toBeInViewport({ ratio: 1 });

    await page.getByRole('tab', { name: /Part 2/ }).click();
    expect(await noPageScroll()).toBe(true);
    await expect(part(page, 2).getByRole('button', { name: 'Submit Task 2.1' })).toBeInViewport({ ratio: 1 });
  });
}

const display = (scope) => scope.locator('.fw-displays');
const controls = (scope) => scope.locator('.fw-controls');
const tasks = (scope) => scope.locator('.fw-part-tasks');
const card = (scope, n) => scope.getByRole('region', { name: `Task ${n}` });
const BLUE = 'rgb(27, 79, 138)';

test('side: Tasks in a 330 px column right of the Display; finished Tasks show title and result, locked ones one line why', async ({ page }) => {
  await openActivity(page, fixture('side'));
  const p1 = part(page, 1);
  const d = await box(display(p1));
  const t = await box(tasks(p1));
  expect(t.width).toBe(330);
  expect(t.left).toBeGreaterThanOrEqual(d.right);
  expect(t.top).toBeLessThanOrEqual(d.top);
  expect((await box(controls(p1))).right).toBeLessThanOrEqual(d.left);

  // The current Task is outlined in blue; the others are not.
  await expect(card(p1, '1.1')).toHaveCSS('border-top-color', BLUE);
  await expect(card(p1, '1.1')).toHaveCSS('border-top-style', 'solid');
  await expect(card(p1, '1.2')).not.toHaveCSS('border-top-color', BLUE);

  // Locked: the title and one line saying why, nothing else.
  const locked = card(p1, '1.3');
  await expect(locked.getByText('Locked until Task 1.2 is done')).toBeVisible();
  await expect(locked.locator('.fw-task-prompt')).toBeHidden();
  await expect(locked.locator('.fw-question')).toBeHidden();
  await expect(locked.getByRole('button', { name: 'Submit Task 1.3' })).toBeHidden();
  const note = await locked.locator('.fw-task-locked').evaluate((e) => [e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).lineHeight) || 20]);
  expect(note[0]).toBeLessThan(note[1] * 1.5);

  // Finished: the title and the result only.
  await setNumber(p1, 'Δt', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  const done = card(p1, '1.1');
  await expect(done).toHaveAttribute('data-status', 'passed');
  await expect(done.getByRole('status', { name: 'Task 1.1 feedback' })).toBeVisible();
  await expect(done.locator('.fw-task-prompt')).toBeHidden();
  await expect(card(p1, '1.2')).toHaveCSS('border-top-color', BLUE);
});

test('strip: Tasks in a row across the bottom, under Controls | Display', async ({ page }) => {
  await openActivity(page, fixture('strip'));
  const p1 = part(page, 1);
  const d = await box(display(p1));
  expect((await box(controls(p1))).right).toBeLessThanOrEqual(d.left);
  expect((await box(tasks(p1))).top).toBeGreaterThanOrEqual(d.bottom);
  const [a, b] = [await box(card(p1, '1.1')), await box(card(p1, '1.2'))];
  expect(b.top).toBe(a.top);
  expect(b.left).toBeGreaterThanOrEqual(a.right);
});

/** Full-width Display with the Controls' sections side by side below it. */
async function expectBannerTool(scope) {
  const panel = await box(scope);
  const d = await box(display(scope));
  expect(d.width).toBeGreaterThan(panel.width - 40);
  const c = await box(controls(scope));
  expect(c.top).toBeGreaterThanOrEqual(d.bottom);
  const sections = await scope.locator('.fw-controls > .fw-section').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right };
  }));
  expect(sections.length).toBeGreaterThan(1);
  for (let i = 1; i < sections.length; i++) {
    expect(sections[i].top).toBe(sections[0].top);
    expect(sections[i].left).toBeGreaterThanOrEqual(sections[i - 1].right - 1);
  }
}

test('banner: the current Task is a banner above a full-width Display; the others are compact steps', async ({ page }) => {
  await openActivity(page, fixture('banner'));
  const p1 = part(page, 1);
  await expectBannerTool(p1);
  expect((await box(tasks(p1))).bottom).toBeLessThanOrEqual((await box(display(p1))).top);

  const current = await box(card(p1, '1.1'));
  for (const n of ['1.2', '1.3']) {
    const step = card(p1, n);
    expect((await box(step)).width).toBeLessThan(current.width);
    expect((await box(step)).top).toBe(current.top);
    await expect(step.locator('.fw-task-prompt')).toBeHidden();
    await expect(step.locator('.fw-question')).toBeHidden();
  }
  await expect(card(p1, '1.1').locator('.fw-task-prompt')).toBeVisible();

  // Passing Task 1.1 makes Task 1.2 the banner.
  await setNumber(p1, 'Δt', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(card(p1, '1.2').locator('.fw-task-prompt')).toBeVisible();
  await expect(card(p1, '1.1').locator('.fw-task-prompt')).toBeHidden();
});

test('banner in Standalone mode: full-width Display with the Controls in a strip below', async ({ page }) => {
  await openStandalone(page, fixture('banner', 'standalone'));
  await expect(page.locator('.fw-app')).toHaveClass(/\bfw-layout-banner\b/);
  await expectBannerTool(page.getByRole('tabpanel'));
  expect(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight)).toBe(true);
});

test('side in Standalone mode: Controls | Display, as before', async ({ page }) => {
  await openStandalone(page, fixture('side', 'standalone'));
  const panel = page.getByRole('tabpanel');
  const d = await box(display(panel));
  expect((await box(controls(panel))).right).toBeLessThanOrEqual(d.left);
  expect(d.right).toBeGreaterThan((await box(panel)).right - 40);
});

for (const layout of LAYOUTS) {
  test(`${layout}: each Part tab shows a progress badge, filled when the Part is complete`, async ({ page }) => {
    await openActivity(page, fixture(layout));
    const tab1 = page.getByRole('tab', { name: /Part 1/ });
    const badge1 = tab1.locator('.fw-tab-badge');
    await expect(badge1).toHaveText('0/3');
    await expect(page.getByRole('tab', { name: /Part 2/ }).locator('.fw-tab-badge')).toHaveText(/^0\/\d+$/);
    const empty = await badge1.evaluate((e) => getComputedStyle(e).backgroundColor);

    const p1 = part(page, 1);
    await setNumber(p1, 'Δt', 0.5);
    await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
    await expect(badge1).toHaveText('1/3');
    await expect(badge1).toHaveCSS('background-color', empty);

    await setNumber(p1, 'f', 0.25);
    await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
    await p1.getByRole('textbox', { name: /difficult to measure/ }).fill('The traces must be lined up by eye.');
    await p1.getByRole('button', { name: 'Submit Task 1.3' }).click();
    await expect(badge1).toHaveText('3/3');
    await expect(badge1).toHaveCSS('background-color', 'rgb(42, 110, 42)');
  });
}
