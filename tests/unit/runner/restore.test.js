import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, encodeKey } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const v1 = {
  id: 'demo', version: 1, title: 'Demo', course: 'PHY 0000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 'reach-1', title: 'Reach 1', prompt: '', points: 1, show: ['x'],
      condition: { state: 'x', target: 1, tol: 0.1 } },
    { id: 'reach-2', title: 'Reach 2', prompt: '', points: 1, lock: ['x'],
      condition: { state: 'x', target: 2, tol: 0.1 } },
    { id: 'reach-3', title: 'Reach 3', prompt: '', points: 1,
      condition: { state: 'x', target: 3, tol: 0.1 } },
  ] }],
};

const tool = () => stubTool({ state: { x: { value: 0 } }, controls: ['x'] });

// A Run with reach-1 passed (after one miss) and one miss on reach-2, saved mid-Activity.
function savedRun() {
  const t = tool();
  const r = createRunner(v1, { tools: { p1: t } });
  r.start('Ada');
  t.setState({ x: 0.5 }); r.submit('p1', 'reach-1');
  t.setState({ x: 1 }); r.submit('p1', 'reach-1');
  t.setState({ x: 1.5 }); r.submit('p1', 'reach-2');
  return { saved: JSON.parse(JSON.stringify(r.save())), runner: r };
}

test('a saved Run restores its name, fingerprint, Attempts and Tool State', () => {
  const { saved, runner: original } = savedRun();
  const t = tool();
  const r = createRunner(v1, { tools: { p1: t } });
  r.restore(saved);

  assert.deepEqual(r.run, original.run);
  assert.equal(t.state.snapshot().x, 1.5);
  assert.deepEqual(r.parts()[0].tasks.map((x) => x.status), ['passed', 'open', 'locked']);
  assert.equal(r.task('p1', 'reach-1').attempts.length, 2);
  assert.equal(r.task('p1', 'reach-2').misses, 1);
  assert.deepEqual(r.score(), original.score());
  // Exposure is where the Run left it: reach-2 locks x.
  assert.equal(t.controls.get('x').isLocked, true);
  // The restored Run carries on: the name stays fixed and Submits keep working.
  assert.throws(() => r.start('Grace'), /already/i);
  t.setState({ x: 2 });
  assert.equal(r.submit('p1', 'reach-2').passed, true);
});

test('restoring after a version change keeps Attempts for Task ids that still exist', () => {
  const { saved } = savedRun();
  // v2 drops reach-2 and adds reach-2b in its place.
  const v2 = structuredClone({ ...v1, version: 2 });
  v2.parts[0].tasks[1] = { id: 'reach-2b', title: 'Reach 2.5', prompt: '', points: 1,
    condition: { state: 'x', target: 2.5, tol: 0.1 } };
  const r = createRunner(v2, { tools: { p1: tool() } });
  r.restore(saved);

  assert.equal(r.run.name, 'Ada');
  assert.equal(r.task('p1', 'reach-1').attempts.length, 2);
  assert.equal(r.task('p1', 'reach-1').status, 'passed');
  assert.equal(r.task('p1', 'reach-2b').attempts.length, 0);
  assert.equal(r.task('p1', 'reach-2b').status, 'open');
  assert.deepEqual(r.parts()[0].tasks.map((x) => x.id), ['reach-1', 'reach-2b', 'reach-3']);
});

test('an unusable save is ignored and leaves the name gate in place', () => {
  for (const junk of [null, 'nope', {}, { run: { name: '' } }]) {
    const r = createRunner(v1, { tools: { p1: tool() } });
    assert.equal(r.restore(junk), false);
    assert.equal(r.run, null);
  }
});

test('a Run of an Activity with encoded keys saves and restores', () => {
  const encoded = structuredClone(v1);
  for (const task of encoded.parts[0].tasks) task.condition = encodeKey(task.condition);
  const t1 = tool();
  const original = createRunner(encoded, { tools: { p1: t1 } });
  original.start('Ada');
  t1.setState({ x: 1 }); original.submit('p1', 'reach-1');
  const saved = JSON.parse(JSON.stringify(original.save()));
  assert.ok(!JSON.stringify(saved).includes('"target"'), 'the save carries no decoded Condition');

  const t2 = tool();
  const r = createRunner(encoded, { tools: { p1: t2 } });
  assert.equal(r.restore(saved), true);
  assert.deepEqual(r.parts()[0].tasks.map((x) => x.status), ['passed', 'open', 'locked']);
  assert.deepEqual(r.score(), original.score());
  t2.setState({ x: 2 });
  assert.equal(r.submit('p1', 'reach-2').passed, true);
});

// A Part with Question Tasks, for answers that outlive a reload.
const asked = {
  id: 'asked', version: 1, title: 'Asked', course: 'PHY 0000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 'q1', title: 'Q1', prompt: '', points: 1,
      questions: [{ id: 'T', kind: 'numeric', prompt: '', answer: 3, tol: 0.1 }] },
    { id: 'q2', title: 'Q2', prompt: '', points: 1,
      questions: [{ id: 'why', kind: 'text', prompt: '' }, { id: 'n', kind: 'numeric', prompt: '', answer: 1, tol: 0.1 }] },
  ] }],
};

test("a restored Run gives back each Task's answers: the passing ones, the last missed ones, and unsubmitted drafts", () => {
  const r = createRunner(asked, { tools: { p1: tool() } });
  r.start('Ada');
  assert.deepEqual(r.task('p1', 'q1').answers, {});
  r.submit('p1', 'q1', { T: '2.96' });
  r.submit('p1', 'q2', { why: 'because', n: '5' });
  r.draft('p1', 'q2', { why: 'because, really', n: '1.0' });
  const missed = createRunner(asked, { tools: { p1: tool() } });
  missed.start('Ada');
  missed.submit('p1', 'q1', { T: '4' });

  const again = createRunner(asked, { tools: { p1: tool() } });
  again.restore(JSON.parse(JSON.stringify(r.save())));
  assert.deepEqual(again.task('p1', 'q1').answers, { T: '2.96' });
  assert.deepEqual(again.task('p1', 'q2').answers, { why: 'because, really', n: '1.0' });

  const back = createRunner(asked, { tools: { p1: tool() } });
  back.restore(JSON.parse(JSON.stringify(missed.save())));
  assert.deepEqual(back.task('p1', 'q1').answers, { T: '4' });
  assert.deepEqual(back.task('p1', 'q1').attempts.at(-1).results[0].feedback, 'Not quite');
});

test('a Submit replaces the draft with the answers it recorded', () => {
  const r = createRunner(asked, { tools: { p1: tool() } });
  r.start('Ada');
  r.draft('p1', 'q1', { T: '2' });
  r.submit('p1', 'q1', { T: '2.5' });
  assert.deepEqual(r.task('p1', 'q1').answers, { T: '2.5' });
});
test('the completion-dialog flag is saved with the Run, restored, and kept out of the Report', async () => {
  const t = tool();
  const r = createRunner(v1, { tools: { p1: t } });
  r.start('Ada');
  assert.equal(r.complete, false);
  assert.equal(r.completionShown, false);
  for (const [id, x] of [['reach-1', 1], ['reach-2', 2], ['reach-3', 3]]) { t.setState({ x }); r.submit('p1', id); }
  assert.equal(r.complete, true);
  r.markCompletionShown();
  assert.equal(r.completionShown, true);

  const saved = JSON.parse(JSON.stringify(r.save()));
  const again = createRunner(v1, { tools: { p1: tool() } });
  assert.equal(again.restore(saved), true);
  assert.equal(again.complete, true);
  assert.equal(again.completionShown, true);
  assert.ok(!JSON.stringify(await r.report()).includes('completion'), 'the Report has no completion flag');

  // A Run saved before the dialog was shown restores with the flag unset.
  const { saved: midway } = savedRun();
  const fresh = createRunner(v1, { tools: { p1: tool() } });
  fresh.restore(midway);
  assert.equal(fresh.completionShown, false);
  assert.equal(fresh.complete, false);
});
