// The Task form's Questions tab. A placeholder: it lists the Questions by id, kind and prompt.
// Ticket 12 replaces this module with the Question editor (its prompts and choice texts through
// prose.js). See task-form.js for the tab shape.

import { h } from '../../../ui-kit.js';

const questionsOf = (task) => (Array.isArray(task.questions) ? task.questions : []);

export const questionsTab = {
  id: 'questions',
  label: (ctx) => `Questions (${questionsOf(ctx.task).length})`,
  owns: (rest) => rest[0] === 'questions',
  render(ctx) {
    const { task, base } = ctx;
    const qs = questionsOf(task);
    return [ctx.section('Questions', `${qs.length}`,
      qs.length
        ? h('ul', { 'data-path': `${base}.questions` }, ...qs.map((q, i) => h('li', { 'data-path': `${base}.questions.${i}`, tabindex: '0' },
          h('code', {}, String(q.id ?? '')), ` (${q.kind}) `, h('span', { html: q.prompt ?? '' }))))
        : h('p', { class: 'muted', 'data-path': `${base}.questions` }, 'No Questions.'))];
  },
};
