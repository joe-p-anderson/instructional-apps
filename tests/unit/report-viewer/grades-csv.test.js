import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openClass } from '../../../framework/v1/report-viewer/core.js';
import { gradesCsv } from '../../../framework/v1/report-viewer/grades-csv.js';
import { sampleReport, quizReport } from './fixtures.js';

const sub = async (path, uploader, submissionId, report) =>
  ({ path, uploader, submissionId, text: JSON.stringify(await report) });

test('the grades CSV has a row per student with the recomputed points (provisional columns)', async () => {
  const inflated = await sampleReport('Ada Lovelace');
  inflated.earned = 8; // the stored total is not trusted
  const { rows } = openClass([
    await sub('x/1.json', 'Ada Lovelace', '143560-1', inflated),
    await sub('x/2.json', 'Grace Hopper', '143560-2', quizReport('Grace Hopper')),
  ]);
  assert.equal(gradesCsv(rows, { item: 'Lab 3' }),
    'Submission Id,Student,Lab 3 Points Grade,End-of-Line Indicator\r\n'
    + '143560-1,Ada Lovelace,4,#\r\n'
    + '143560-2,Grace Hopper,4,#\r\n');
});

test('the grade item defaults to the Activity title, and a missing uploader id is left blank', async () => {
  const { rows } = openClass([await sub('a.json', null, null, sampleReport('Ada Lovelace'))]);
  assert.equal(gradesCsv(rows),
    'Submission Id,Student,Demo Lab Points Grade,End-of-Line Indicator\r\n'
    + ',Ada Lovelace,4,#\r\n');
});

test('fields with commas, quotes or line breaks are quoted, and formula-like names are defused', async () => {
  const { rows } = openClass([
    await sub('a.json', 'Lovelace, "Ada"', '1-1', sampleReport('x')),
    await sub('b.json', '=HYPERLINK("x")', '1-2', sampleReport('y')),
    await sub('c.json', 'Two\nLines', '1-3', sampleReport('z')),
  ]);
  const lines = gradesCsv(rows, { item: 'Lab, "3"' }).split('\r\n');
  assert.equal(lines[0], 'Submission Id,Student,"Lab, ""3"" Points Grade",End-of-Line Indicator');
  assert.deepEqual(lines.slice(1, -1).sort(), [
    '1-1,"Lovelace, ""Ada""",4,#',
    '1-2,"\'=HYPERLINK(""x"")",4,#',
    '1-3,"Two\nLines",4,#',
  ].sort());
});
