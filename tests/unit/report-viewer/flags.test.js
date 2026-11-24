import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openClass, namesMatch } from '../../../framework/v1/report-viewer/core.js';
import { sampleReport, quizReport, firstTryReport } from './fixtures.js';
import { sealReport } from '../../../framework/v1/report.js';

const sub = (uploader, report, path = `${uploader}.json`) => ({ path, uploader, text: JSON.stringify(report) });
const flagsOf = (cls, name) => cls.rows.find((r) => r.name === name).flags;
const kinds = (cls, name) => flagsOf(cls, name).map((f) => f.kind);

test('a Report whose checksum fails is flagged as tampered', async () => {
  const edited = await sampleReport('Ada Lovelace');
  edited.parts[0].tasks[0].attempts[0].state.x = 1; // hand-edited, not resealed
  const cls = openClass([sub('Ada Lovelace', edited)]);
  assert.deepEqual(kinds(cls, 'Ada Lovelace'), ['tampered']);
  assert.equal(flagsOf(cls, 'Ada Lovelace')[0].severity, 'flag');
});

// A Report copied and relabelled with the checksum key that ships in the client (ADR 0001).
const relabel = (report, name) => sealReport({ ...report, student: { ...report.student, name } });

test('a Run fingerprint shared across uploaders flags both Reports; one uploader resubmitting does not', async () => {
  const ada = await sampleReport('Ada Lovelace');
  const copy = structuredClone(ada);
  copy.parts[0].tasks[1].attempts[0].answers.why = 'My own words.';
  const cls = openClass([
    sub('Ada Lovelace', ada, 'a1.json'), sub('Ada Lovelace', ada, 'a2.json'), sub('Bo Diddley', relabel(copy, 'Bo Diddley')),
    sub('Cy Young', await sampleReport('Cy Young')),
  ]);
  for (const row of cls.rows.filter((r) => r.name !== 'Cy Young')) {
    assert.ok(row.flags.some((f) => f.kind === 'shared-fingerprint'), row.path);
  }
  assert.match(flagsOf(cls, 'Bo Diddley').find((f) => f.kind === 'shared-fingerprint').message, /Ada Lovelace/);
  assert.ok(!kinds(cls, 'Cy Young').includes('shared-fingerprint'));

  const uploadedTwice = openClass([sub('Ada Lovelace', ada, 'a1.json'), sub('Ada Lovelace', ada, 'a2.json')]);
  assert.deepEqual(uploadedTwice.rows.map((r) => r.flags), [[], []]);
});

test('an identical Attempt history across uploaders is flagged, even from different Runs', async () => {
  // Two Runs with the same Submits, including a miss, as a history copied into a
  // fresh Run would be.
  const ada = await sampleReport('Ada Lovelace');
  const cy = await sampleReport('Cy Young');
  assert.notEqual(ada.fingerprint, cy.fingerprint);
  const own = structuredClone(await sampleReport('Di Fossey'));
  own.parts[0].tasks[1].attempts[0].answers.why = 'My own words.';
  const cls = openClass([sub('Ada Lovelace', ada), sub('Cy Young', cy), sub('Di Fossey', relabel(own, 'Di Fossey'))]);
  assert.deepEqual(kinds(cls, 'Ada Lovelace'), ['identical-history']);
  assert.match(flagsOf(cls, 'Ada Lovelace')[0].message, /Cy Young/);
  assert.deepEqual(kinds(cls, 'Cy Young'), ['identical-history']);
  assert.deepEqual(kinds(cls, 'Di Fossey'), []);
});

test('a copied Attempt history replayed at other times is still flagged as identical', async () => {
  const ada = await sampleReport('Ada Lovelace');
  const replayed = await sampleReport('Cy Young', { startedAt: '2026-11-24T16:30:00.000Z' });
  const cls = openClass([sub('Ada Lovelace', ada), sub('Cy Young', replayed)]);
  assert.deepEqual(kinds(cls, 'Ada Lovelace'), ['identical-history']);
  assert.deepEqual(kinds(cls, 'Cy Young'), ['identical-history']);
});

test('students who all pass on the first try with the same values are not flagged as identical', async () => {
  const cls = openClass([
    sub('Ada Lovelace', await firstTryReport('Ada Lovelace')),
    sub('Cy Young', await firstTryReport('Cy Young', { startedAt: '2026-11-24T16:30:00.000Z' })),
  ]);
  assert.deepEqual(cls.rows.map((r) => r.flags), [[], []]);
});

test('an Activity id or version that differs from the class majority is flagged', async () => {
  const oldVersion = await sampleReport('Di Fossey');
  const cls = openClass([
    sub('Ada Lovelace', await sampleReport('Ada Lovelace')),
    sub('Bo Diddley', await sampleReport('Bo Diddley')),
    sub('Cy Young', await sampleReport('Cy Young')),
    sub('Di Fossey', relabel({ ...oldVersion, activity: { ...oldVersion.activity, version: 1 } }, 'Di Fossey')),
    sub('Ed Hubble', await quizReport('Ed Hubble')),
  ]);
  const wrong = (name) => flagsOf(cls, name).find((f) => f.kind === 'wrong-activity');
  assert.equal(wrong('Ada Lovelace'), undefined);
  assert.equal(wrong('Cy Young'), undefined);
  assert.match(wrong('Di Fossey').message, /demo version 1.*demo version 2/);
  assert.match(wrong('Ed Hubble').message, /quiz version 1.*demo version 2/);
});

test('with no class majority, no Report is flagged as from a different Activity', async () => {
  const cls = openClass([sub('Ada Lovelace', await sampleReport('Ada Lovelace')), sub('Ed Hubble', await quizReport('Ed Hubble'))]);
  assert.deepEqual(cls.rows.map((r) => r.flags), [[], []]);
});

test('names loosely match despite case, accents, punctuation, middle names, order and nicknames', () => {
  for (const [sealed, uploader] of [
    ['Ada Lovelace', 'Ada Lovelace'],
    ['ada lovelace', 'ADA LOVELACE'],
    ['  Ada   Lovelace ', 'Ada Lovelace'],
    ['Grace Hopper', 'Grace Brewster Hopper'],
    ['Grace B. Hopper', 'Grace Hopper'],
    ['Hopper, Grace', 'Grace Hopper'],
    ['Bill Gates', 'William Henry Gates'],
    ['Liz Taylor', 'Elizabeth Taylor'],
    ['Bob Smith', 'Robert Smith'],
    ['Chris Wong', 'Christopher Wong'],
    ['Jose Garcia', 'José García'],
    ["Shaquille O'Neal", 'Shaquille ONeal'],
    ['Mary-Jane Watson', 'Mary Jane Watson'],
    ['Ada', 'Ada Lovelace'],
    ['Ada Lovelase', 'Ada Lovelace'], // a one-letter slip in a long name
  ]) {
    assert.equal(namesMatch(sealed, uploader), true, `${sealed} / ${uploader}`);
  }
});

test('names that belong to someone else do not match', () => {
  for (const [sealed, uploader] of [
    ['Bo Diddley', 'Ada Lovelace'],
    ['Ada Byron', 'Ada Lovelace'],
    ['Alan Lovelace', 'Ada Lovelace'],
    ['Bill Smith', 'Robert Smith'],
    ['Al', 'Ada Lovelace'],
    ['', 'Ada Lovelace'],
  ]) {
    assert.equal(namesMatch(sealed, uploader), false, `${sealed} / ${uploader}`);
  }
});

test("a sealed name that doesn't loosely match the uploader is a warning, not a zero", async () => {
  const cls = openClass([
    sub('Ada Lovelace', await sampleReport('Bo Diddley')),
    sub('William Henry Gates', await quizReport('bill gates')),
    { path: 'no-uploader.json', uploader: null, text: JSON.stringify(await quizReport('Cy Young')) },
  ]);
  const warning = flagsOf(cls, 'Ada Lovelace').find((f) => f.kind === 'name-mismatch');
  assert.equal(warning.severity, 'warning');
  assert.match(warning.message, /Bo Diddley.*Ada Lovelace/);
  assert.deepEqual([cls.rows[0].earned, cls.rows[0].possible], [4, 8]); // still scored
  assert.ok(!kinds(cls, 'William Henry Gates').includes('name-mismatch'));
  assert.ok(!kinds(cls, 'Cy Young').includes('name-mismatch')); // no uploader to compare with
});

test('Reports with no Attempts are not flagged as identical', async () => {
  const empty = (name) => {
    const r = structuredClone(ada0);
    for (const part of r.parts) for (const task of part.tasks) task.attempts = [];
    return relabel({ ...r, fingerprint: name }, name);
  };
  const ada0 = await sampleReport('x');
  const cls = openClass([sub('Ada Lovelace', empty('Ada Lovelace')), sub('Cy Young', empty('Cy Young'))]);
  assert.deepEqual(cls.rows.map((r) => r.flags), [[], []]);
});
