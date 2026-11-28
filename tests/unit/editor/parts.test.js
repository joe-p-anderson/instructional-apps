// The editor core's Part and Setup edits, Capture, and the problems found against Tool info
// (framework/v1/authoring/editor/core.js), driven through openActivity on a real Activity file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';

const read = (path) => readFileSync(new URL(`../../../tools/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OSC = read('oscilloscope/activities/phase-period-amplitude.json');
const SPACETIME = read('spacetime/activities/lab10.json');

// The value as JSON data (without the encoding records the core keeps on objects).
const plain = (v) => JSON.parse(JSON.stringify(v));
const ids = (doc) => doc.parts.map((p) => p.id);

test('a new Part gets a slug of its title as its id, unique in the Activity', () => {
  const editor = openActivity(OSC);
  const before = ids(editor.doc);
  editor.edit({ type: 'addPart', title: 'Part 3: Lissajous Figures!', mode: 'xy' });
  const part = editor.doc.parts.at(-1);
  assert.deepEqual(ids(editor.doc), [...before, 'part-3-lissajous-figures']);
  assert.deepEqual(part, { id: 'part-3-lissajous-figures', title: 'Part 3: Lissajous Figures!', mode: 'xy', setup: {}, tasks: [] });

  editor.edit({ type: 'addPart', title: 'Part 3: Lissajous figures', mode: 'xy' });
  assert.equal(editor.doc.parts.at(-1).id, 'part-3-lissajous-figures-2');
  editor.edit({ type: 'addPart', title: before[0], mode: 'xy' });
  assert.equal(editor.doc.parts.at(-1).id, `${before[0]}-2`);
  editor.edit({ type: 'addPart', title: '  ??  ', mode: 'xy' });
  assert.equal(editor.doc.parts.at(-1).id, 'part');
});

async function saved(editor) {
  let written;
  await editor.save((text) => { written = text; });
  return written;
}

test("retitling a Part writes only its title line and keeps its id", async () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setPartField', p: 0, field: 'title', value: 'Part 1: Phase' });
  assert.equal(editor.doc.parts[0].id, 'phase');
  assert.equal(await saved(editor), OSC.replace('"title": "Part 1: Phase Shift",', '"title": "Part 1: Phase",'));
});

test("a Part's Mode and notes can be set; empty notes remove the field", () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setPartField', p: 1, field: 'mode', value: 'xy' });
  assert.equal(editor.doc.parts[1].mode, 'xy');
  editor.edit({ type: 'setPartField', p: 1, field: 'notes', value: 'Hi' });
  assert.equal(editor.doc.parts[1].notes, 'Hi');
  editor.edit({ type: 'setPartField', p: 1, field: 'notes', value: '' });
  assert.equal(Object.hasOwn(editor.doc.parts[1], 'notes'), false);
  assert.throws(() => editor.edit({ type: 'setPartField', p: 0, field: 'id', value: 'x' }), /field/);
});

test('Parts can be reordered and deleted, each as one undo step', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'addPart', title: 'Third', mode: 'xy' });
  const [a, b, c] = ids(editor.doc);
  editor.edit({ type: 'movePart', p: 2, to: 0 });
  assert.deepEqual(ids(editor.doc), [c, a, b]);
  editor.edit({ type: 'movePart', p: 0, to: 1 });
  assert.deepEqual(ids(editor.doc), [a, c, b]);
  editor.edit({ type: 'movePart', p: 0, to: 0 });
  editor.edit({ type: 'movePart', p: 0, to: 5 });
  assert.deepEqual(ids(editor.doc), [a, c, b]);
  editor.edit({ type: 'deletePart', p: 1 });
  assert.deepEqual(ids(editor.doc), [a, b]);
  editor.undo();
  assert.deepEqual(ids(editor.doc), [a, c, b]);
  editor.undo();
  assert.deepEqual(ids(editor.doc), [c, a, b]);
});

test("Capture stores the Mode's Setup keys from the live State, and nothing else of it", async () => {
  const editor = openActivity(OSC);
  const snapshot = { Va: 3, f: 0.5, Dt: 0.25, Vb: 3, phi: 0.785, T: 2 };
  editor.edit({ type: 'captureSetup', p: 0, setupKeys: ['Va', 'f', 'Dt'], snapshot });
  assert.deepEqual(plain(editor.doc.parts[0].setup), { Va: 3, f: 0.5, Dt: 0.25 });
  // The Setup's lines keep their order, so only the changed value's line moves in the file.
  assert.equal(await saved(editor), OSC.replace('"Va": 2,', '"Va": 3,'));
});

test('Capture adds Setup keys the Setup lacks and leaves Setup option values untouched', () => {
  const editor = openActivity(SPACETIME);
  const before = editor.doc.parts[0].setup;
  editor.edit({ type: 'captureSetup', p: 0, setupKeys: ['v'], snapshot: { v: -0.25, gamma: 1.03, tool: 'select' } });
  assert.deepEqual(plain(editor.doc.parts[0].setup), plain({ ...before, v: -0.25 }));
  assert.equal(editor.doc.parts[0].setup.tool, 'worldline');
  editor.edit({ type: 'setSetupValue', p: 0, key: 'v', value: undefined });
  editor.edit({ type: 'captureSetup', p: 0, setupKeys: ['v'], snapshot: { v: 0.5 } });
  assert.equal(editor.doc.parts[0].setup.v, 0.5);
});

test('typed Setup values, keys or options, are set and cleared one by one', () => {
  const editor = openActivity(SPACETIME);
  const { v, ...rest } = editor.doc.parts[1].setup;
  editor.edit({ type: 'setSetupValue', p: 1, key: 'v', value: 0.8 });
  editor.edit({ type: 'setSetupValue', p: 1, key: 'grid', value: { K: false, Kp: true } });
  assert.deepEqual(plain(editor.doc.parts[1].setup), plain({ v: 0.8, ...rest, grid: { K: false, Kp: true } }));
  editor.edit({ type: 'setSetupValue', p: 1, key: 'v', value: undefined });
  editor.edit({ type: 'setSetupValue', p: 1, key: 'objs', value: undefined });
  const { objs, ...left } = rest;
  assert.deepEqual(plain(editor.doc.parts[1].setup), plain({ ...left, grid: { K: false, Kp: true } }));
  assert.ok(objs);
  assert.ok(v !== undefined);
});

test('a Part without a setup object gets one when a value is typed', () => {
  const text = JSON.stringify({ id: 'a', version: 1, title: 'A', tool: 'x', parts: [{ id: 'p', title: 'P', mode: 'm', tasks: [] }] });
  const editor = openActivity(text);
  editor.edit({ type: 'setSetupValue', p: 0, key: 'k', value: 1 });
  assert.deepEqual(plain(editor.doc.parts[0].setup), { k: 1 });
});

// Tool info as the page builds it by mounting each Mode (core.js); only what the checks read.
const OSC_INFO = { modes: { 'dual-trace': { title: 'Dual-trace scope', setupKeys: ['Va', 'f', 'Dt'], setupOptions: [],
  controls: ['Va', 'f', 'Dt', 'Va-marker', 'f-marker', 'Dt-marker', 'phi-readout', 'ratio-readout'].map((id) => ({ id, label: id })),
  state: Object.fromEntries(['Va', 'f', 'Dt', 'phi', 'T', 'pkpk', 'ratio'].map((name) => [name, { label: name, unit: '' }])) } } };
const SPACETIME_INFO = { modes: { diagram: { title: 'Diagram', setupKeys: ['v'],
  setupOptions: ['names', 'grid', 'showKp', 'objs', 'tool', 'view'],
  controls: ['tool-select', 'tool-event', 'tool-worldline', 'tool-rod', 'tool-join', 'v', 'gamma', 'flip', 'grid-K', 'grid-Kp',
    'kp-panel', 'primed', 'measurements', 'undo', 'redo', 'export-json', 'import-json', 'new', 'reset-view', 'save-png'].map((id) => ({ id, label: id })),
  state: {} } } };
const toolProblems = (editor, info) => editor.problems(info).filter((p) => p.source !== 'runner').map((p) => [p.path, p.message]);

test('the existing Activities have no problems against their Tool info', () => {
  assert.deepEqual(toolProblems(openActivity(OSC), OSC_INFO), []);
  const st = openActivity(SPACETIME);
  const mode = st.doc.parts[0].mode;
  assert.deepEqual(toolProblems(st, { modes: { [mode]: SPACETIME_INFO.modes.diagram } }), []);
});

test('an unknown Mode is a problem on the Part\'s mode', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setPartField', p: 1, field: 'mode', value: 'xy' });
  assert.deepEqual(toolProblems(editor, OSC_INFO), [[['parts', 1, 'mode'], 'Part "period-amplitude" Mode "xy" is not a Mode of the Tool']]);
});

test('a Setup value that is neither a Setup key nor a Setup option of the Mode is a problem', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setSetupValue', p: 0, key: 'seed', value: 4 });
  editor.edit({ type: 'setSetupValue', p: 0, key: 'phi', value: 1 });
  assert.deepEqual(toolProblems(editor, OSC_INFO), [
    [['parts', 0, 'setup', 'seed'], 'Part "phase" Setup "seed" is not a Setup key or Setup option of Mode "dual-trace"'],
    [['parts', 0, 'setup', 'phi'], 'Part "phase" Setup "phi" is not a Setup key or Setup option of Mode "dual-trace"'],
  ]);
});

test('without Tool info there are no Tool problems', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setPartField', p: 1, field: 'mode', value: 'xy' });
  editor.edit({ type: 'setSetupValue', p: 0, key: 'seed', value: 4 });
  assert.deepEqual(toolProblems(editor, undefined), []);
});
