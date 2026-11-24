import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openReport } from '../../../framework/v1/report-viewer/core.js';
import { sampleReport } from './fixtures.js';

test('a Report file opens as a student view of the Run', async () => {
  const view = openReport(JSON.stringify(await sampleReport()));
  assert.equal(view.activity.title, 'Demo Lab');
  assert.equal(view.activity.course, 'PHY 1000');
  assert.equal(view.activity.version, 2);
  assert.equal(view.student.name, 'Ada Lovelace');
  assert.equal(view.startedAt, '2026-11-24T15:00:00.000Z');
  assert.equal(view.checksumOk, true);
  assert.deepEqual(view.parts.map((p) => [p.title, p.tasks.map((t) => t.title)]),
    [['Part 1: Set x', ['Task 1.1', 'Task 1.2']], ['Part 2: Set y', ['Task 2.1']]]);
});

test('each Task lists its Attempts in order with time, State, answers, feedback and snapshots', async () => {
  const view = openReport(JSON.stringify(await sampleReport()));
  const [set, why] = view.parts[0].tasks;
  assert.equal(set.passed, true);
  assert.deepEqual(set.attempts.map((a) => [a.number, a.passed, a.state]),
    [[1, false, [{ name: 'x', value: 0 }]], [2, true, [{ name: 'x', value: 1 }]]]);
  assert.equal(set.attempts[0].at, '2026-11-24T15:01:00.000Z');
  assert.match(set.attempts[0].feedback.join(' '), /x = 0.*need/);
  assert.deepEqual(set.attempts[1].feedback, []);
  assert.deepEqual(set.attempts[0].snapshots, []);
  assert.deepEqual(set.attempts[1].snapshots, [{ display: 'scope', png: 'data:image/png;base64,scope' }]);

  assert.deepEqual(why.attempts[0].answers, [{ id: 'why', value: 'Because the phase lags.' }]);
  assert.deepEqual(view.parts[1].tasks[0].attempts, []);
  assert.equal(view.parts[1].tasks[0].passed, false);
});

test('points are shown for each Task, each Part and in total', async () => {
  const view = openReport(JSON.stringify(await sampleReport()));
  const [set, why] = view.parts[0].tasks;
  assert.deepEqual([set.earned, set.possible], [2, 2]);
  assert.deepEqual([why.earned, why.possible], [2, 2]); // Task point + free-text Question point
  assert.deepEqual([view.parts[0].earned, view.parts[0].possible], [4, 4]);
  assert.deepEqual([view.parts[1].earned, view.parts[1].possible], [0, 4]);
  assert.deepEqual([view.earned, view.possible], [4, 8]);
});

test('a hand-edited Report still opens, marked as failing its checksum', async () => {
  const report = await sampleReport();
  report.student.name = 'Someone Else';
  const view = openReport(JSON.stringify(report));
  assert.equal(view.student.name, 'Someone Else');
  assert.equal(view.checksumOk, false);
});

test('Tasks are numbered by Part and position, as in the Activity', async () => {
  const view = openReport(JSON.stringify(await sampleReport()));
  assert.deepEqual(view.parts.map((p) => p.tasks.map((t) => t.number)), [['1.1', '1.2'], ['2.1']]);
});

test('only PNG data URLs are kept as snapshots', async () => {
  const report = await sampleReport();
  report.parts[0].tasks[0].attempts[1].snapshots.push({ display: 'evil', png: 'https://example.com/x.png' });
  const view = openReport(JSON.stringify(report));
  assert.deepEqual(view.parts[0].tasks[0].attempts[1].snapshots.map((s) => s.display), ['scope']);
});

test('files that are not Reports, or are in an unknown format version, are refused with a reason', () => {
  assert.throws(() => openReport('not json'), /not a Report.*JSON/i);
  assert.throws(() => openReport('{"hello": 1}'), /not a Report.*format version/i);
  assert.throws(() => openReport('{"formatVersion": 99}'), /format version 99/);
});
