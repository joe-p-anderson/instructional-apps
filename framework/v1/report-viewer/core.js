// Report Viewer core (framework v1): pure logic, no DOM, so it runs in Node tests.
//
//   openReport(text) -> view   parse one Report file into a plain student view;
//                              throws an Error with a readable message if it isn't a Report.
//
//   uploaderFromPath(path) -> { uploader, uploadId, uploadedAt, fileName }
//                              who uploaded a file, from Brightspace bulk-download naming
//   await readUploads(files) -> [{ path, uploader, uploadId, uploadedAt, text }]
//                              files: [{ name, bytes: Uint8Array }]; zips are expanded,
//                              and only .json entries are kept
//   openClass(uploads) -> { rows, errors }
//                              rows: one per readable Report, sorted by name:
//                                { path, uploader, uploadId, uploadedAt, sealedName, name,
//                                  tasksPassed, taskCount, attemptCount, earned, possible,
//                                  flags: [], view }   (view: the openReport student view)
//                              errors: [{ path, uploader, message }] for files that aren't Reports
//
// Every score is recomputed from the Report's Attempts (spec, Scoring), never taken
// from its stored totals. `flags` is filled in by the flag checks (ticket 11); the
// grades CSV (ticket 12) reads the same rows.
//
// Reading dispatches on the Report's formatVersion through `readers`, so every
// Report format version still in use stays readable (spec, The Report Viewer).
// A new format version adds a reader that maps its Reports onto the same view.
import { verifyReport } from '../report.js';
import { isZip, readZip } from './zip.js';
import { flagClass } from './flags.js';
import { earnedFromResults } from '../runner/scoring.js';

export { namesMatch } from './flags.js';

const readers = {
  1: readV1,
};

/** The Report format versions this Report Viewer can read. */
export const READABLE_FORMAT_VERSIONS = Object.keys(readers).map(Number);

export function openReport(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Report: it is not valid JSON.');
  }
  if (!report || typeof report !== 'object' || !('formatVersion' in report)) {
    throw new Error('This file is not a Report: it has no Report format version.');
  }
  const read = readers[report.formatVersion];
  if (!read) {
    throw new Error(`This Report uses format version ${report.formatVersion}, which this Report Viewer cannot read.`);
  }
  return read(report);
}

// Brightspace bulk-download naming. PROVISIONAL: assumed from the commonly seen
// shape, not yet checked against a real download (spec keeps this open). Each
// upload is either a flat file or a folder named
//   "<id>-<id> - First Last - <submitted date>"            (folder)
//   "<id>-<id> - First Last - <submitted date> - <file>"   (flat file)
// The folder or file closest to the Report that has this shape names the uploader.
// Anything else has uploader null, and the Report's sealed name is used instead.
const BULK_NAME = /^(\d+-\d+) - (.+?) - (.+?)(?: - (.+))?$/;

export function uploaderFromPath(path) {
  const segments = String(path).split(/[\\/]/).filter(Boolean);
  const fileName = segments.at(-1) ?? '';
  for (let i = segments.length - 1; i >= 0; i--) {
    const m = BULK_NAME.exec(segments[i]);
    if (!m) continue;
    const isFile = i === segments.length - 1;
    if (isFile && !m[4]) continue; // a flat file needs its own file name after the date
    return {
      uploader: m[2].trim(),
      uploadId: m[1],
      uploadedAt: m[3].trim(),
      fileName: isFile ? m[4] : fileName,
    };
  }
  return { uploader: null, uploadId: null, uploadedAt: null, fileName };
}

export async function readUploads(files) {
  const out = [];
  const decoder = new TextDecoder();
  const add = (path, bytes) => {
    if (!/\.json$/i.test(path)) return;
    out.push({ path, ...withoutFileName(uploaderFromPath(path)), text: decoder.decode(bytes) });
  };
  for (const { name, bytes } of files) {
    if (/\.zip$/i.test(name) || isZip(bytes)) {
      for (const entry of await readZip(bytes)) add(`${name}/${entry.name}`, entry.bytes);
    } else {
      add(name, bytes);
    }
  }
  return out;
}

const withoutFileName = ({ fileName: _ignored, ...rest }) => rest;

export function openClass(uploads) {
  const rows = [];
  const errors = [];
  for (const { path, uploader = null, uploadId = null, uploadedAt = null, text } of uploads) {
    let view;
    try {
      view = openReport(text);
    } catch (err) {
      errors.push({ path, uploader, message: err.message });
      continue;
    }
    rows.push({
      path, uploader, uploadId, uploadedAt,
      sealedName: view.student.name,
      name: uploader || view.student.name || path,
      tasksPassed: view.tasksPassed,
      taskCount: view.taskCount,
      attemptCount: view.attemptCount,
      earned: view.earned,
      possible: view.possible,
      flags: [],
      view,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
  flagClass(rows);
  return { rows, errors };
}

// Format version 1: the schema in ../report.js.
function readV1(report) {
  const parts = (report.parts ?? []).map((part, p) => {
    const tasks = (part.tasks ?? []).map((task, t) => ({
      id: task.id,
      number: `${p + 1}.${t + 1}`,
      title: task.title ?? task.id,
      ...rescoreTaskV1(task),
      attempts: (task.attempts ?? []).map(readAttemptV1),
    }));
    return { id: part.id, title: part.title ?? part.id, ...totals(tasks), tasks };
  });
  const tasks = parts.flatMap((p) => p.tasks);
  return {
    formatVersion: report.formatVersion,
    frameworkVersion: report.frameworkVersion ?? '',
    activity: {
      id: report.activity?.id ?? '',
      version: report.activity?.version,
      title: report.activity?.title ?? '',
      course: report.activity?.course ?? '',
    },
    student: { name: report.student?.name ?? '' },
    fingerprint: report.fingerprint ?? '',
    startedAt: report.startedAt ?? null,
    downloadedAt: report.downloadedAt ?? null,
    checksumOk: verifyReport(report),
    ...totals(parts),
    // The totals the Report claims; shown nowhere, kept for comparison only.
    stored: { earned: num(report.earned), possible: num(report.possible) },
    tasksPassed: tasks.filter((t) => t.passed).length,
    taskCount: tasks.length,
    attemptCount: tasks.reduce((n, t) => n + t.attempts.length, 0),
    parts,
  };
}

// Rescore one Task from its own Attempts (spec, Scoring), never from its stored
// earned/passed. The Report Viewer has no Activity definition, so it applies the
// runner's scoring rules (earnedFromResults) to each Attempt's recorded results and
// answers, with the points the Report records. An Attempt passed if it has results
// and none of them failed. A Report without per-Question points counts all its
// possible points as the Task's.
function rescoreTaskV1(task) {
  const attempts = (task.attempts ?? []).filter((a) => a && typeof a === 'object').map((a) => ({
    passed: Array.isArray(a.results) && a.results.every((r) => r?.pass !== false),
    results: Array.isArray(a.results) ? a.results : [],
    answers: a.answers ?? {},
  }));
  const questions = (Array.isArray(task.questions) ? task.questions : [])
    .map((q) => ({ id: q?.id, graded: q?.graded !== false, points: num(q?.points) }));
  const points = Number.isFinite(task.points) ? task.points : num(task.possible);
  return earnedFromResults({ points, questions }, attempts);
}

// The expected value recorded on a Question's result, if it is a finite number.
function expectedFor(results, id) {
  const r = results.find((x) => x?.kind === 'question' && x.id === id);
  return typeof r?.expected === 'number' && Number.isFinite(r.expected) ? r.expected : undefined;
}

function readAttemptV1(attempt, i) {
  const results = Array.isArray(attempt.results) ? attempt.results : [];
  return {
    number: i + 1,
    at: attempt.at ?? null,
    passed: attempt.passed === true,
    state: Object.entries(attempt.state ?? {}).map(([name, value]) => ({ name, value })),
    // expected: the value a numeric answer was judged against (framework 1.1.0 on).
    answers: Object.entries(attempt.answers ?? {}).map(([id, value]) => {
      const expected = expectedFor(results, id);
      return expected === undefined ? { id, value } : { id, value, expected };
    }),
    feedback: results.filter((r) => r.pass === false && r.feedback).map((r) => r.feedback),
    // A Report is an untrusted file: only inline PNGs are shown, never other URLs.
    snapshots: (attempt.snapshots ?? [])
      .filter((s) => typeof s?.png === 'string' && s.png.startsWith('data:image/png;base64,'))
      .map(({ display, png }) => ({ display: String(display ?? ''), png })),
  };
}

const totals = (items) => ({
  earned: items.reduce((n, i) => n + i.earned, 0),
  possible: items.reduce((n, i) => n + i.possible, 0),
});
const num = (v) => (Number.isFinite(v) ? v : 0);
