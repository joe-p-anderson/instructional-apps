// Report Viewer UI (framework v1): the thin DOM layer over ./core.js.
//
//   mountReportViewer(root) -> { open(files) }
//
// Files are read in the browser; nothing is uploaded (spec, The Report Viewer).
// One Report opens in the student view, with Print / Save as PDF. A zip (the
// Brightspace bulk download) or many Reports open as the class table; clicking a
// student opens their student view, with Back to class. Report content is
// untrusted, so it is only ever inserted as text (h() children), never as HTML.
import { h } from '../ui-kit.js';
import { typeset } from '../vendor.js';
import { openReport, readSubmissions, openClass } from './core.js';
import { isZip } from './zip.js';
import { gradesCsv } from './grades-csv.js';

export function mountReportViewer(root) {
  const input = h('input', {
    type: 'file', id: 'fw-viewer-file', multiple: true, class: 'fw-viewer-input',
    accept: '.json,application/json,.zip,application/zip',
    onchange: () => open(input.files),
  });
  const drop = h('div', { class: 'fw-viewer-drop' },
    h('label', { for: 'fw-viewer-file', class: 'fw-viewer-drop-label' }, 'Open a Report'),
    input,
    h('p', { class: 'fw-viewer-drop-help' },
      'Drop your Report (.json) here, or choose it. Instructors: drop the Brightspace bulk-download zip, '
      + 'or many Reports, for the class table. Files are read in this browser and never uploaded.'));
  const message = h('div', { class: 'fw-viewer-message', role: 'alert', hidden: true });
  const output = h('div', { class: 'fw-viewer-output' });

  document.documentElement.classList.add('fw-root');
  root.classList.add('fw-viewer');
  root.replaceChildren(
    h('header', { class: 'fw-header fw-viewer-chrome' },
      h('div', { class: 'fw-header-titles' },
        h('h1', { class: 'fw-title' }, 'Report Viewer'),
        h('div', { class: 'fw-subtitle' }, 'Read or print a Report'))),
    h('div', { class: 'fw-viewer-chrome' }, drop, message),
    output);

  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('fw-dragging'); });
  }
  drop.addEventListener('dragleave', () => drop.classList.remove('fw-dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('fw-dragging');
    open(e.dataTransfer.files);
  });

  function showError(text) {
    message.textContent = text;
    message.hidden = false;
  }

  async function open(files) {
    message.hidden = true;
    const list = [...(files ?? [])];
    if (list.length === 0) return;
    let read;
    try {
      read = await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
    } catch (err) {
      showError(`Could not read the file: ${err.message}`);
      return;
    }
    // One Report on its own opens in the student view; a zip or many Reports open as a class.
    if (read.length === 1 && !/\.zip$/i.test(read[0].name) && !isZip(read[0].bytes)) {
      await openOne(read[0]);
      return;
    }
    let cls;
    try {
      cls = openClass(await readSubmissions(read));
    } catch (err) {
      output.replaceChildren();
      showError(`${read.map((f) => f.name).join(', ')}: ${err.message}`);
      return;
    }
    if (cls.rows.length === 0) {
      output.replaceChildren();
      showError(cls.errors.length ? 'None of these files is a Report.' : 'No Reports (.json) were found.');
      return;
    }
    showClass(cls);
  }

  async function openOne(file) {
    let view;
    try {
      view = openReport(new TextDecoder().decode(file.bytes));
    } catch (err) {
      output.replaceChildren();
      showError(`${file.name}: ${err.message}`);
      return;
    }
    await showStudent(view);
  }

  async function showStudent(view, back) {
    const article = studentView(view);
    output.replaceChildren(
      back ? h('div', { class: 'fw-viewer-chrome fw-viewer-back' },
        h('button', { class: 'fw-button', type: 'button', onclick: back }, 'Back to class')) : null,
      article);
    document.title = `${view.activity.title} - ${view.student.name}`;
    await typeset([article]);
  }

  function showClass(cls) {
    const back = () => showClass(cls);
    output.replaceChildren(classView(cls, (row) => showStudent(row.view, back)));
    document.title = 'Report Viewer - Class';
  }

  return { open };
}

// Columns of the class table. Flags come from the core's flag checks (flags.js);
// a warning (name mismatch) is styled apart from a flag, and each shows its reason on hover.
const CLASS_COLUMNS = [
  ['Student', (row, onOpen) => h('button', { class: 'fw-class-name', type: 'button', onclick: () => onOpen(row) }, row.name)],
  ['Tasks passed', (row) => `${row.tasksPassed} / ${row.taskCount}`],
  ['Attempts', (row) => String(row.attemptCount)],
  ['Points', (row) => `${row.earned} / ${row.possible}`],
  ['Flags', (row) => row.flags.map((f) => h('span', {
    class: f.severity === 'warning' ? 'fw-class-flag fw-class-warning' : 'fw-class-flag', title: f.message ?? '',
  }, f.label ?? String(f.kind ?? f)))],
];

function classView(cls, onOpen) {
  return h('section', { class: 'fw-class', 'aria-label': 'Class view' },
    h('div', { class: 'fw-class-actions fw-viewer-chrome' },
      h('button', { class: 'fw-button', type: 'button', onclick: () => exportGrades(cls.rows) }, 'Export grades CSV')),
    h('table', { class: 'fw-class-table', 'aria-label': 'Class' },
      h('thead', {}, h('tr', {}, CLASS_COLUMNS.map(([label]) => h('th', { scope: 'col' }, label)))),
      h('tbody', {}, cls.rows.map((row) => h('tr', {},
        CLASS_COLUMNS.map(([, cell]) => h('td', {}, cell(row, onOpen))))))),
    cls.errors.length === 0 ? null
      : h('div', { class: 'fw-class-errors' },
        h('h3', {}, 'Files that could not be read'),
        h('ul', {}, cls.errors.map((e) => h('li', {}, `${e.uploader ? `${e.uploader}: ` : ''}${e.path}: ${e.message}`)))));
}

// The grades CSV is built in the browser (./grades-csv.js) and saved as a local file; nothing is uploaded.
function exportGrades(rows) {
  const item = rows[0]?.view.activity.title || 'Activity';
  const url = URL.createObjectURL(new Blob([gradesCsv(rows, { item })], { type: 'text/csv' }));
  const link = h('a', { href: url, download: `${item.replace(/[\\/:*?"<>|]/g, '_')} grades.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function studentView(view) {
  const when = (iso) => (iso ? new Date(iso).toLocaleString() : '-');
  return h('article', { class: 'fw-report', 'aria-label': 'Report' },
    h('div', { class: 'fw-report-actions fw-viewer-chrome' },
      h('button', { class: 'fw-button', type: 'button', onclick: () => window.print() }, 'Print / Save as PDF')),
    h('header', { class: 'fw-report-head' },
      h('div', { class: 'fw-report-course' }, view.activity.course),
      h('h2', { class: 'fw-report-title' }, view.activity.title),
      h('dl', { class: 'fw-report-meta' },
        meta('Student', view.student.name),
        meta('Started', when(view.startedAt)),
        meta('Downloaded', when(view.downloadedAt)),
        meta('Points', pts(view)),
        meta('Activity', `${view.activity.id}, version ${view.activity.version ?? '-'}`),
        meta('Run', view.fingerprint)),
      view.checksumOk ? null
        : h('p', { class: 'fw-report-warning' },
          'This Report fails its checksum: it was changed after it was downloaded.')),
    view.parts.map((part) => h('section', { class: 'fw-report-part' },
      h('h3', {}, part.title),
      h('div', { class: 'fw-report-points' }, pts(part)),
      part.tasks.map(taskView))));
}

function taskView(task) {
  const status = task.passed ? 'passed' : task.attempts.length ? 'attempted' : 'not attempted';
  return h('section', {
    class: 'fw-report-task', 'aria-label': `Task ${task.number}`,
    'data-status': task.passed ? 'passed' : task.attempts.length ? 'attempted' : 'open',
  },
  h('h4', {}, `Task ${task.number}: `, task.title),
  h('div', { class: 'fw-report-points' }, `${cap(status)} · ${pts(task)}`),
  task.attempts.length === 0 ? null
    : h('ol', { class: 'fw-report-attempts' }, task.attempts.map(attemptView)));
}

function attemptView(a) {
  return h('li', { class: `fw-report-attempt ${a.passed ? 'fw-pass' : 'fw-miss'}` },
    h('div', { class: 'fw-report-attempt-head' },
      `Attempt ${a.number} · ${a.passed ? 'passed' : 'missed'} · `,
      a.at ? new Date(a.at).toLocaleTimeString() : ''),
    a.state.length === 0 ? null
      : h('div', { class: 'fw-report-state' }, 'State: ',
        a.state.flatMap((s, i) => [i ? ', ' : '', h('span', {}, `${s.name} = ${fmt(s.value)}`)])),
    a.answers.length === 0 ? null
      : h('dl', { class: 'fw-report-answers' },
        a.answers.map((ans) => meta(ans.id, String(ans.value ?? '')))),
    a.feedback.length === 0 ? null
      : h('ul', { class: 'fw-report-feedback' }, a.feedback.map((f) => h('li', {}, f))),
    a.snapshots.map((s) => h('figure', { class: 'fw-report-snapshot' },
      h('img', { src: s.png, alt: `Snapshot of ${s.display}` }))));
}

function meta(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', {}, value));
}

const pts = (x) => `${x.earned} / ${x.possible} points`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(4)));
  return String(v);
}
