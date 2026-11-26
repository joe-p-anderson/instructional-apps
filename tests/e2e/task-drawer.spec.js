import { test, expect } from '@playwright/test';

// The Task drawer: the narrow form of the `side` layout. When the Tasks column would leave the
// Display narrower than the Tool's minDisplayWidth (default 480 px), the frame moves the Tasks
// into a bar above the Display that opens into a drawer over it.

const ACTIVITIES = [
  { name: 'oscilloscope', url: '/tools/oscilloscope/activities/phase-period-amplitude.html' },
  { name: 'Conductor Properties', url: '/tools/electrostatics/activities/conductor-properties.html' },
  { name: 'spacetime Lab 10', url: '/tools/spacetime/activities/lab10.html' },
];
const OSCILLOSCOPE = ACTIVITIES[0].url;
const PORTRAIT = { width: 768, height: 1024 };
const LAPTOP = { width: 1366, height: 768 };

async function openActivity(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const bar = (scope) => scope.locator('.fw-drawer-bar');
const toggle = (scope) => bar(scope).locator('.fw-drawer-toggle');
const box = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

async function setNumber(scope, name, value) {
  const field = scope.getByRole('spinbutton', { name, exact: true });
  await field.fill(String(value));
  await field.press('Enter');
}

for (const { name, url } of ACTIVITIES) {
  test(`768×1024, ${name}: the Task drawer bar is shown and the Display keeps the Tool's minimum width`, async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await openActivity(page, url);
    const p1 = part(page, 1);
    await expect(page.locator('.fw-app')).toHaveAttribute('data-side-form', 'drawer');
    await expect(bar(p1)).toBeVisible();
    await expect(bar(p1)).toContainText('Task 1.1');
    await expect(p1.locator('.fw-tasks')).toBeHidden();
    const min = await page.evaluate(() => window.activityHost.tool.minDisplayWidth);
    expect((await box(p1.locator('.fw-displays'))).width).toBeGreaterThanOrEqual(min);
    // The Part tab badges carry progress.
    await expect(page.getByRole('tab', { name: /Part 1/ }).locator('.fw-tab-badge')).toBeVisible();
    // No page scroll sideways.
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('1366×768: the side Tasks column is shown as before', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await openActivity(page, OSCILLOSCOPE);
  const p1 = part(page, 1);
  await expect(page.locator('.fw-app')).toHaveAttribute('data-side-form', 'column');
  await expect(bar(p1)).toBeHidden();
  expect((await box(p1.locator('.fw-part-tasks'))).width).toBe(330);
  await expect(p1.getByRole('region', { name: 'Task 1.2' })).toBeVisible();
});

test('Submit from the closed bar passes a Condition-only Task, and the bar moves on to the next Task', async ({ page }) => {
  await page.setViewportSize(PORTRAIT);
  await openActivity(page, OSCILLOSCOPE);
  const p1 = part(page, 1);
  const submit = bar(p1).getByRole('button', { name: 'Submit Task 1.1' });

  await submit.click();
  await expect(bar(p1).getByRole('status', { name: 'Task 1.1 feedback' })).toContainText('✗');
  await expect(toggle(p1)).toHaveAttribute('aria-expanded', 'false');

  await setNumber(p1, 'Δt (s)', 0.5);
  await submit.click();
  await expect(p1.locator('[data-task="phase-pi-2"]')).toHaveAttribute('data-status', 'passed');
  await expect(toggle(p1)).toContainText('Task 1.2');
  await expect(bar(p1).getByRole('button', { name: 'Submit Task 1.2' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAccessibleName(/1 of 3 Tasks done/);
});

test('a Task with Questions opens, is answered and submitted; opening leaves the Display box unchanged', async ({ page }) => {
  await page.setViewportSize(PORTRAIT);
  await openActivity(page, OSCILLOSCOPE);
  const p1 = part(page, 1);
  // Pass Tasks 1.1 and 1.2 to reach Task 1.3, which has a Question.
  await setNumber(p1, 'Δt (s)', 0.5);
  await bar(p1).getByRole('button', { name: 'Submit Task 1.1' }).click();
  await setNumber(p1, 'f (Hz)', 0.25);
  await bar(p1).getByRole('button', { name: 'Submit Task 1.2' }).click();
  await expect(toggle(p1)).toContainText('Task 1.3');
  await expect(bar(p1)).toContainText('Open to answer');
  await expect(bar(p1).getByRole('button', { name: 'Submit Task 1.3' })).toBeHidden();

  const before = await box(p1.locator('.fw-displays'));
  await toggle(p1).click();
  await expect(toggle(p1)).toHaveAttribute('aria-expanded', 'true');
  const drawer = p1.getByRole('region', { name: 'Task 1.3' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toBeFocused();
  // Only the current Task is shown.
  await expect(p1.getByRole('region', { name: 'Task 1.2' })).toBeHidden();
  expect(await box(p1.locator('.fw-displays'))).toEqual(before);
  // The drawer lies over the right part of the Display.
  const d = await box(drawer);
  expect(d.left).toBeGreaterThan(before.left);
  expect(d.top).toBeGreaterThanOrEqual(before.top);

  await drawer.getByRole('textbox').fill('The traces have to be lined up by eye.');
  await bar(p1).getByRole('button', { name: 'Submit Task 1.3' }).click();
  await expect(p1.locator('[data-task="phase-question"]')).toHaveAttribute('data-status', 'passed');
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAccessibleName(/3 of 3 Tasks done/);
});

test('the drawer closes with Escape or the toggle (focus back on the toggle), or a click on the Display', async ({ page }) => {
  await page.setViewportSize(PORTRAIT);
  await openActivity(page, OSCILLOSCOPE);
  const p1 = part(page, 1);
  const drawer = p1.getByRole('region', { name: 'Task 1.1' });
  await expect(toggle(p1)).toHaveAccessibleName(/Task 1\.1/);

  await toggle(p1).click();
  await expect(drawer).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(toggle(p1)).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(p1)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(drawer).toBeVisible();
  await toggle(p1).click();
  await expect(drawer).toBeHidden();
  await expect(toggle(p1)).toBeFocused();

  await toggle(p1).click();
  await expect(drawer).toBeVisible();
  const d = await box(p1.locator('.fw-displays'));
  await page.mouse.click(d.left + 20, d.top + 60);
  await expect(drawer).toBeHidden();
  await expect(toggle(p1)).toHaveAttribute('aria-expanded', 'false');
});

test('resizing from 1366 to 768 and back keeps a typed Question answer and the Part\'s State', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await openActivity(page, OSCILLOSCOPE);
  const p1 = part(page, 1);
  await setNumber(p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await setNumber(p1, 'f (Hz)', 0.25);
  await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
  const answer = p1.getByRole('region', { name: 'Task 1.3' }).getByRole('textbox');
  await answer.fill('Lining traces up by eye');
  await page.evaluate(() => { window.mountedInstance = window.activityHost.instances.phase; });

  await page.setViewportSize(PORTRAIT);
  await expect(page.locator('.fw-app')).toHaveAttribute('data-side-form', 'drawer');
  // A typed answer counts as opened: Submit is offered from the bar.
  await expect(bar(p1).getByRole('button', { name: 'Submit Task 1.3' })).toBeVisible();
  await toggle(p1).click();
  await expect(answer).toHaveValue('Lining traces up by eye');
  await page.keyboard.press('Escape');

  await page.setViewportSize(LAPTOP);
  await expect(page.locator('.fw-app')).toHaveAttribute('data-side-form', 'column');
  await expect(answer).toHaveValue('Lining traces up by eye');
  await expect(p1.getByRole('region', { name: 'Task 1.2' })).toHaveAttribute('data-status', 'passed');
  const state = await page.evaluate(() => ({
    same: window.mountedInstance === window.activityHost.instances.phase,
    snapshot: window.activityHost.instances.phase.state.snapshot(),
  }));
  expect(state.same).toBe(true);
  expect(state.snapshot).toMatchObject({ Dt: 0.5, f: 0.25 });
});
