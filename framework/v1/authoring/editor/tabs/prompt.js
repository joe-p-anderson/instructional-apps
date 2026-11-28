// The Task form's Prompt tab: title, points, id (renamed by hand, with a warning) and prompt.
// See task-form.js for the tab shape. Ticket 13 gives the prompt its preview through prose.js.

import { h } from '../../../ui-kit.js';
import { proseField } from '../prose.js';

const setTask = (p, t, field, value) => ({ type: 'setTaskField', p, t, field, value });

export const promptTab = {
  id: 'prompt',
  label: () => 'Prompt',
  owns: (rest) => ['title', 'points', 'id', 'prompt'].includes(rest[0]),
  render(ctx) {
    const { p, t, task, base } = ctx;
    const [titleLabel, titleInput] = ctx.field({ label: 'Title', path: `${base}.title`, value: task.title, class: 't wide',
      toEdit: (v) => setTask(p, t, 'title', v) });
    titleInput.addEventListener('input', () => ctx.setHeading(titleInput.value));
    const [pointsLabel, pointsInput] = ctx.field({ label: 'Points', path: `${base}.points`, value: task.points === undefined ? '' : String(task.points),
      class: 't num', inputmode: 'decimal', toEdit: (v) => setTask(p, t, 'points', pointsValue(v)) });
    return [
      ctx.section('Task', null,
        h('div', { class: 'row' }, titleLabel, titleInput),
        h('div', { class: 'row' }, pointsLabel, pointsInput, h('span', { class: 'muted' }, 'for passing the Condition; each Question has its own')),
        idRow(ctx)),
      ctx.section('Prompt', null,
        proseField(ctx, { label: 'Prompt', path: `${base}.prompt`, value: task.prompt, toEdit: (v) => setTask(p, t, 'prompt', v) })),
    ];
  },
};

// Points as typed: empty removes them (the runner counts 0), a number is that number, anything
// else is kept as text so the runner's validation lists it.
function pointsValue(text) {
  const s = text.trim();
  if (s === '') return undefined;
  return Number.isFinite(Number(s)) ? Number(s) : s;
}

// The id, frozen on retitle; "Rename id…" opens a field with the warning.
function idRow(ctx) {
  const { p, t, task, base } = ctx;
  const row = h('div', { class: 'row' });
  const view = () => row.replaceChildren(h('span', { class: 'flabel' }, 'Id'),
    h('span', { class: 'idfield', 'data-path': `${base}.id` }, h('code', {}, task.id ?? ''),
      h('button', { type: 'button', class: 'lnk', onclick: edit }, 'Rename id…')),
    h('span', { class: 'muted' }, 'made from the first title; retitling keeps it'));
  function edit() {
    const input = h('input', { type: 'text', class: 't', id: 'task-id-input', 'data-path': `${base}.id`, spellcheck: 'false',
      'aria-describedby': 'task-id-warning', autocomplete: 'off' });
    input.value = task.id ?? '';
    const done = () => {
      const id = input.value.trim();
      if (id && id !== task.id) ctx.commitAndRender({ type: 'setTaskId', p, t, id });
      else view();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); done(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); view(); }
    });
    row.replaceChildren(h('label', { for: input.id }, 'New id'), input,
      h('button', { type: 'button', class: 'btn', onclick: done }, 'Rename'),
      h('button', { type: 'button', class: 'btn', onclick: view }, 'Cancel'),
      h('p', { class: 'sev', id: 'task-id-warning', role: 'alert' },
        "Renaming the id drops students' progress on this Task in Runs already started."));
    input.focus();
    input.select();
  }
  view();
  return row;
}
