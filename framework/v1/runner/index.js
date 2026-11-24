// Activity runner core: pure logic, no DOM.
import { evaluateCondition } from './conditions.js';

export function createRunner(activity, { tools = {}, clock = () => new Date() } = {}) {
  let run = null;

  // Per-Task progress, keyed by Part id then Task id.
  const progress = new Map(
    activity.parts.map((part) => [
      part.id,
      new Map(part.tasks.map((task) => [task.id, { passed: false, attempts: [] }])),
    ]),
  );

  function requireRun() {
    if (!run) throw new Error('Enter a name to start the Run first.');
  }

  function findPart(partId) {
    const part = activity.parts.find((p) => p.id === partId);
    if (!part) throw new Error(`Unknown Part "${partId}".`);
    return part;
  }

  function findTask(part, taskId) {
    const task = part.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Unknown Task "${taskId}" in Part "${part.id}".`);
    return task;
  }

  function statusOf(part, index) {
    const record = progress.get(part.id).get(part.tasks[index].id);
    if (record.passed) return 'passed';
    const previous = index === 0 ? null : progress.get(part.id).get(part.tasks[index - 1].id);
    return !previous || previous.passed ? 'open' : 'locked';
  }

  return {
    get run() { return run; },

    start(name) {
      if (run) throw new Error('This Run has already started; start over to change the name.');
      const trimmed = String(name ?? '').trim();
      if (!trimmed) throw new Error('A name is required to start the Run.');
      run = Object.freeze({ name: trimmed, fingerprint: randomFingerprint(), startedAt: clock().toISOString() });
      return run;
    },

    parts() {
      return activity.parts.map((part) => ({
        id: part.id,
        title: part.title,
        tasks: part.tasks.map((task, i) => ({ id: task.id, title: task.title, status: statusOf(part, i) })),
      }));
    },

    submit(partId, taskId) {
      requireRun();
      const part = findPart(partId);
      const task = findTask(part, taskId);
      const status = statusOf(part, part.tasks.indexOf(task));
      if (status === 'passed') throw new Error(`Task "${taskId}" has already passed.`);
      if (status === 'locked') throw new Error(`Task "${taskId}" is locked until the previous Task passes.`);

      const tool = tools[part.id];
      const state = tool.state.snapshot();
      const results = task.condition ? evaluateCondition(task.condition, state) : [];
      const attempt = {
        at: clock().toISOString(),
        state,
        results,
        passed: results.every((r) => r.pass),
      };
      const record = progress.get(part.id).get(task.id);
      record.attempts.push(attempt);
      if (attempt.passed) record.passed = true;
      return attempt;
    },
  };
}

function randomFingerprint() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
