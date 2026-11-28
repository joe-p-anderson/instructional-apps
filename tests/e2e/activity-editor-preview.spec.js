// The Activity editor's preview (ticket 14): the unsaved Activity in the real runner, started at
// any Task, as a throwaway Run that leaves browser storage alone.
import { test, expect } from '@playwright/test';
import { openEditor, openActivity, outline, liveTool } from './helpers/activity-editor.js';

const FOURIER = 'Frequency Domain: Fourier Series';
const launcher = (page) => page.getByRole('group', { name: 'Preview the unsaved Activity' });

// A student's saved Run of the Fourier Activity, and their name, as another tab would leave them.
const STUDENT_RUN = JSON.stringify({ activity: { id: 'fourier-series', version: 1 }, run: { name: 'Ada', fingerprint: 'f', startedAt: '2026-01-01T00:00:00.000Z' }, parts: {} });
async function seedStudent(page) {
  await page.evaluate((run) => {
    localStorage.setItem('fw1:run:fourier-series', run);
    localStorage.setItem('fw1:name', '"Ada"');
  }, STUDENT_RUN);
}
const storageOf = (page) => page.evaluate(() => ({
  local: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
  session: sessionStorage.length,
}));

// Wait for the Tool to arrive (it redraws the page, the open launcher included) before using it.
const toolLoaded = (page) => expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();

async function startAt(page, part, task) {
  await toolLoaded(page);
  await page.getByRole('button', { name: 'Preview ▾' }).click();
  await launcher(page).getByRole('combobox', { name: 'Start at Part' }).selectOption({ index: part - 1 });
  await launcher(page).getByRole('combobox', { name: 'Start at Task' }).selectOption({ index: task - 1 });
}

test('journey: preview the unsaved Activity in a new tab at Part 2, Task 3, Submit there, and no Run is saved', async ({ page }) => {
  await openEditor(page);
  await seedStudent(page);
  const before = await storageOf(page);
  await openActivity(page, FOURIER);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Fourier, unsaved');

  await startAt(page, 2, 3);
  const [preview] = await Promise.all([
    page.waitForEvent('popup'),
    launcher(page).getByRole('button', { name: 'In a new tab' }).click(),
  ]);
  await preview.waitForFunction(() => window.activityHost?.runner?.run);

  // The editor's current Activity, under the preview id, with no name gate.
  await expect(preview.getByRole('note', { name: 'Preview' })).toBeVisible();
  await expect(preview.locator('.fw-title')).toHaveText('Fourier, unsaved');
  expect(await preview.evaluate(() => window.activityHost.runner.save().activity.id)).toBe('fourier-series~preview');

  // Part 2 is open, its first two Tasks (and all of Part 1) passed, Task 2.3 open.
  const part2 = preview.getByRole('tabpanel', { name: /Part 2/ });
  await expect(part2).toBeVisible();
  for (const n of ['2.1', '2.2']) await expect(part2.getByRole('region', { name: `Task ${n}` })).toHaveAttribute('data-status', 'passed');
  const task = part2.getByRole('region', { name: 'Task 2.3' });
  await expect(task).toHaveAttribute('data-status', 'open');
  const statuses = await preview.evaluate(() => window.activityHost.runner.parts().map((p) => p.tasks.map((t) => t.status)));
  expect(statuses[0].every((s) => s === 'passed')).toBe(true);

  await task.getByRole('button', { name: 'Submit Task 2.3' }).click();
  await expect(task.getByRole('status', { name: 'Task 2.3 feedback' })).not.toBeEmpty();
  expect((await preview.evaluate(() => window.activityHost.runner.task(
    window.activityHost.runner.parts()[1].id, window.activityHost.runner.parts()[1].tasks[2].id).attempts.length))).toBe(1);

  // Nothing written: localStorage is exactly as the student left it, sessionStorage empty.
  expect(await storageOf(preview)).toEqual(before);
  expect(await storageOf(page)).toEqual(before);
});

test('Preview here opens the pane at the chosen Task, and Close leaves the editor as it was', async ({ page }) => {
  await openEditor(page);
  const before = await storageOf(page);
  await openActivity(page, FOURIER);
  // The launcher follows the selected Task.
  await toolLoaded(page);
  await outline(page).getByRole('button', { name: /^2\.2\s/ }).click();
  await page.getByRole('button', { name: 'Preview ▾' }).click();
  await expect(launcher(page).getByRole('combobox', { name: 'Start at Part' })).toHaveValue('1');
  await expect(launcher(page).getByRole('combobox', { name: 'Start at Task' })).toHaveValue('1');
  await launcher(page).getByRole('button', { name: 'Preview here' }).click();

  const pane = page.getByRole('dialog', { name: 'Preview' });
  await expect(pane).toBeVisible();
  const frame = page.frameLocator('iframe[title="Preview"]');
  const task = frame.getByRole('tabpanel', { name: /Part 2/ }).getByRole('region', { name: 'Task 2.2' });
  await expect(task).toHaveAttribute('data-status', 'open');
  await task.getByRole('button', { name: 'Submit Task 2.2' }).click();
  await expect(task.getByRole('status', { name: 'Task 2.2 feedback' })).not.toBeEmpty();

  await pane.getByRole('button', { name: 'Close preview' }).click();
  await expect(pane).toBeHidden();
  await expect(outline(page)).toBeVisible();
  expect(await storageOf(page)).toEqual(before);
});

test('with a problem the runner would reject, the preview refuses to start and says why', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, FOURIER);
  await toolLoaded(page);
  await page.getByRole('textbox', { name: 'Version' }).fill('');
  await page.getByRole('button', { name: 'Preview ▾' }).click();
  await expect(launcher(page).getByRole('alert')).toHaveText(/Can't start: the runner would reject the Activity\. Activity: missing version/);
  await expect(launcher(page).getByRole('button', { name: 'Preview here' })).toBeDisabled();
  await expect(launcher(page).getByRole('button', { name: 'In a new tab' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Preview ▾' })).toHaveAttribute('title', /can't start: missing version/);

  // Fixing it lets the preview start (the open launcher follows the edit).
  await page.getByRole('textbox', { name: 'Version' }).fill('1');
  await expect(launcher(page)).toBeVisible();
  await expect(launcher(page).getByRole('alert')).toHaveCount(0);
  await expect(launcher(page).getByRole('button', { name: 'Preview here' })).toBeEnabled();
});

test('an Activity page ignores the preview page\'s query and starts a student at Task 1', async ({ page }) => {
  await page.goto('/tools/fourier/activities/fourier-series.html?run=1&start=2.3');
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => window.activityHost?.runner?.run);
  const statuses = await page.evaluate(() => window.activityHost.runner.parts().map((p) => p.tasks.map((t) => t.status)));
  expect(statuses.flat().filter((s) => s === 'passed')).toEqual([]);
});

test('the preview page opened on its own has nothing to preview', async ({ page }) => {
  await page.goto('/framework/v1/authoring/preview.html?run=1');
  await expect(page.getByRole('alert')).toHaveText(/open the preview from the Activity editor/);
});
