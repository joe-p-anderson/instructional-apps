// Ticket 07 (Spec 0003): the spacetime Condition types, judged by the runner against State
// snapshots built from real diagrams (the saved diagram format, as the Tool's State carries it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, encodeKey } from '../../../framework/v1/runner/index.js';
import { conditionTypes } from '../../../tools/spacetime/spacetime.js';
import { diagramState } from '../../../tools/spacetime/conditions.js';
import { stubTool } from '../runner/stub-tool.js';

const ev = (id, x, t, home = 'K') => ({ id, kind: 'event', home, x, t, label: '', color: '#D55E00' });
const chain = (id, ids, extend = false) => ({ id, kind: 'wl', mode: 'chain', ids, extend, label: '', color: '#0072B2' });
const param = (id, u, x0, frame = 'K') => ({ id, kind: 'wl', mode: 'param', frame, u, x0, label: '', color: '#0072B2' });
const rod = (id, frame, T, x1, x2, wl1 = null, wl2 = null) =>
  ({ id, kind: 'rod', frame, T, ends: [{ x: x1, wl: wl1 }, { x: x2, wl: wl2 }], label: '', color: '#009E73' });

/** The spacetime State for a diagram with K′ at velocity v. */
const stateOf = (v, objs) => ({
  v: { value: v, label: 'v', unit: 'c' },
  diagram: { value: diagramState({ v, objs }), label: 'Diagram' },
});

/** Judge a Condition through the runner, with the Tool's Condition types registered by the host. */
function judge(condition, v, objs) {
  const tool = stubTool({ state: stateOf(v, objs) });
  const activity = {
    id: 'st', version: 1, title: 'ST', course: 'X', tool: 'spacetime',
    parts: [{ id: 'p', title: 'P', mode: 'diagram', setup: {}, tasks: [
      { id: 't', title: 't', prompt: '', points: 1, condition },
    ] }],
  };
  const r = createRunner(activity, { tools: { p: tool }, conditionTypes });
  r.start('Ada');
  return r.submit('p', 't');
}

test('st-event passes for an event within tol of (x, t)', () => {
  const attempt = judge({ type: 'st-event', x: 3, t: 5, tol: 0.1 }, 0, [ev(1, 0, 0), ev(2, 3.05, 4.95)]);
  assert.equal(attempt.passed, true);
  // The Attempt records what was drawn.
  assert.deepEqual(JSON.parse(attempt.state.diagram).map((o) => [o.kind, o.x, o.t]), [['event', 0, 0], ['event', 3.05, 4.95]]);
});

test('st-event misses and names the nearest event', () => {
  const attempt = judge({ type: 'st-event', x: 3, t: 5, tol: 0.1 }, 0, [ev(1, 0, 0), ev(2, 2.9, 4.6)]);
  assert.equal(attempt.passed, false);
  assert.equal(attempt.results[0].feedback, 'nearest event is at (2.9, 4.6); need (3, 5) ± 0.1');
});

test('st-event reads an event placed in K′ at its K coordinates', () => {
  // At v = 0.6 the K′ event (0, 4) is the K event (3, 5).
  assert.equal(judge({ type: 'st-event', x: 3, t: 5, tol: 0.01 }, 0.6, [ev(1, 0, 4, 'Kp')]).passed, true);
  assert.equal(judge({ type: 'st-event', x: 0, t: 4, tol: 0.01 }, 0.6, [ev(1, 0, 4, 'Kp')]).passed, false);
});

test('st-event on a diagram with no events says so', () => {
  const attempt = judge({ type: 'st-event', x: 3, t: 5, tol: 0.1 }, 0, [param(1, 0.5, 0)]);
  assert.equal(attempt.results[0].feedback, 'no event found; need (3, 5) ± 0.1');
});

test('st-worldline passes for a parametric worldline of velocity u through (x, t), in either frame', () => {
  // x = 0.6 t passes (3, 5) in K. At v = 0.6, the K′ worldline x′ = 0 is the same line.
  assert.equal(judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 3, t: 5, tol: 0.1 }, 0, [param(1, 0.6, 0)]).passed, true);
  assert.equal(judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 3, t: 5, tol: 0.1 }, 0.6, [param(1, 0, 0, 'Kp')]).passed, true);
});

test('st-worldline misses when no worldline has the velocity', () => {
  const attempt = judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 3, t: 5, tol: 0.1 }, 0, [param(1, 0.5, 0)]);
  assert.equal(attempt.passed, false);
  assert.equal(attempt.results[0].feedback, 'no worldline with u = 0.60 found');
});

test('st-worldline misses when the right velocity passes too far from the point', () => {
  // x = 0.6 t + 0.5 is 0.5 / √1.36 ≈ 0.43 from (3, 5).
  const attempt = judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 3, t: 5, tol: 0.1 }, 0, [param(1, 0.6, 0.5)]);
  assert.equal(attempt.passed, false);
  assert.equal(attempt.results[0].feedback, 'nearest worldline with u = 0.60 passes 0.43 from (3, 5); need within 0.1');
});

// A twin trip: out at u = 0.6 from (0, 0) to (3, 5), back at u = −0.6 to (0, 10).
const trip = [ev(1, 0, 0), ev(2, 3, 5), ev(3, 0, 10), chain(4, [1, 2, 3])];

test('st-worldline judges a joined chain segment by segment', () => {
  const out = { type: 'st-worldline', u: 0.6, uTol: 0.01, x: 1.5, t: 2.5, tol: 0.1 };
  const back = { type: 'st-worldline', u: -0.6, uTol: 0.01, x: 1.5, t: 7.5, tol: 0.1 };
  assert.equal(judge(out, 0, trip).passed, true);
  assert.equal(judge(back, 0, trip).passed, true);
});

test('st-worldline on a chain needs the matching segment to contain the point', () => {
  // (4.5, 7.5) is on the outbound line x = 0.6 t, but past the turnaround; the return leg,
  // which does pass near t = 7.5, has the wrong velocity.
  const attempt = judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 4.5, t: 7.5, tol: 0.1 }, 0, trip);
  assert.equal(attempt.passed, false);
  assert.equal(attempt.results[0].feedback, 'nearest worldline with u = 0.60 passes 2.92 from (4.5, 7.5); need within 0.1');
  // The return leg matches at a point it contains.
  assert.equal(judge({ type: 'st-worldline', u: -0.6, uTol: 0.01, x: 1.5, t: 7.5, tol: 0.1 }, 0, trip).passed, true);
});

test('st-rod passes for a rod with its ends at the two points, in either order', () => {
  const c = { type: 'st-rod', ends: [[0, 2], [4, 2]], tol: 0.1 };
  assert.equal(judge(c, 0, [rod(1, 'K', 2, 0, 4)]).passed, true);
  assert.equal(judge(c, 0, [rod(1, 'K', 2, 4, 0)]).passed, true);
  assert.equal(judge({ ...c, ends: [[4, 2], [0, 2]] }, 0, [rod(1, 'K', 2, 0, 4)]).passed, true);
});

test('st-rod reads a rod laid in K′, and ends riding worldlines', () => {
  // At v = 0.6 the K′ rod along t′ = 4 from x′ = 0 to x′ = −4 has K ends
  // (x, t) = γ(x′ + v t′, t′ + v x′) = (3, 5) and (−2, 2); listed here in the other order.
  const c = { type: 'st-rod', ends: [[-2, 2], [3, 5]], tol: 0.01 };
  assert.equal(judge(c, 0.6, [rod(1, 'Kp', 4, 0, -4)]).passed, true);
  // The same ends, set by the worldline x′ = 0 (x = 0.6 t) and x = −2 rather than by x′.
  assert.equal(judge(c, 0.6, [param(1, 0.6, 0), param(2, 0, -2), rod(3, 'Kp', 4, 9, 9, 1, 2)]).passed, true);
});

test('st-rod misses and names the nearest rod', () => {
  const attempt = judge({ type: 'st-rod', ends: [[0, 2], [4, 2]], tol: 0.1 }, 0, [rod(1, 'K', 2, 4.5, 0)]);
  assert.equal(attempt.passed, false);
  assert.equal(attempt.results[0].feedback, 'nearest rod has ends at (0, 2) and (4.5, 2); need (0, 2) and (4, 2) ± 0.1');
  assert.equal(judge({ type: 'st-rod', ends: [[0, 2], [4, 2]], tol: 0.1 }, 0, [ev(1, 0, 2)]).results[0].feedback,
    'no rod found; need (0, 2) and (4, 2) ± 0.1');
});

test('a single joined segment that is extended counts beyond its events', () => {
  const objs = [ev(1, 0, 0), ev(2, 3, 5), chain(3, [1, 2], true)];
  assert.equal(judge({ type: 'st-worldline', u: 0.6, uTol: 0.01, x: 4.5, t: 7.5, tol: 0.1 }, 0, objs).passed, true);
});

test('the types work in a Condition list, inside anyOf, and encoded', () => {
  const event = { type: 'st-event', x: 3, t: 5, tol: 0.1 };
  const out = { type: 'st-worldline', u: 0.6, uTol: 0.01, x: 1.5, t: 2.5, tol: 0.1 };
  const stayed = { type: 'st-worldline', u: 0, uTol: 0.01, x: 0, t: 5, tol: 0.1 };

  const list = judge([event, out, stayed], 0, trip);
  assert.deepEqual(list.results.map((r) => r.pass), [true, true, false]);
  assert.equal(list.results[2].feedback, 'no worldline with u = 0.00 found');

  assert.equal(judge({ type: 'anyOf', conditions: [stayed, out] }, 0, trip).passed, true);
  const none = judge({ type: 'anyOf', conditions: [stayed, { ...event, x: 9 }] }, 0, trip);
  assert.equal(none.results[0].feedback,
    'Any one of: no worldline with u = 0.00 found — or — nearest event is at (3, 5); need (9, 5) ± 0.1');

  assert.equal(judge(encodeKey([event, out]), 0, trip).passed, true);
  assert.equal(judge(encodeKey({ type: 'anyOf', conditions: [stayed, event] }), 0, trip).passed, true);
  assert.equal(judge(encodeKey(stayed), 0, trip).results[0].feedback, 'no worldline with u = 0.00 found');
});
