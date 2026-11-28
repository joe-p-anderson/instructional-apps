import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { PREVIEW_START } from '../../../framework/v1/runner/preview.js';
import { activityPage } from '../../../framework/v1/activity-file.js';
import { stubTool } from './stub-tool.js';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Two Parts; Part 2 has three Tasks whose exposure carries over.
const activity = {
  id: 'two-parts', version: 1, title: 'Two Parts', tool: 'stub',
  parts: [
    { id: 'a', title: 'A', mode: 'm', setup: {}, tasks: [
      { id: 'a1', title: 'A1', prompt: '', points: 1, condition: { state: 'x', target: 1, tol: 0.1 } },
    ] },
    { id: 'b', title: 'B', mode: 'm', setup: {}, tasks: [
      { id: 'b1', title: 'B1', prompt: '', points: 1, hide: ['k'], condition: { state: 'x', target: 1, tol: 0.1 } },
      { id: 'b2', title: 'B2', prompt: '', points: 2, show: ['k'], lock: ['j'], condition: { state: 'x', target: 2, tol: 0.1 } },
      { id: 'b3', title: 'B3', prompt: '', points: 3, condition: { state: 'x', target: 3, tol: 0.1 } },
    ] },
  ],
};

const tools = () => ({
  a: stubTool({ state: { x: { value: 0 } }, controls: ['j', 'k'] }),
  b: stubTool({ state: { x: { value: 0 } }, controls: ['j', 'k'] }),
});
const statuses = (r) => Object.fromEntries(r.parts().flatMap((p) => p.tasks.map((t) => [t.id, t.status])));
const exposure = (tool) => Object.fromEntries(tool.controls.ids().map((id) => {
  const c = tool.controls.get(id);
  return [id, !c.isVisible ? 'hidden' : c.isLocked ? 'locked' : 'shown'];
}));

test('a preview start marks every earlier Task passed and opens the chosen one', () => {
  const t = tools();
  const r = createRunner(activity, { tools: t, [PREVIEW_START]: { partId: 'b', taskId: 'b3' } });
  r.start('Preview');
  assert.deepEqual(statuses(r), { a1: 'passed', b1: 'passed', b2: 'passed', b3: 'open' });
  assert.deepEqual(r.task('b', 'b2').attempts, [], 'passed without Attempts');
  // The chosen Task sees the exposure the earlier Tasks left it.
  assert.deepEqual(exposure(t.b), { j: 'locked', k: 'shown' });
});

test('the Task opened by a preview start can be submitted and passes on', () => {
  const t = tools();
  const r = createRunner(activity, { tools: t, [PREVIEW_START]: { partId: 'b', taskId: 'b3' } });
  r.start('Preview');
  t.b.setState({ x: 3 });
  assert.equal(r.submit('b', 'b3').passed, true);
  assert.equal(r.complete, true);
});

test("a preview start's passes are in neither the saved Run nor the Report", async () => {
  const r = createRunner(activity, { tools: tools(), [PREVIEW_START]: { partId: 'b', taskId: 'b3' } });
  r.start('Preview');
  const saved = r.save();
  for (const part of Object.values(saved.parts)) {
    for (const attempts of Object.values(part.attempts)) assert.deepEqual(attempts, []);
  }
  const report = await r.report();
  assert.equal(report.earned, 0);
  // A normal Run restored from that save has nothing passed.
  const normal = createRunner(activity, { tools: tools() });
  assert.equal(normal.restore(saved), true);
  assert.deepEqual(statuses(normal), { a1: 'open', b1: 'open', b2: 'locked', b3: 'locked' });
});

test('a normal Run ignores a start position given any other way', () => {
  const withField = { ...activity, previewStart: { partId: 'b', taskId: 'b3' }, startAt: { partId: 'b', taskId: 'b3' } };
  for (const [def, options] of [
    [withField, {}],
    [activity, { previewStart: { partId: 'b', taskId: 'b3' }, startAt: { partId: 'b', taskId: 'b3' } }],
    [activity, { [Symbol('preview start')]: { partId: 'b', taskId: 'b3' } }],
  ]) {
    const r = createRunner(def, { tools: tools(), ...options });
    r.start('Ada');
    assert.deepEqual(statuses(r), { a1: 'open', b1: 'open', b2: 'locked', b3: 'locked' });
  }
});

test('no Activity page can reach the preview start: neither the pages nor their template import it', () => {
  const tools = new URL('../../../tools/', import.meta.url);
  const pages = readdirSync(tools).filter((t) => existsSync(new URL(`${t}/activities/`, tools)))
    .flatMap((t) => readdirSync(new URL(`${t}/activities/`, tools)).filter((f) => f.endsWith('.html'))
      .map((f) => readFileSync(new URL(`${t}/activities/${f}`, tools), 'utf8')));
  pages.push(activityPage({ title: 'T', tool: 'stub', file: 't.json' }));
  assert.ok(pages.length > 5);
  for (const page of pages) assert.doesNotMatch(page, /runner\/preview|PREVIEW_START|authoring\//);
});

test('a preview start at an unknown Part or Task is refused', () => {
  assert.throws(() => createRunner(activity, { tools: tools(), [PREVIEW_START]: { partId: 'z', taskId: 'b1' } }), /Unknown Part "z"/);
  assert.throws(() => createRunner(activity, { tools: tools(), [PREVIEW_START]: { partId: 'b', taskId: 'zz' } }), /Unknown Task "zz"/);
});
