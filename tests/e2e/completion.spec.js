import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readReport } from '../../framework/v1/report.js';

// The completion dialog: shown once, when the last Task of the Activity passes, and the header's
// Download button marked complete from then on (fixture: tests/e2e/fixtures/completion.html).
const PAGE = '/tests/e2e/fixtures/completion.html';

async function start(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const dialog = (page) => page.getByRole('dialog', { name: /Activity complete/ });
const completedButton = (page) => page.getByRole('button', { name: 'Activity complete · Download Report' });

// Pass every Task but the last one (Task 2.2).
async function passAllButLast(page) {
  await part(page, 1).getByRole('button', { name: 'Submit Task 1.1' }).click();
  await page.getByRole('tab', { name: /Part 2/ }).click();
  await part(page, 2).getByRole('button', { name: 'Submit Task 2.1' }).click();
  await expect(part(page, 2).getByRole('region', { name: 'Task 2.1' })).toHaveAttribute('data-status', 'passed');
}

const passLast = (page) => part(page, 2).getByRole('button', { name: 'Submit Task 2.2' }).click();

test('passing the last Task opens the completion dialog, which takes focus and closes with Escape or Close', async ({ page }) => {
  await start(page);
  await passAllButLast(page);
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download Report', exact: true })).toBeVisible();

  await passLast(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('Activity complete · 3 of 3 Tasks');
  await expect(dialog(page)).toContainText('Brightspace');
  expect(await dialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  // Focus is back on the page: the Submit that opened the dialog is gone, so the header's Download.
  await expect(completedButton(page)).toBeFocused();

  // Close works too (reopened by hand here: the page itself shows the dialog only once).
  await page.evaluate(() => document.querySelector('dialog').showModal());
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(dialog(page)).toBeHidden();

  // The Tool stays usable after the dialog closes.
  const f = part(page, 2).getByRole('slider', { name: 'f (Hz)', exact: true });
  const before = await f.inputValue();
  await f.focus();
  await page.keyboard.press('ArrowRight');
  await expect(f).not.toHaveValue(before);
  await expect(completedButton(page)).toBeVisible();
});

test('Download Report in the completion dialog saves the Report', async ({ page }) => {
  await start(page);
  await passAllButLast(page);
  await passLast(page);
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    dialog(page).getByRole('button', { name: 'Download Report' }).click(),
  ]);
  const { report, checksumOk } = readReport(await readFile(await file.path(), 'utf8'));
  expect(checksumOk).toBe(true);
  expect(report.parts.flatMap((p) => p.tasks).every((t) => t.passed)).toBe(true);
  expect(JSON.stringify(report)).not.toMatch(/completionShown/i);
});

test('reloading a completed Run keeps the dialog closed and the header shows the completed label', async ({ page }) => {
  await start(page);
  await passAllButLast(page);
  await passLast(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  await expect(completedButton(page)).toBeVisible();
  await expect(dialog(page)).toBeHidden();

  const [file] = await Promise.all([page.waitForEvent('download'), completedButton(page).click()]);
  expect(readReport(await readFile(await file.path(), 'utf8')).checksumOk).toBe(true);
});
