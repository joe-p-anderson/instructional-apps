import { test, expect } from '@playwright/test';
import { sampleReport, quizReport } from '../unit/report-viewer/fixtures.js';
import { makeZip } from '../unit/report-viewer/make-zip.js';

const VIEWER = '/framework/v1/report-viewer/index.html';

async function bulkDownload() {
  const inflated = await sampleReport('Ada Lovelace');
  inflated.earned = 8; // stored totals are not trusted
  return Buffer.from(makeZip([
    { name: '143560-1 - Ada Lovelace - Nov 24, 2026 1027 AM - demo_Ada-Lovelace_2026-11-24.json',
      data: JSON.stringify(inflated) },
    { name: '143560-2 - Grace Hopper - Nov 24, 2026 1030 AM/quiz_Grace-Hopper_2026-11-24.json',
      data: JSON.stringify(await quizReport('Grace Hopper')) },
    { name: 'index.html', data: '<html></html>' },
  ]));
}

test('a Brightspace bulk-download zip opens as a class table, read in the browser', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r));
  await page.goto(VIEWER);
  requests.length = 0;
  await page.getByLabel('Open a Report').setInputFiles({
    name: 'Lab 3 Download.zip', mimeType: 'application/zip', buffer: await bulkDownload(),
  });

  const table = page.getByRole('table', { name: 'Class' });
  await expect(table.getByRole('columnheader')).toHaveText(['Student', 'Tasks passed', 'Attempts', 'Points', 'Flags']);
  const rows = table.getByRole('row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1).getByRole('cell')).toHaveText(['Ada Lovelace', '2 / 3', '3', '4 / 8', '']);
  await expect(rows.nth(2).getByRole('cell')).toHaveText(['Grace Hopper', '0 / 1', '2', '4 / 5', '']);
  expect(requests.filter((r) => r.method() !== 'GET')).toEqual([]);
});

test("clicking a student opens their full detail, and Back returns to the class", async ({ page }) => {
  await page.goto(VIEWER);
  await page.getByLabel('Open a Report').setInputFiles({
    name: 'Lab 3 Download.zip', mimeType: 'application/zip', buffer: await bulkDownload(),
  });
  await page.getByRole('button', { name: 'Ada Lovelace' }).click();

  const view = page.getByRole('article', { name: 'Report' });
  await expect(view).toContainText('Demo Lab');
  await expect(view).toContainText('4 / 8 points');
  const task = view.getByRole('region', { name: /Task 1\.1/ });
  await expect(task.getByRole('listitem').filter({ hasText: 'Attempt' })).toHaveCount(2);
  await expect(task).toContainText('x = 1');
  await expect(task.getByRole('img')).toHaveCount(1);
  await expect(view.getByRole('region', { name: /Task 1\.2/ })).toContainText('Because the phase lags.');

  await page.getByRole('button', { name: 'Back to class' }).click();
  await expect(page.getByRole('table', { name: 'Class' })).toBeVisible();
});

test('many Reports dropped together also open as a class table', async ({ page }) => {
  await page.goto(VIEWER);
  await page.getByLabel('Open a Report').setInputFiles([
    { name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(await sampleReport('Ada Lovelace'))) },
    { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(await sampleReport('Bo Diddley'))) },
  ]);
  await expect(page.getByRole('table', { name: 'Class' }).getByRole('row')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Bo Diddley' })).toBeVisible();
});
