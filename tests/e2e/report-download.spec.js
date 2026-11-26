import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readReport, REPORT_FORMAT_VERSION } from '../../framework/v1/report.js';

const PAGE = '/tools/oscilloscope/activities/phase-period-amplitude.html';

async function start(page, name = 'Ada Lovelace') {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

async function setNumber(scope, name, value) {
  const box = scope.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

async function download(page) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Report' }).click(),
  ]);
  return { filename: file.suggestedFilename(), ...readReport(await readFile(await file.path(), 'utf8')) };
}

test('the downloaded Report has the expected shape and represents partial work faithfully', async ({ page }) => {
  await start(page);
  const p1 = page.getByRole('tabpanel', { name: /Part 1/ });
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click(); // a miss
  await setNumber(p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click(); // a pass
  await expect(p1.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'passed');

  const { filename, report, checksumOk } = await download(page);
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  expect(filename).toBe(`oscilloscope-phase-period-amplitude_Ada-Lovelace_${today}.json`);
  expect(checksumOk).toBe(true);
  expect(report).toMatchObject({
    formatVersion: REPORT_FORMAT_VERSION,
    activity: { id: 'oscilloscope-phase-period-amplitude', title: expect.any(String), course: expect.any(String) },
    student: { name: 'Ada Lovelace' },
    fingerprint: expect.stringMatching(/^[0-9a-f]{32}$/),
  });
  expect(Date.parse(report.downloadedAt)).toBeGreaterThanOrEqual(Date.parse(report.startedAt));
  expect(report.parts.map((p) => p.id)).toEqual(['phase', 'period-amplitude']);

  const [t11, t12] = report.parts[0].tasks;
  expect(t11.passed).toBe(true);
  expect(t11.earned).toBe(t11.possible);
  expect(t11.attempts.map((a) => a.passed)).toEqual([false, true]);
  expect(t11.attempts[0].snapshots).toBeUndefined();
  expect(t11.attempts[1].snapshots).toEqual([
    { display: expect.any(String), png: expect.stringMatching(/^data:image\/png;base64,.{100,}/) },
  ]);
  expect(t12).toMatchObject({ passed: false, earned: 0, attempts: [] });
  expect(report.earned).toBe(t11.earned);
  expect(report.possible).toBeGreaterThan(report.earned);
});

test('the Report can be downloaded right after the Run starts, before any Submit', async ({ page }) => {
  await start(page, 'Grace Hopper');
  const { report, checksumOk } = await download(page);
  expect(checksumOk).toBe(true);
  expect(report.student.name).toBe('Grace Hopper');
  expect(report.earned).toBe(0);
  expect(report.parts.flatMap((p) => p.tasks).every((t) => t.attempts.length === 0)).toBe(true);
});
