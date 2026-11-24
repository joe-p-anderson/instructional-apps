import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { verifyReport, REPORT_FORMAT_VERSION, FRAMEWORK_VERSION } from '../../../framework/v1/report.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 'demo', version: 3, title: 'Demo Lab', course: 'PHY 1000', tool: 'stub',
  parts: [
    { id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
      { id: 'set', title: 'Set x', prompt: '', points: 2, condition: { state: 'x', target: 1, tol: 0.1 } },
      { id: 'why', title: 'Explain', prompt: '', points: 1, questions: [
        { id: 'why', kind: 'text', prompt: 'Why?', points: 1 },
      ] },
    ] },
    { id: 'p2', title: 'Part 2', mode: 'main', setup: {}, tasks: [
      { id: 'y', title: 'Set y', prompt: '', points: 4, condition: { state: 'y', target: 2, tol: 0.1 } },
    ] },
  ],
};

// A clock that ticks one minute per call, from a fixed start.
function tickingClock(start = '2026-11-24T15:00:00.000Z') {
  let t = Date.parse(start);
  return () => { const d = new Date(t); t += 60_000; return d; };
}

function setup() {
  const tools = {
    p1: stubTool({ state: { x: { value: 0, unit: 'V' } }, displays: ['scope'] }),
    p2: stubTool({ state: { y: { value: 0 } }, displays: ['scope', 'meter'] }),
  };
  const runner = createRunner(activity, { tools, clock: tickingClock() });
  return { runner, tools };
}

test('a Report carries the format and framework versions, the Activity, the student and the Run', async () => {
  const { runner } = setup();
  const run = runner.start('Ada Lovelace');
  const report = await runner.report();
  assert.equal(report.formatVersion, REPORT_FORMAT_VERSION);
  assert.equal(report.frameworkVersion, FRAMEWORK_VERSION);
  assert.deepEqual(report.activity, { id: 'demo', version: 3, title: 'Demo Lab', course: 'PHY 1000' });
  assert.equal(report.student.name, 'Ada Lovelace');
  assert.equal(report.fingerprint, run.fingerprint);
  assert.equal(report.startedAt, '2026-11-24T15:00:00.000Z');
  assert.equal(report.downloadedAt, '2026-11-24T15:01:00.000Z');
});

test('a Report cannot be made before the Run starts', async () => {
  const { runner } = setup();
  await assert.rejects(runner.report(), /name/i);
});

test('partial work is represented faithfully: every Part and Task, with the Attempts so far', async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  runner.submit('p1', 'set');
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  const report = await runner.report();

  assert.deepEqual(report.parts.map((p) => [p.id, p.title, p.tasks.map((t) => t.id)]),
    [['p1', 'Part 1', ['set', 'why']], ['p2', 'Part 2', ['y']]]);
  const [set, why] = report.parts[0].tasks;
  assert.equal(set.title, 'Set x');
  assert.equal(set.passed, true);
  assert.deepEqual(set.attempts.map((a) => [a.state.x, a.passed]), [[0, false], [1, true]]);
  assert.equal(set.attempts[0].at, '2026-11-24T15:01:00.000Z');
  assert.deepEqual(why.attempts, []);
  assert.equal(why.passed, false);
  assert.deepEqual(report.parts[1].tasks[0].attempts, []);
});

test('points earned and possible appear for each Task, each Part and in total', async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  runner.submit('p1', 'why', { why: 'Because.' });
  const report = await runner.report();
  const points = (o) => [o.earned, o.possible];
  assert.deepEqual(report.parts[0].tasks.map(points), [[2, 2], [2, 2]]);
  assert.deepEqual(report.parts.map(points), [[4, 4], [0, 4]]);
  assert.deepEqual(points(report), [4, 8]);
});

test("passing Attempts carry PNG snapshots of the Part's Displays; misses carry none", async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  runner.submit('p2', 'y');
  tools.p2.setState({ y: 2 });
  runner.submit('p2', 'y');
  const [miss, pass] = (await runner.report()).parts[1].tasks[0].attempts;
  assert.equal(miss.snapshots, undefined);
  assert.deepEqual(pass.snapshots, [
    { display: 'scope', png: 'data:image/png;base64,scope' },
    { display: 'meter', png: 'data:image/png;base64,meter' },
  ]);
});

test('the snapshot is taken at the passing Submit, not at download', async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  let frame = 'at-submit';
  tools.p2.displays = [{ id: 'scope', snapshot: async () => `data:image/png;base64,${frame}` }];
  tools.p2.setState({ y: 2 });
  runner.submit('p2', 'y');
  frame = 'later';
  const [pass] = (await runner.report()).parts[1].tasks[0].attempts;
  assert.deepEqual(pass.snapshots, [{ display: 'scope', png: 'data:image/png;base64,at-submit' }]);
});

test('a Display that fails to snapshot does not break the Report', async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  tools.p2.displays = [{ id: 'scope', snapshot: async () => { throw new Error('no canvas'); } }];
  tools.p2.setState({ y: 2 });
  runner.submit('p2', 'y');
  const report = await runner.report();
  assert.deepEqual(report.parts[1].tasks[0].attempts[0].snapshots, []);
  assert.equal(verifyReport(report), true);
});

test("the Report's checksum verifies, and fails after any edit", async () => {
  const { runner, tools } = setup();
  runner.start('Ada');
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  const report = await runner.report();
  assert.equal(verifyReport(report), true);
  // Round-trips through the file unchanged.
  assert.equal(verifyReport(JSON.parse(JSON.stringify(report, null, 2))), true);

  const edits = [
    (r) => { r.student.name = 'Grace'; },
    (r) => { r.earned = 8; },
    (r) => { r.parts[0].tasks[0].attempts[0].state.x = 1.01; },
    (r) => { r.parts[1].tasks[0].passed = true; },
    (r) => { r.parts[0].tasks[1].attempts.push({ passed: true }); },
    (r) => { r.fingerprint = r.fingerprint.replace(/^./, (c) => (c === '0' ? '1' : '0')); },
    (r) => { r.extra = 1; },
    (r) => { r.checksum = r.checksum.replace(/^./, (c) => (c === '0' ? '1' : '0')); },
    (r) => { delete r.checksum; },
  ];
  for (const edit of edits) {
    const copy = structuredClone(report);
    edit(copy);
    assert.equal(verifyReport(copy), false, String(edit));
  }
});

test('a restored Run reports its Attempts, with snapshots saved once they are taken, and no answer keys', async () => {
  const { encodeKey } = await import('../../../framework/v1/runner/index.js');
  const secret = { ...activity, parts: activity.parts.map((part) => ({ ...part, tasks: part.tasks.map((task) =>
    task.condition ? { ...task, condition: encodeKey(task.condition) } : task) })) };
  const tools = { p1: stubTool({ state: { x: { value: 0 } }, displays: ['scope'] }), p2: stubTool({ state: { y: { value: 0 } } }) };
  const first = createRunner(secret, { tools });
  first.start('Ada');
  tools.p1.setState({ x: 1 });
  first.submit('p1', 'set');
  await first.snapshotsTaken();
  const saved = JSON.parse(JSON.stringify(first.save()));

  const fresh = { p1: stubTool({ state: { x: { value: 0 } }, displays: ['scope'] }), p2: stubTool({ state: { y: { value: 0 } } }) };
  const second = createRunner(secret, { tools: fresh });
  assert.equal(second.restore(saved), true);
  const report = await second.report();
  assert.ok(verifyReport(report));
  const set = report.parts[0].tasks[0];
  assert.equal(set.passed, true);
  assert.deepEqual(set.attempts[0].snapshots, [{ display: 'scope', png: 'data:image/png;base64,scope' }]);
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /enc1:/);
  assert.doesNotMatch(text, /"target"|"tol"/);
});
