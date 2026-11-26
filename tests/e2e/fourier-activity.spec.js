import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readReport } from '../../framework/v1/report.js';

// The Activity "Frequency Domain: Fourier Series" on the fourier Tool (tickets 07 and 08: Parts 1–5).

const PAGE = '/tools/fourier/activities/fourier-series.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });

async function submit(scope, task, answers) {
  for (const [prompt, value] of Object.entries(answers)) {
    await scope.getByRole('textbox', { name: prompt, exact: true }).fill(value);
  }
  await scope.getByRole('button', { name: `Submit Task ${task}` }).click();
  await expect(scope.getByRole('region', { name: `Task ${task}` })).toHaveAttribute('data-status', 'passed');
}

test('the page title and header read "Frequency Domain: Fourier Series"', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Frequency Domain: Fourier Series');
  await expect(page.getByRole('heading', { name: 'Frequency Domain: Fourier Series', level: 1 })).toBeVisible();
});

test('the Name gate blocks Part 1 until a name is entered', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeHidden();

  await enterName(page);
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Part 3/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
});

test('Part 1 shows the coefficient table for the selected waveform', async ({ page }) => {
  await open(page);
  await enterName(page);
  const table = part(page, 1).getByRole('table', { name: 'Coefficients' });
  await expect(table).toBeVisible();
  // Square: A₁ = 4/π, the even terms zero.
  await expect(table.getByRole('row', { name: /^1\b/ })).toContainText('1.273');
  await expect(table.getByRole('row', { name: /^2\b/ })).toContainText('0.000');
  await part(page, 1).getByRole('combobox', { name: 'Waveform', exact: true }).selectOption('triangle');
  // Triangle: A₁ = 8/π².
  await expect(table.getByRole('row', { name: /^1\b/ })).toContainText('0.811');
});

test('the Standalone Synthesis Mode shows no coefficient table', async ({ page }) => {
  await page.goto('/tools/fourier/');
  await page.waitForFunction(() => window.toolHost);
  await expect(page.locator('[data-mode="synthesis"]')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Coefficients' })).toHaveCount(0);
});

test('submitting correct hand-computed coefficients passes, and the spectrum appears after Submit', async ({ page }) => {
  await open(page);
  await enterName(page);
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const p2 = part(page, 2);
  const spectrum = p2.locator('[data-display="spectrum"]');
  await expect(p2.locator('[data-display="product"]')).toBeVisible();
  await expect(spectrum).toBeHidden();

  await submit(p2, '2.1', { 'a₁ (V)': '-0.5', 'b₁ (V)': '0.866' });
  await expect(spectrum).toBeHidden();
  await submit(p2, '2.2', { 'A₁ (V)': '1', 'φ₁ (°)': '240' });
  await expect(spectrum).toBeVisible();
});

test('Part 3 hides the spectrum until the square wave\'s coefficients are submitted', async ({ page }) => {
  await open(page);
  await enterName(page);
  await page.getByRole('tab', { name: /Part 3/ }).click();
  const p3 = part(page, 3);
  const spectrum = p3.locator('[data-display="spectrum"]');
  await expect(spectrum).toBeHidden();
  await submit(p3, '3.1', {
    'A₁ (V)': '1.273', 'φ₁ (°)': '-90', 'A₂ (V)': '0', 'A₃ (V)': '0.424', 'φ₃ (°)': '270',
    'A₄ (V)': '0', 'A₅ (V)': '0.255', 'φ₅ (°)': '-90',
  });
  await expect(spectrum).toBeVisible();
});

const choose = (scope, name) => scope.getByRole('radio', { name, exact: typeof name === 'string' }).check();
const toggles = async (scope, gain, phase) => {
  await scope.getByRole('checkbox', { name: 'Apply gain', exact: true }).setChecked(gain);
  await scope.getByRole('checkbox', { name: 'Apply phase shift', exact: true }).setChecked(phase);
};
const setN = async (scope, n) => {
  const box = scope.getByRole('spinbutton', { name: 'N', exact: true });
  await box.fill(String(n));
  await box.press('Enter');
};

test('a full Run passes every Task through Part 5 and downloads a Report with the Display snapshots', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await enterName(page);

  const p1 = part(page, 1);
  await choose(p1, 'Square Aₙ ∝ 1/n; triangle Aₙ ∝ 1/n²');
  await submit(p1, '1.1', {});
  await setN(p1, 21);
  await submit(p1, '1.2', {});
  await p1.getByRole('combobox', { name: 'Waveform', exact: true }).selectOption('triangle');
  await setN(p1, 3);
  await submit(p1, '1.3', {});
  await p1.getByRole('textbox', { name: /jumps/ }).fill('The jumps need fast terms.');
  await p1.getByRole('textbox', { name: /same signal/ }).fill('Shape against harmonics.');
  await submit(p1, '1.4', {});

  await page.getByRole('tab', { name: /Part 2/ }).click();
  const p2 = part(page, 2);
  await submit(p2, '2.1', { 'a₁ (V)': '-0.5', 'b₁ (V)': '0.866' });
  await submit(p2, '2.2', { 'A₁ (V)': '1', 'φ₁ (°)': '-120' });
  await choose(p2, /^Their positive and negative areas cancel/);
  await submit(p2, '2.3', {});

  await page.getByRole('tab', { name: /Part 3/ }).click();
  const p3 = part(page, 3);
  await submit(p3, '3.1', {
    'A₁ (V)': '1.273', 'φ₁ (°)': '-90', 'A₂ (V)': '0', 'A₃ (V)': '0.424', 'φ₃ (°)': '-90',
    'A₄ (V)': '0', 'A₅ (V)': '0.255', 'φ₅ (°)': '-90',
  });
  await choose(p3, 'The even terms are zero, and Aₙ ∝ 1/n for odd n.');
  await submit(p3, '3.2', {});

  // Parts 4 and 5: gain only, phase only, both (with the choice), why both, the 3rd harmonic by hand.
  for (const [n, phi] of [[4, '-135'], [5, '-45']]) {
    await page.getByRole('tab', { name: new RegExp(`Part ${n}`) }).click();
    const p = part(page, n);
    await expect(p.getByRole('combobox', { name: 'Filter', exact: true })).toBeDisabled();
    await expect(p.getByRole('checkbox', { name: 'Apply gain', exact: true })).not.toBeChecked();
    await toggles(p, true, false);
    await submit(p, `${n}.1`, {});
    await toggles(p, false, true);
    await submit(p, `${n}.2`, {});
    await toggles(p, true, true);
    await choose(p, 'Gain and phase together');
    await submit(p, `${n}.3`, {});
    await p.getByRole('textbox', { name: /^Why does the/ }).fill('Each harmonic must be scaled and delayed.');
    await submit(p, `${n}.4`, {});
    await submit(p, `${n}.5`, { 'Output A₃ (V)': '0.300', 'Output φ₃ (°)': phi });
  }
  const p5 = part(page, 5);
  await choose(p5, /^The complex gains add to 1/);
  const dialog = page.getByRole('dialog', { name: /Activity complete/ });
  await expect(dialog).toBeHidden();
  await submit(p5, '5.6', { '|H_LP| + |H_HP| at 3 kHz': '1.414' });

  await expect(dialog).toBeVisible();
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download Report' }).click(),
  ]);
  const { report, checksumOk } = readReport(await readFile(await file.path(), 'utf8'));
  expect(checksumOk).toBe(true);
  expect(report.parts.map((p) => p.id)).toEqual(['synthesis', 'sine', 'square', 'lowpass', 'highpass']);
  expect(report.parts.flatMap((p) => p.tasks).every((t) => t.passed)).toBe(true);
  expect(report.earned).toBe(report.possible);

  const both = report.parts[3].tasks.find((t) => t.id === 'both').attempts.find((a) => a.passed);
  expect(both.state).toMatchObject({ filter: 'lowpass', fc: 3000, applyGain: true, applyPhase: true });
  expect(both.snapshots).toEqual([
    { display: 'time', png: expect.stringMatching(/^data:image\/png;base64,.{100,}/) },
  ]);
  const why = report.parts[4].tasks.find((t) => t.id === 'why-both').attempts[0];
  expect(why.answers['why-both']).toBe('Each harmonic must be scaled and delayed.');
});
