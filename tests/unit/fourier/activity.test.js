import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRunner, decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';
import activity from '../../../tools/fourier/activities/fourier-series.js';
import { ideal, partialSum, productAverage, series } from '../../../tools/fourier/engine.js';
import { stubTool } from '../runner/stub-tool.js';

const SHARED = ['waveform', 'amp', 'f0', 'offset', 'shift', 'filter', 'fc', 'applyGain', 'applyPhase'];
const CONTROLS = {
  synthesis: [...SHARED, 'N', 'play'],
  analysis: [...SHARED, 'testFunction', 'n', 'spectrumSource', 'spectrum', 'filter-curves'],
};

// A stub Fourier Tool for one Part: its Mode's Controls, and State that starts at the Setup.
function fourier(part) {
  const state = { mode: { value: part.mode } };
  for (const [k, value] of Object.entries(part.setup)) state[k] = { value };
  return stubTool({ state, controls: CONTROLS[part.mode] });
}

function start() {
  const tools = Object.fromEntries(activity.parts.map((p) => [p.id, fourier(p)]));
  const runner = createRunner(activity, { tools });
  runner.start('Ada');
  return { runner, tools };
}

const [part1, part2, part3] = activity.parts;
const taskOf = (part, id) => part.tasks.find((t) => t.id === id);
const allTasks = () => activity.parts.flatMap((p) => p.tasks);
const allQuestions = () => allTasks().flatMap((t) => t.questions ?? []);

// Submit every Task of a Part before `stopAt`, passing each with its answers.
function passUpTo(runner, tools, part, stopAt, answers) {
  for (const task of part.tasks) {
    if (task.id === stopAt) return;
    if (answers[task.id]?.state) tools[part.id].setState(answers[task.id].state);
    const attempt = runner.submit(part.id, task.id, answers[task.id]?.answers ?? {});
    assert.equal(attempt.passed, true, `Task "${task.id}" should pass`);
  }
}

// Correct answers, from the textbook values (not the engine).
const P1 = {
  falloff: { answers: { falloff: 'square-n-triangle-n2' } },
  'square-n': { state: { waveform: 'square', N: 21 } },
  'triangle-n': { state: { waveform: 'triangle', N: 3 } },
};
const P2 = {
  'ab-1': { answers: { a1: '-0.5', b1: '0.866' } },
  'A-phi-1': { answers: { A1: '1', phi1: '-120' } },
};
const P3 = {
  'A-phi-square': { answers: { A1: '1.273', A2: '0', A3: '0.424', A4: '0', A5: '0.255', phi1: '-90', phi3: '-90', phi5: '-90' } },
};

test('the Activity names the fourier Tool, for PHY/EGR 3120, with Parts on Synthesis, Analysis, Analysis', () => {
  assert.equal(activity.tool, 'fourier');
  assert.equal(activity.course, 'PHY/EGR 3120');
  assert.equal(activity.title, 'Frequency Domain: Fourier Series');
  assert.deepEqual(activity.parts.slice(0, 3).map((p) => p.mode), ['synthesis', 'analysis', 'analysis']);
});

test('each Setup fixes the waveform, shift, f₀ = 1 kHz, ±1 V and the filter off; Part 1 shows the coefficient table', () => {
  const fixed = { amp: 1, f0: 1000, offset: 0, filter: 'off' };
  assert.deepEqual(part1.setup, { ...fixed, waveform: 'square', shift: 0, N: 1, coefficientTable: true });
  assert.deepEqual(part2.setup, { ...fixed, waveform: 'sine', shift: 30, testFunction: 'cos', n: 1 });
  assert.deepEqual(part3.setup, { ...fixed, waveform: 'square', shift: 0, testFunction: 'sin', n: 1 });
});

test('the falloff choice passes only on square 1/n and triangle 1/n²', () => {
  const { runner } = start();
  assert.equal(runner.submit(part1.id, 'falloff', { falloff: 'square-n2-triangle-n' }).passed, false);
  assert.equal(runner.submit(part1.id, 'falloff', { falloff: 'square-n-triangle-n2' }).passed, true);
});

test('the square N Task passes near the smallest N within 5% and fails far from it or on the wrong waveform', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'square-n', P1);
  const t = tools[part1.id];
  for (const [state, passed] of [
    [{ waveform: 'square', N: 5 }, false],
    [{ waveform: 'square', N: 60 }, false],
    [{ waveform: 'triangle', N: 21 }, false],
    [{ waveform: 'square', N: 19 }, true],
  ]) {
    t.setState(state);
    assert.equal(runner.submit(part1.id, 'square-n').passed, passed, JSON.stringify(state));
  }
});

test('the triangle N Task passes near the smallest N within 5% and fails far from it', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'triangle-n', P1);
  const t = tools[part1.id];
  for (const [state, passed] of [
    [{ waveform: 'triangle', N: 1 }, false],
    [{ waveform: 'triangle', N: 21 }, false],
    [{ waveform: 'square', N: 3 }, false],
    [{ waveform: 'triangle', N: 5 }, true],
  ]) {
    t.setState(state);
    assert.equal(runner.submit(part1.id, 'triangle-n').passed, passed, JSON.stringify(state));
  }
});

// The worst error of the partial sum through N, as a fraction of the 1 V amplitude, more than
// 0.1 ms (T/10) from every jump (square) or corner (triangle), by the engine.
function sumError(waveform, N) {
  const input = { waveform, amp: 1, f0: 1000, offset: 0, shift: 0 };
  const s = series(input);
  const marks = waveform === 'square' ? [0, 0.5, 1] : [0.25, 0.75];
  let worst = 0;
  for (let i = 0; i < 4000; i += 1) {
    const p = (i + 0.5) / 4000;
    if (marks.some((m) => Math.abs(p - m) < 0.1)) continue;
    worst = Math.max(worst, Math.abs(partialSum(s, N, p * 1e-3) - ideal(input, p * 1e-3)));
  }
  return worst;
}

test('the N Tasks accept the engine\'s smallest N within 5%, and fail every N whose sum is off by more than 6%', () => {
  for (const [taskId, waveform] of [['square-n', 'square'], ['triangle-n', 'triangle']]) {
    let smallest = 0;
    while (sumError(waveform, smallest) > 0.05) smallest += 1;
    const tooFew = [];
    for (let N = 0; N < smallest; N += 1) if (sumError(waveform, N) > 0.06) tooFew.push(N);
    const { runner, tools } = start();
    passUpTo(runner, tools, part1, taskId, P1);
    for (const N of tooFew) {
      tools[part1.id].setState({ waveform, N });
      assert.equal(runner.submit(part1.id, taskId).passed, false, `${waveform} N = ${N}`);
    }
    tools[part1.id].setState({ waveform, N: smallest });
    assert.equal(runner.submit(part1.id, taskId).passed, true, `${waveform} N = ${smallest}`);
  }
});

test('Part 1 ends with free-text Questions on jumps and corners, and on two descriptions of one signal', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'explain', P1);
  const task = taskOf(part1, 'explain');
  assert.deepEqual(task.questions.map((q) => q.kind), ['text', 'text']);
  assert.match(task.questions[0].prompt, /jump/);
  assert.match(task.questions[0].prompt, /corner/);
  assert.match(task.questions[1].prompt, /same signal/i);
  assert.equal(runner.submit(part1.id, 'explain', { jumps: 'because', descriptions: 'both' }).passed, true);
});

test('Part 2: hand-computed a₁, b₁ pass within 2% and fail outside it', () => {
  const { runner } = start();
  assert.equal(runner.submit(part2.id, 'ab-1', { a1: '-0.48', b1: '0.866' }).passed, false);
  assert.equal(runner.submit(part2.id, 'ab-1', { a1: '0.5', b1: '0.866' }).passed, false);
  assert.equal(runner.submit(part2.id, 'ab-1', { a1: '-0.505', b1: '0.86' }).passed, true);
});

test('Part 2: A₁ passes within 2%, and φ₁ within ±2° at any equivalent angle', () => {
  for (const [answers, passed] of [
    [{ A1: '1', phi1: '-120' }, true],
    [{ A1: '1.015', phi1: '240' }, true],
    [{ A1: '1', phi1: '-841.5' }, true], // −121.5 − 720
    [{ A1: '1', phi1: '-60' }, false],
    [{ A1: '1', phi1: '-123' }, false],
    [{ A1: '1.03', phi1: '-120' }, false],
  ]) {
    const { runner, tools } = start();
    passUpTo(runner, tools, part2, 'A-phi-1', P2);
    assert.equal(runner.submit(part2.id, 'A-phi-1', answers).passed, passed, JSON.stringify(answers));
  }
});

test('Part 2 ends on a choice: the n = 2 and n = 3 products have zero net area', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part2, 'off-harmonic', P2);
  const q = taskOf(part2, 'off-harmonic').questions[0];
  assert.equal(q.kind, 'choice');
  const wrong = q.choices.find((c) => c.id !== decodeKey(q.correct));
  assert.equal(runner.submit(part2.id, 'off-harmonic', { [q.id]: wrong.id }).passed, false);
  assert.equal(runner.submit(part2.id, 'off-harmonic', { [q.id]: 'zero' }).passed, true);
});

test('Part 3: hand-computed Aₙ and φₙ of the square wave pass, with phases at any equivalent angle', () => {
  const ok = P3['A-phi-square'].answers;
  for (const [answers, passed] of [
    [ok, true],
    [{ ...ok, phi1: '270', phi3: '-450', phi5: '-91.5' }, true],
    [{ ...ok, A3: '0.4' }, false],         // 6% low
    [{ ...ok, A2: '0.1' }, false],         // even terms are zero
    [{ ...ok, phi3: '90' }, false],
  ]) {
    const { runner } = start();
    assert.equal(runner.submit(part3.id, 'A-phi-square', answers).passed, passed, JSON.stringify(answers));
  }
});

test('Part 3 explains why the square wave\'s φₙ is −90° under the cos convention', () => {
  const prompt = taskOf(part3, 'A-phi-square').prompt;
  assert.match(prompt, /−90°/);
  assert.match(prompt, /cos/);
  assert.match(prompt, /sin/);
});

test('Part 3 ends on a choice: even terms are zero and Aₙ ∝ 1/n', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part3, 'pattern', P3);
  const q = taskOf(part3, 'pattern').questions[0];
  assert.equal(q.kind, 'choice');
  assert.equal(runner.submit(part3.id, 'pattern', { [q.id]: 'odd-1-over-n2' }).passed, false);
  assert.equal(runner.submit(part3.id, 'pattern', { [q.id]: 'even-zero-1-over-n' }).passed, true);
});

test('the answer keys agree with the engine: series() for Aₙ, φₙ; productAverage() for aₙ, bₙ', () => {
  const keyOf = (part, taskId, qId) => decodeKey(taskOf(part, taskId).questions.find((q) => q.id === qId).answer);
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

  const sine = { waveform: 'sine', amp: 1, f0: 1000, offset: 0, shift: 30 };
  assert.ok(Math.abs(keyOf(part2, 'ab-1', 'a1') - 2 * productAverage(sine, 'cos', 1)) < 1e-3);
  assert.ok(Math.abs(keyOf(part2, 'ab-1', 'b1') - 2 * productAverage(sine, 'sin', 1)) < 1e-3);
  const [s1] = series(sine).terms;
  assert.ok(Math.abs(keyOf(part2, 'A-phi-1', 'A1') - s1.amp) < 1e-9);
  assert.ok(Math.abs(wrap(keyOf(part2, 'A-phi-1', 'phi1') - s1.phase)) < 1e-9);

  const square = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
  for (const term of series(square, 5).terms) {
    assert.ok(Math.abs(keyOf(part3, 'A-phi-square', `A${term.n}`) - term.amp) < 1e-9, `A${term.n}`);
    if (term.n % 2) assert.ok(Math.abs(wrap(keyOf(part3, 'A-phi-square', `phi${term.n}`) - term.phase)) < 1e-9, `φ${term.n}`);
  }
});

test('amplitude answers use a 2% relative tolerance, and phases ±2° mod 360', () => {
  const numeric = allQuestions().filter((q) => q.kind === 'numeric');
  assert.ok(numeric.length >= 12);
  for (const q of numeric) {
    if (q.id.startsWith('phi')) assert.deepEqual([q.tol, q.modulus, q.relTol], [2, 360, undefined], q.id);
    else assert.deepEqual([q.relTol, q.tol, q.modulus], [0.02, undefined, undefined], q.id);
  }
});

test('text Questions are recorded, not graded', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'explain', P1);
  const attempt = runner.submit(part1.id, 'explain', {});
  assert.equal(attempt.passed, true);
  assert.ok(attempt.results.filter((r) => r.kind === 'question').every((r) => r.graded === false));
});

test('the spectrum is hidden in each coefficient Task and shown in the Task after it', () => {
  const { runner, tools } = start();
  const visible = (part) => tools[part.id].controls.get('spectrum').isVisible;
  for (const [part, answers, coefficientTasks] of [[part2, P2, ['ab-1', 'A-phi-1']], [part3, P3, ['A-phi-square']]]) {
    for (const task of part.tasks) {
      const coefficient = coefficientTasks.includes(task.id);
      assert.equal(visible(part), !coefficient, `spectrum in Task "${task.id}"`);
      if (!coefficient) break;
      runner.submit(part.id, task.id, answers[task.id].answers);
    }
  }
});

test('the filter stays off and locked in Parts 1–3; Part 1 leaves only the waveform, N and play open', () => {
  const { tools } = start();
  for (const part of [part1, part2, part3]) {
    for (const id of ['filter', 'fc', 'applyGain', 'applyPhase', 'amp', 'f0', 'offset', 'shift']) {
      assert.equal(tools[part.id].controls.get(id).isLocked, true, `${part.id} ${id}`);
    }
  }
  for (const id of ['waveform', 'N', 'play']) assert.equal(tools[part1.id].controls.get(id).isLocked, false, id);
  for (const part of [part2, part3]) {
    assert.equal(tools[part.id].controls.get('waveform').isLocked, true);
    assert.equal(tools[part.id].controls.get('filter-curves').isVisible, false);
  }
});

test('Conditions, numeric answers and choice keys are encoded answer keys', async () => {
  for (const task of allTasks().filter((t) => t.condition)) assert.ok(isEncodedKey(task.condition), task.id);
  for (const q of allQuestions()) {
    if (q.kind === 'numeric') assert.ok(isEncodedKey(q.answer), q.id);
    if (q.kind === 'choice') assert.ok(isEncodedKey(q.correct), q.id);
  }
  const source = await readFile(new URL('../../../tools/fourier/activities/fourier-series.js', import.meta.url), 'utf8');
  for (const leak of ['1.273', '0.424', '0.866', '-120', '240', 'above:', 'below:']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
});

test('no Hint states the value that passes its Task', () => {
  const leaks = {
    'square-n': [/\b(1[5-9]|2[0-5])\b/],
    'triangle-n': [/\b[3-7]\b(?!\s*(ms|%))/],
    'ab-1': [/0\.5\b/, /0\.866/, /0\.87/, /√3/],
    'A-phi-1': [/120/, /240/],
    'A-phi-square': [/1\.27/, /0\.42/, /0\.25/, /4\s*\/\s*\(?π/],
  };
  for (const task of allTasks().filter((t) => t.hint)) {
    const text = isEncodedKey(task.hint.text) ? decodeKey(task.hint.text) : task.hint.text;
    for (const leak of leaks[task.id] ?? []) assert.doesNotMatch(text, leak, `Task "${task.id}" Hint: ${text}`);
  }
});
