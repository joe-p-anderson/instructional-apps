// Report Viewer UI (framework v1): the thin DOM layer over ./core.js.
//
//   mountReportViewer(root) -> { open(files) }
//
// Files are read with FileReader in the browser; nothing is uploaded (spec, The Report Viewer).
// One Report opens in the student view, with Print / Save as PDF. Report content is
// untrusted, so it is only ever inserted as text (h() children), never as HTML.
import { h } from '../ui-kit.js';
import { typeset } from '../vendor.js';
import { openReport } from './core.js';

export function mountReportViewer(root) {
  const input = h('input', {
    type: 'file', id: 'fw-viewer-file', accept: '.json,application/json', class: 'fw-viewer-input',
    onchange: () => open(input.files),
  });
  const drop = h('div', { class: 'fw-viewer-drop' },
    h('label', { for: 'fw-viewer-file', class: 'fw-viewer-drop-label' }, 'Open a Report'),
    input,
    h('p', { class: 'fw-viewer-drop-help' },
      'Drop your Report (.json) here, or choose it. It is read in this browser and never uploaded.'));
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
    if (list.length > 1) {
      showError('Open one Report at a time.');
      return;
    }
    let view;
    try {
      view = openReport(await list[0].text());
    } catch (err) {
      output.replaceChildren();
      showError(`${list[0].name}: ${err.message}`);
      return;
    }
    const article = studentView(view);
    output.replaceChildren(article);
    document.title = `${view.activity.title} - ${view.student.name}`;
    await typeset([article]);
  }

  return { open };
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
        a.state.map((s, i) => [i ? ', ' : '', h('span', {}, `${s.name} = ${fmt(s.value)}`)])),
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
