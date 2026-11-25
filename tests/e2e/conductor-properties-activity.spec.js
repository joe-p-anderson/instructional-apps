import { test, expect } from '@playwright/test';

const PAGE = '/tools/electrostatics/activities/conductor-properties.html';
const VIEWER = '/framework/v1/report-viewer/index.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });

async function setNumber(scope, name, value) {
  const box = scope.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

test('the name gate blocks the Parts until a name is entered; then the three Parts are tabs', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();
  await enterName(page);
  await expect(page.getByRole('tab', { name: /Part 1: Electric Field/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Part 2: Potential/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 3: Gauss/ })).toBeVisible();

  // Every Control of every Mode is open.
  for (const id of ['electric-field', 'potential', 'gauss']) {
    const exposure = await page.evaluate((partId) => {
      const { controls } = window.activityHost.instances[partId];
      return controls.ids().map((c) => controls.get(c)).filter((c) => c.isHidden() || c.isLocked()).map((c) => c.id);
    }, id);
    expect(exposure, id).toEqual([]);
  }

  await page.getByRole('tab', { name: /Part 2/ }).click();
  await expect(part(page, 2).getByRole('checkbox', { name: 'Lock to surface' })).toBeVisible();
  await expect(part(page, 2).getByRole('region', { name: 'Task 2.1' })).toContainText('Try measuring the potential inside the conductor.');
});

test('a Task passes only on a Submit at the target, and its Hint appears after 3 misses', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const card = p1.getByRole('region', { name: 'Task 1.1' });
  const submit = p1.getByRole('button', { name: 'Submit Task 1.1' });

  // Passing through a nonzero E₀ and back to zero without Submitting does not pass.
  await setNumber(p1, 'E₀x', 400);
  await setNumber(p1, 'E₀x', 0);
  await expect(card).toHaveAttribute('data-status', 'open');
  await submit.click();
  await expect(p1.getByRole('status', { name: 'Task 1.1 feedback' })).toContainText('need > 0');
  await expect(card).toHaveAttribute('data-status', 'open');
  await submit.click();
  await expect(p1.getByText(/Hint:/)).toBeHidden();
  await submit.click();
  await expect(p1.getByText(/Hint:/)).toBeVisible();
  await expect(card).toContainText('Drag the E₀ joystick away from its centre');

  await card.getByRole('textbox', { name: /electric field in the bulk/ }).fill('If E ≠ 0 the charges would move.');
  await setNumber(p1, 'E₀x', 400);
  await submit.click();
  await expect(card).toHaveAttribute('data-status', 'passed');
  await expect(p1.getByRole('region', { name: 'Task 1.2' })).toHaveAttribute('data-status', 'open');
});

test('a reload restores progress and answers, and the Report opens in the Report Viewer', async ({ page }) => {
  await open(page);
  await enterName(page);
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const p2 = part(page, 2);
  // Task 2.1: measure at infinity, with P1 moved inside the conductor.
  await page.evaluate(() => window.activityHost.instances.potential.controls.get('P1').set({ x: 1, y: 1 }));
  await p2.getByRole('checkbox', { name: 'Measure at infinity' }).check();
  const answer = p2.getByRole('textbox', { name: /potential field inside a conductor/ });
  await answer.fill('V is constant: E = 0 inside.');
  await p2.getByRole('button', { name: 'Submit Task 2.1' }).click();
  await expect(p2.getByRole('region', { name: 'Task 2.1' })).toHaveAttribute('data-status', 'passed');

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const again = part(page, 2);
  await expect(again.getByRole('region', { name: 'Task 2.1' })).toHaveAttribute('data-status', 'passed');
  await expect(again.getByRole('region', { name: 'Task 2.2' })).toHaveAttribute('data-status', 'open');
  await expect(again.getByRole('textbox', { name: /potential field inside a conductor/ })).toHaveValue('V is constant: E = 0 inside.');
  await expect(again.getByRole('checkbox', { name: 'Measure at infinity' })).toBeChecked();

  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Report' }).click(),
  ]);
  const reportPath = await file.path();
  await page.goto(VIEWER);
  await page.getByLabel('Open a Report').setInputFiles(reportPath);
  const view = page.getByRole('article', { name: 'Report' });
  await expect(view).toContainText('Conductor Properties');
  await expect(view).toContainText('PHY 4300');
  await expect(view).toContainText('Ada Lovelace');
  await expect(view.getByRole('heading', { name: 'Part 3: Gauss’s Law' })).toBeVisible();
  const task = view.getByRole('region', { name: /Task 2\.1/ });
  await expect(task).toHaveAttribute('data-status', 'passed');
  await expect(task).toContainText('V is constant: E = 0 inside.');
  await expect(view).toContainText(/2\s*\/\s*12|2 of 12/);
});
