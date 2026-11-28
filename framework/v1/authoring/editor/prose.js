// A prose field: Task prompts, Hint texts, Question prompts and choice texts. Needs a DOM.
//
// proseField(ctx, { label, path, value, toEdit, rows? }) -> node
//   ctx is the TaskContext (task-form.js); path is the full data-path; toEdit(text) -> edit.
//   Each keystroke is an edit, one undo group per visit, and the text is stored exactly as typed.
//
// For now a plain labelled textarea. Ticket 13 replaces this module's body with the source box,
// the MathJax preview and the info hover; every prose field in the tabs comes through here.

import { h } from '../../ui-kit.js';

export function proseField(ctx, { label, path, value, toEdit, rows = '4' }) {
  return h('div', { class: 'prose-plain' }, ...ctx.field({ label, path, value, toEdit, textarea: true, rows, class: 't wide mono' }));
}
