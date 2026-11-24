// Activity runner core: pure logic, no DOM.
//
//   const runner = createRunner(activity, { tools: { [partId]: toolInstance } });
//   runner.start(name)            // name gate; begins the Run
//   runner.parts()                // Parts with each Task's status: open | locked | passed
//   runner.task(partId, taskId)   // status, misses, hint, attempts
//   runner.submit(partId, taskId, answers?) // judge State + Question answers; returns the Attempt
//   runner.score()                // points earned/possible per Task, Part and total (see scoring.js)
//   runner.save()                 // JSON-able Run: name, fingerprint, Attempts, per-Part Tool State
//   runner.restore(saved)         // resume a saved Run in a fresh runner; Attempts for Task ids
//                                 //   that no longer exist are dropped. Returns false if unusable.
//   await runner.report()         // the sealed Report so far (format: ../report.js)
//   await runner.snapshotsTaken() // resolves once passing Attempts carry their Display snapshots
//                                 //   (save() after this to persist them)
//
// Each Part has its own Tool instance (Tool contract: state.snapshot/describe/onChange,
// controls.get(id) with get/set/lock/unlock/show/hide, displays[].snapshot).
import { createConditionRegistry } from './conditions.js';
import { createFingerprint, sealReport, REPORT_FORMAT_VERSION, FRAMEWORK_VERSION } from '../report.js';
import { validateActivity } from './activity.js';
import { judgeTask, scoreActivity } from './scoring.js';
import { decodeActivity } from './keys.js';
import { isGraded } from './questions.js';

export { builtinConditionTypes, createConditionRegistry, evaluateCondition } from './conditions.js';
export { validateActivity } from './activity.js';
export { evaluateQuestions } from './questions.js';
export { judgeTask, scoreActivity } from './scoring.js';
export { encodeKey, decodeKey, decodeActivity, isEncodedKey } from './keys.js';

export function createRunner(definition, { tools = {}, clock = () => new Date(), conditionTypes } = {}) {
  const activity = decodeActivity(definition); // encoded keys stay inside the runner
  validateActivity(activity);
  for (const part of activity.parts) {
    if (!tools[part.id]) throw new Error(`Part "${part.id}" needs a Tool instance.`);
  }
  let run = null;
  const pendingSnapshots = new Set();
  const registry = createConditionRegistry(activity.conditionTypes, conditionTypes);

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

  // Apply a Task's Control exposure to its Part's Tool. Controls the Task
  // doesn't mention keep whatever exposure earlier Tasks gave them.
  function applyExposure(part, task) {
    const controls = tools[part.id].controls;
    const control = (id) => {
      const c = controls.get(id);
      if (!c) throw new Error(`Task "${task.id}" names unknown Control "${id}".`);
      return c;
    };
    for (const id of task.show ?? []) { const c = control(id); c.show(); c.unlock(); }
    for (const id of task.lock ?? []) { const c = control(id); c.show(); c.lock(); }
    for (const id of task.hide ?? []) control(id).hide();
  }

  function score() {
    const attempts = Object.fromEntries(activity.parts.map((part) => [
      part.id,
      Object.fromEntries(part.tasks.map((task) => [task.id, progress.get(part.id).get(task.id).attempts])),
    ]));
    return scoreActivity(activity, attempts, { conditionTypes });
  }

  // PNG data URLs of the Part's Displays, attached to the (passing) Attempt once taken.
  function captureSnapshots(part, attempt) {
    const displays = tools[part.id].displays ?? [];
    const pending = Promise.all(displays.map(async (d) => ({ display: d.id, png: await d.snapshot() })))
      .catch(() => [])
      .then((snapshots) => { attempt.snapshots = snapshots; pendingSnapshots.delete(pending); });
    pendingSnapshots.add(pending);
  }

  return {
    get run() { return run; },

    start(name) {
      if (run) throw new Error('This Run has already started; start over to change the name.');
      const trimmed = String(name ?? '').trim();
      if (!trimmed) throw new Error('A name is required to start the Run.');
      run = Object.freeze({ name: trimmed, fingerprint: createFingerprint(), startedAt: clock().toISOString() });
      for (const part of activity.parts) {
        const first = part.tasks.findIndex((_, i) => statusOf(part, i) === 'open');
        if (first !== -1) applyExposure(part, part.tasks[first]);
      }
      return run;
    },

    parts() {
      return activity.parts.map((part) => ({
        id: part.id,
        title: part.title,
        tasks: part.tasks.map((task, i) => ({ id: task.id, title: task.title, status: statusOf(part, i) })),
      }));
    },

    task(partId, taskId) {
      const part = findPart(partId);
      const task = findTask(part, taskId);
      const record = progress.get(part.id).get(task.id);
      return {
        id: task.id,
        title: task.title,
        status: statusOf(part, part.tasks.indexOf(task)),
        misses: missesOf(record),
        hint: hintFor(task, record),
        attempts: structuredClone(record.attempts),
      };
    },

    // Points earned and possible, recomputed from the recorded Attempts.
    score,

    // Resolves once every passing Attempt so far carries its Display snapshots.
    async snapshotsTaken() {
      await Promise.all(pendingSnapshots);
    },

    // The Report of the Run so far, sealed with its checksum. Waits for any
    // Display snapshots still being taken.
    async report() {
      requireRun();
      await Promise.all(pendingSnapshots);
      const downloadedAt = clock().toISOString();
      const scored = score();
      return sealReport({
        formatVersion: REPORT_FORMAT_VERSION,
        frameworkVersion: FRAMEWORK_VERSION,
        activity: { id: activity.id, version: activity.version, title: activity.title, course: activity.course ?? '' },
        student: { name: run.name },
        fingerprint: run.fingerprint,
        startedAt: run.startedAt,
        downloadedAt,
        earned: scored.earned,
        possible: scored.possible,
        parts: activity.parts.map((part, p) => ({
          id: part.id,
          title: part.title ?? '',
          earned: scored.parts[p].earned,
          possible: scored.parts[p].possible,
          tasks: part.tasks.map((task, t) => ({
            id: task.id,
            title: task.title ?? '',
            ...scored.parts[p].tasks[t],
            // Points as defined (never answer keys), so a reader can rescore from the Attempts.
            points: task.points ?? 0,
            questions: (task.questions ?? []).map((q) => ({ id: q.id, graded: isGraded(q), points: q.points ?? 0 })),
            attempts: structuredClone(progress.get(part.id).get(task.id).attempts),
          })),
        })),
      });
    },

    save() {
      return {
        activity: { id: activity.id, version: activity.version },
        run: run && { ...run },
        parts: Object.fromEntries(activity.parts.map((part) => [part.id, {
          state: tools[part.id].serialize?.() ?? null,
          attempts: Object.fromEntries(part.tasks.map((task) => [task.id,
            structuredClone(progress.get(part.id).get(task.id).attempts)])),
        }])),
      };
    },

    restore(saved) {
      if (run) throw new Error('This Run has already started.');
      const r = saved?.run;
      if (saved?.activity?.id !== activity.id || typeof r?.name !== 'string' || !r.name.trim()
        || typeof r.fingerprint !== 'string' || typeof r.startedAt !== 'string') return false;
      for (const part of activity.parts) {
        const savedPart = saved.parts?.[part.id];
        if (!savedPart) continue;
        if (savedPart.state != null) {
          try { tools[part.id].restore?.(savedPart.state); } catch { /* keep the Setup */ }
        }
        for (const task of part.tasks) {
          const attempts = savedPart.attempts?.[task.id];
          if (!Array.isArray(attempts)) continue;
          const record = progress.get(part.id).get(task.id);
          record.attempts = structuredClone(attempts);
          record.passed = attempts.some((a) => a?.passed);
        }
      }
      run = Object.freeze({ name: r.name, fingerprint: r.fingerprint, startedAt: r.startedAt });
      // Replay exposure in Task order up to the first Task not yet passed.
      for (const part of activity.parts) {
        for (const [i, task] of part.tasks.entries()) {
          applyExposure(part, task);
          if (statusOf(part, i) !== 'passed') break;
        }
      }
      return true;
    },

    submit(partId, taskId, answers = {}) {
      requireRun();
      const part = findPart(partId);
      const task = findTask(part, taskId);
      const status = statusOf(part, part.tasks.indexOf(task));
      if (status === 'passed') throw new Error(`Task "${taskId}" has already passed.`);
      if (status === 'locked') throw new Error(`Task "${taskId}" is locked until the previous Task passes.`);

      const tool = tools[part.id];
      const state = tool.state.snapshot();
      const { results, passed } = judgeTask(task, state, answers, { info: tool.state.describe(), registry });
      const attempt = {
        at: clock().toISOString(),
        state,
        answers: structuredClone(answers),
        results,
        passed,
      };
      const record = progress.get(part.id).get(task.id);
      record.attempts.push(attempt);
      if (attempt.passed) {
        record.passed = true;
        captureSnapshots(part, attempt);
        const next = part.tasks[part.tasks.indexOf(task) + 1];
        if (next) applyExposure(part, next);
      }
      return { ...structuredClone(attempt), hint: hintFor(task, record) };
    },
  };
}

const missesOf = (record) => record.attempts.filter((a) => !a.passed).length;

function hintFor(task, record) {
  if (!task.hint) return null;
  return missesOf(record) >= task.hint.after ? task.hint.text : null;
}
