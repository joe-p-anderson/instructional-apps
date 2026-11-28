// The Task form (spec, "Editor page"; mockup variant B): a header, then one tab at a time out of
// TASK_TABS. Needs a DOM; page.js draws it.
//
// The extension point. TASK_TABS lists the tabs in order. Each one lives in its own module under
// tabs/ and is
//   { id, label(ctx) -> text, owns(rest) -> bool, render(ctx) -> [nodes] }
// where rest is a problem's path below its Task (['questions', 1, 'answer'] for
// ['parts', 0, 'tasks', 2, 'questions', 1, 'answer']). A problem belongs to the first tab that
// owns its rest, or to the first tab (Prompt) when none does; each tab shows how many it holds,
// and jumping to a problem opens its tab first. To fill a tab, replace its module's export; to
// claim more paths, change its owns. No tab reads another's code.
//
// render gets the TaskContext page.js builds (taskContext there):
//   editor, doc, p, t, part, task       the open Activity's editor and the selected Task, now
//   base                                'parts.<p>.tasks.<t>', the prefix of every data-path
//   tool                                { tool, conditionTypes, info } once loaded, else null
//   toolError                           why the Tool couldn't load, or null
//   mode                                Tool info for the Part's Mode, or null (unknown, loading)
//   problems                            this tab's problems ({ path, message, source })
//   commit(edit, { group }?)            apply an edit; redraws all but the form
//   commitAndRender(edit)               apply an edit and redraw the form too
//   field({ label, path, value, toEdit, textarea?, ...attrs }) -> [label, input]
//                                       a text field bound to one value (one undo group per visit);
//                                       path is the full data-path, so problems jump to it
//   section(title, sub, ...body)        a form section (.sec)
//   onLive(fn)                          run fn after every live Tool mount and State change
//   liveInstance()                      the live Tool instance at this Part, or null
//   exposure()                          effectiveExposure at this Task (exposure.js), with Tool info
//   rerender()                          redraw the form (after a view-only change in the tab)
//   setHeading(html)                    retitle the form's heading while the title is typed
// Prose (prompts, Hint texts, Question prompts, choice texts) goes through proseField in
// prose.js, imported by each tab, so ticket 13 changes every prose field in one place.

import { h } from '../../ui-kit.js';
import { promptTab } from './tabs/prompt.js';
import { exposureTab } from './tabs/exposure.js';
import { conditionTab } from './tabs/condition.js';
import { questionsTab } from './tabs/questions.js';
import { hintTab } from './tabs/hint.js';

export const TASK_TABS = [promptTab, exposureTab, conditionTab, questionsTab, hintTab];

// The id of the tab holding the field at a problem path; null when the path isn't in a Task.
export function tabOf(path) {
  if (path[0] !== 'parts' || path[2] !== 'tasks' || typeof path[3] !== 'number') return null;
  const rest = path.slice(4);
  return (TASK_TABS.find((tab) => tab.owns(rest)) ?? TASK_TABS[0]).id;
}

// The form's nodes. ctx is the TaskContext without problems (all the Task's problems are given
// apart); open is the open tab's id; choose(id) opens another tab.
export function taskForm(ctx, { problems, open, choose, head }) {
  const tab = TASK_TABS.find((x) => x.id === open) ?? TASK_TABS[0];
  const mine = (id) => problems.filter((pr) => tabOf(pr.path) === id);
  const bar = h('div', { class: 'ftabs', role: 'tablist', 'aria-label': 'Task sections' }, ...TASK_TABS.map((x) => {
    const n = mine(x.id).length;
    return h('button', { type: 'button', role: 'tab', class: 'fw-tab', id: `task-tab-${x.id}`, 'aria-selected': String(x === tab),
      'aria-controls': 'task-tabpanel', tabindex: x === tab ? '0' : '-1', 'data-tab': x.id, onclick: () => choose(x.id) },
    x.label(ctx), countBadge(n));
  }));
  bar.addEventListener('keydown', (e) => {
    const i = TASK_TABS.indexOf(tab);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    choose(TASK_TABS[(i + step + TASK_TABS.length) % TASK_TABS.length].id, { focusTab: true });
  });
  const panel = h('div', { role: 'tabpanel', id: 'task-tabpanel', 'aria-labelledby': `task-tab-${tab.id}` },
    ...tab.render({ ...ctx, problems: mine(tab.id) }));
  return [...head, bar, panel];
}

const countBadge = (n) => (n ? h('span', { class: 'ftab-count', 'aria-label': `${n} problem${n === 1 ? '' : 's'}` }, String(n)) : null);

// Bring the tab bar's problem counts in form up to date with problems (the Task's), without
// redrawing the tab being typed in.
export function refreshTabCounts(form, problems) {
  for (const button of form.querySelectorAll('[role="tab"][data-tab]')) {
    const n = problems.filter((pr) => tabOf(pr.path) === button.dataset.tab).length;
    button.querySelector('.ftab-count')?.remove();
    const badge = countBadge(n);
    if (badge) button.append(badge);
  }
}
