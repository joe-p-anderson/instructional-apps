import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRunner, decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';
import activity from '../../../tools/fourier/activities/fourier-series.js';
import { filterResponse, filterSeries, ideal, partialSum, productAverage, series } from '../../../tools/fourier/engine.js';
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

const [part1, part2, part3, part4] = activity.parts;
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
  'ab-1': { answers: { a1: '0', b1: '1' } },
  'A-phi-1': { answers: { A1: '1', phi1: '-90' } },
};
const P3 = {
  'A-phi-square': { answers: { A1: '1.273', A2: '0', A3: '0.424', A4: '0', A5: '0.255', phi1: '-90', phi3: '-90', phi5: '-90' } },
};
// Part 4: A3 = 4/(3*pi) through |H(3 kHz)| = 1/sqrt 2, and phi3 = -90 deg plus angle H = -45 deg
// (low-pass) or +45 deg (high-pass); |H_LP| + |H_HP| = sqrt 2 at f_c.
const TOGGLES = (gain, phase) => ({ state: { applyGain: gain, applyPhase: phase } });
const P4 = {
  'gain-only': TOGGLES(true, false),
  'phase-only': TOGGLES(false, true),
  both: { ...TOGGLES(true, true), answers: { 'rc-curve': 'both' } },
  'why-both': {},
  'lowpass-3': { answers: { A3out: '0.300', phi3out: '-135' } },
  'to-highpass': { state: { filter: 'highpass', applyGain: true, applyPhase: true }, answers: { spikes: 'both' } },
  'highpass-3': { answers: { A3out: '0.300', phi3out: '-45' } },
};

test('the Activity names the fourier Tool, for PHY/EGR 3120, with Parts on Synthesis, Analysis, Analysis, Synthesis', () => {
  assert.equal(activity.tool, 'fourier');
  assert.equal(activity.course, 'PHY/EGR 3120');
  assert.equal(activity.title, 'Frequency Domain: Fourier Series');
  assert.deepEqual(activity.parts.map((p) => p.mode), ['synthesis', 'analysis', 'analysis', 'synthesis']);
});

test('each Setup fixes the waveform, shift, f₀ = 1 kHz, ±1 V and the filter off; Part 1 shows the coefficient table', () => {
  const fixed = { amp: 1, f0: 1000, offset: 0, filter: 'off' };
  assert.deepEqual(part1.setup, { ...fixed, waveform: 'square', shift: 0, N: 1, coefficientTable: true });
  assert.deepEqual(part2.setup, { ...fixed, waveform: 'sine', shift: 0, testFunction: 'cos', n: 1 });
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
    [{ waveform: 'square', N: 15 }, false],
    [{ waveform: 'square', N: 18 }, false],
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

test('Part 2 is a plain sine: no shift in its title, Task text, Hints or Questions', () => {
  assert.equal(part2.title, 'Part 2: A Sine');
  for (const task of part2.tasks) {
    const texts = [task.title, task.prompt, task.hint?.text ?? '',
      ...(task.questions ?? []).flatMap((q) => [q.prompt, ...(q.choices ?? []).map((c) => c.text)])];
    for (const text of texts) assert.doesNotMatch(text, /shift|30°/i, `Task "${task.id}": ${text}`);
  }
});

test('Part 2: hand-computed a₁ = 0 passes within 0.01 V, and b₁ within 2%', () => {
  for (const [answers, passed] of [
    [{ a1: '0', b1: '1' }, true],
    [{ a1: '-0.008', b1: '1.015' }, true],
    [{ a1: '0.02', b1: '1' }, false],
    [{ a1: '0', b1: '0.97' }, false],
    [{ a1: '1', b1: '0' }, false], // a₁ and b₁ swapped
  ]) {
    const { runner } = start();
    assert.equal(runner.submit(part2.id, 'ab-1', answers).passed, passed, JSON.stringify(answers));
  }
});

test('Part 2: A₁ passes within 2%, and φ₁ within ±2° at any equivalent angle', () => {
  for (const [answers, passed] of [
    [{ A1: '1', phi1: '-90' }, true],
    [{ A1: '1.015', phi1: '270' }, true],
    [{ A1: '1', phi1: '-811.5' }, true], // −91.5 − 720
    [{ A1: '1', phi1: '90' }, false],
    [{ A1: '1', phi1: '0' }, false],
    [{ A1: '1', phi1: '-93' }, false],
    [{ A1: '1.03', phi1: '-90' }, false],
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
    [{ ...ok, A2: '0.005', A4: '-0.01' }, true], // zero within 0.01 V
    [{ ...ok, A4: '0.02' }, false],
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

  const sine = { waveform: 'sine', amp: 1, f0: 1000, offset: 0, shift: 0 };
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

test('amplitude answers use a 2% relative tolerance (0.01 V absolute for a zero), and phases ±2° mod 360', () => {
  const numeric = allQuestions().filter((q) => q.kind === 'numeric');
  assert.ok(numeric.length >= 12);
  for (const q of numeric) {
    if (q.id.startsWith('phi')) assert.deepEqual([q.tol, q.modulus, q.relTol], [2, 360, undefined], q.id);
    else if (decodeKey(q.answer) === 0) assert.deepEqual([q.tol, q.relTol, q.modulus], [0.01, undefined, undefined], q.id);
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
  for (const leak of ['1.273', '0.424', '-90', 'above:', 'below:', 'equals:', '0.300', '-135', '-45', '1.414', '0.707']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
});

test('no Hint states the value that passes its Task', () => {
  const leaks = {
    'square-n': [/\b(1[5-9]|2[0-5])\b/],
    'triangle-n': [/\b[3-7]\b(?!\s*(ms|%))/],
    'ab-1': [/[ab]₁\s*(=|is)\s*[01]\b/],
    'A-phi-1': [/90/, /270/],
    'A-phi-square': [/1\.27/, /0\.42/, /0\.25/, /4\s*\/\s*\(?π/],
    'lowpass-3': [/0\.30/, /0\.70?7/, /135/, /45/, /√2/],
    'highpass-3': [/0\.30/, /0\.70?7/, /45/, /√2/],
    'gains-add': [/1\.41/, /√2/],
  };
  for (const task of allTasks().filter((t) => t.hint)) {
    const text = isEncodedKey(task.hint.text) ? decodeKey(task.hint.text) : task.hint.text;
    for (const leak of leaks[task.id] ?? []) assert.doesNotMatch(text, leak, `Task "${task.id}" Hint: ${text}`);
  }
});

test('Part 4 fixes the square wave, f₀ = 1 kHz, f_c = 3 kHz and the low-pass filter, with both toggles off', () => {
  assert.equal(part4.id, 'filters');
  assert.equal(part4.title, 'Part 4: RC Filters on the Square Wave');
  assert.deepEqual(part4.setup, {
    amp: 1, f0: 1000, offset: 0, waveform: 'square', shift: 0, fc: 3000, filter: 'lowpass', applyGain: false, applyPhase: false, N: 30,
  });
});

test('the Activity ends with Part 4: the low-pass half, then the switch to high-pass and its half', () => {
  assert.equal(activity.parts.length, 4);
  assert.deepEqual(part4.tasks.map((t) => t.id), [
    'gain-only', 'phase-only', 'both', 'why-both', 'lowpass-3', 'to-highpass', 'highpass-3', 'gains-add',
  ]);
});

test('Part 4 locks the input and filter type, leaving the gain and phase toggles, N and play open', () => {
  const { tools } = start();
  for (const id of ['waveform', 'amp', 'f0', 'offset', 'shift', 'filter', 'fc']) {
    assert.equal(tools[part4.id].controls.get(id).isLocked, true, id);
  }
  for (const id of ['applyGain', 'applyPhase', 'N', 'play']) {
    assert.equal(tools[part4.id].controls.get(id).isLocked, false, id);
  }
});

test('the low-pass toggle Tasks pass only on the toggle states they ask for', () => {
  for (const [taskId, want] of [['gain-only', [true, false]], ['phase-only', [false, true]], ['both', [true, true]]]) {
    for (const gain of [false, true]) {
      for (const phase of [false, true]) {
        const { runner, tools } = start();
        passUpTo(runner, tools, part4, taskId, P4);
        tools[part4.id].setState({ applyGain: gain, applyPhase: phase });
        const passed = gain === want[0] && phase === want[1];
        const attempt = runner.submit(part4.id, taskId, P4[taskId].answers ?? {});
        assert.equal(attempt.passed, passed, `${taskId} gain ${gain} phase ${phase}`);
      }
    }
  }
});

test('the choice on the RC charging curve passes only on gain and phase together', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part4, 'both', P4);
  tools[part4.id].setState({ applyGain: true, applyPhase: true });
  const q = taskOf(part4, 'both').questions.find((x) => x.id === 'rc-curve');
  assert.equal(q.kind, 'choice');
  assert.deepEqual(q.choices.map((c) => c.id), ['gain', 'phase', 'both', 'either']);
  assert.equal(runner.submit(part4.id, 'both', { 'rc-curve': 'gain' }).passed, false);
  assert.equal(runner.submit(part4.id, 'both', { 'rc-curve': 'both' }).passed, true);
});

test('Part 4 asks in free text why both are needed, recorded and not graded', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part4, 'why-both', P4);
  const task = taskOf(part4, 'why-both');
  assert.deepEqual(task.questions.map((q) => q.kind), ['text']);
  assert.match(task.questions[0].prompt, /both/);
  const attempt = runner.submit(part4.id, 'why-both', {});
  assert.equal(attempt.passed, true);
  assert.ok(attempt.results.filter((r) => r.kind === 'question').every((r) => r.graded === false));
});

test('the Task text gives the low-pass formulas, then the high-pass ones', () => {
  const lp = taskOf(part4, 'lowpass-3').prompt;
  assert.ok(lp.includes('|H| = 1/√(1 + (f/f_c)²)'), lp);
  assert.ok(lp.includes('∠H = −arctan(f/f_c)'), lp);
  const hp = taskOf(part4, 'highpass-3').prompt;
  assert.ok(hp.includes('|H| = 1/√(1 + (f_c/f)²)'), hp);
  assert.ok(hp.includes('∠H = arctan(f_c/f)'), hp);
});

test('the hand-computed output 3rd harmonics pass within 2% and ±2° mod 360, and fail outside', () => {
  for (const [taskId, phi] of [['lowpass-3', -135], ['highpass-3', -45]]) {
    for (const [given, passed] of [
      [{ A3out: '0.300', phi3out: String(phi) }, true],
      [{ A3out: '0.305', phi3out: String(phi + 361.5) }, true],
      [{ A3out: '0.424', phi3out: String(phi) }, false], // the input's A₃, unfiltered
      [{ A3out: '0.212', phi3out: String(phi) }, false], // 1/2 in place of 1/√2
      [{ A3out: '0.300', phi3out: '-90' }, false], // the input's φ₃
      [{ A3out: '0.300', phi3out: String(phi + 3) }, false],
    ]) {
      const { runner, tools } = start();
      passUpTo(runner, tools, part4, taskId, P4);
      assert.equal(runner.submit(part4.id, taskId, given).passed, passed, `${taskId} ${JSON.stringify(given)}`);
    }
  }
});

test('a Task unlocks the filter type and passes only once it is high-pass with both toggles on', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part4, 'to-highpass', P4);
  const t = tools[part4.id];
  assert.equal(t.controls.get('filter').isLocked, false);
  assert.equal(t.controls.get('fc').isLocked, true);
  for (const [state, passed] of [
    [{ filter: 'lowpass', applyGain: true, applyPhase: true }, false],
    [{ filter: 'off', applyGain: true, applyPhase: true }, false],
    [{ filter: 'highpass', applyGain: true, applyPhase: false }, false],
    [{ filter: 'highpass', applyGain: false, applyPhase: true }, false],
    [{ filter: 'highpass', applyGain: true, applyPhase: true }, true],
  ]) {
    t.setState(state);
    assert.equal(runner.submit(part4.id, 'to-highpass', P4['to-highpass'].answers).passed, passed, JSON.stringify(state));
  }
});

test('the high-pass spikes choice passes only on gain and phase together', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part4, 'to-highpass', P4);
  tools[part4.id].setState(P4['to-highpass'].state);
  const q = taskOf(part4, 'to-highpass').questions.find((x) => x.id === 'spikes');
  assert.equal(q.kind, 'choice');
  assert.deepEqual(q.choices.map((c) => c.id), ['gain', 'phase', 'both', 'either']);
  assert.equal(runner.submit(part4.id, 'to-highpass', { spikes: 'phase' }).passed, false);
  assert.equal(runner.submit(part4.id, 'to-highpass', { spikes: 'both' }).passed, true);
});

test('the filter type locks again for the high-pass hand computation', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part4, 'highpass-3', P4);
  assert.equal(tools[part4.id].controls.get('filter').isLocked, true);
});

test('Part 4 ends on the two gains: the magnitudes do not add to 1 but the complex gains do', () => {
  const q = taskOf(part4, 'gains-add').questions.find((x) => x.id === 'complex-sum');
  assert.equal(q.kind, 'choice');
  for (const [answers, passed] of [
    [{ magSum: '1.414', 'complex-sum': 'one' }, true],
    [{ magSum: '1.40', 'complex-sum': 'one' }, true],
    [{ magSum: '1', 'complex-sum': 'one' }, false],
    [{ magSum: '1.414', 'complex-sum': 'magnitudes' }, false],
  ]) {
    const { runner, tools } = start();
    passUpTo(runner, tools, part4, 'gains-add', P4);
    assert.equal(runner.submit(part4.id, 'gains-add', answers).passed, passed, JSON.stringify(answers));
  }
});

test('the filtered answer keys agree with the engine: filterSeries() and filterResponse() at 3 kHz', () => {
  const keyOf = (taskId, qId) => decodeKey(taskOf(part4, taskId).questions.find((q) => q.id === qId).answer);
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const square = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
  for (const [taskId, type] of [['lowpass-3', 'lowpass'], ['highpass-3', 'highpass']]) {
    const out = filterSeries(series(square, 3), { type, fc: 3000, gain: true, phase: true }).terms[2];
    assert.equal(out.n, 3);
    assert.ok(Math.abs(keyOf(taskId, 'A3out') - out.amp) < 1e-9, `${type} A₃`);
    assert.ok(Math.abs(wrap(keyOf(taskId, 'phi3out') - out.phase)) < 1e-9, `${type} φ₃`);
  }
  const sum = filterResponse({ type: 'lowpass', fc: 3000 }, 3000).gain + filterResponse({ type: 'highpass', fc: 3000 }, 3000).gain;
  assert.ok(Math.abs(keyOf('gains-add', 'magSum') - sum) < 1e-9);
});

