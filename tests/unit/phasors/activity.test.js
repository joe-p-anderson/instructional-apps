import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRunner, decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';
import { readFileSync } from 'node:fs';
import { div, omega0, omegaC, solve, sum, toPolar } from '../../../tools/phasors/engine.js';
import { LAYERS } from '../../../tools/phasors/layers.js';
import { stubTool } from '../runner/stub-tool.js';

const ACTIVITY_FILE = new URL('../../../tools/phasors/activities/phasors-impedance.json', import.meta.url);
const activity = JSON.parse(readFileSync(ACTIVITY_FILE, 'utf8'));

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

// ── Circuit Parts: shared checks ──

// The Setup Controls a Circuit Part's first Task locks, and the layers it hides.
const CIRCUIT_SETUP = ['includeR', 'includeL', 'includeC', 'V0', 'R', 'L', 'C', 'omega'];

// The engine's solution of a Circuit Part's Setup (L in mH and C in µF, as the Mode takes them).
function solved(part) {
  const s = part.setup;
  const include = ['R', 'L', 'C'].filter((k) => s[`include${k}`]);
  return solve({ V0: s.V0, R: s.R, L: (s.L ?? 0) / 1e3, C: (s.C ?? 0) / 1e6, include, omega: s.omega });
}

// Pass every Task of a Part in order, checking which layers are visible as each Task opens.
function checkReveals(part, answers, visibleAt) {
  const { runner, tools } = start();
  const visible = (id) => tools[part.id].controls.get(id).isVisible;
  for (const task of part.tasks) {
    for (const id of LAYERS.circuit) {
      assert.equal(visible(id), visibleAt[task.id].includes(id), `layer ${id} as Task "${task.id}" opens`);
    }
    if (answers[task.id]?.state) tools[part.id].setState(answers[task.id].state);
    assert.equal(runner.submit(part.id, task.id, answers[task.id]?.answers ?? {}).passed, true, task.id);
  }
}

// Each [answers, passed] pair submitted to a fresh Run at Task `taskId`.
function checkJudging(part, answers, taskId, cases) {
  for (const [given, passed] of cases) {
    const { runner, tools } = start();
    passUpTo(runner, tools, part, taskId, answers);
    if (answers[taskId]?.state) tools[part.id].setState(answers[taskId].state);
    assert.equal(runner.submit(part.id, taskId, given).passed, passed, `${taskId} ${JSON.stringify(given)}`);
  }
}

// A choice Task passes on `right` alone.
function checkChoice(part, answers, taskId, right) {
  const q = taskOf(part, taskId).questions.find((x) => x.kind === 'choice');
  assert.ok(q.choices.some((c) => c.id === right), `${taskId} offers ${right}`);
  for (const c of q.choices.filter((x) => x.id !== right)) {
    checkJudging(part, answers, taskId, [[{ ...answers[taskId]?.answers, [q.id]: c.id }, false]]);
  }
  checkJudging(part, answers, taskId, [[{ ...answers[taskId]?.answers, [q.id]: right }, true]]);
}

// The Task's keys agree with the engine: magnitudes relative, phases mod 360.
function checkKeys(part, taskId, expected) {
  for (const [qId, value] of Object.entries(expected)) {
    const key = keyOf(part, taskId, qId);
    const diff = qId.startsWith('phi') ? Math.abs(wrap(key - value)) : Math.abs(key - value) / Math.abs(value);
    assert.ok(diff < 1e-9, `${taskId}/${qId}: key ${key}, engine ${value}`);
  }
}

const polar = (z) => toPolar(z);

// ── Part 2: Series RC ──
// Worked by hand: X_C = 1/(ωC) = 1/(1000 · 2.5 µF) = 400 Ω, so Z = 300 − j400 Ω = 500∠−53.13° Ω
// (a 3-4-5 triangle); I = 10 V / Z = 20 mA∠53.13°; V_R = 6 V∠53.13°; V_C = I · 400∠−90° =
// 8 V∠−36.87°; V_C/V_in = 1/(1 + j0.75) = 0.8∠−36.87°; ω_c = 1/(RC) = 1333 rad/s, f_c = 212 Hz.
const part2 = partOf('rc');
const UNSWEPT = { omegaMin: 1000, omegaMax: 1000 };
const P2 = {
  'rc-impedance': { answers: { ZRe: '300', ZIm: '-400', Z: '500', phiZ: '-53.13' } },
  'rc-current': { answers: { I: '20', phiI: '53.13' } },
  'rc-voltages': { answers: { VR: '6', phiVR: '53.13', VC: '8', phiVC: '-36.87' } },
  'rc-phase': { answers: { phase: 'in-phase-lags' } },
  'rc-ratio': { answers: { H: '0.8', phiH: '-36.87' } },
  'rc-cutoff': { answers: { fc: 'over-2pi' } },
  'rc-sweep': { state: { omegaMin: 300, omegaMax: 5000 }, answers: { sweep: 'falls' } },
};

test('Part 2 is the series RC circuit on the Circuit Mode, L off, with ω within a factor of 3 of ω_c', () => {
  assert.equal(activity.parts[1], part2);
  assert.equal(part2.title, 'Part 2: Series RC');
  assert.equal(part2.mode, 'circuit');
  assert.deepEqual(part2.setup, { includeR: true, includeL: false, includeC: true, V0: 10, R: 300, C: 2.5, omega: 1000 });
  const ratio = part2.setup.omega / omegaC(part2.setup.R, part2.setup.C / 1e6);
  assert.ok(ratio > 1 / 3 && ratio < 3, `ω/ω_c = ${ratio}`);
});

test('Part 2 runs Z, I, the device voltages, their phases, then the Fourier link: ratio, cutoff, sweep', () => {
  assert.deepEqual(part2.tasks.map((t) => t.id),
    ['rc-impedance', 'rc-current', 'rc-voltages', 'rc-phase', 'rc-ratio', 'rc-cutoff', 'rc-sweep']);
});

test('the Part 2 Z Task locks the Setup and gives Z_C = 1/(jωC)', () => {
  const { tools } = start();
  for (const id of CIRCUIT_SETUP) assert.equal(tools[part2.id].controls.get(id).isLocked, true, id);
  assert.match(taskOf(part2, 'rc-impedance').prompt, /1\/\(jωC\)/);
});

test('each Part 2 compute Task hides its layer, and the next Task shows it', () => {
  const none = [];
  checkReveals(part2, P2, {
    'rc-impedance': none,
    'rc-current': ['Ztotal'],
    'rc-voltages': ['Ztotal', 'I'],
    'rc-phase': ['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl'],
    'rc-ratio': ['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl'],
    'rc-cutoff': ['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl'],
    'rc-sweep': ['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl'],
  });
});

test('the Part 2 Z Task passes both forms within 2% and ±2° at any equivalent angle, and fails wrong ones', () => {
  checkJudging(part2, P2, 'rc-impedance', [
    [{ ZRe: '300', ZIm: '-400', Z: '500', phiZ: '-53.13' }, true],
    [{ ZRe: '305', ZIm: '-395', Z: '509', phiZ: '306.87' }, true], // −53.13 + 360
    [{ ZRe: '300', ZIm: '400', Z: '500', phiZ: '53.13' }, false], // +j: the inductor's sign
    [{ ZRe: '300', ZIm: '-400', Z: '700', phiZ: '-53.13' }, false], // R + X_C
    [{ ZRe: '300', ZIm: '-400', Z: '500', phiZ: '-36.87' }, false], // arctan(R/X)
    [{ ZRe: '300', ZIm: '-0.0004', Z: '300', phiZ: '0' }, false], // ωC, not 1/(ωC)
  ]);
});

test('the Part 2 current and voltage Tasks pass the hand answers and fail common slips', () => {
  checkJudging(part2, P2, 'rc-current', [
    [{ I: '20', phiI: '53.13' }, true],
    [{ I: '19.7', phiI: '-306.87' }, true],
    [{ I: '20', phiI: '-53.13' }, false], // ∠Z, not −∠Z
    [{ I: '0.02', phiI: '53.13' }, false], // in A, not mA
  ]);
  checkJudging(part2, P2, 'rc-voltages', [
    [{ VR: '6', phiVR: '53.13', VC: '8', phiVC: '-36.87' }, true],
    [{ VR: '6.1', phiVR: '55', VC: '7.9', phiVC: '323.13' }, true],
    [{ VR: '6', phiVR: '53.13', VC: '8', phiVC: '143.13' }, false], // V_C leading I
    [{ VR: '8', phiVR: '53.13', VC: '6', phiVC: '-36.87' }, false], // swapped
  ]);
});

test('the Part 2 phase Task passes only on V_R in phase with I and V_C lagging by 90°', () => {
  checkChoice(part2, P2, 'rc-phase', 'in-phase-lags');
});

test('the Part 2 ratio Task gives the Fourier H, and passes V_C/V_in = 0.8∠−36.87°', () => {
  assert.match(taskOf(part2, 'rc-ratio').prompt, /1\/\(1 \+ jωRC\)/);
  assert.match(taskOf(part2, 'rc-ratio').prompt, /1\/\(1 \+ jf\/f<sub>c<\/sub>\)/); // the Fourier H
  checkJudging(part2, P2, 'rc-ratio', [
    [{ H: '0.8', phiH: '-36.87' }, true],
    [{ H: '0.6', phiH: '53.13' }, false], // V_R/V_in
    [{ H: '0.8', phiH: '36.87' }, false],
  ]);
});

test('the Part 2 cutoff Task passes only on f_c = ω_c/2π', () => {
  checkChoice(part2, P2, 'rc-cutoff', 'over-2pi');
});

test('the Part 2 sweep Task opens ω and passes only once ω has been swept across ω_c both ways', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part2, 'rc-sweep', P2);
  assert.equal(tools[part2.id].controls.get('omega').isLocked, false);
  for (const id of CIRCUIT_SETUP.filter((x) => x !== 'omega')) {
    assert.equal(tools[part2.id].controls.get(id).isLocked, true, id);
  }
  const answers = P2['rc-sweep'].answers;
  for (const [state, passed] of [
    [UNSWEPT, false],
    [{ omegaMin: 300, omegaMax: 1000 }, false], // down only
    [{ omegaMin: 1000, omegaMax: 5000 }, false], // up only
    [{ omegaMin: 500, omegaMax: 5000 }, false], // not a factor of 3 below ω_c
    [{ omegaMin: 300, omegaMax: 5000 }, true],
  ]) {
    tools[part2.id].setState(state);
    assert.equal(runner.submit(part2.id, 'rc-sweep', answers).passed, passed, JSON.stringify(state));
  }
  checkChoice(part2, P2, 'rc-sweep', 'falls');
});

test('the Part 2 answer keys agree with the engine', () => {
  const s = solved(part2);
  const Z = polar(s.Z.total);
  const I = polar(s.I);
  const H = polar(div(s.V.C, s.Vin));
  checkKeys(part2, 'rc-impedance', { ZRe: s.Z.total.re, ZIm: s.Z.total.im, Z: Z.A, phiZ: Z.phi });
  checkKeys(part2, 'rc-current', { I: I.A * 1e3, phiI: I.phi });
  checkKeys(part2, 'rc-voltages', { VR: polar(s.V.R).A, phiVR: polar(s.V.R).phi, VC: polar(s.V.C).A, phiVC: polar(s.V.C).phi });
  checkKeys(part2, 'rc-ratio', { H: H.A, phiH: H.phi });
  const wc = omegaC(part2.setup.R, part2.setup.C / 1e6);
  const fc = taskOf(part2, 'rc-cutoff').questions[0].choices.find((c) => c.id === 'over-2pi');
  assert.match(fc.text, new RegExp(`${Math.round(wc / (2 * Math.PI))} Hz`));
});

// ── Part 3: Series RLC ──
// Worked by hand: X_L = ωL = 1000 · 0.2 H = 200 Ω and X_C = 1/(1000 · 12.5 µF) = 80 Ω, so
// Z = 50 + j120 Ω = 130∠67.38° Ω (a 5-12-13 triangle); I = 6.5 V / Z = 50 mA∠−67.38°;
// V_R = 2.5 V∠−67.38°, V_L = 10 V∠22.62°, V_C = 4 V∠−157.38°; ω₀ = 1/√(LC) = 632.5 rad/s.
const part3 = partOf('rlc');
const P3 = {
  'rlc-impedance': { answers: { ZRe: '50', ZIm: '120', Z: '130', phiZ: '67.38' } },
  'rlc-current': { answers: { I: '50', phiI: '-67.38' } },
  'rlc-voltages': { answers: { VR: '2.5', phiVR: '-67.38', VL: '10', phiVL: '22.62', VC: '4', phiVC: '-157.38' } },
  'rlc-phase': { answers: { phase: 'lead-lag' } },
  'rlc-resonance': { state: { angleZ: 0.3, omegaMin: 600, omegaMax: 1000 }, answers: { omega0: '632.5' } },
};

test('Part 3 is the series RLC circuit on the Circuit Mode, with ω within a factor of 3 of ω₀', () => {
  assert.equal(activity.parts[2], part3);
  assert.equal(part3.title, 'Part 3: Series RLC');
  assert.equal(part3.mode, 'circuit');
  assert.deepEqual(part3.setup, { includeR: true, includeL: true, includeC: true, V0: 6.5, R: 50, L: 200, C: 12.5, omega: 1000 });
  const ratio = part3.setup.omega / omega0(part3.setup.L / 1e3, part3.setup.C / 1e6);
  assert.ok(ratio > 1 / 3 && ratio < 3, `ω/ω₀ = ${ratio}`);
});

test('Part 3 runs Z, I, the device voltages, their phases, resonance, then the free-text why', () => {
  assert.deepEqual(part3.tasks.map((t) => t.id),
    ['rlc-impedance', 'rlc-current', 'rlc-voltages', 'rlc-phase', 'rlc-resonance', 'rlc-why']);
});

test('the Part 3 Z Task locks the Setup and gives Z_L = jωL and Z_C = 1/(jωC)', () => {
  const { tools } = start();
  for (const id of CIRCUIT_SETUP) assert.equal(tools[part3.id].controls.get(id).isLocked, true, id);
  assert.match(taskOf(part3, 'rlc-impedance').prompt, /jωL/);
  assert.match(taskOf(part3, 'rlc-impedance').prompt, /1\/\(jωC\)/);
});

test('each Part 3 compute Task hides its layer, and the next Task shows it', () => {
  const all = ['Ztotal', 'I', 'VR', 'VL', 'VC', 'kvl'];
  checkReveals(part3, P3, {
    'rlc-impedance': [],
    'rlc-current': ['Ztotal'],
    'rlc-voltages': ['Ztotal', 'I'],
    'rlc-phase': all,
    'rlc-resonance': all,
    'rlc-why': all,
  });
});

test('the Part 3 compute Tasks pass the hand answers, equivalent angles included, and fail common slips', () => {
  checkJudging(part3, P3, 'rlc-impedance', [
    [{ ZRe: '50', ZIm: '120', Z: '130', phiZ: '67.38' }, true],
    [{ ZRe: '50.9', ZIm: '118', Z: '128', phiZ: '-292.62' }, true], // 67.38 − 360
    [{ ZRe: '50', ZIm: '280', Z: '284.4', phiZ: '79.88' }, false], // X_L + X_C
    [{ ZRe: '50', ZIm: '-120', Z: '130', phiZ: '-67.38' }, false], // X_C − X_L
  ]);
  checkJudging(part3, P3, 'rlc-current', [
    [{ I: '50', phiI: '-67.38' }, true],
    [{ I: '49.5', phiI: '292.62' }, true],
    [{ I: '50', phiI: '67.38' }, false],
  ]);
  checkJudging(part3, P3, 'rlc-voltages', [
    [{ VR: '2.5', phiVR: '-67.38', VL: '10', phiVL: '22.62', VC: '4', phiVC: '-157.38' }, true],
    [{ VR: '2.5', phiVR: '292.62', VL: '10', phiVL: '-337.38', VC: '4', phiVC: '202.62' }, true],
    [{ VR: '2.5', phiVR: '-67.38', VL: '10', phiVL: '-157.38', VC: '4', phiVC: '22.62' }, false], // leads and lags swapped
    [{ VR: '2.5', phiVR: '-67.38', VL: '4', phiVL: '22.62', VC: '10', phiVC: '-157.38' }, false],
  ]);
});

test('the Part 3 phase Task passes only on V_L leading I by 90° and V_C lagging it by 90°', () => {
  checkChoice(part3, P3, 'rlc-phase', 'lead-lag');
});

test('the resonance Task opens ω and passes only at ∠Z ≈ 0 with ω₀ = 1/√(LC)', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part3, 'rlc-resonance', P3);
  assert.equal(tools[part3.id].controls.get('omega').isLocked, false);
  for (const id of CIRCUIT_SETUP.filter((x) => x !== 'omega')) {
    assert.equal(tools[part3.id].controls.get(id).isLocked, true, id);
  }
  for (const [state, answers, passed] of [
    [{ angleZ: 67.38 }, { omega0: '632.5' }, false], // not swept: still at ω = 1000
    [{ angleZ: -5 }, { omega0: '632.5' }, false],
    [{ angleZ: 5 }, { omega0: '632.5' }, false],
    [{ angleZ: 0.4 }, { omega0: '1000' }, false],
    [{ angleZ: 0.4 }, { omega0: '100' }, false], // 1/(LC) without the root
    [{ angleZ: 1.5 }, { omega0: '625' }, true],
  ]) {
    tools[part3.id].setState(state);
    assert.equal(runner.submit(part3.id, 'rlc-resonance', answers).passed, passed, `${JSON.stringify(state)} ${JSON.stringify(answers)}`);
  }
});

test('Part 3 ends with a free-text why on V_L and V_C cancelling, recorded and not graded', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part3, 'rlc-why', P3);
  const task = taskOf(part3, 'rlc-why');
  assert.deepEqual(task.questions.map((q) => q.kind), ['text']);
  assert.match(task.questions[0].prompt, /V_L and V_C/);
  assert.match(task.questions[0].prompt, /V₀/);
  const attempt = runner.submit(part3.id, 'rlc-why', {});
  assert.equal(attempt.passed, true);
  assert.ok(attempt.results.filter((r) => r.kind === 'question').every((r) => r.graded === false));
});

test('at the Part 3 resonance V_L and V_C each exceed V₀, so the free text has something to explain', () => {
  const s = part3.setup;
  const w0 = omega0(s.L / 1e3, s.C / 1e6);
  const r = solve({ V0: s.V0, R: s.R, L: s.L / 1e3, C: s.C / 1e6, include: ['R', 'L', 'C'], omega: w0 });
  assert.ok(polar(r.V.L).A > s.V0 && polar(r.V.C).A > s.V0);
});

test('the Part 3 answer keys agree with the engine', () => {
  const s = solved(part3);
  const Z = polar(s.Z.total);
  const I = polar(s.I);
  checkKeys(part3, 'rlc-impedance', { ZRe: s.Z.total.re, ZIm: s.Z.total.im, Z: Z.A, phiZ: Z.phi });
  checkKeys(part3, 'rlc-current', { I: I.A * 1e3, phiI: I.phi });
  const V = (k) => polar(s.V[k]);
  checkKeys(part3, 'rlc-voltages', {
    VR: V('R').A, phiVR: V('R').phi, VL: V('L').A, phiVL: V('L').phi, VC: V('C').A, phiVC: V('C').phi,
  });
  checkKeys(part3, 'rlc-resonance', { omega0: omega0(part3.setup.L / 1e3, part3.setup.C / 1e6) });
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
  const source = await readFile(ACTIVITY_FILE, 'utf8');
  for (const leak of ['53.1', '3.60', '3.61', '73.9', '√13', 'target:', 'below:', 'above:',
    '36.8', '67.3', '22.6', '157.3', '632.', '1333.']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
});

test('no Hint states the value that passes its Task', () => {
  const leaks = {
    'right-angle': [/\b5\b(?!\s*%)/, /53/],
    'law-of-cosines': [/√13/, /3\.6/, /73/, /74/],
    'rc-impedance': [/500/, /400/, /53/],
    'rc-current': [/\b20\b/, /53/],
    'rc-voltages': [/\b6\b/, /\b8\b/, /36/, /53/],
    'rc-ratio': [/0\.8/, /36/],
    'rlc-impedance': [/120/, /130/, /67/],
    'rlc-current': [/\b50\b/, /67/],
    'rlc-voltages': [/2\.5/, /\b10\b/, /\b4\b/, /22/, /157/],
  };
  for (const task of allTasks().filter((t) => t.hint)) {
    const text = isEncodedKey(task.hint.text) ? decodeKey(task.hint.text) : task.hint.text;
    for (const leak of leaks[task.id] ?? []) assert.doesNotMatch(text, leak, `Task "${task.id}" Hint: ${text}`);
  }
});
