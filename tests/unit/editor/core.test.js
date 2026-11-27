// The editor core (framework/v1/authoring/editor/core.js): open, edit, undo and redo, save,
// problems and preview, driven through its public interface on the real Activity files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { validateActivity } from '../../../framework/v1/runner/index.js';

const TOOLS = new URL('../../../tools/', import.meta.url);
const FILES = readdirSync(TOOLS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/activities/`, TOOLS)))
  .flatMap((d) => readdirSync(new URL(`${d.name}/activities/`, TOOLS))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ where: `${d.name}/${f}`, text: readFileSync(new URL(`${d.name}/activities/${f}`, TOOLS), 'utf8').replace(/\r\n/g, '\n') })));
const OSC = FILES.find((f) => f.where === 'oscilloscope/phase-period-amplitude.json').text;

// Save through the core, returning the text it wrote.
async function saved(editor) {
  let written;
  await editor.save((text) => { written = text; });
  return written;
}

// A small Activity for the problems cases, as JSON text.
const small = (task = {}, extra = {}) => `${JSON.stringify({
  id: 'a', version: 1, title: 'A', tool: 'stub',
  parts: [{ id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [{ id: 't', title: 'T', prompt: '', points: 1, ...task }] }],
  ...extra,
}, null, 2)}\n`;

test('all five Activities are found', () => {
  assert.equal(FILES.length, 5);
});

for (const { where, text } of FILES) {
  test(`${where}: opening and saving with no edits writes the file byte for byte`, async () => {
    const editor = openActivity(text);
    assert.equal(await saved(editor), text);
  });

  test(`${where}: every encoded field is decoded on open`, () => {
    assert.ok(text.includes('"enc1:'));
    const { doc } = openActivity(text);
    assert.equal(JSON.stringify(doc).includes('enc1:'), false);
  });
}

// The file with one line changed: the expected text of an edit that writes only that change.
const withLine = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `exactly one ${from}`);
  return text.replace(from, to);
};

test('editing the title, course or version writes only that line', async () => {
  const cases = [
    [{ field: 'title', value: 'Sinusoids' }, '  "title": "Sinusoidal Signals",', '  "title": "Sinusoids",'],
    [{ field: 'course', value: 'PHY 3120' }, '  "course": "PHY/EGR 3120",', '  "course": "PHY 3120",'],
    [{ field: 'version', value: 2 }, '  "version": 1,', '  "version": 2,'],
  ];
  for (const [change, from, to] of cases) {
    const editor = openActivity(OSC);
    editor.edit({ type: 'setActivityField', ...change });
    assert.equal(await saved(editor), withLine(OSC, from, to));
  }
});

test('editing the notes writes only the notes; clearing them removes the line', async () => {
  const line = OSC.split('\n').find((l) => l.startsWith('  "notes": '));
  const editor = openActivity(OSC);
  editor.edit({ type: 'setActivityField', field: 'notes', value: 'Short "note"\nTwo lines.' });
  assert.equal(await saved(editor), withLine(OSC, line, '  "notes": "Short \\"note\\"\\nTwo lines.",'));
  editor.edit({ type: 'setActivityField', field: 'notes', value: '' });
  assert.equal(await saved(editor), withLine(OSC, `${line}\n`, ''));
});

test('an edit returns a new document and leaves the old one as it was', () => {
  const editor = openActivity(OSC);
  const before = editor.doc;
  const after = editor.edit({ type: 'setActivityField', field: 'title', value: 'New' });
  assert.equal(after, editor.doc);
  assert.equal(after.title, 'New');
  assert.equal(before.title, 'Sinusoidal Signals');
  assert.equal(after.parts, before.parts);
  assert.throws(() => { after.title = 'mutated'; }, TypeError);
});

const setTitle = (value) => ({ type: 'setActivityField', field: 'title', value });

test('undo and redo step through the edits; a new edit drops the redo steps', () => {
  const editor = openActivity(OSC);
  assert.equal(editor.canUndo, false);
  assert.equal(editor.undo(), false);
  editor.edit(setTitle('One'));
  editor.edit(setTitle('Two'));
  assert.equal(editor.undo(), true);
  assert.equal(editor.doc.title, 'One');
  assert.equal(editor.canRedo, true);
  assert.equal(editor.redo(), true);
  assert.equal(editor.doc.title, 'Two');
  assert.equal(editor.redo(), false);
  editor.undo();
  editor.undo();
  assert.equal(editor.doc.title, 'Sinusoidal Signals');
  assert.equal(editor.canUndo, false);
  editor.edit(setTitle('Three'));
  assert.equal(editor.canRedo, false);
});

test('edits in one group (typing in one field) make a single undo step', () => {
  const editor = openActivity(OSC);
  for (const value of ['S', 'Si', 'Sin']) editor.edit(setTitle(value), { group: 'title#1' });
  editor.edit({ type: 'setActivityField', field: 'course', value: 'X' }, { group: 'course#1' });
  editor.edit(setTitle('Sine'), { group: 'title#2' });
  editor.undo();
  assert.equal(editor.doc.title, 'Sin');
  editor.undo();
  assert.equal(editor.doc.course, 'PHY/EGR 3120');
  editor.undo();
  assert.equal(editor.doc.title, 'Sinusoidal Signals');
  assert.equal(editor.canUndo, false);
});

test('an edit that changes nothing makes no undo step', () => {
  const editor = openActivity(OSC);
  editor.edit(setTitle('Sinusoidal Signals'));
  assert.equal(editor.canUndo, false);
  assert.equal(editor.dirty, false);
});

test('unsaved changes: dirty after an edit, clean after save, and clean again when undone back', async () => {
  const editor = openActivity(OSC);
  assert.equal(editor.dirty, false);
  editor.edit(setTitle('One'));
  assert.equal(editor.dirty, true);
  editor.undo();
  assert.equal(editor.dirty, false);
  editor.redo();
  await saved(editor);
  assert.equal(editor.dirty, false);
  editor.undo();
  assert.equal(editor.dirty, true);
});

test('a failed save leaves the changes unsaved', async () => {
  const editor = openActivity(OSC);
  editor.edit(setTitle('One'));
  await assert.rejects(editor.save(() => { throw new Error('disk full'); }), /disk full/);
  assert.equal(editor.dirty, true);
});

test('a valid Activity has no problems', () => {
  for (const { where, text } of FILES) assert.deepEqual(openActivity(text).problems(), [], where);
});

test("problems are the runner's own validation errors, each with a path to its field", () => {
  const T = ['parts', 0, 'tasks', 0];
  const cases = [
    [small({ points: 'x' }), [...T, 'points'], 'Task "t" points must be a number'],
    [small({ show: 'f' }), [...T, 'show'], 'Task "t" show must be a list of Control ids'],
    [small({ hint: { after: 'x', text: 'h' } }), [...T, 'hint'], 'Task "t" hint needs { after: number, text: string }'],
    [small({ questions: [{ id: 'q', kind: 'numeric', prompt: '', answer: 1 }] }), [...T, 'questions', 0, 'tol'],
      'Question "q" in Task "t" needs tol or relTol'],
    [small({ questions: [{ id: 'q', kind: 'numeric', prompt: '', answer: 'x', tol: 1 }] }), [...T, 'questions', 0, 'answer'],
      'Question "q" in Task "t" needs a numeric answer'],
    [small({ questions: [{ id: 'q', kind: 'choice', prompt: '', choices: [{ id: 'a' }, { id: 'b' }], correct: 'c' }] }),
      [...T, 'questions', 0, 'correct'], 'Question "q" in Task "t" correct must name one of its choices'],
    [small({ questions: [{ id: 'q', kind: 'essay', prompt: '' }] }), [...T, 'questions', 0, 'kind'],
      'Question "q" in Task "t" kind must be one of numeric, choice, text'],
    [small({ questions: [{ id: 'q', kind: 'text' }, { id: 'q', kind: 'text' }] }), [...T, 'questions', 1, 'id'],
      'duplicate Question "q" in Task "t"'],
    [small({ condition: { type: 'anyOf', conditions: [{ state: 'x', equals: 1 }, { state: 'x', target: { expr: '1/(' }, tol: 1 }] } }),
      [...T, 'condition', 'conditions', 1, 'target'], 'Task "t" Condition target expression "1/(" doesn\'t parse: The expression ends where a value is expected (position 3).'],
    [small({ condition: [{ state: 'x', target: 1 }] }), [...T, 'condition', 0, 'tol'], 'Task "t" Condition needs exactly one of tol and relTol, as a number'],
    [small({}, { version: undefined }), ['version'], 'missing version'],
    [small({}, { notes: 3 }), ['notes'], 'the Activity notes must be text'],
  ];
  for (const [text, path, message] of cases) {
    const problems = openActivity(text).problems();
    assert.deepEqual(problems.map((p) => ({ path: p.path, message: p.message })), [{ path, message }], message);
    // The message is exactly the one the runner throws.
    assert.throws(() => validateActivity(JSON.parse(text)), { message: `Invalid Activity: ${message}` });
  }
});

test('every problem is listed, not only the first the runner stops at', () => {
  const text = small({ points: 'x', questions: [{ id: 'q', kind: 'text' }, { id: 'q', kind: 'text' }] }, { title: '' });
  assert.deepEqual(openActivity(text).problems().map((p) => p.path), [
    ['title'],
    ['parts', 0, 'tasks', 0, 'points'],
    ['parts', 0, 'tasks', 0, 'questions', 1, 'id'],
  ]);
});

test('problems follow the edits: clearing the version is a problem until it is set again', () => {
  const editor = openActivity(OSC);
  editor.edit({ type: 'setActivityField', field: 'version', value: undefined });
  assert.deepEqual(editor.problems().map((p) => [p.path, p.message]), [[['version'], 'missing version']]);
  editor.edit({ type: 'setActivityField', field: 'version', value: 3 });
  assert.deepEqual(editor.problems(), []);
});

test('the preview is the Activity object the runner takes: the file as saved', () => {
  const editor = openActivity(OSC);
  editor.edit(setTitle('Preview me'));
  assert.deepEqual(editor.preview(), JSON.parse(editor.serialize()));
  assert.equal(editor.preview().title, 'Preview me');
});

test('an unknown edit, or an Activity field the edit does not cover, is refused', () => {
  const editor = openActivity(OSC);
  assert.throws(() => editor.edit({ type: 'nope' }), /Unknown edit "nope"/);
  assert.throws(() => editor.edit({ type: 'setActivityField', field: 'parts', value: [] }), /field/);
});
