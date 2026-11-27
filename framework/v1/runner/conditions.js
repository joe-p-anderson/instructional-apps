// Conditions: tests on named State, evaluated only on Submit.
//
// A Condition is one of:
//   { state, target, tol, targetLabel? }   value within tol of target
//   { state, target, relTol, targetLabel? }
//                                          value within relTol × |target| (exactly one of tol, relTol)
//   { state, equals }                      exact or boolean match
//   { type: 'range', state, above?, below?, targetLabel? }
//                                          strictly above and/or below the bounds
//   { type: 'anyOf', conditions: [ condition, ... ] }
//                                          at least one component passes
//   { type, ...options }                   a registered Condition type
//   (state, info) => boolean | { pass, feedback }   the escape hatch
//   [ condition, ... ]                     several components; all must pass
//
// In the built-in forms, state may be a State name or a State expression { expr } (see
// ../expression.js), and target, equals, above and below may be a value or an { expr },
// worked out against the State at Submit; tol and relTol are plain numbers. Unknown State,
// or a non-finite target or bound, makes the Condition a miss whose feedback names it.
// validateCondition(condition, fail) checks the built-in forms when a runner is created. It
// calls fail(message, path), where path leads from the Condition to the field at fault (such
// as ['conditions', 1, 'target']); fail may throw to stop at the first problem.
//
// A Condition type is an evaluator (condition, state, info, { evaluate }) => { pass, feedback? },
// where info maps State names to { label, unit } and evaluate(condition) judges a
// nested Condition against the same State and registry (one result per component).

import { cachedExpression, isExpression, ExpressionError } from '../expression.js';

export const builtinConditionTypes = Object.freeze({
  tolerance: judged((c, state, info) => {
    const { value, label, unit } = subject(c.state, state, info);
    const target = operand(c.target, state);
    if (c.relTol !== undefined) {
      const pass = typeof value === 'number' && Math.abs(value - target) <= c.relTol * Math.abs(target);
      const need = c.targetLabel ?? `${threeFigures(target)}${withUnit(unit)} ± ${short(c.relTol * 100)}%`;
      return { pass, feedback: `${label} = ${short(value)}${withUnit(unit)}; need ${need}` };
    }
    const pass = typeof value === 'number' && Math.abs(value - target) <= c.tol;
    const digits = decimalsFor(c.tol);
    const need = c.targetLabel ?? `${fmt(target, digits)} ± ${fmt(c.tol, digits)}${withUnit(unit)}`;
    return { pass, feedback: `${label} = ${fmt(value, digits)}${withUnit(unit)}; need ${need}` };
  }),
  equals: judged((c, state, info) => {
    const { value, label, unit } = subject(c.state, state, info);
    const equals = operand(c.equals, state);
    const need = c.targetLabel ?? `${String(equals)}${withUnit(unit)}`;
    return { pass: value === equals, feedback: `${label} = ${String(value)}${withUnit(unit)}; need ${need}` };
  }),
  range: judged((c, state, info) => {
    if (c.above === undefined && c.below === undefined) throw new Error('A range Condition needs an above or below bound.');
    const { value, label, unit } = subject(c.state, state, info);
    const above = operand(c.above, state);
    const below = operand(c.below, state);
    const isNumber = typeof value === 'number' && !Number.isNaN(value);
    const missedAbove = above !== undefined && !(isNumber && value > above);
    const missedBelow = below !== undefined && !(isNumber && value < below);
    const need = c.targetLabel ?? (missedAbove || !missedBelow ? `> ${short(above)}` : `< ${short(below)}`);
    return { pass: !missedAbove && !missedBelow, feedback: `${label} = ${short(value)}${withUnit(unit)}; need ${need}` };
  }),
  anyOf(c, state, info, { evaluate }) {
    if (!Array.isArray(c.conditions) || c.conditions.length === 0) throw new Error('An anyOf Condition needs a non-empty conditions list.');
    const outcomes = c.conditions.map((component) => {
      const results = evaluate(component);
      return { pass: results.every((r) => r.pass), feedback: results.filter((r) => !r.pass).map((r) => r.feedback).join('; ') };
    });
    const pass = outcomes.some((o) => o.pass);
    return { pass, feedback: `Any one of: ${outcomes.map((o) => o.feedback).join(' — or — ')}` };
  },
});

// Check the built-in forms of a (decoded) Condition, at any depth: every { expr } value
// parses, and a target Condition has exactly one numeric tol or relTol. Registered types
// and functions are left to their evaluators. fail(message) reports a problem.
const VALUE_SLOTS = ['state', 'target', 'equals', 'above', 'below'];
export function validateCondition(c, fail, path = []) {
  if (Array.isArray(c)) return c.forEach((component, i) => validateCondition(component, fail, [...path, i]));
  if (!c || typeof c !== 'object') return;
  const type = c.type ?? ('equals' in c ? 'equals' : 'tolerance');
  if (type === 'anyOf') {
    return Array.isArray(c.conditions)
      && c.conditions.forEach((component, i) => validateCondition(component, fail, [...path, 'conditions', i]));
  }
  if (!['tolerance', 'equals', 'range'].includes(type)) return;
  for (const slot of VALUE_SLOTS) {
    if (!isExpression(c[slot])) continue;
    try {
      cachedExpression(c[slot].expr);
    } catch (err) {
      if (!(err instanceof ExpressionError)) throw err;
      fail(`${slot} expression "${c[slot].expr}" doesn't parse: ${err.message}`, [...path, slot]);
    }
  }
  if (type === 'tolerance') {
    const given = ['tol', 'relTol'].filter((key) => c[key] !== undefined);
    if (given.length !== 1 || typeof c[given[0]] !== 'number') {
      fail('needs exactly one of tol and relTol, as a number', [...path, given.length === 1 ? given[0] : 'tol']);
    }
  }
}

// Combine the built-in types with any number of extension maps (later ones win).
export function createConditionRegistry(...extensions) {
  return Object.freeze(Object.assign({}, builtinConditionTypes, ...extensions.filter(Boolean)));
}

// Evaluate a Condition against a State snapshot; returns one result per component.
export function evaluateCondition(condition, state, { info = {}, registry = builtinConditionTypes } = {}) {
  const components = Array.isArray(condition) ? condition : [condition];
  const context = { evaluate: (inner) => evaluateCondition(inner, state, { info, registry }) };
  return components.map((c) => {
    const outcome = typeof c === 'function' ? normalize(c(state, info)) : normalize(evaluator(c, registry)(c, state, info, context));
    return { kind: 'condition', pass: outcome.pass, feedback: outcome.pass ? null : outcome.feedback ?? 'Condition not met' };
  });
}

function evaluator(c, registry) {
  const type = c.type ?? ('equals' in c ? 'equals' : 'tolerance');
  const fn = registry[type];
  if (typeof fn !== 'function') throw new Error(`Unknown Condition type "${type}".`);
  return fn;
}

// A value a Condition can't be judged against (unknown State, a non-finite key): the
// Condition is a miss with this feedback.
class Unjudgeable extends Error {}

function judged(evaluate) {
  return (c, state, info, context) => {
    try {
      return evaluate(c, state, info, context);
    } catch (err) {
      if (!(err instanceof Unjudgeable)) throw err;
      return { pass: false, feedback: `Can't judge this Condition: ${err.message}.` };
    }
  };
}

// A value slot (target, equals, above, below): a plain value, or an { expr } worked out
// against the State, which must come to a finite number.
function operand(slot, state) {
  if (!isExpression(slot)) return slot;
  const value = evaluateExpression(slot.expr, state);
  if (!Number.isFinite(value)) throw new Unjudgeable(`"${slot.expr}" works out to ${value}`);
  return value;
}

function evaluateExpression(source, state) {
  try {
    return cachedExpression(source).evaluate(state);
  } catch (err) {
    if (!(err instanceof ExpressionError)) throw err;
    throw new Unjudgeable(`"${source}" has ${lowerFirst(err.message).replace(/\.$/, '')}`);
  }
}

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

function normalize(outcome) {
  return typeof outcome === 'object' && outcome !== null
    ? { pass: Boolean(outcome.pass), feedback: outcome.feedback }
    : { pass: Boolean(outcome) };
}

// The value a Condition tests, with the label and unit its feedback names: a State name
// (labelled from info), or an { expr } (labelled with its source; it may come to any number).
function subject(name, state, info) {
  if (isExpression(name)) return { value: evaluateExpression(name.expr, state), label: name.expr, unit: '' };
  if (!Object.hasOwn(state, name)) throw new Unjudgeable(`unknown State "${name}"`);
  return { value: state[name], label: info[name]?.label ?? name, unit: info[name]?.unit ?? '' };
}

const withUnit = (unit) => (unit ? ` ${unit}` : '');

function decimalsFor(tol) {
  return tol > 0 ? Math.max(0, Math.ceil(-Math.log10(tol))) : 3;
}

// A number to four significant figures without trailing zeros (0, 0.05, 1234).
function short(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(Number(value.toPrecision(4))) : String(value);
}

// At least three significant figures, in fixed notation (5.00, 0.0120, 1000).
function threeFigures(value) {
  return value === 0 ? '0' : value.toFixed(Math.max(0, 2 - Math.floor(Math.log10(Math.abs(value)))));
}

function fmt(value, digits) {
  return typeof value === 'number' ? value.toFixed(digits) : String(value);
}
