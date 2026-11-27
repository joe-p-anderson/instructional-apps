import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readReport } from '../../framework/v1/report.js';

// The Activity "Phasors and Impedance" on the phasors Tool.

const PAGE = '/tools/phasors/activities/phasors-impedance.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const taskRegion = (scope, task) => scope.getByRole('region', { name: `Task ${task}` });

async function submit(scope, task, answers = {}) {
  const region = taskRegion(scope, task);
  for (const [prompt, value] of Object.entries(answers)) {
    await region.getByRole('textbox', { name: prompt, exact: true }).fill(value);
  }
  await scope.getByRole('button', { name: `Submit Task ${task}` }).click();
  await expect(region).toHaveAttribute('data-status', 'passed');
}

const choose = (scope, name) => scope.getByRole('radio', { name }).check();

async function enter(scope, name, value) {
  const box = scope.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

test('the page title and header read "Phasors and Impedance"', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Phasors and Impedance');
  await expect(page.getByRole('heading', { name: 'Phasors and Impedance', level: 1 })).toBeVisible();
});

test('the Name gate blocks Part 1 until a name is entered', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeHidden();

  await enterName(page);
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
});

test('the 90° Task locks the sinusoids, and the resultant appears once A and φ are submitted', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const polar = p1.getByRole('status', { name: 'v₁ + v₂ polar', exact: true });
  const toggle = p1.getByRole('checkbox', { name: 'Show v₁ + v₂', exact: true });
  await expect(p1.getByRole('spinbutton', { name: 'A₁ (V)', exact: true })).toBeDisabled();
  await expect(polar).toBeHidden();
  await expect(toggle).toBeHidden();

  await submit(p1, '1.1', { 'A (V)': '5', 'φ (°)': '-306.9' });
  await expect(polar).toBeVisible();
  await expect(polar).toHaveText('5.00∠53.1° V');
  await expect(toggle).toBeVisible();
});

test('a full Run of Part 1 passes every Task and downloads a Report with the Display snapshots', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const polar = p1.getByRole('status', { name: 'v₁ + v₂ polar', exact: true });

  await submit(p1, '1.1', { 'A (V)': '5', 'φ (°)': '53.13' });
  await choose(p1, /^At every instant it is v₁\(t\) \+ v₂\(t\)/);
  await submit(p1, '1.2');

  // The 120° Task hides the resultant again and opens φ₂ alone.
  await expect(polar).toBeHidden();
  await expect(p1.getByRole('spinbutton', { name: 'A₂ (V)', exact: true })).toBeDisabled();
  await enter(p1, 'φ₂ (°)', 120);
  await submit(p1, '1.3', { 'A (V)': '3.606', 'φ (°)': '73.9' });
  await expect(polar).toHaveText('3.61∠73.9° V');

  await expect(p1.getByRole('spinbutton', { name: 'A₂ (V)', exact: true })).toBeEnabled();
  await choose(p1, /^In phase, A = A₁ \+ A₂; out of phase, A = \|A₁ − A₂\|/);
  await submit(p1, '1.4');
  await p1.getByRole('textbox', { name: /^Why is the sum/ }).fill('The phasors add to one phasor rotating at ω.');

  await submit(p1, '1.5');
  // The header's Download Report button works at any point in the Run, so this holds whether or
  // not Part 1 completes the Activity (the completion dialog, if open, is closed first).
  const dialog = page.getByRole('dialog', { name: /Activity complete/ });
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Close' }).click();
  const download = page.getByRole('button', { name: /Download Report$/ }).first();
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const { report, checksumOk } = readReport(await readFile(await file.path(), 'utf8'));
  expect(checksumOk).toBe(true);
  expect(report.activity).toMatchObject({ id: 'phasors-impedance', course: 'PHY/EGR 3120' });
  const sum = report.parts.find((p) => p.id === 'sum');
  expect(sum.tasks.every((t) => t.passed)).toBe(true);
  expect(sum.earned).toBe(sum.possible);

  const passed = (id) => sum.tasks.find((t) => t.id === id).attempts.find((a) => a.passed);
  expect(passed('law-of-cosines').state).toMatchObject({ A1: 3, phi1: 0, A2: 4, phi2: 120, omega: 1000 });
  expect(passed('right-angle').snapshots).toEqual([
    { display: 'plane', png: expect.stringMatching(/^data:image\/png;base64,.{100,}/) },
    { display: 'time', png: expect.stringMatching(/^data:image\/png;base64,.{100,}/) },
  ]);
  expect(passed('why').answers.why).toBe('The phasors add to one phasor rotating at ω.');
});

test('in Part 2, submitting Z reveals Z_total and submitting I reveals I', async ({ page }) => {
  await open(page);
  await enterName(page);
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const p2 = part(page, 2);
  const zTotal = p2.getByRole('status', { name: 'Z_total polar', exact: true });
  const current = p2.getByRole('status', { name: 'I', exact: true });
  await expect(p2.getByRole('spinbutton', { name: 'R (Ω)', exact: true })).toBeDisabled();
  await expect(zTotal).toBeHidden();
  await expect(current).toBeHidden();

  await submit(p2, '2.1', { 'Re Z (Ω)': '300', 'Im Z (Ω)': '-400', '|Z| (Ω)': '500', '∠Z (°)': '306.87' });
  await expect(zTotal).toBeVisible();
  await expect(zTotal).toHaveText(/∠−53\.1° Ω$/);
  await expect(current).toBeHidden();

  await submit(p2, '2.2', { '|I| (mA)': '20', '∠I (°)': '53.13' });
  await expect(current).toBeVisible();
  await expect(current).toHaveText(/∠53\.1°/);
});
