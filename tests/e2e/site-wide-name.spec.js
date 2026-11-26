import { test, expect } from '@playwright/test';

// The student name is stored for the whole site (shell revision 06): the Name gate appears only
// while no name is stored, Start over keeps the name, and "Not <name>? Sign out" in the ⋯ menu
// forgets it. Each test starts with clean storage.

const A = '/tools/oscilloscope/activities/phase-period-amplitude.html';
const B = '/tools/electrostatics/activities/conductor-properties.html';

async function open(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

async function pickMenuItem(page, name) {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

const nameBox = (page) => page.getByRole('textbox', { name: 'Your name' });
const run = (page) => page.evaluate(() => window.activityHost.runner.run);

test('a name entered in one Activity starts the next Activity with no Name gate', async ({ page }) => {
  await open(page, A);
  await enterName(page, 'Ada Lovelace');

  await open(page, B);
  await expect(nameBox(page)).toBeHidden();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
  expect((await run(page)).name).toBe('Ada Lovelace');
  await expect(page.locator('.fw-student')).toHaveText('Ada Lovelace');
});

test("Sign out, once confirmed, shows the Name gate here and keeps the other Activity's Run", async ({ page }) => {
  await open(page, A);
  await enterName(page, 'Ada Lovelace');
  const runA = await run(page);
  await open(page, B);

  // Dismissing the confirmation keeps the Run and the name.
  let message = '';
  page.once('dialog', (d) => { message = d.message(); d.dismiss(); });
  await pickMenuItem(page, 'Not Ada Lovelace? Sign out');
  expect(message).toMatch(/Conductor Properties/);
  expect(message).toMatch(/forget/i);
  await expect(nameBox(page)).toBeHidden();
  expect((await run(page)).name).toBe('Ada Lovelace');

  page.once('dialog', (d) => d.accept());
  await pickMenuItem(page, 'Not Ada Lovelace? Sign out');
  await expect(nameBox(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();

  // The Run here is gone for good.
  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  await expect(nameBox(page)).toBeVisible();

  // A new name here starts a Run under it; A's Run is still restored under its own name.
  await enterName(page, 'Grace Hopper');
  expect((await run(page)).name).toBe('Grace Hopper');
  await open(page, A);
  await expect(nameBox(page)).toBeHidden();
  expect(await run(page)).toEqual(runA);
  await expect(page.locator('.fw-student')).toHaveText('Ada Lovelace');
  // Sign-out's label uses the Run's name, not the stored one.
  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Not Ada Lovelace? Sign out' })).toBeVisible();
});

test('Start over, once confirmed, begins a new Run under the stored name with no Name gate', async ({ page }) => {
  await open(page, A);
  await enterName(page, 'Ada Lovelace');
  const first = await run(page);

  let message = '';
  page.once('dialog', (d) => { message = d.message(); d.accept(); });
  await pickMenuItem(page, 'Start over');
  expect(message).toMatch(/Sinusoidal Signals/);
  expect(message).toMatch(/Ada Lovelace/);
  await page.waitForFunction((fp) => window.activityHost?.runner.run
    && window.activityHost.runner.run.fingerprint !== fp, first.fingerprint);
  await expect(nameBox(page)).toBeHidden();
  const second = await run(page);
  expect(second.name).toBe('Ada Lovelace');
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
});
