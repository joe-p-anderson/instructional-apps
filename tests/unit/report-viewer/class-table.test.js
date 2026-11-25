import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploaderFromPath, readUploads, openClass } from '../../../framework/v1/report-viewer/core.js';
import { readZip } from '../../../framework/v1/report-viewer/zip.js';
import { sampleReport, quizReport } from './fixtures.js';
import { makeZip } from './make-zip.js';

const json = async (name) => JSON.stringify(await sampleReport(name));
const file = (name, data) => ({ name, bytes: typeof data === 'string' ? new TextEncoder().encode(data) : data });

test('the uploader is read from a flat Brightspace bulk-download file name', () => {
  assert.deepEqual(
    uploaderFromPath('143560-1234567 - Ada Lovelace - Nov 24, 2026 1027 AM - demo_Ada-Lovelace_2026-11-24.json'),
    { uploader: 'Ada Lovelace', uploadId: '143560-1234567', uploadedAt: 'Nov 24, 2026 1027 AM',
      fileName: 'demo_Ada-Lovelace_2026-11-24.json' });
});

test('the uploader is read from a per-upload folder name', () => {
  assert.deepEqual(
    uploaderFromPath('Lab 3 Download/143560-1234568 - Grace Brewster Hopper - Nov 25, 2026 901 PM/report.json'),
    { uploader: 'Grace Brewster Hopper', uploadId: '143560-1234568', uploadedAt: 'Nov 25, 2026 901 PM',
      fileName: 'report.json' });
});

test('a file name not shaped like a bulk download has no uploader', () => {
  assert.deepEqual(uploaderFromPath('demo_Ada-Lovelace_2026-11-24.json'),
    { uploader: null, uploadId: null, uploadedAt: null, fileName: 'demo_Ada-Lovelace_2026-11-24.json' });
});

test('the zip reader reads stored and deflated entries', async () => {
  for (const method of ['store', 'deflate']) {
    const zip = makeZip([{ name: 'a/b.txt', data: 'hello '.repeat(50) }, { name: 'c.txt', data: 'é' }], { method });
    const entries = await readZip(zip);
    assert.deepEqual(entries.map((e) => [e.name, new TextDecoder().decode(e.bytes)]),
      [['a/b.txt', 'hello '.repeat(50)], ['c.txt', 'é']]);
  }
});

test('a bulk-download zip yields one upload per Report, matched to its uploader; other files are skipped', async () => {
  const zip = makeZip([
    { name: '143560-1 - Ada Lovelace - Nov 24, 2026 1027 AM - demo_Ada.json', data: await json('Ada Lovelace') },
    { name: '143560-2 - Grace Hopper - Nov 24, 2026 1030 AM/demo_Grace.json', data: await json('Grace Hopper') },
    { name: 'index.html', data: '<html></html>' },
  ]);
  const subs = await readUploads([file('Lab Download.zip', zip)]);
  assert.deepEqual(subs.map((s) => [s.uploader, s.path]), [
    ['Ada Lovelace', 'Lab Download.zip/143560-1 - Ada Lovelace - Nov 24, 2026 1027 AM - demo_Ada.json'],
    ['Grace Hopper', 'Lab Download.zip/143560-2 - Grace Hopper - Nov 24, 2026 1030 AM/demo_Grace.json'],
  ]);
  assert.match(subs[0].text, /"formatVersion":1/);
});

test('many Reports dropped without a zip are read too', async () => {
  const subs = await readUploads([file('a.json', await json('Ada')), file('b.json', await json('Bo'))]);
  assert.deepEqual(subs.map((s) => [s.path, s.uploader]), [['a.json', null], ['b.json', null]]);
});

test('the class table has a row per student: name, Tasks passed, Attempts, points and an empty flags column', async () => {
  const cls = openClass([
    { path: 'x/2.json', uploader: 'Grace Hopper', text: JSON.stringify(await quizReport('Grace Hopper')) },
    { path: 'x/1.json', uploader: 'Ada Lovelace', text: await json('Ada Lovelace') },
  ]);
  assert.deepEqual(cls.rows.map((r) => [r.name, r.tasksPassed, r.taskCount, r.attemptCount, r.earned, r.possible, r.flags]), [
    ['Ada Lovelace', 2, 3, 3, 4, 8, []],
    ['Grace Hopper', 0, 1, 2, 4, 5, []],
  ]);
  assert.equal(cls.rows[0].sealedName, 'Ada Lovelace');
  assert.equal(cls.rows[0].view.parts[0].tasks[0].attempts.length, 2); // the full detail
  assert.deepEqual(cls.errors, []);
});

test('class table points are recomputed, not the stored totals', async () => {
  const report = await sampleReport('Ada Lovelace');
  report.earned = 8;
  report.parts[1].tasks[0].earned = 4;
  const cls = openClass([{ path: 'a.json', uploader: 'Ada Lovelace', text: JSON.stringify(report) }]);
  assert.deepEqual([cls.rows[0].earned, cls.rows[0].possible], [4, 8]);
});

test('without an uploader the row is named by the sealed name; unreadable files are listed as errors', async () => {
  const cls = openClass([
    { path: 'a.json', uploader: null, text: await json('Ada Lovelace') },
    { path: 'bad.json', uploader: 'Bo Diddley', text: 'not json' },
  ]);
  assert.deepEqual(cls.rows.map((r) => [r.name, r.uploader]), [['Ada Lovelace', null]]);
  assert.equal(cls.errors.length, 1);
  assert.equal(cls.errors[0].uploader, 'Bo Diddley');
  assert.match(cls.errors[0].message, /not a Report/i);
});
