import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openReport } from '../../../framework/v1/report-viewer/core.js';
import { sampleReport, quizReport } from './fixtures.js';

const taskPoints = (view) => view.parts.flatMap((p) => p.tasks.map((t) => [t.id, t.passed, t.earned, t.possible]));

test('scores are recomputed from the Attempts, not taken from the stored totals', async () => {
  const report = await sampleReport();
  report.earned = 99;
  report.parts[1].earned = 4;
  report.parts[1].tasks[0].earned = 4;
  report.parts[1].tasks[0].passed = true;
  const view = openReport(JSON.stringify(report));
  assert.deepEqual(taskPoints(view), [['set', true, 2, 2], ['why', true, 2, 2], ['y', false, 0, 4]]);
  assert.deepEqual([view.parts[1].earned, view.parts[1].possible], [0, 4]);
  assert.deepEqual([view.earned, view.possible], [4, 8]);
});

test('an Attempt marked passed whose results show a miss earns nothing', async () => {
  const report = await sampleReport();
  const [miss] = report.parts[0].tasks[0].attempts;
  report.parts[0].tasks[0].attempts = [{ ...miss, passed: true }];
  const view = openReport(JSON.stringify(report));
  assert.deepEqual(taskPoints(view)[0], ['set', false, 0, 2]);
});

test('each Question earns its own share once answered correctly in any Attempt; free text when non-empty', async () => {
  // Attempt 1: T right, c wrong, why blank. Attempt 2: T wrong, c right, why given. Neither passes.
  const view = openReport(JSON.stringify(await quizReport()));
  // Task point 1 (not passed) + T 2 + c 1 + why 1.
  assert.deepEqual(taskPoints(view), [['ask', false, 4, 5]]);
});

test('Tasks passed and Attempts are counted for the class table', async () => {
  const view = openReport(JSON.stringify(await sampleReport()));
  assert.deepEqual([view.tasksPassed, view.taskCount, view.attemptCount], [2, 3, 3]);
});
