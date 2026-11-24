// Activity runner UI (framework v1): the thin DOM layer over the runner core (runner/).
//
// mountActivity(tool, activity, root, { conditionTypes, storage })
//   Mounts one Tool instance per Part (its Mode and Setup) under Part tabs, adds a Task card
//   row and a progress indicator to each Part, and shows a name gate before Part 1.
//   The Run autosaves to `storage` (default localStorage; null disables it), keyed by Activity
//   id, and a saved Run is restored on load in place of the name gate. "Start over" (confirmed)
//   discards the saved Run and reloads the page for a new one.
//   All judging, ordering and Control exposure come from the core; this layer only renders
//   what runner.parts()/runner.task() report and forwards Start and Submit.
//   Returns { runner, instances: { [partId]: ToolInstance }, select(partId), render(), activePart }.
//
// Prompts, titles, Question prompts and Hints are trusted HTML from the Activity author and may
// contain \( \) math, typeset with MathJax.

import { createStore, runKey } from './persistence.js';
import { createRunner } from './runner/index.js';
import { createFrame, createTabs } from './tool-host.js';
import { defineTool } from './tool.js';
import { h } from './ui-kit.js';
import { typeset } from './vendor.js';

export function mountActivity(tool, activity, root, { conditionTypes, storage = browserStorage() } = {}) {
  defineTool(tool);
  if (activity.tool !== tool.id) throw new Error(`Activity "${activity.id}" is for Tool "${activity.tool}", not "${tool.id}".`);
  if (!document.title) document.title = activity.title;

  const frame = createFrame(root, { title: activity.title, subtitle: activity.course });
  const host = { runner: null, instances: {}, activePart: null, select: null, render };

  const tabs = createTabs(frame, activity.parts, (id) => {
    host.activePart = id;
    host.instances[id]?.resize?.();
  });

  const views = {}; // partId -> { progress, cards: { taskId: card } }
  activity.parts.forEach((part, p) => {
    const panel = tabs.panels[part.id];
    host.instances[part.id] = tool.mount(panel, part.mode, part.setup);
    views[part.id] = partView(part, p);
    panel.append(views[part.id].el);
  });

  host.runner = createRunner(activity, { tools: host.instances, conditionTypes });
  host.select = tabs.select;

  // ── Autosave: the whole Run after every Start, Submit and Tool State change ──
  const store = createStore(runKey(activity.id), storage);
  const autosave = () => { if (host.runner.run) store.save(host.runner.save()); };
  let restored = false;
  try { restored = host.runner.restore(store.load()); } catch { /* unusable save: new Run */ }
  for (const instance of Object.values(host.instances)) instance.state.onChange(autosave);

  // ── Name gate: the Part tabs stay hidden until a name starts the Run ──
  const student = h('div', { class: 'fw-student', hidden: true });
  const startOver = h('button', { type: 'button', class: 'fw-button fw-start-over', hidden: true }, 'Start over');
  startOver.addEventListener('click', () => {
    if (!confirm('Start over? This discards your progress and begins a new Run; you will enter your name again.')) return;
    store.clear();
    location.reload();
  });
  frame.header.append(student, startOver);
  frame.tablist.hidden = true;
  frame.panels.hidden = true;

  const nameInput = h('input', { type: 'text', id: 'fw-name', class: 'fw-name-input', autocomplete: 'name', required: true });
  const gateError = h('div', { class: 'fw-gate-error', role: 'alert' });
  const gate = h('form', { class: 'fw-gate', 'aria-label': 'Start the Activity' },
    h('h2', { class: 'fw-gate-title' }, activity.title),
    activity.course ? h('div', { class: 'fw-subtitle' }, activity.course) : null,
    h('label', { class: 'fw-gate-label', for: 'fw-name' }, 'Your name'),
    h('div', { class: 'fw-gate-row' }, nameInput, h('button', { type: 'submit', class: 'fw-button' }, 'Start')),
    h('p', { class: 'fw-hint' }, 'Your name goes on your Report and stays fixed for this Run.'),
    gateError);
  gate.noValidate = true;
  gate.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      host.runner.start(nameInput.value);
    } catch (err) {
      gateError.textContent = err.message;
      nameInput.focus();
      return;
    }
    autosave();
    enterRun();
  });
  if (restored) {
    enterRun();
  } else {
    frame.app.insertBefore(gate, frame.tablist);
    nameInput.focus();
  }

  typeset([frame.app]);
  return host;

  // Leave the name gate and show the Run's Parts.
  function enterRun() {
    gate.remove();
    student.textContent = host.runner.run.name;
    student.hidden = false;
    startOver.hidden = false;
    frame.tablist.hidden = false;
    frame.panels.hidden = false;
    render();
    tabs.select(activity.parts[0].id);
  }

  // ── Task cards and progress for one Part ──
  function partView(part, p) {
    const progressBar = h('progress', { class: 'fw-progress-bar', max: part.tasks.length, value: 0,
      'aria-label': `${stripTags(part.title)} progress` });
    const progressText = h('span', { class: 'fw-progress-text' });
    const cards = {};
    const row = h('div', { class: 'fw-tasks' });
    part.tasks.forEach((task, t) => {
      cards[task.id] = taskCard(part, task, `Task ${p + 1}.${t + 1}`);
      row.append(cards[task.id].el);
    });
    const el = h('div', { class: 'fw-part-tasks' },
      h('div', { class: 'fw-progress' }, progressBar, progressText),
      row);
    return { el, cards, progressBar, progressText };
  }

  function taskCard(part, task, number) {
    const answers = []; // [{ id, read(), inputs }]
    const questions = (task.questions ?? []).map((q, i) => {
      const promptId = `fw-q-${part.id}-${task.id}-${q.id}`;
      const prompt = h('div', { class: 'fw-question-prompt', id: promptId, html: q.prompt ?? '' });
      let field;
      let read;
      if (q.kind === 'text') {
        field = h('textarea', { class: 'fw-question-input', rows: 3, 'aria-labelledby': promptId,
          placeholder: 'Write your answer here…' });
        read = () => field.value;
      } else if (q.kind === 'numeric') {
        field = h('input', { type: 'text', inputmode: 'decimal', class: 'fw-question-input fw-question-number',
          'aria-labelledby': promptId });
        read = () => field.value;
      } else {
        const name = `${promptId}-choice`;
        field = h('div', { role: 'radiogroup', 'aria-labelledby': promptId, class: 'fw-question-choices' },
          q.choices.map((c) => h('label', { class: 'fw-choice' },
            h('input', { type: 'radio', name, value: c.id }), h('span', { html: c.text }))));
        read = () => field.querySelector('input:checked')?.value;
      }
      answers.push({ id: q.id, read, field });
      return h('div', { class: 'fw-question', 'data-question': i }, prompt, field);
    });

    const check = h('span', { class: 'fw-task-check', 'aria-hidden': 'true' });
    const submit = h('button', { type: 'button', class: 'fw-button', 'aria-label': `Submit ${number}` }, 'Submit');
    const feedback = h('span', { class: 'fw-task-feedback', role: 'status', 'aria-label': `${number} feedback` });
    const hint = h('div', { class: 'fw-task-hint', hidden: true });
    const el = h('section', { class: 'fw-task-card', 'aria-label': number, 'data-task': task.id },
      h('div', { class: 'fw-task-heading' }, check,
        h('h3', { class: 'fw-task-title', html: `${number} — ${task.title ?? ''}` })),
      task.prompt ? h('div', { class: 'fw-task-prompt', html: task.prompt }) : null,
      ...questions,
      h('div', { class: 'fw-task-submit' }, submit, feedback),
      hint);

    submit.addEventListener('click', () => {
      const given = Object.fromEntries(answers.map((a) => [a.id, a.read()]).filter(([, v]) => v !== undefined));
      const attempt = host.runner.submit(part.id, task.id, given);
      autosave();
      feedback.className = `fw-task-feedback ${attempt.passed ? 'fw-ok' : 'fw-fail'}`;
      feedback.textContent = attempt.passed
        ? '✓ Correct!'
        : `✗ ${attempt.results.filter((r) => r.pass === false).map((r) => r.feedback).join('; ')}`;
      render();
    });

    function update() {
      const state = host.runner.task(part.id, task.id);
      el.dataset.status = state.status;
      const done = state.status === 'passed';
      const operable = state.status === 'open';
      check.textContent = done ? '✓' : '';
      submit.hidden = done;
      submit.disabled = !operable;
      for (const a of answers) {
        for (const input of [a.field, ...a.field.querySelectorAll('input')]) input.disabled = !operable;
      }
      if (done && !feedback.textContent) {
        feedback.className = 'fw-task-feedback fw-ok';
        feedback.textContent = '✓ Done';
      }
      if (state.hint && hint.hidden) {
        hint.innerHTML = `<strong>Hint:</strong> ${state.hint}`;
        hint.hidden = false;
        typeset([hint]);
      }
    }

    return { el, update };
  }

  // Re-read every Part's progress from the core.
  function render() {
    for (const part of host.runner.parts()) {
      const view = views[part.id];
      const passed = part.tasks.filter((t) => t.status === 'passed').length;
      view.progressBar.value = passed;
      view.progressText.textContent = `${passed} of ${part.tasks.length} Tasks done`;
      for (const t of part.tasks) view.cards[t.id].update();
    }
  }
}

function stripTags(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent;
}

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
