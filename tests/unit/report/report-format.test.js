import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sealReport, verifyReport, readReport, reportFilename, createFingerprint, sha256, REPORT_FORMAT_VERSION,
} from '../../../framework/v1/report.js';

const hex = (bytes) => Buffer.from(bytes).toString('hex');

test('the checksum hash is standard SHA-256', () => {
  assert.equal(hex(sha256(new TextEncoder().encode('abc'))),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hex(sha256(new Uint8Array(0))),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const long = new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq');
  assert.equal(hex(sha256(long)), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

const body = {
  formatVersion: REPORT_FORMAT_VERSION, activity: { id: 'osc', version: 1 },
  student: { name: 'José Ñúñez' }, downloadedAt: '2026-11-24T12:00:00.000Z', parts: [],
};

test('the checksum does not depend on key order or formatting', () => {
  const sealed = sealReport(body);
  const reordered = { parts: [], checksum: sealed.checksum, downloadedAt: body.downloadedAt,
    student: { name: 'José Ñúñez' }, activity: { version: 1, id: 'osc' }, formatVersion: REPORT_FORMAT_VERSION };
  assert.equal(verifyReport(reordered), true);
});

test('readReport parses a Report file and says whether its checksum holds', () => {
  const sealed = sealReport(body);
  assert.deepEqual(readReport(JSON.stringify(sealed)), { report: sealed, checksumOk: true });
  const edited = JSON.stringify({ ...sealed, student: { name: 'Someone Else' } });
  assert.equal(readReport(edited).checksumOk, false);
  assert.throws(() => readReport('not json'), /not valid JSON/);
  assert.throws(() => readReport('{"hello":1}'), /Not a Report/);
  assert.throws(() => readReport(JSON.stringify({ ...sealed, formatVersion: 99 })), /format version 99/);
});

test('the filename combines the Activity id, the student name and the date', () => {
  assert.equal(reportFilename({ activity: { id: 'phase-period-amplitude' }, student: { name: 'Ada  Lovelace' },
    downloadedAt: '2026-11-24T12:00:00.000Z' }), 'phase-period-amplitude_Ada-Lovelace_2026-11-24.json');
  assert.equal(reportFilename(body), 'osc_Jose-Nunez_2026-11-24.json');
  assert.equal(reportFilename({ ...body, student: { name: '../<>' } }), 'osc_.._2026-11-24.json');
});

test('fingerprints are random 32-hex-character strings', () => {
  const a = createFingerprint();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, createFingerprint());
});
