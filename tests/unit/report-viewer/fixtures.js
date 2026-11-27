// Fixture Reports for the Report Viewer, made by the Activity runner core itself
// (spec, Testing Decisions) so the fixtures always follow the real Report format.
import { createRunner } from '../../../framework/v1/runner/index.js';
import { sealReport } from '../../../framework/v1/report.js';
import { stubTool } from '../runner/stub-tool.js';

export const activity = {
  id: 'demo', version: 2, title: 'Demo Lab', course: 'PHY 1000', tool: 'stub',
  parts: [
    { id: 'p1', title: 'Part 1: Set x', mode: 'main', setup: {}, tasks: [
      { id: 'set', title: 'Task 1.1', prompt: '', points: 2, condition: { state: 'x', target: 1, tol: 0.1 } },
      { id: 'why', title: 'Task 1.2', prompt: '', points: 1, questions: [
        { id: 'why', kind: 'text', prompt: 'Why?', points: 1 },
      ] },
    ] },
    { id: 'p2', title: 'Part 2: Set y', mode: 'main', setup: {}, tasks: [
      { id: 'y', title: 'Task 2.1', prompt: '', points: 4, condition: { state: 'y', target: 2, tol: 0.1 } },
    ] },
  ],
};

function tickingClock(start = '2026-11-24T15:00:00.000Z') {
  let t = Date.parse(start);
  return () => { const d = new Date(t); t += 60_000; return d; };
}

function demoRun(name, startedAt) {
  const tools = {
    p1: stubTool({ state: { x: { value: 0, unit: 'V' } }, displays: ['scope'] }),
    p2: stubTool({ state: { y: { value: 0 } } }),
  };
  const runner = createRunner(activity, { tools, clock: tickingClock(startedAt) });
  runner.start(name);
  return { runner, tools };
}

/** A Report where the student missed then passed Task 1.1 and answered Task 1.2.
 *  Runs started at the same time (the default) have identical Attempt times. */
export async function sampleReport(name = 'Ada Lovelace', { startedAt } = {}) {
  const { runner, tools } = demoRun(name, startedAt);
  runner.submit('p1', 'set');
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  runner.submit('p1', 'why', { why: 'Because the phase lags.' });
  return runner.report();
}

/** A partial Report where the student passed Task 1.1 on the first try, at x = 1. */
export async function firstTryReport(name, { startedAt } = {}) {
  const { runner, tools } = demoRun(name, startedAt);
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  return runner.report();
}

export const quizActivity = {
  id: 'quiz', version: 1, title: 'Quiz Lab', course: 'PHY 1000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 'ask', title: 'Ask', prompt: '', points: 1, questions: [
      { id: 'T', kind: 'numeric', prompt: '', answer: 3, tol: 0.05, points: 2 },
      { id: 'c', kind: 'choice', prompt: '', correct: 'b', points: 1,
        choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
      { id: 'why', kind: 'text', prompt: '', points: 1 },
    ] },
  ] }],
};

/** A Report where each graded Question was right in a different Attempt and the Task never passed. */
export async function quizReport(name = 'Grace Hopper') {
  const runner = createRunner(quizActivity, { tools: { p1: stubTool() }, clock: tickingClock() });
  runner.start(name);
  runner.submit('p1', 'ask', { T: 3, c: 'a', why: '  ' });
  runner.submit('p1', 'ask', { T: 9, c: 'b', why: 'because' });
  return runner.report();
}

/** quizReport as framework 1.0.0 wrote it: no expected values on its results. */
export async function legacyQuizReport(name = 'Grace Hopper') {
  const report = await quizReport(name);
  for (const part of report.parts) for (const task of part.tasks) for (const a of task.attempts) {
    for (const r of a.results) delete r.expected;
  }
  return sealReport({ ...report, frameworkVersion: '1.0.0' });
}

export const expressionActivity = {
  id: 'expr', version: 1, title: 'Expression Lab', course: 'PHY 1000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 'ask', title: 'Ask', prompt: '', points: 1, questions: [
      { id: 'I', kind: 'numeric', prompt: 'Current in mA?', answer: { expr: 'I * 1000' }, tol: 0.05, points: 1 },
    ] },
  ] }],
};

/** A Report whose expression key moved: missed at I = 4 mA, then passed at I = 2.5 mA. */
export async function expressionReport(name = 'Emmy Noether') {
  const tool = stubTool({ state: { I: { value: 0.004, unit: 'A' } } });
  const runner = createRunner(expressionActivity, { tools: { p1: tool }, clock: tickingClock() });
  runner.start(name);
  runner.submit('p1', 'ask', { I: 3 });
  tool.setState({ I: 0.0025 });
  runner.submit('p1', 'ask', { I: 2.5 });
  return runner.report();
}
