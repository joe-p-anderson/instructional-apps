// The editor core's Task edits, effective exposure and set exposure, and the unknown-Control
// problem (framework/v1/authoring/editor/core.js and exposure.js), on the real Activity files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { effectiveExposure } from '../../../framework/v1/authoring/editor/exposure.js';
import { createRunner, decodeKey } from '../../../framework/v1/runner/index.js';
import { stubTool } from '../runner/stub-tool.js';

const read = (path) => readFileSync(new URL(`../../../tools/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FILES = {
  oscilloscope: read('oscilloscope/activities/phase-period-amplitude.json'),
  electrostatics: read('electrostatics/activities/conductor-properties.json'),
  fourier: read('fourier/activities/fourier-series.json'),
  phasors: read('phasors/activities/phasors-impedance.json'),
  spacetime: read('spacetime/activities/lab10.json'),
};
const OSC = FILES.oscilloscope;
const plain = (v) => JSON.parse(JSON.stringify(v));

async function saved(editor) {
  let written;
  await editor.save((text) => { written = text; });
  return written;
}

// Tool info for one Activity: every Control any of a Mode's Tasks names, plus one no Task names.
function toolInfoFor(doc) {
  const modes = {};
  for (const part of doc.parts) {
    const ids = modes[part.mode]?.controls.map((c) => c.id) ?? ['untouched'];
    for (const task of part.tasks) for (const k of ['show', 'lock', 'hide']) for (const id of task[k] ?? []) if (!ids.includes(id)) ids.push(id);
    modes[part.mode] = { title: part.mode, setupKeys: [], setupOptions: [], controls: ids.map((id) => ({ id, label: `Label ${id}` })), state: {} };
  }
  return { modes };
}

// What the runner applies at Task t of Part p: restore a Run whose earlier Tasks passed, so the
// runner replays exposure for Tasks 0..t, then read each stub Control.
function runnerExposure(doc, info, p, t) {
  const activity = JSON.parse(JSON.stringify(doc));
  const tools = Object.fromEntries(activity.parts.map((part) => [part.id, stubTool({ controls: info.modes[part.mode].controls.map((c) => c.id) })]));
  const runner = createRunner(activity, { tools });
  const part = activity.parts[p];
  runner.restore({
    activity: { id: activity.id, version: activity.version },
    run: { name: 'Ada', fingerprint: 'f', startedAt: '2026-01-01T00:00:00Z' },
    parts: { [part.id]: { state: null, attempts: Object.fromEntries(part.tasks.slice(0, t).map((task) => [task.id, [{ passed: true }]])) } },
  });
  const controls = tools[part.id].controls;
  return Object.fromEntries(controls.ids().map((id) => {
    const c = controls.get(id);
    return [id, !c.isVisible ? 'hidden' : c.isLocked ? 'locked' : 'open'];
  }));
}

test("the effective exposure matches the runner's carry-over at every Task of all 5 Activities", () => {
  let checked = 0;
  for (const [name, text] of Object.entries(FILES)) {
    const { doc } = openActivity(text);
    const info = toolInfoFor(doc);
    doc.parts.forEach((part, p) => part.tasks.forEach((_, t) => {
      const eff = effectiveExposure(doc, p, t, info);
      const states = Object.fromEntries(Object.entries(eff).map(([id, e]) => [id, e.state]));
      assert.deepEqual(states, runnerExposure(doc, info, p, t), `${name} Part ${p + 1} Task ${t + 1}`);
      checked += 1;
    }));
  }
  assert.ok(checked > 50);
});

test('each Control is marked as set at this Task or inherited, naming the Task it comes from', () => {
  const doc = openActivity(FILES.phasors).doc;
  const info = toolInfoFor(doc);
  // phasors Part 1: Task 1 hides sum; Task 3 shows it.
  const sumTasks = doc.parts[0].tasks.map((task) => ['show', 'lock', 'hide'].find((k) => task[k]?.includes('sum')) ?? null);
  const first = sumTasks.findIndex(Boolean);
  const eff = effectiveExposure(doc, 0, first, info);
  assert.equal(eff.sum.here, true);
  assert.equal(eff.sum.from, first);
  assert.equal(eff.untouched.here, false);
  assert.equal(eff.untouched.from, null);
  assert.equal(eff.untouched.state, 'open');
  const later = effectiveExposure(doc, 0, first + 1, info);
  if (!sumTasks[first + 1]) {
    assert.equal(later.sum.here, false);
    assert.equal(later.sum.from, first);
    assert.equal(later.sum.state, eff.sum.state);
  }
});

// A small Activity: one Part, three Tasks, no lists.
function small() {
  const doc = JSON.parse(OSC);
  doc.parts = [{ id: 'p', title: 'P', mode: 'dual-trace', setup: {}, tasks: [
    { id: 'a', title: 'A', prompt: '', points: 1 }, { id: 'b', title: 'B', prompt: '', points: 1 }, { id: 'c', title: 'C', prompt: '', points: 1 }] }];
  return openActivity(JSON.stringify(doc));
}
const lists = (task) => Object.fromEntries(['show', 'lock', 'hide'].filter((k) => k in task).map((k) => [k, [...task[k]]]));
const INFO = { modes: { 'dual-trace': { title: 'Dual', setupKeys: [], setupOptions: [], controls: [{ id: 'Va', label: 'Va' }, { id: 'f', label: 'f' }], state: {} } } };

test('setting a Control writes minimal lists, and setting it back to its inherited state removes it', () => {
  const editor = small();
  editor.edit({ type: 'setExposure', p: 0, t: 0, control: 'Va', state: 'locked' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[0]), { lock: ['Va'] });
  // Later Tasks inherit it, with nothing in their lists.
  assert.equal(effectiveExposure(editor.doc, 0, 2, INFO).Va.state, 'locked');
  assert.deepEqual(lists(editor.doc.parts[0].tasks[2]), {});

  // At Task 3, open it: one show entry. Hide it: the show entry becomes a hide entry.
  editor.edit({ type: 'setExposure', p: 0, t: 2, control: 'Va', state: 'open' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[2]), { show: ['Va'] });
  editor.edit({ type: 'setExposure', p: 0, t: 2, control: 'Va', state: 'hidden' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[2]), { hide: ['Va'] });
  // Back to locked, the inherited state: Task 3 names nothing, and its empty lists are gone.
  editor.edit({ type: 'setExposure', p: 0, t: 2, control: 'Va', state: 'locked' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[2]), {});

  // Setting the inherited state changes nothing.
  const before = editor.doc;
  editor.edit({ type: 'setExposure', p: 0, t: 1, control: 'f', state: 'open' });
  assert.equal(editor.doc, before);

  // Opening it again at Task 1 empties Task 1's lists; later Tasks follow.
  editor.edit({ type: 'setExposure', p: 0, t: 0, control: 'Va', state: 'open' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[0]), {});
  assert.equal(effectiveExposure(editor.doc, 0, 2, INFO).Va.state, 'open');
});

test('set exposure keeps every other entry and the order of the lists', () => {
  const editor = openActivity(FILES.phasors);
  // The first Task of Part 2 hides several Controls.
  const p = 1;
  const t = 0;
  const task = editor.doc.parts[p].tasks[t];
  assert.ok(task.hide.length > 1);
  const [id, ...rest] = task.hide;
  editor.edit({ type: 'setExposure', p, t, control: id, state: 'locked' });
  const next = editor.doc.parts[p].tasks[t];
  assert.deepEqual(next.hide, rest);
  assert.deepEqual(next.lock, [...(task.lock ?? []), id]);
  assert.deepEqual(next.show, task.show);
  // Asking for the state it already has (named once, in its list) changes nothing.
  const doc = editor.doc;
  editor.edit({ type: 'setExposure', p, t, control: rest[0], state: 'hidden' });
  assert.equal(editor.doc, doc);
});

test('a Control the Mode does not have shows in the problems list, at its list', () => {
  const editor = small();
  editor.edit({ type: 'setExposure', p: 0, t: 1, control: 'nope', state: 'hidden' });
  const problems = editor.problems(INFO).filter((p) => p.source === 'controls');
  assert.deepEqual(problems.map((p) => p.path), [['parts', 0, 'tasks', 1, 'hide', 0]]);
  assert.match(problems[0].message, /"nope"/);
  assert.deepEqual(editor.problems(undefined).filter((p) => p.source === 'controls'), []);
  // clearExposure takes it out of every list.
  editor.edit({ type: 'clearExposure', p: 0, t: 1, control: 'nope' });
  assert.deepEqual(lists(editor.doc.parts[0].tasks[1]), {});
});

test('a new Task gets a slug of its title, unique in the Part; retitling keeps it', async () => {
  const editor = small();
  editor.edit({ type: 'addTask', p: 0, title: 'Find the Period!' });
  assert.deepEqual(plain(editor.doc.parts[0].tasks[3]), { id: 'find-the-period', title: 'Find the Period!', prompt: '', points: 1 });
  editor.edit({ type: 'addTask', p: 0, title: 'A' });
  assert.equal(editor.doc.parts[0].tasks[4].id, 'a-2');
  editor.edit({ type: 'addTask', p: 0, title: '<b>Bold</b> move' });
  assert.equal(editor.doc.parts[0].tasks[5].id, 'bold-move');
  editor.edit({ type: 'addTask', p: 0, title: '  ' });
  assert.equal(editor.doc.parts[0].tasks[6].id, 'task');
  editor.edit({ type: 'setTaskField', p: 0, t: 3, field: 'title', value: 'Measure the period' });
  assert.equal(editor.doc.parts[0].tasks[3].id, 'find-the-period');
  assert.throws(() => editor.edit({ type: 'setTaskField', p: 0, t: 3, field: 'id', value: 'x' }), /field/);
});

test("retitling a Task writes only its title line", async () => {
  const editor = openActivity(OSC);
  const task = editor.doc.parts[0].tasks[0];
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'title', value: 'New title' });
  assert.equal(await saved(editor), OSC.replace(`"title": ${JSON.stringify(task.title)},`, '"title": "New title",'));
});

test('a Task id can be renamed by hand', () => {
  const editor = small();
  editor.edit({ type: 'setTaskId', p: 0, t: 1, id: 'bee' });
  assert.equal(editor.doc.parts[0].tasks[1].id, 'bee');
  editor.edit({ type: 'setTaskId', p: 0, t: 1, id: 'a' });
  assert.ok(editor.problems().some((p) => p.source === 'runner' && p.path.join('.') === 'parts.0.tasks.1.id'));
});

test('Tasks can be reordered, duplicated and deleted', () => {
  const editor = small();
  const ids = () => editor.doc.parts[0].tasks.map((t) => t.id);
  editor.edit({ type: 'moveTask', p: 0, t: 2, to: 0 });
  assert.deepEqual(ids(), ['c', 'a', 'b']);
  assert.equal(editor.edit({ type: 'moveTask', p: 0, t: 0, to: 5 }), editor.doc);
  editor.edit({ type: 'setExposure', p: 0, t: 1, control: 'Va', state: 'locked' });
  editor.edit({ type: 'duplicateTask', p: 0, t: 1 });
  assert.deepEqual(ids(), ['c', 'a', 'a-2', 'b']);
  assert.deepEqual(plain(editor.doc.parts[0].tasks[2]), { ...plain(editor.doc.parts[0].tasks[1]), id: 'a-2' });
  editor.edit({ type: 'deleteTask', p: 0, t: 0 });
  assert.deepEqual(ids(), ['a', 'a-2', 'b']);
  editor.undo();
  assert.deepEqual(ids(), ['c', 'a', 'a-2', 'b']);
});

test("a duplicated Task keeps its Condition's and answers' encoding on save", async () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'duplicateTask', p: 0, t: 0 });
  const file = JSON.parse(await saved(editor));
  const [a, b] = file.parts[0].tasks;
  assert.deepEqual({ ...b, id: a.id }, a);
});

test('points, the Hint and notes can be edited', () => {
  const editor = small();
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'points', value: 3 });
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'notes', value: 'why' });
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'prompt', value: 'Do it' });
  assert.deepEqual(plain(editor.doc.parts[0].tasks[0]), { id: 'a', title: 'A', prompt: 'Do it', points: 3, notes: 'why' });
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'notes', value: '' });
  assert.equal('notes' in editor.doc.parts[0].tasks[0], false);

  editor.edit({ type: 'setHint', p: 0, t: 0, hint: { after: 2, text: '' } });
  editor.edit({ type: 'setHintField', p: 0, t: 0, field: 'text', value: 'Look' });
  editor.edit({ type: 'setHintField', p: 0, t: 0, field: 'after', value: 4 });
  assert.deepEqual(plain(editor.doc.parts[0].tasks[0].hint), { after: 4, text: 'Look' });
  assert.equal(decodeKey(JSON.parse(editor.serialize()).parts[0].tasks[0].hint.text), 'Look');
  assert.throws(() => editor.edit({ type: 'setHintField', p: 0, t: 0, field: 'x', value: 1 }), /field/);
  editor.edit({ type: 'setHint', p: 0, t: 0, hint: undefined });
  assert.equal('hint' in editor.doc.parts[0].tasks[0], false);
});

test("an encoded Hint text stays encoded after editing it", async () => {
  const editor = openActivity(FILES.electrostatics);
  const p = editor.doc.parts.findIndex((part) => part.tasks.some((t) => t.hint));
  const t = editor.doc.parts[p].tasks.findIndex((task) => task.hint);
  editor.edit({ type: 'setHintField', p, t, field: 'after', value: 9 });
  const hint = JSON.parse(await saved(editor)).parts[p].tasks[t].hint;
  assert.equal(hint.after, 9);
  assert.match(hint.text, /^enc1:/);
});
