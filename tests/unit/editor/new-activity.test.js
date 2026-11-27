// A new Activity (framework/v1/authoring/editor/new-activity.js): its id offered from its title,
// the checks on its fields, and its two files written into the Tool's activities folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryFolder, findActivities } from '../../../framework/v1/authoring/editor/folder.js';
import { slugFromTitle, newActivityProblems, createActivity } from '../../../framework/v1/authoring/editor/new-activity.js';
import { activityPage } from '../../../framework/v1/activity-file.js';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';

const existing = () => createMemoryFolder({
  'tools/spacetime/activities/lab10.json': '{ "id": "spacetime-lab10", "title": "Spacetime Diagrams", "tool": "spacetime" }\n',
  'tools/spacetime/activities/lab10.html': '',
  'tools/spacetime/spacetime.js': '',
});
const fields = (extra = {}) => ({ tool: 'spacetime', id: 'lab11', title: 'Length Contraction', course: 'PHY 1200', ...extra });

test('the id offered from a title is a slug', () => {
  assert.equal(slugFromTitle('Length Contraction'), 'length-contraction');
  assert.equal(slugFromTitle('  Phasors & Impedance: Lab 3!  '), 'phasors-impedance-lab-3');
  assert.equal(slugFromTitle('Ångström’s Rule'), 'angstrom-s-rule');
  assert.equal(slugFromTitle('!!!'), '');
});

test('a new Activity needs a listed Tool, a slug id, a title and a course', async () => {
  const folder = existing();
  assert.deepEqual(await newActivityProblems(folder, fields()), {});
  assert.deepEqual(await newActivityProblems(folder, { tool: '', id: '', title: ' ', course: '' }), {
    tool: 'Choose a Tool', id: 'Give it an id', title: 'Give it a title', course: 'Give it a course',
  });
  assert.deepEqual(await newActivityProblems(folder, fields({ tool: 'nope' })), { tool: 'Choose a Tool' });
  assert.deepEqual(await newActivityProblems(folder, fields({ id: 'Lab 11' })),
    { id: 'An id is lower-case letters, digits and single hyphens, such as lab-11' });
});

test("an id already used in that Tool's folder is refused, as a file name or as an Activity id", async () => {
  const folder = existing();
  const used = { id: 'That id is already used in tools/spacetime/activities' };
  assert.deepEqual(await newActivityProblems(folder, fields({ id: 'lab10' })), used);
  assert.deepEqual(await newActivityProblems(folder, fields({ id: 'spacetime-lab10' })), used);
  // Another Tool's folder (even one with no activities folder yet) doesn't clash.
  assert.deepEqual(await newActivityProblems(folder, fields({ tool: 'fourier', id: 'lab10' })), {});
});

test('creating an Activity writes its JSON and its page from the template, and returns the JSON path', async () => {
  const folder = existing();
  const path = await createActivity(folder, fields({ title: ' Length Contraction ', course: ' PHY 1200 ' }));
  assert.equal(path, 'tools/spacetime/activities/lab11.json');
  assert.equal((await folder.readFile(path)).text, `{
  "id": "lab11",
  "version": 1,
  "title": "Length Contraction",
  "course": "PHY 1200",
  "tool": "spacetime",
  "parts": []
}
`);
  assert.equal((await folder.readFile('tools/spacetime/activities/lab11.html')).text,
    activityPage({ title: 'Length Contraction', tool: 'spacetime', file: 'lab11.json' }));
  assert.ok((await findActivities(folder)).some((a) => a.path === path && a.title === 'Length Contraction'));
  // It opens in the editor, needing its first Part.
  assert.deepEqual(openActivity((await folder.readFile(path)).text).problems().map((p) => p.message), ['needs at least one Part']);
});

test('creating an Activity with a problem writes nothing', async () => {
  const folder = existing();
  await assert.rejects(createActivity(folder, fields({ id: 'lab10' })), /already used/);
  await assert.rejects(folder.readFile('tools/spacetime/activities/lab11.json'), { name: 'NotFoundError' });
});
