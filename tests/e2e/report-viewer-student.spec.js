import { test, expect } from '@playwright/test';

const ACTIVITY = '/tools/oscilloscope/activities/phase-period-amplitude.html';
const VIEWER = '/framework/v1/report-viewer/index.html';

async function downloadReport(page) {
  await page.goto(ACTIVITY);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
  const p1 = page.getByRole('tabpanel', { name: /Part 1/ });
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click(); // a miss
  const box = p1.getByRole('spinbutton', { name: 'Δt', exact: true });
  await box.fill('0.5');
  await box.press('Enter');
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click(); // a pass
  await expect(p1.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'passed');
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Report' }).click(),
  ]);
  return file.path();
}

test('a Report downloaded from the oscilloscope Activity opens in the student view', async ({ page }) => {
  const reportPath = await downloadReport(page);

  const requests = [];
  page.on('request', (r) => requests.push(r));
  await page.goto(VIEWER);
  requests.length = 0;
  await page.getByLabel('Open a Report').setInputFiles(reportPath);

  const view = page.getByRole('article', { name: 'Report' });
  await expect(view).toContainText('Sinusoidal Signals');
  await expect(view).toContainText('PHY/EGR 3120');
  await expect(view).toContainText('Ada Lovelace');
  await expect(view.getByRole('heading', { name: 'Part 1: Phase Shift' })).toBeVisible();
  await expect(view.getByRole('heading', { name: 'Part 2: Period and Amplitude' })).toBeVisible();

  const task = view.getByRole('region', { name: /Task 1\.1/ });
  await expect(task).toHaveAttribute('data-status', 'passed');
  await expect(task.getByRole('listitem').filter({ hasText: 'Attempt' })).toHaveCount(2);
  await expect(task).toContainText('Attempt 1');
  await expect(task).toContainText(/need/); // miss feedback on Attempt 1
  await expect(task.getByRole('img')).toHaveCount(1); // snapshot on the passing Attempt only
  await expect(task.getByRole('img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(view.getByText(/points/i).first()).toBeVisible();

  // Nothing about the Report leaves the browser.
  expect(requests.filter((r) => r.method() !== 'GET')).toEqual([]);
});

test('Print / Save as PDF opens the browser print dialog', async ({ page }) => {
  const reportPath = await downloadReport(page);
  await page.goto(VIEWER);
  await page.evaluate(() => { window.printed = 0; window.print = () => { window.printed += 1; }; });
  await page.getByLabel('Open a Report').setInputFiles(reportPath);
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  expect(await page.evaluate(() => window.printed)).toBe(1);
});

test('a file that is not a Report shows a readable error', async ({ page }) => {
  await page.goto(VIEWER);
  await page.getByLabel('Open a Report').setInputFiles({
    name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}'),
  });
  await expect(page.getByRole('alert')).toContainText(/not a Report/i);
});
