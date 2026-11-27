import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRunner, decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';
import activity from '../../../tools/phasors/activities/phasors-impedance.js';
import { sum } from '../../../tools/phasors/engine.js';
import { LAYERS } from '../../../tools/phasors/layers.js';
import { stubTool } from '../runner/stub-tool.js';

// The Activity "Phasors and Impedance" through the runner core, with a stub Tool per Part
// (Mode modules need a DOM). CONTROLS lists every Control id each Mode registers, so a Task
// naming an id the Mode lacks throws here as it would in the page.
const TIME = ['omega', 'play', 't', 'cursor'];
const CONTROLS = {
  sum: ['A1', 'phi1', 'A2', 'phi2', 'tip1', 'tip2', 'crest1', 'crest2', ...LAYERS.sum, ...TIME],
  circuit: ['includeR', 'includeL', 'includeC', 'V0', 'R', 'L', 'C', 'vin', ...LAYERS.circuit, ...TIME],
};

// A stub phasors Tool for one Part: its Mode's Controls, and State that starts at the Setup.
function phasors(part) {
  const state = { mode: { value: part.mode } };
  for (const [k, value] of Object.entries(part.setup)) state[k] = { value };
  return stubTool({ state, controls: CONTROLS[part.mode] });
}

function start() {
  const tools = Object.fromEntries(activity.parts.map((p) => [p.id, phasors(p)]));
  const runner = createRunner(activity, { tools });
  runner.start('Ada');
  return { runner, tools };
}

const partOf = (id) => activity.parts.find((p) => p.id === id);
const taskOf = (part, id) => part.tasks.find((t) => t.id === id);
const allTasks = () => activity.parts.flatMap((p) => p.tasks);
const allQuestions = () => allTasks().flatMap((t) => t.questions ?? []);
const keyOf = (part, taskId, qId) => decodeKey(taskOf(part, taskId).questions.find((q) => q.id === qId).answer);
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// Submit every Task of a Part before `stopAt`, passing each with its answers (and State).
function passUpTo(runner, tools, part, stopAt, answers) {
  for (const task of part.tasks) {
    if (task.id === stopAt) return;
    if (answers[task.id]?.state) tools[part.id].setState(answers[task.id].state);
    const attempt = runner.submit(part.id, task.id, answers[task.id]?.answers ?? {});
    assert.equal(attempt.passed, true, `Task "${task.id}" should pass`);
  }
}

// ── Part 1: Sum ──
// Correct answers, worked by hand (not the engine): 3∠0° + 4∠90° = 5∠53.13° (3-4-5 triangle);
// 3∠0° + 4∠120° = (3 − 2) + j2√3, so A = √13 = 3.606 and φ = arctan(2√3) = 73.90°.
const part1 = partOf('sum');
const P1 = {
  'right-angle': { answers: { A: '5', phi: '53.13' } },
  'check-sum': { answers: { curve: 'pointwise' } },
  'law-of-cosines': { state: { phi2: 120 }, answers: { A: '3.606', phi: '73.90' } },
  extremes: { answers: { extremes: 'sum-difference' } },
};

test('the Activity names the phasors Tool, for PHY/EGR 3120, with Part 1 on the Sum Mode', () => {
  assert.equal(activity.id, 'phasors-impedance');
  assert.equal(activity.title, 'Phasors and Impedance');
  assert.equal(activity.course, 'PHY/EGR 3120');
  assert.equal(activity.tool, 'phasors');
  assert.equal(activity.parts[0], part1);
  assert.equal(part1.title, 'Part 1: Sum');
  assert.equal(part1.mode, 'sum');
});

test('Part 1 Setup fixes ω and two unequal sinusoids 90° apart', () => {
  assert.deepEqual(part1.setup, { A1: 3, phi1: 0, A2: 4, phi2: 90, omega: 1000 });
  assert.notEqual(part1.setup.A1, part1.setup.A2);
});

test('Part 1 runs 90°, check, 120°, extremes, then the free-text why', () => {
  assert.deepEqual(part1.tasks.map((t) => t.id), ['right-angle', 'check-sum', 'law-of-cosines', 'extremes', 'why']);
});

test('the 90° Task locks the sinusoids and ω, and passes A within 2% and φ within ±2° at any equivalent angle', () => {
  const { tools } = start();
  for (const id of ['A1', 'phi1', 'A2', 'phi2', 'tip1', 'tip2', 'crest1', 'crest2', 'omega']) {
    assert.equal(tools[part1.id].controls.get(id).isLocked, true, id);
  }
  for (const [answers, passed] of [
    [{ A: '5', phi: '53.13' }, true],
    [{ A: '5.09', phi: '55' }, true],
    [{ A: '4.92', phi: '-306.87' }, true], // 53.13 − 360
    [{ A: '5', phi: '413.13' }, true],
    [{ A: '7', phi: '53.13' }, false], // A₁ + A₂
    [{ A: '5.15', phi: '53.13' }, false], // 3% high
    [{ A: '5', phi: '36.87' }, false], // the angle from v₂
    [{ A: '5', phi: '56' }, false],
  ]) {
    const { runner } = start();
    assert.equal(runner.submit(part1.id, 'right-angle', answers).passed, passed, JSON.stringify(answers));
  }
});

test('the check Task passes only on the pointwise sum', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'check-sum', P1);
  const q = taskOf(part1, 'check-sum').questions[0];
  assert.equal(q.kind, 'choice');
  const wrong = q.choices.find((c) => c.id !== 'pointwise');
  assert.equal(runner.submit(part1.id, 'check-sum', { [q.id]: wrong.id }).passed, false);
  assert.equal(runner.submit(part1.id, 'check-sum', { [q.id]: 'pointwise' }).passed, true);
});

test('the 120° Task opens φ₂ alone, and passes only with φ₂ at 120° and the law-of-cosines answers', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'law-of-cosines', P1);
  const t = tools[part1.id];
  assert.equal(t.controls.get('phi2').isLocked, false);
  for (const id of ['A1', 'phi1', 'A2', 'tip1', 'tip2', 'crest1', 'crest2', 'omega']) {
    assert.equal(t.controls.get(id).isLocked, true, id);
  }
  const ok = P1['law-of-cosines'].answers;
  for (const [phi2, answers, passed] of [
    [90, ok, false], // φ₂ not moved
    [-120, ok, false],
    [120, { A: '5', phi: '53.13' }, false], // the 90° answers
    [120, { A: '4.36', phi: '73.90' }, false], // √19: + 2A₁A₂cos instead of the sign of cos 120°
    [120, ok, true],
  ]) {
    t.setState({ phi2 });
    assert.equal(runner.submit(part1.id, 'law-of-cosines', answers).passed, passed, `${phi2} ${JSON.stringify(answers)}`);
  }
});

test('the 120° Task passes equivalent angles and fails outside ±2°', () => {
  for (const [answers, passed] of [
    [{ A: '3.6', phi: '-286.1' }, true], // 73.9 − 360
    [{ A: '3.606', phi: '75.5' }, true],
    [{ A: '3.606', phi: '76.5' }, false],
    [{ A: '3.606', phi: '-73.90' }, false],
  ]) {
    const { runner, tools } = start();
    passUpTo(runner, tools, part1, 'law-of-cosines', P1);
    tools[part1.id].setState({ phi2: 120 });
    assert.equal(runner.submit(part1.id, 'law-of-cosines', answers).passed, passed, JSON.stringify(answers));
  }
});

test('each compute Task hides the resultant, and the Task after it shows it', () => {
  const { runner, tools } = start();
  const visible = () => tools[part1.id].controls.get('sum').isVisible;
  const compute = ['right-angle', 'law-of-cosines'];
  for (const task of part1.tasks) {
    assert.equal(visible(), !compute.includes(task.id), `resultant in Task "${task.id}"`);
    if (P1[task.id]?.state) tools[part1.id].setState(P1[task.id].state);
    runner.submit(part1.id, task.id, P1[task.id]?.answers ?? {});
  }
});

test('the extremes Task opens the sinusoids for dragging and passes only on A₁ + A₂ and |A₁ − A₂|', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'extremes', P1);
  for (const id of ['A1', 'phi1', 'A2', 'phi2', 'tip1', 'tip2', 'crest1', 'crest2']) {
    assert.equal(tools[part1.id].controls.get(id).isLocked, false, id);
  }
  const q = taskOf(part1, 'extremes').questions[0];
  assert.equal(q.kind, 'choice');
  for (const c of q.choices.filter((x) => x.id !== 'sum-difference')) {
    assert.equal(runner.submit(part1.id, 'extremes', { extremes: c.id }).passed, false, c.id);
  }
  assert.equal(runner.submit(part1.id, 'extremes', { extremes: 'sum-difference' }).passed, true);
});

test('Part 1 ends with a free-text why, recorded and not graded', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'why', P1);
  const task = taskOf(part1, 'why');
  assert.deepEqual(task.questions.map((q) => q.kind), ['text']);
  assert.match(task.questions[0].prompt, /same frequency/);
  const attempt = runner.submit(part1.id, 'why', {});
  assert.equal(attempt.passed, true);
  assert.ok(attempt.results.filter((r) => r.kind === 'question').every((r) => r.graded === false));
});

test('the Part 1 answer keys agree with the engine\'s sum()', () => {
  const s = part1.setup;
  const v1 = { A: s.A1, phi: s.phi1 };
  for (const [taskId, phi2] of [['right-angle', s.phi2], ['law-of-cosines', 120]]) {
    const r = sum(v1, { A: s.A2, phi: phi2 });
    assert.ok(Math.abs(keyOf(part1, taskId, 'A') - r.A) < 1e-9, `${taskId} A`);
    assert.ok(Math.abs(wrap(keyOf(part1, taskId, 'phi') - r.phi)) < 1e-9, `${taskId} φ`);
  }
});

// ── The whole Activity ──

test('amplitudes use a 2% relative tolerance and phases ±2° mod 360', () => {
  const numeric = allQuestions().filter((q) => q.kind === 'numeric');
  assert.ok(numeric.length >= 4);
  for (const q of numeric) {
    if (q.id.startsWith('phi')) assert.deepEqual([q.tol, q.modulus, q.relTol], [2, 360, undefined], q.id);
    else assert.deepEqual([q.relTol, q.tol, q.modulus], [0.02, undefined, undefined], q.id);
  }
});

test('every hidden or shown id is a revealable layer of its Part\'s Mode', () => {
  for (const part of activity.parts) {
    for (const task of part.tasks) {
      for (const id of [...(task.hide ?? []), ...(task.show ?? [])]) {
        assert.ok(CONTROLS[part.mode].includes(id), `${part.id}/${task.id}: ${id}`);
        if (task.hide?.includes(id)) assert.ok(LAYERS[part.mode].includes(id), `${part.id}/${task.id} hides ${id}`);
      }
    }
  }
});

test('Conditions, numeric answers and choice keys are encoded answer keys', async () => {
  for (const task of allTasks().filter((t) => t.condition)) assert.ok(isEncodedKey(task.condition), task.id);
  for (const q of allQuestions()) {
    if (q.kind === 'numeric') assert.ok(isEncodedKey(q.answer), q.id);
    if (q.kind === 'choice') assert.ok(isEncodedKey(q.correct), q.id);
  }
  const source = await readFile(new URL('../../../tools/phasors/activities/phasors-impedance.js', import.meta.url), 'utf8');
  for (const leak of ['53.1', '3.60', '3.61', '73.9', '√13', 'target:']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
});

test('no Hint states the value that passes its Task', () => {
  const leaks = {
    'right-angle': [/\b5\b(?!\s*%)/, /53/],
    'law-of-cosines': [/√13/, /3\.6/, /73/, /74/],
  };
  for (const task of allTasks().filter((t) => t.hint)) {
    const text = isEncodedKey(task.hint.text) ? decodeKey(task.hint.text) : task.hint.text;
    for (const leak of leaks[task.id] ?? []) assert.doesNotMatch(text, leak, `Task "${task.id}" Hint: ${text}`);
  }
});
