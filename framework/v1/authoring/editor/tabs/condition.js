// The Task form's Condition tab. A placeholder: it shows the Condition as JSON, read-only.
// Ticket 11 replaces this module with the Condition builder. See task-form.js for the tab shape.

import { h } from '../../../ui-kit.js';

export const conditionTab = {
  id: 'condition',
  label: () => 'Condition',
  owns: (rest) => rest[0] === 'condition',
  render(ctx) {
    const { task, base } = ctx;
    return [ctx.section('Condition', 'what the live Tool must show to pass',
      task.condition === undefined
        ? h('p', { class: 'muted', 'data-path': `${base}.condition` }, 'No Condition: the Questions alone decide the Task.')
        : h('pre', { class: 'mono', 'data-path': `${base}.condition`, tabindex: '0' }, JSON.stringify(task.condition, null, 2)))];
  },
};
