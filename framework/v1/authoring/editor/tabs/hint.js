// The Task form's Hint & notes tab: the Hint (its text, and the failed-Attempt count it appears
// after), added or removed, and the Task's notes. The Hint text goes through prose.js, which
// ticket 13 gives its preview. See task-form.js for the tab shape.

import { h } from '../../../ui-kit.js';
import { proseField } from '../prose.js';

export const hintTab = {
  id: 'hint',
  label: () => 'Hint & notes',
  owns: (rest) => rest[0] === 'hint' || rest[0] === 'notes',
  render(ctx) {
    const { p, t, task, base } = ctx;
    const hint = task.hint && typeof task.hint === 'object' ? task.hint : null;
    const hintSection = hint
      ? ctx.section('Hint', 'stored encoded',
        h('div', { class: 'row' }, ...afterField(ctx, hint), h('span', {}, 'failed Attempts'), h('span', { style: 'flex:1' }),
          h('button', { type: 'button', class: 'lnk danger', onclick: () => ctx.commitAndRender({ type: 'setHint', p, t, hint: undefined }) }, 'Remove Hint')),
        proseField(ctx, { label: 'Hint text', path: `${base}.hint.text`, value: hint.text,
          toEdit: (v) => ({ type: 'setHintField', p, t, field: 'text', value: v }) }))
      : ctx.section('Hint', null, h('div', { 'data-path': `${base}.hint` },
        h('button', { type: 'button', class: 'lnk', onclick: () => {
          ctx.commitAndRender({ type: 'setHint', p, t, hint: { after: 3, text: '' } });
        } }, '+ Add a Hint')));
    return [hintSection,
      ctx.section('Notes', 'not shown to students; stored unencoded',
        ...ctx.field({ label: 'Notes', path: `${base}.notes`, value: task.notes, textarea: true, rows: '4',
          placeholder: 'Design notes for yourself. The runner ignores them.',
          toEdit: (v) => ({ type: 'setTaskField', p, t, field: 'notes', value: v }) }))];
  },
};

// "Appears after [n]": a number; anything else is kept as typed so the runner's validation lists it.
function afterField(ctx, hint) {
  const { p, t, base } = ctx;
  return ctx.field({ label: 'Appears after', path: `${base}.hint.after`, value: String(hint.after ?? ''), class: 't num', inputmode: 'numeric',
    toEdit: (v) => ({ type: 'setHintField', p, t, field: 'after', value: v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v }) });
}
