// Fixture Reports for the Report Viewer, made by the Activity runner core itself
// (spec, Testing Decisions) so the fixtures always follow the real Report format.
import { createRunner } from '../../../framework/v1/runner/index.js';
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

/** A Report where the student missed then passed Task 1.1 and answered Task 1.2. */
export async function sampleReport(name = 'Ada Lovelace') {
  const tools = {
    p1: stubTool({ state: { x: { value: 0, unit: 'V' } }, displays: ['scope'] }),
    p2: stubTool({ state: { y: { value: 0 } } }),
  };
  const runner = createRunner(activity, { tools, clock: tickingClock() });
  runner.start(name);
  runner.submit('p1', 'set');
  tools.p1.setState({ x: 1 });
  runner.submit('p1', 'set');
  runner.submit('p1', 'why', { why: 'Because the phase lags.' });
  return runner.report();
}
