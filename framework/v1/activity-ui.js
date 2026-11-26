// Activity runner UI (framework v1): the thin DOM layer over the runner core (runner/).
//
// mountActivity(tool, activity, root, { conditionTypes, storage })
//   Mounts one Tool instance per Part (its Mode and Setup) under Part tabs, adds the Part's
//   Task cards and a progress indicator to each Part and a progress badge ("1/3") to each Part
//   tab, and shows a name gate before Part 1. The Tool's panel layout (tool.js) places them.
//   The Run autosaves to `storage` (default localStorage; null disables it), keyed by Activity
//   id, and a saved Run is restored on load in place of the name gate.
//   The header shows the Activity's title and course, the Part tabs, then the actions: the
//   student's name, Download Report and the ⋯ menu, which holds Start over (confirmed; discards
//   the saved Run and reloads the page for a new one) and Print.
//   All judging, ordering and Control exposure come from the core; this layer only renders
//   what runner.parts()/runner.task() report and forwards Start and Submit.
//   Once the Run starts, a Download Report button saves runner.report() as a JSON file.
//   Returns { runner, instances: { [partId]: ToolInstance }, select(partId), render(), activePart }.
//
// Prompts, titles, Question prompts and Hints are trusted HTML from the Activity author and may
// contain \( \) math, typeset with MathJax.

import { browserStorage, runStore } from './persistence.js';
import { createRunner } from './runner/index.js';
import { reportFilename } from './report.js';
import { createFrame, createTabs, printItem } from './tool-host.js';
import { defineTool } from './tool.js';
import { h } from './ui-kit.js';
import { typeset } from './vendor.js';

export function mountActivity(definition, activity, root, { conditionTypes, storage = browserStorage() } = {}) {
  const tool = defineTool(definition);
  if (activity.tool !== tool.id) throw new Error(`Activity "${activity.id}" is for Tool "${activity.tool}", not "${tool.id}".`);
  if (!document.title) document.title = activity.title;

  const frame = createFrame(root, { title: activity.title, course: activity.course, layout: tool.layout });
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
    tabs.buttons[part.id].append(views[part.id].badgeText, views[part.id].badge);
  });

  host.runner = createRunner(activity, { tools: host.instances, conditionTypes });
  host.select = tabs.select;

  // ── Autosave: the whole Run after every Start, Submit and Tool State change ──
  const store = runStore(activity.id, storage);
  const autosave = () => { if (host.runner.run) store.save(host.runner.save()); };
  let restored = false;
  try { restored = host.runner.restore(store.load()); } catch { /* unusable save: new Run */ }
  for (const instance of Object.values(host.instances)) instance.state.onChange(autosave);

  // ── Name gate: the Part tabs stay hidden until a name starts the Run ──
  const student = h('div', { class: 'fw-student', hidden: true });
  const download = reportButton(host);
  frame.addAction(student);
  frame.addAction(download);
  const startOver = frame.menu.add({ id: 'start-over', label: 'Start over', onSelect: () => {
    if (!confirm('Start over? This discards your progress and begins a new Run; you will enter your name again.')) return;
    store.clear();
    location.reload();
  } });
  startOver.hidden = true;
  frame.menu.add(printItem());
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
    for (const view of Object.values(views)) for (const card of Object.values(view.cards)) card.restore();
    enterRun();
  } else {
    frame.app.insertBefore(gate, frame.panels);
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
    download.hidden = false;
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
    // The badge shows "1/3"; screen readers get " (1 of 3 Tasks done)" in the tab's name instead.
    const badgeText = h('span', { class: 'fw-sr-only' });
    const badge = h('span', { class: 'fw-tab-badge', 'aria-hidden': 'true' });
    const cards = {};
    const row = h('div', { class: 'fw-tasks' });
    part.tasks.forEach((task, t) => {
      cards[task.id] = taskCard(part, task, taskNumber(p, t), t > 0 ? taskNumber(p, t - 1) : null);
      row.append(cards[task.id].el);
    });
    const el = h('div', { class: 'fw-part-tasks' },
      h('div', { class: 'fw-progress' }, progressBar, progressText),
      row);
    return { el, cards, progressBar, progressText, badge, badgeText };
  }

  // previous: the number of the Task before this one, which unlocks it; null for a Part's first
  // Task, which is never locked.
  function taskCard(part, task, number, previous) {
    const answers = []; // [{ id, read(), write(value), field }]
    const questions = (task.questions ?? []).map((q, i) => {
      const promptId = `fw-q-${part.id}-${task.id}-${q.id}`;
      const prompt = h('div', { class: 'fw-question-prompt', id: promptId, html: q.prompt ?? '' });
      const input = questionInputs[q.kind](q, promptId);
      answers.push({ id: q.id, ...input });
      return h('div', { class: 'fw-question', 'data-question': i }, prompt, input.field);
    });
    const given = () => Object.fromEntries(answers.map((a) => [a.id, a.read()]).filter(([, v]) => v !== undefined));

    const check = h('span', { class: 'fw-task-check', 'aria-hidden': 'true' });
    const lockedNote = previous ? h('span', { class: 'fw-task-locked', hidden: true }, `Locked until ${previous} is done`) : null;
    const submit = h('button', { type: 'button', class: 'fw-button', 'aria-label': `Submit ${number}` }, 'Submit');
    const feedback = h('span', { class: 'fw-task-feedback', role: 'status', 'aria-label': `${number} feedback` });
    const hint = h('div', { class: 'fw-task-hint', hidden: true });
    const el = h('section', { class: 'fw-task-card', 'aria-label': number, 'data-task': task.id },
      h('div', { class: 'fw-task-heading' }, check,
        h('h3', { class: 'fw-task-title', html: `${number} — ${task.title ?? ''}` }), lockedNote),
      task.prompt ? h('div', { class: 'fw-task-prompt', html: task.prompt }) : null,
      ...questions,
      h('div', { class: 'fw-task-submit' }, submit, feedback),
      hint);

    // Typed answers are kept as a draft with the Run, so a reload doesn't lose them.
    el.addEventListener('input', () => {
      if (host.runner.task(part.id, task.id).status !== 'open') return;
      host.runner.draft(part.id, task.id, given());
      autosave();
    });

    submit.addEventListener('click', () => {
      const attempt = host.runner.submit(part.id, task.id, given());
      autosave();
      if (attempt.passed) host.runner.snapshotsTaken().then(autosave); // persist the snapshots too
      showFeedback(attempt, '✓ Correct!');
      render();
    });

    function showFeedback(attempt, passText) {
      feedback.className = `fw-task-feedback ${attempt.passed ? 'fw-ok' : 'fw-fail'}`;
      feedback.textContent = attempt.passed
        ? passText
        : `✗ ${attempt.results.filter((r) => r.pass === false).map((r) => r.feedback).join('; ')}`;
    }

    // After a reload: the Task's answers (passing, draft or last missed) and its last miss feedback.
    function restore() {
      const state = host.runner.task(part.id, task.id);
      for (const a of answers) if (state.answers[a.id] !== undefined) a.write(state.answers[a.id]);
      const last = state.attempts.at(-1);
      if (last && !last.passed && state.status !== 'passed') showFeedback(last);
    }

    function update() {
      const state = host.runner.task(part.id, task.id);
      el.dataset.status = state.status;
      const done = state.status === 'passed';
      const operable = state.status === 'open';
      check.textContent = done ? '✓' : '';
      if (lockedNote) lockedNote.hidden = state.status !== 'locked';
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

    return { el, update, restore };
  }

  // Re-read every Part's progress from the core.
  function render() {
    for (const part of host.runner.parts()) {
      const view = views[part.id];
      const passed = part.tasks.filter((t) => t.status === 'passed').length;
      view.progressBar.value = passed;
      view.progressText.textContent = `${passed} of ${part.tasks.length} Tasks done`;
      view.badgeText.textContent = ` (${view.progressText.textContent})`;
      view.badge.textContent = `${passed}/${part.tasks.length}`;
      view.badge.dataset.done = String(passed === part.tasks.length);
      for (const t of part.tasks) view.cards[t.id].update();
    }
  }
}

// How each Question kind (runner/questions.js) is answered on the page: its field and how
// to read an answer from it or write a saved one back.
const questionInputs = {
  text(q, promptId) {
    const field = h('textarea', { class: 'fw-question-input', rows: 3, 'aria-labelledby': promptId,
      placeholder: 'Write your answer here…' });
    return { field, read: () => field.value, write: (v) => { field.value = String(v); } };
  },
  numeric(q, promptId) {
    const field = h('input', { type: 'text', inputmode: 'decimal', class: 'fw-question-input fw-question-number',
      'aria-labelledby': promptId });
    return { field, read: () => field.value, write: (v) => { field.value = String(v); } };
  },
  choice(q, promptId) {
    const name = `${promptId}-choice`;
    const field = h('div', { role: 'radiogroup', 'aria-labelledby': promptId, class: 'fw-question-choices' },
      q.choices.map((c) => h('label', { class: 'fw-choice' },
        h('input', { type: 'radio', name, value: c.id }), h('span', { html: c.text }))));
    const radios = () => [...field.querySelectorAll('input')];
    return {
      field,
      read: () => radios().find((r) => r.checked)?.value,
      write: (v) => { for (const r of radios()) r.checked = r.value === v; },
    };
  },
};

// Download the Run's Report so far (allowed at any time after the Run starts).
function reportButton(host) {
  const button = h('button', { type: 'button', class: 'fw-button fw-download', hidden: true }, 'Download Report');
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const report = await host.runner.report();
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const link = h('a', { href: url, download: reportFilename(report), hidden: true });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

/** "Task 1.2": the Task's number as the page shows it, from 0-based Part and Task indexes. */
function taskNumber(partIndex, taskIndex) {
  return `Task ${partIndex + 1}.${taskIndex + 1}`;
}

function stripTags(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent;
}