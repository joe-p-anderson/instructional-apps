// The editor core's Question edits, tolerance presets and the Question problems
// (framework/v1/authoring/editor/core.js, edits.js, tolerance.js, problems.js), on the real
// Activity files and on a small one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { TOLERANCE_PRESETS, presetOf, toleranceText, toleranceValues } from '../../../framework/v1/authoring/editor/tolerance.js';
import { decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';

const read = (path) => readFileSync(new URL(`../../../tools/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FILES = {
  oscilloscope: read('oscilloscope/activities/phase-period-amplitude.json'),
  electrostatics: read('electrostatics/activities/conductor-properties.json'),
  fourier: read('fourier/activities/fourier-series.json'),
  phasors: read('phasors/activities/phasors-impedance.json'),
  spacetime: read('spacetime/activities/lab10.json'),
};

async function saved(editor) {
  let written;
  await editor.save((text) => { written = text; });
  return written;
}
const savedQuestions = async (editor, p = 0, t = 0) => JSON.parse(await saved(editor)).parts[p].tasks[t].questions;

// One Part, one Task with no Questions.
function small() {
  const doc = JSON.parse(FILES.oscilloscope);
  doc.parts = [{ id: 'p', title: 'P', mode: 'dual-trace', setup: {}, tasks: [{ id: 'a', title: 'A', prompt: '', points: 1 }] }];
  return openActivity(JSON.stringify(doc));
}
const qs = (editor, p = 0, t = 0) => editor.doc.parts[p].tasks[t].questions;
const add = (editor, kind, prompt) => editor.edit({ type: 'addQuestion', p: 0, t: 0, kind, prompt });

test('each Question kind can be added, with an id made from its prompt and unique in the Task', async () => {
  const editor = small();
  add(editor, 'numeric', '|I| (mA)');
  add(editor, 'choice', 'Which is larger?');
  add(editor, 'text', '|I| (mA)');
  add(editor, 'numeric', '');
  assert.deepEqual(qs(editor).map((q) => [q.id, q.kind]), [['i-ma', 'numeric'], ['which-is-larger', 'choice'], ['i-ma-2', 'text'], ['question', 'numeric']]);

  const [numeric, choice, text] = await savedQuestions(editor);
  // A new numeric Question has no answer yet (a problem until one is typed) and a 2% tolerance.
  assert.deepEqual(Object.keys(numeric), ['id', 'kind', 'prompt', 'relTol', 'points']);
  assert.equal(numeric.relTol, 0.02);
  assert.deepEqual(Object.keys(choice), ['id', 'kind', 'prompt', 'choices', 'correct', 'points']);
  assert.deepEqual(choice.choices, [{ id: 'a', text: '' }, { id: 'b', text: '' }]);
  assert.ok(isEncodedKey(choice.correct));
  assert.equal(decodeKey(choice.correct), 'a');
  assert.deepEqual(text, { id: 'i-ma-2', kind: 'text', prompt: '|I| (mA)', points: 1 });
});

test('a Question id stays frozen when its prompt changes', () => {
  const editor = small();
  add(editor, 'numeric', 'Amplitude');
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'prompt', value: 'Peak value (V)' });
  assert.equal(qs(editor)[0].id, 'amplitude');
  assert.equal(qs(editor)[0].prompt, 'Peak value (V)');
});

test('a numeric answer is a number or a State expression, saved encoded in the key order of the files', async () => {
  const editor = small();
  add(editor, 'numeric', 'I');
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'answer', value: { expr: 'IMag * 1000' } });
  let [q] = await savedQuestions(editor);
  assert.deepEqual(Object.keys(q), ['id', 'kind', 'prompt', 'answer', 'relTol', 'points']);
  assert.ok(isEncodedKey(q.answer));
  assert.deepEqual(decodeKey(q.answer), { expr: 'IMag * 1000' });
  // Shown plain in the editor.
  assert.deepEqual(qs(editor)[0].answer, { expr: 'IMag * 1000' });

  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'answer', value: 3.5 });
  [q] = await savedQuestions(editor);
  assert.equal(decodeKey(q.answer), 3.5);
});

test('points, prompt and modulus are set; an undefined value removes an optional field', async () => {
  const editor = small();
  add(editor, 'numeric', 'phase');
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'points', value: 2 });
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'modulus', value: 360 });
  let [q] = await savedQuestions(editor);
  assert.deepEqual(Object.keys(q), ['id', 'kind', 'prompt', 'relTol', 'modulus', 'points']);
  assert.equal(q.points, 2);
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'modulus', value: undefined });
  [q] = await savedQuestions(editor);
  assert.equal('modulus' in q, false);
  assert.throws(() => editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'id', value: 'x' }), /can't set/);
});

test('Questions are reordered and removed', () => {
  const editor = small();
  add(editor, 'numeric', 'one');
  add(editor, 'text', 'two');
  add(editor, 'choice', 'three');
  editor.edit({ type: 'moveQuestion', p: 0, t: 0, q: 2, to: 0 });
  assert.deepEqual(qs(editor).map((q) => q.id), ['three', 'one', 'two']);
  const before = editor.doc;
  editor.edit({ type: 'moveQuestion', p: 0, t: 0, q: 0, to: 5 });
  assert.equal(editor.doc, before);
  editor.edit({ type: 'deleteQuestion', p: 0, t: 0, q: 1 });
  assert.deepEqual(qs(editor).map((q) => q.id), ['three', 'two']);
  editor.edit({ type: 'deleteQuestion', p: 0, t: 0, q: 0 });
  editor.edit({ type: 'deleteQuestion', p: 0, t: 0, q: 0 });
  // The last one removed takes the empty list with it.
  assert.equal('questions' in editor.doc.parts[0].tasks[0], false);
  editor.undo();
  assert.deepEqual(qs(editor).map((q) => q.id), ['two']);
});

test("changing a Question's kind swaps its kind's fields", async () => {
  const editor = small();
  add(editor, 'numeric', 'x');
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'answer', value: 2 });
  editor.edit({ type: 'setQuestionKind', p: 0, t: 0, q: 0, kind: 'choice' });
  let [q] = await savedQuestions(editor);
  assert.deepEqual(Object.keys(q), ['id', 'kind', 'prompt', 'choices', 'correct', 'points']);
  editor.edit({ type: 'setQuestionKind', p: 0, t: 0, q: 0, kind: 'text' });
  [q] = await savedQuestions(editor);
  assert.deepEqual(q, { id: 'x', kind: 'text', prompt: 'x', points: 1 });
  editor.edit({ type: 'setQuestionKind', p: 0, t: 0, q: 0, kind: 'numeric' });
  [q] = await savedQuestions(editor);
  assert.deepEqual(Object.keys(q), ['id', 'kind', 'prompt', 'relTol', 'points']);
});

test('choices are added, edited, reordered and removed, and the correct one is marked', async () => {
  const editor = small();
  add(editor, 'choice', 'Which?');
  const e = (edit) => editor.edit({ p: 0, t: 0, q: 0, ...edit });
  e({ type: 'addChoice' });
  assert.deepEqual(qs(editor)[0].choices.map((c) => c.id), ['a', 'b', 'c']);
  e({ type: 'setChoiceField', c: 2, field: 'text', value: 'Equal \\(V_L = V_C\\)' });
  e({ type: 'setQuestionField', field: 'correct', value: 'c' });
  // Renaming the correct choice's id keeps it correct.
  e({ type: 'setChoiceField', c: 2, field: 'id', value: 'equal' });
  assert.equal(qs(editor)[0].correct, 'equal');
  e({ type: 'moveChoice', c: 2, to: 0 });
  assert.deepEqual(qs(editor)[0].choices.map((c) => c.id), ['equal', 'a', 'b']);
  e({ type: 'deleteChoice', c: 2 });
  const [q] = await savedQuestions(editor);
  assert.deepEqual(q.choices, [{ id: 'equal', text: 'Equal \\(V_L = V_C\\)' }, { id: 'a', text: '' }]);
  assert.equal(decodeKey(q.correct), 'equal');
});

test('a correct id that matches no choice is a problem at the correct field', () => {
  const editor = small();
  add(editor, 'choice', 'Which?');
  editor.edit({ type: 'addChoice', p: 0, t: 0, q: 0 });
  editor.edit({ type: 'deleteChoice', p: 0, t: 0, q: 0, c: 0 });
  const problems = editor.problems().filter((pr) => pr.path.join('.').startsWith('parts.0.tasks.0.questions.0'));
  assert.deepEqual(problems.map((pr) => pr.path), [['parts', 0, 'tasks', 0, 'questions', 0, 'correct']]);
});

test('presets stamp plain tol, relTol and modulus, and nothing preset-shaped is stored', async () => {
  const editor = small();
  add(editor, 'numeric', 'phi');
  const phase = TOLERANCE_PRESETS.find((x) => x.name === 'Phase ±2° mod 360');
  editor.edit({ type: 'setQuestionValues', p: 0, t: 0, q: 0, values: phase.values });
  let [q] = await savedQuestions(editor);
  assert.deepEqual(q, { id: 'phi', kind: 'numeric', prompt: 'phi', tol: 2, modulus: 360, points: 1 });
  assert.equal(presetOf(editor.doc.parts[0].tasks[0].questions[0])?.name, 'Phase ±2° mod 360');

  editor.edit({ type: 'setQuestionValues', p: 0, t: 0, q: 0, values: TOLERANCE_PRESETS.find((x) => x.name === 'Amplitude 2%').values });
  [q] = await savedQuestions(editor);
  assert.deepEqual(q, { id: 'phi', kind: 'numeric', prompt: 'phi', relTol: 0.02, points: 1 });
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'relTol', value: 0.03 });
  assert.equal(presetOf(qs(editor)[0]), null);
  // Every preset is plain numbers on the tolerance keys alone.
  for (const preset of TOLERANCE_PRESETS) {
    assert.deepEqual(Object.keys(preset.values).sort(), ['modulus', 'relTol', 'tol']);
    for (const v of Object.values(preset.values)) assert.ok(v === undefined || Number.isFinite(v));
  }
});

test('the tolerance field: the unit side writes tol, the % side writes relTol as a fraction, and each clears the other', () => {
  assert.deepEqual(toleranceValues('unit', '2'), { tol: 2, relTol: undefined });
  assert.deepEqual(toleranceValues('percent', '2'), { tol: undefined, relTol: 0.02 });
  assert.deepEqual(toleranceValues('percent', '1.5'), { tol: undefined, relTol: 0.015 });
  assert.deepEqual(toleranceValues('percent', '7'), { tol: undefined, relTol: 0.07 });
  assert.deepEqual(toleranceValues('unit', ''), { tol: undefined, relTol: undefined });
  assert.deepEqual(toleranceValues('unit', 'abc'), { tol: undefined, relTol: undefined });
  assert.deepEqual(toleranceText({ relTol: 0.07 }), { side: 'percent', text: '7' });
  assert.deepEqual(toleranceText({ tol: 0.1 }), { side: 'unit', text: '0.1' });
  assert.deepEqual(toleranceText({}), { side: 'unit', text: '' });
});

test('an expression answer naming State the Mode lacks is a problem at the answer', () => {
  const editor = small();
  add(editor, 'numeric', 'I');
  editor.edit({ type: 'setQuestionField', p: 0, t: 0, q: 0, field: 'answer', value: { expr: 'Va * 2 + nope' } });
  const info = { modes: { 'dual-trace': { title: 'Dual', setupKeys: [], setupOptions: [], controls: [], state: { Va: { label: 'Va', unit: 'V' } } } } };
  const found = editor.problems(info).filter((pr) => pr.source === 'questions');
  assert.deepEqual(found.map((pr) => pr.path), [['parts', 0, 'tasks', 0, 'questions', 0, 'answer']]);
  assert.match(found[0].message, /"nope"/);
  assert.deepEqual(editor.problems().filter((pr) => pr.source === 'questions'), []);
});

test("every existing Activity's Questions open and save byte-identically, also after an edit and its undo", async () => {
  for (const [name, text] of Object.entries(FILES)) {
    const editor = openActivity(text);
    assert.equal(await saved(editor), text, name);
    const p = editor.doc.parts.findIndex((part) => part.tasks.some((task) => task.questions?.length));
    if (p < 0) continue;
    const t = editor.doc.parts[p].tasks.findIndex((task) => task.questions?.length);
    const q = editor.doc.parts[p].tasks[t].questions[0];
    editor.edit({ type: 'setQuestionField', p, t, q: 0, field: 'prompt', value: `${q.prompt}!` });
    editor.edit({ type: 'setQuestionField', p, t, q: 0, field: 'prompt', value: q.prompt });
    assert.equal(await saved(editor), text, `${name} after an edit back`);
  }
});
