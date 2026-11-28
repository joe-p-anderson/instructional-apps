// The folder interface (framework/v1/authoring/editor/folder.js) through its in-memory folder,
// the one the editor's tests use in place of the instructor's checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryFolder, findActivities } from '../../../framework/v1/authoring/editor/folder.js';

const activity = (id, extra = {}) => JSON.stringify({ id, version: 1, title: `T ${id}`, course: 'C', tool: 'osc', parts: [], ...extra });

test('a memory folder lists entries, reads and writes files', async () => {
  const folder = createMemoryFolder({
    'tools/osc/activities/a.json': { text: '{}', lastModified: 5 },
    'tools/osc/osc.js': '',
    'README.md': 'hi',
  });
  assert.deepEqual(await folder.list(''), [
    { name: 'README.md', kind: 'file' },
    { name: 'tools', kind: 'directory' },
  ]);
  assert.deepEqual(await folder.list('tools/osc'), [
    { name: 'activities', kind: 'directory' },
    { name: 'osc.js', kind: 'file' },
  ]);
  assert.deepEqual(await folder.readFile('tools/osc/activities/a.json'), { text: '{}', lastModified: 5 });

  await folder.writeFile('tools/osc/activities/a.json', '{"x":1}');
  const { text, lastModified } = await folder.readFile('tools/osc/activities/a.json');
  assert.equal(text, '{"x":1}');
  assert.ok(lastModified > 5);

  await folder.writeFile('tools/osc/activities/b.json', 'new');
  assert.equal((await folder.readFile('tools/osc/activities/b.json')).text, 'new');
});

test('a memory folder refuses a missing file or folder', async () => {
  const folder = createMemoryFolder({ 'a/b.txt': '' });
  await assert.rejects(folder.readFile('a/c.txt'), { name: 'NotFoundError' });
  await assert.rejects(folder.list('nope'), { name: 'NotFoundError' });
  await assert.rejects(folder.list('a/b.txt'), { name: 'NotFoundError' });
});

test('findActivities lists every Activity file with its header fields and last-modified time', async () => {
  const folder = createMemoryFolder({
    'tools/osc/activities/a.json': { text: activity('osc-a'), lastModified: 20 },
    'tools/osc/activities/a.html': '',
    'tools/osc/activities/old.prototype-themes.html': '',
    'tools/vern/activities/b.json': { text: activity('vern-b', { tool: 'vern', course: undefined }), lastModified: 10 },
    'tools/vern/activities/broken.json': { text: '{ not json', lastModified: 1 },
    'tools/plain/plain.js': '',
  });
  const found = await findActivities(folder);
  assert.deepEqual(found, [
    { path: 'tools/osc/activities/a.json', id: 'osc-a', title: 'T osc-a', course: 'C', tool: 'osc', version: 1, lastModified: 20 },
    { path: 'tools/vern/activities/b.json', id: 'vern-b', title: 'T vern-b', course: '', tool: 'vern', version: 1, lastModified: 10 },
    { path: 'tools/vern/activities/broken.json', id: '', title: 'broken.json', course: '', tool: 'vern', version: '', lastModified: 1, error: 'not valid JSON' },
  ]);
});
