import { test, expect } from '@playwright/test';

// The Activity "Frequency Domain: Fourier Series" on the fourier Tool (ticket 07: Parts 1–3).

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
