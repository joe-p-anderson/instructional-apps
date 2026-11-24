// Report Viewer core (framework v1): pure logic, no DOM, so it runs in Node tests.
//
//   openReport(text) -> view   parse one Report file into a plain student view;
//                              throws an Error with a readable message if it isn't a Report.
//
// Reading dispatches on the Report's formatVersion through `readers`, so every
// Report format version still in use stays readable (spec, The Report Viewer).
// A new format version adds a reader that maps its Reports onto the same view.
import { verifyReport } from '../report.js';

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

// Format version 1: the schema in ../report.js.
function readV1(report) {
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
    ...points(report),
    parts: (report.parts ?? []).map((part, p) => ({
      id: part.id,
      title: part.title ?? part.id,
      ...points(part),
      tasks: (part.tasks ?? []).map((task, t) => ({
        id: task.id,
        number: `${p + 1}.${t + 1}`,
        title: task.title ?? task.id,
        passed: task.passed === true,
        ...points(task),
        attempts: (task.attempts ?? []).map(readAttemptV1),
      })),
    })),
  };
}

function readAttemptV1(attempt, i) {
  const results = attempt.results ?? [];
  return {
    number: i + 1,
    at: attempt.at ?? null,
    passed: attempt.passed === true,
    state: Object.entries(attempt.state ?? {}).map(([name, value]) => ({ name, value })),
    answers: Object.entries(attempt.answers ?? {}).map(([id, value]) => ({ id, value })),
    feedback: results.filter((r) => r.pass === false && r.feedback).map((r) => r.feedback),
    // A Report is an untrusted file: only inline PNGs are shown, never other URLs.
    snapshots: (attempt.snapshots ?? [])
      .filter((s) => typeof s?.png === 'string' && s.png.startsWith('data:image/png;base64,'))
      .map(({ display, png }) => ({ display: String(display ?? ''), png })),
  };
}

// The student view shows the points the Report carries; recomputing them from the
// Attempts needs the Activity definition (class view, ticket 10).
const points = (item) => ({ earned: num(item.earned), possible: num(item.possible) });
const num = (v) => (Number.isFinite(v) ? v : 0);
