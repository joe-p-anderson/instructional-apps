// The editor's preview plan (framework/v1/authoring/editor/preview.js): what the preview page
// is handed for the editor's current, unsaved Activity, and when it refuses to start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { planPreview, PREVIEW_ID_SUFFIX } from '../../../framework/v1/authoring/editor/preview.js';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { PREVIEW_START } from '../../../framework/v1/runner/preview.js';
import { stubTool } from '../runner/stub-tool.js';

const OSC = readFileSync(new URL('../../../tools/oscilloscope/activities/phase-period-amplitude.json', import.meta.url), 'utf8');

test('the plan carries the unsaved Activity under a preview id, and the chosen Task', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setActivityField', field: 'title', value: 'Not saved yet' });
  const plan = planPreview(editor, { p: 1, t: 1 });
  assert.equal(plan.blockers.length, 0);
  assert.equal(plan.activity.title, 'Not saved yet');
  assert.equal(plan.activity.id, `oscilloscope-phase-period-amplitude${PREVIEW_ID_SUFFIX}`);
  assert.notEqual(plan.activity.id, editor.doc.id);
  assert.deepEqual(plan.start, { partId: editor.doc.parts[1].id, taskId: editor.doc.parts[1].tasks[1].id });
});

test('the real runner starts the planned preview at that Task', () => {
  const editor = openActivity(OSC);
  const plan = planPreview(editor, { p: 1, t: 1 });
  const tools = Object.fromEntries(plan.activity.parts.map((part) => [part.id, stubTool({ controls: allControls(plan.activity) })]));
  const runner = createRunner(plan.activity, { tools, [PREVIEW_START]: plan.start });
  runner.start('Preview');
  const [first, second] = runner.parts();
  assert.ok(first.tasks.every((t) => t.status === 'passed'));
  assert.deepEqual(second.tasks.map((t) => t.status), ['passed', 'open']);
});

test("a problem the runner would reject blocks the preview, saying why", () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setActivityField', field: 'version', value: undefined });
  const plan = planPreview(editor, { p: 0, t: 0 });
  assert.deepEqual(plan.blockers.map((b) => b.message), ['missing version']);
  assert.equal(plan.activity, null);
});

test('an unknown Control or Mode blocks too; an undeclared Setup value does not', () => {
  const editor = openActivity(OSC);
  const toolInfo = { modes: { [editor.doc.parts[0].mode]: { title: 'M', setupKeys: [], setupOptions: [], controls: [], state: {} } } };
  // No Controls known and only Part 1's Mode: Tasks name unknown Controls, later Parts an unknown Mode.
  const sources = new Set(planPreview(editor, { p: 0, t: 0 }, toolInfo).blockers.map((b) => b.source));
  assert.ok(sources.has('controls'));
  assert.ok(!sources.has('setup'));
  const setupOnly = planPreview(editor, { p: 0, t: 0 }, fullInfo(editor.doc, { setupKeys: [] }));
  assert.deepEqual(setupOnly.blockers, []);
});

test("Condition problems the runner accepts (empty group, unknown State) do not block", () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setConditionNode', p: 0, t: 0, path: [], node: { type: 'anyOf', conditions: [] } });
  const info = fullInfo(editor.doc, { setupKeys: [] }); // state: {}, so every State name is unknown
  const sources = new Set(editor.problems(info).map((pr) => pr.source));
  assert.ok(sources.has('conditions'));
  const plan = planPreview(editor, { p: 0, t: 0 }, info);
  assert.deepEqual(plan.blockers, []);
  assert.ok(plan.activity);
});

test('a Part with no Tasks cannot be a start', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'addPart', title: 'Empty', mode: editor.doc.parts[0].mode });
  const p = editor.doc.parts.length - 1;
  const plan = planPreview(editor, { p, t: 0 });
  assert.match(plan.blockers[0].message, /no Tasks/);
});

function allControls(activity) {
  const ids = new Set();
  for (const part of activity.parts) for (const task of part.tasks) for (const l of ['show', 'lock', 'hide']) for (const id of task[l] ?? []) ids.add(id);
  return [...ids];
}

function fullInfo(doc, { setupKeys }) {
  const modes = {};
  for (const part of doc.parts) {
    modes[part.mode] = { title: part.mode, setupKeys, setupOptions: [], controls: allControls(doc).map((id) => ({ id, label: id })), state: {} };
  }
  return { modes };
}
