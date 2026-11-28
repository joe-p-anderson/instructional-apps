// The editor core's Condition edits and Condition problems (ticket 11), on the real Activity files,
// plus the builder's DOM-free helpers: the tolerance field's unit / % mapping and the live result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { decodeKey, isEncodedKey } from '../../../framework/v1/runner/keys.js';
import { toleranceFields, toleranceOf } from '../../../framework/v1/authoring/editor/tolerance.js';
import { judgeLive } from '../../../framework/v1/authoring/editor/condition-model.js';

const read = (path) => readFileSync(new URL(`../../../tools/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FILES = {
  oscilloscope: read('oscilloscope/activities/phase-period-amplitude.json'),
  electrostatics: read('electrostatics/activities/conductor-properties.json'),
  fourier: read('fourier/activities/fourier-series.json'),
  phasors: read('phasors/activities/phasors-impedance.json'),
  spacetime: read('spacetime/activities/lab10.json'),
};
const plain = (v) => JSON.parse(JSON.stringify(v));

// The Condition of Task t of Part p as the saved file stores it, decoded.
function savedCondition(editor, p, t) {
  const stored = JSON.parse(editor.serialize()).parts[p].tasks[t].condition;
  assert.ok(isEncodedKey(stored), 'the saved Condition is encoded');
  return decodeKey(stored);
}

// The first Task in the file without a Condition.
function bareTask(doc) {
  for (const [p, part] of doc.parts.entries()) for (const [t, task] of part.tasks.entries()) if (task.condition === undefined) return { p, t };
  throw new Error('no Task without a Condition');
}

test('a new Condition is saved encoded and decodes to what was built; removing it removes the key', () => {
  const editor = openActivity(FILES.phasors);
  const { p, t } = bareTask(editor.doc);
  const built = { type: 'anyOf', conditions: [{ state: 'phi2', target: 90, tol: 1 }, { type: 'range', state: { expr: 'abs(phi1 - phi2)' }, below: 5 }] };
  editor.edit({ type: 'setConditionNode', p, t, path: [], node: built });
  assert.deepEqual(savedCondition(editor, p, t), built);
  editor.edit({ type: 'setConditionNode', p, t, path: [], node: undefined });
  assert.equal(Object.hasOwn(JSON.parse(editor.serialize()).parts[p].tasks[t], 'condition'), false);
});

const taskAt = (doc, id) => {
  const p = doc.parts.findIndex((part) => part.tasks.some((x) => x.id === id));
  return { p, t: doc.parts[p].tasks.findIndex((x) => x.id === id) };
};

test('editing a nested Condition changes only that node; the others, and their order, are kept', () => {
  // electrostatics pf-t1: [range r1 < 5, anyOf [measureAtInfinity = true, range r2 < 5]]
  const editor = openActivity(FILES.electrostatics);
  const { p, t } = taskAt(editor.doc, 'pf-t1');
  const expected = plain(editor.doc.parts[p].tasks[t].condition);
  editor.edit({ type: 'setConditionFields', p, t, path: [1, 'conditions', 1], fields: { below: { expr: 'r1 / 2' } } });
  editor.edit({ type: 'setConditionNode', p, t, path: [1, 'conditions', 0], node: undefined });
  expected[1].conditions = [{ type: 'range', state: 'r2', below: { expr: 'r1 / 2' } }];
  assert.deepEqual(savedCondition(editor, p, t), expected);
});

test('switching a target between tol and relTol clears the other key and keeps its place', () => {
  const editor = openActivity(FILES.oscilloscope);
  const { p, t } = taskAt(editor.doc, 'period-3');
  editor.edit({ type: 'setConditionFields', p, t, path: [], fields: { relTol: 0.02, tol: undefined } });
  assert.equal(JSON.stringify(savedCondition(editor, p, t)), JSON.stringify({ state: 'T', target: 3, relTol: 0.02, targetLabel: '3.00 s' }));
  editor.edit({ type: 'setConditionFields', p, t, path: [], fields: { tol: 0.1, relTol: undefined } });
  assert.equal(JSON.stringify(savedCondition(editor, p, t)), JSON.stringify({ state: 'T', target: 3, tol: 0.1, targetLabel: '3.00 s' }));
});

// Tool info for the oscilloscope's dual-trace Mode, cut down to the State the tests name.
const OSC_INFO = { modes: { 'dual-trace': { title: 'Dual trace', setupKeys: [], setupOptions: [], controls: [],
  state: { phi: { label: 'φ', unit: 'rad' }, T: { label: 'T', unit: 's' }, pkpk: { label: 'Vpp', unit: 'V' } } } } };
const conditionProblems = (editor, info = OSC_INFO) => editor.problems(info).filter((pr) => pr.path.includes('condition') && pr.source !== 'runner');

test('unknown State, as a State name or inside an expression, is a problem at its slot; none without Tool info', () => {
  const editor = openActivity(FILES.oscilloscope);
  assert.deepEqual(conditionProblems(editor), []);
  const { p, t } = taskAt(editor.doc, 'period-3');
  editor.edit({ type: 'setConditionNode', p, t, path: [], node: { type: 'anyOf', conditions: [
    { state: 'Tx', target: 3, tol: 0.1 },
    [{ type: 'range', state: { expr: 'T * f' }, above: { expr: 'pkpk / 2' }, below: { expr: 'phi + q + f' } }],
  ] } });
  const base = ['parts', p, 'tasks', t, 'condition'];
  assert.deepEqual(conditionProblems(editor).map(({ path, message }) => ({ path, message })), [
    { path: [...base, 'conditions', 0, 'state'], message: 'Task "period-3" Condition names "Tx", which is not State of Mode "dual-trace"' },
    { path: [...base, 'conditions', 1, 0, 'state'], message: 'Task "period-3" Condition expression "T * f" names "f", which is not State of Mode "dual-trace"' },
    { path: [...base, 'conditions', 1, 0, 'below'], message: 'Task "period-3" Condition expression "phi + q + f" names "q" and "f", which are not State of Mode "dual-trace"' },
  ]);
  assert.deepEqual(conditionProblems(editor, null), []);
});

test("an expression that doesn't parse is a runner problem at its slot", () => {
  const editor = openActivity(FILES.oscilloscope);
  const { p, t } = taskAt(editor.doc, 'period-3');
  editor.edit({ type: 'setConditionFields', p, t, path: [], fields: { target: { expr: '2 * (T' } } });
  const runner = editor.problems(OSC_INFO).filter((pr) => pr.source === 'runner');
  assert.equal(runner.length, 1);
  assert.deepEqual(runner[0].path, ['parts', p, 'tasks', t, 'condition', 'target']);
  assert.equal(conditionProblems(editor).length, 0, 'a slot that does not parse is not checked for State as well');
});

test('an empty group, a target with no value and a range with no bound are problems', () => {
  const editor = openActivity(FILES.oscilloscope);
  const { p, t } = taskAt(editor.doc, 'period-3');
  editor.edit({ type: 'setConditionNode', p, t, path: [], node: [{ type: 'anyOf', conditions: [] }, { state: 'T', tol: 0.1 }, { type: 'range', state: 'T' }] });
  const base = ['parts', p, 'tasks', t, 'condition'];
  assert.deepEqual(conditionProblems(editor).map(({ path, message }) => ({ path, message })), [
    { path: [...base, 0], message: 'Task "period-3" Condition has an empty any-of group' },
    { path: [...base, 1, 'target'], message: 'Task "period-3" Condition target needs a value' },
    { path: [...base, 2, 'above'], message: 'Task "period-3" Condition range needs an above or below bound' },
  ]);
});

test('the tolerance field: the unit side writes tol, the % side writes relTol as the percentage / 100, and each clears the other', () => {
  assert.deepEqual(toleranceFields('unit', '0.05'), { tol: 0.05, relTol: undefined });
  assert.deepEqual(toleranceFields('percent', '2'), { tol: undefined, relTol: 0.02 });
  assert.deepEqual(toleranceFields('percent', '7'), { tol: undefined, relTol: 0.07 });
  assert.deepEqual(toleranceFields('percent', ' '), { tol: undefined, relTol: undefined });
  assert.deepEqual(toleranceFields('unit', 'abc'), { tol: 'abc', relTol: undefined }, 'kept as typed, so validation lists it');
  assert.deepEqual(toleranceOf({ tol: 0.5 }), { side: 'unit', text: '0.5' });
  assert.deepEqual(toleranceOf({ relTol: 0.07 }), { side: 'percent', text: '7' });
  assert.deepEqual(toleranceOf({ relTol: 0.005 }), { side: 'percent', text: '0.5' });
  assert.deepEqual(toleranceOf({}), { side: 'unit', text: '' });
});

test('the live result is what a student would get now: pass, or the misses\' feedback', () => {
  const info = { T: { label: 'T', unit: 's' } };
  const condition = { type: 'anyOf', conditions: [{ state: 'T', target: 3, tol: 0.05 }, { type: 'range', state: { expr: 'T * 2' }, below: 1 }] };
  assert.deepEqual(judgeLive(condition, { T: 3.02 }, { info }), { pass: true, feedback: [] });
  assert.deepEqual(judgeLive(condition, { T: 2 }, { info }),
    { pass: false, feedback: ['Any one of: T = 2.00 s; need 3.00 ± 0.05 s — or — T * 2 = 4; need < 1'] });
  assert.deepEqual(judgeLive([{ state: 'T', equals: 2 }, { state: 'T', target: 2, relTol: 0.1 }], { T: 2 }, { info }), { pass: true, feedback: [] });
  assert.match(judgeLive({ type: 'st-rod' }, { T: 2 }, { info }).error, /Unknown Condition type "st-rod"/);
  assert.deepEqual(judgeLive({ type: 'st-rod' }, { T: 2 }, { info, registry: { 'st-rod': () => ({ pass: false, feedback: 'rod off' }) } }),
    { pass: false, feedback: ['rod off'] });
});

test("a Tool's registered Condition types are kept intact when the Condition around them is edited", () => {
  // spacetime flash: [st-worldline u=1, st-worldline u=-1]; append a target, drop the first
  const editor = openActivity(FILES.spacetime);
  const { p, t } = taskAt(editor.doc, 'flash');
  const [, second] = plain(editor.doc.parts[p].tasks[t].condition);
  editor.edit({ type: 'setConditionNode', p, t, path: [2], node: { state: 'u', target: 0, tol: 0.1 } });
  editor.edit({ type: 'setConditionNode', p, t, path: [0], node: undefined });
  assert.deepEqual(savedCondition(editor, p, t), [second, { state: 'u', target: 0, tol: 0.1 }]);
  assert.equal(second.type, 'st-worldline');
});
