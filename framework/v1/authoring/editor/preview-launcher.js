// The preview launcher (mockup: the Preview ▾ popover): pick the Part and Task to start at, then
// preview the editor's current, unsaved Activity in the pane (a dialog holding an iframe) or a
// new tab. Both load ../preview.html?run=<n>, which reads plan n from
// window.activityEditorPreviews (preview-page.js). Needs a DOM; the plan itself is preview.js.
//
// createPreviewLauncher({ button, pop, context }) -> { refresh() }
//   context() -> { editor, sel, toolInfo, toolError, where(path) } at the moment of asking.
//   refresh() redraws the popover when it is open, and keeps the button's description (why the
//   preview won't start, if it won't) current. The page calls it from its own refresh().
//   The popover follows the selection each time it opens: a selected Task, or Task 1 of the
//   selected Part.

import { h } from '../../ui-kit.js';
import { planPreview } from './preview.js';

const PAGE = new URL('../preview.html', import.meta.url);
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '');

export function createPreviewLauncher({ button, pop, context }) {
  let at = { p: 0, t: 0 };
  let runs = 0;
  const plans = (window.activityEditorPreviews ??= {});
  const pane = paneDialog();

  const plan = () => {
    const { editor, toolInfo, toolError } = context();
    const result = planPreview(editor, at, toolInfo);
    if (toolError) result.blockers.unshift({ path: [], message: toolError, source: 'tool' });
    return result;
  };

  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', pop.id);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop.hidden) open();
    else close();
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); button.focus(); } });
  document.addEventListener('click', () => { if (!pop.hidden) close(); });

  function open() {
    const { editor, sel } = context();
    if (sel.kind !== 'activity') at = { p: sel.p, t: sel.kind === 'task' ? sel.t : 0 };
    at.p = Math.min(at.p, editor.doc.parts.length - 1);
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    render();
    pop.querySelector('select')?.focus();
  }

  function close() {
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function render() {
    const { editor, where } = context();
    const { parts } = editor.doc;
    const { blockers } = plan();
    const partSel = h('select', { class: 't', 'aria-label': 'Start at Part', onchange: (e) => { at = { p: +e.target.value, t: 0 }; render(); pop.querySelector('select')?.focus(); } },
      parts.map((part, i) => h('option', { value: i, selected: i === at.p }, stripTags(part.title) || `Part ${i + 1}`)));
    const tasks = parts[at.p]?.tasks ?? [];
    const taskSel = h('select', { class: 't', 'aria-label': 'Start at Task', disabled: !tasks.length, onchange: (e) => { at = { ...at, t: +e.target.value }; render(); pop.querySelectorAll('select')[1]?.focus(); } },
      tasks.map((task, i) => h('option', { value: i, selected: i === at.t }, `${i + 1}. ${stripTags(task.title)}`)));
    const why = blockers.length
      ? h('p', { class: 'pv-why sev', role: 'alert' }, `Can't start: ${blockers[0].source === 'preview' || blockers[0].source === 'tool' ? '' : 'the runner would reject the Activity. '}`
        + `${blockers[0].path.length ? `${where(blockers[0].path)}: ` : ''}${blockers[0].message}${blockers.length > 1 ? ` (and ${blockers.length - 1} more)` : ''}`)
      : null;
    pop.replaceChildren(...[
      h('h3', {}, 'Preview the unsaved Activity'),
      h('div', { class: 'row' }, h('label', {}, 'Start at Part'), partSel),
      h('div', { class: 'row' }, h('label', {}, 'Task'), taskSel),
      h('p', { class: 'muted' }, "Earlier Tasks count as passed. A throwaway Run: nothing is saved, and no student's Run is touched."),
      why,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', disabled: blockers.length > 0, onclick: () => launch('pane') }, 'Preview here'),
        h('button', { type: 'button', class: 'btn', disabled: blockers.length > 0, onclick: () => launch('tab') }, 'In a new tab')),
    ].filter(Boolean));
  }

  function launch(where) {
    const { blockers, activity, start } = plan();
    if (blockers.length) return;
    const run = String(++runs);
    plans[run] = { activity, start };
    const url = new URL(PAGE);
    url.searchParams.set('run', run);
    close();
    if (where === 'tab') window.open(url.href, '_blank');
    else pane.show(url.href, activity.title);
  }

  function refresh() {
    const { editor } = context();
    if (!editor) return;
    if (at.p >= editor.doc.parts.length) at = { p: 0, t: 0 };
    const { blockers } = plan();
    button.title = blockers.length ? `The preview can't start: ${blockers[0].message}` : 'Preview the unsaved Activity';
    if (pop.hidden) return;
    const focused = [...pop.querySelectorAll('select')].indexOf(document.activeElement);
    render();
    if (focused !== -1) pop.querySelectorAll('select')[focused].focus();
  }

  return { refresh };
}

// The preview pane: a modal dialog over the editor with the preview page in an iframe, so the
// runner's page-wide ids and reloads stay out of the editor's page.
function paneDialog() {
  const frame = h('iframe', { class: 'pv-frame', title: 'Preview' });
  const heading = h('h2', {}, 'Preview');
  const closeButton = h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, 'Close preview');
  const dialog = h('dialog', { class: 'ed-preview', 'aria-label': 'Preview' },
    h('div', { class: 'pv-head' }, heading, closeButton), frame);
  dialog.addEventListener('close', () => { frame.src = 'about:blank'; });
  document.body.append(dialog);
  return {
    show(src, title) {
      heading.textContent = `Preview: ${stripTags(title)}`;
      frame.src = src;
      dialog.showModal();
    },
  };
}
