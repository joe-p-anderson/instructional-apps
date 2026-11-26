import { test, expect } from '@playwright/test';

const PAGE = '/tools/oscilloscope/activities/phase-period-amplitude.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

async function setNumber(scope, name, value) {
  const box = scope.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

/** Start over lives in the header's ⋯ menu. */
async function startOver(page) {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Start over' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const run = (page) => page.evaluate(() => window.activityHost.runner.run);

test('a reload restores progress', async ({ page }) => {
  await open(page);
  await enterName(page);
  const before = await run(page);
  const p1 = part(page, 1);
  await setNumber(p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await setNumber(p1, 'f (Hz)', 0.3);

  await page.reload();
  await page.waitForFunction(() => window.activityHost);

  // No name gate: the same Run carries on where it left off.
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  expect(await run(page)).toEqual(before);
  await expect(page.getByText('Ada Lovelace', { exact: true })).toBeVisible();
  const again = part(page, 1);
  await expect(again.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'passed');
  await expect(again.getByRole('region', { name: 'Task 1.2' })).toHaveAttribute('data-status', 'open');
  await expect(again.getByText('1 of 3 Tasks done')).toBeVisible();
  await expect(again.getByRole('spinbutton', { name: 'Δt (s)', exact: true })).toBeDisabled();
  await expect(again.getByRole('spinbutton', { name: 'f (Hz)', exact: true })).toHaveValue(/^0\.3/);
});

test('Start over, once confirmed, discards the Run and begins a new one under the stored name', async ({ page }) => {
  await open(page);
  await enterName(page, 'Ada Lovelace');
  const first = await run(page);
  const p1 = part(page, 1);
  await setNumber(p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();

  // Dismissing the confirmation keeps the Run.
  page.once('dialog', (d) => d.dismiss());
  await startOver(page);
  await expect(p1.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'passed');
  expect(await run(page)).toEqual(first);

  page.once('dialog', (d) => d.accept());
  await startOver(page);
  // The stored name starts the new Run at once, with no Name gate.
  await page.waitForFunction((fp) => window.activityHost?.runner.run
    && window.activityHost.runner.run.fingerprint !== fp, first.fingerprint);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  const second = await run(page);
  expect(second.name).toBe('Ada Lovelace');
  expect(second.fingerprint).not.toBe(first.fingerprint);
  const fresh = part(page, 1);
  await expect(fresh.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'open');
  await expect(fresh.getByRole('spinbutton', { name: 'Δt (s)', exact: true })).toHaveValue(/^0\.25/);

  // The discarded Run does not come back on reload.
  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  expect((await run(page)).fingerprint).toBe(second.fingerprint);
});

test('a reload restores Question answers, unsubmitted drafts and the last miss feedback', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  await setNumber(p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await setNumber(p1, 'f (Hz)', 0.3);
  await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
  const missFeedback = await p1.getByRole('status', { name: 'Task 1.2 feedback' }).textContent();
  expect(missFeedback).toMatch(/^✗/);

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  const again = part(page, 1);
  await expect(again.getByRole('status', { name: 'Task 1.2 feedback' })).toHaveText(missFeedback);

  await setNumber(again, 'f (Hz)', 0.25);
  await again.getByRole('button', { name: 'Submit Task 1.2' }).click();
  const why = again.getByRole('textbox', { name: /difficult to measure/ });
  await why.fill('The traces are hard to line up.');

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  const third = part(page, 1);
  const draft = third.getByRole('textbox', { name: /difficult to measure/ });
  await expect(draft).toHaveValue('The traces are hard to line up.');
  await draft.fill('The traces are hard to line up exactly.');
  await third.getByRole('button', { name: 'Submit Task 1.3' }).click();

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  const last = part(page, 1);
  await expect(last.getByRole('region', { name: 'Task 1.3' })).toHaveAttribute('data-status', 'passed');
  // A finished Task shows only its title and result in the side layout, but keeps its answer.
  await expect(last.getByRole('textbox', { name: /difficult to measure/, includeHidden: true })).toHaveValue('The traces are hard to line up exactly.');
});