// Conditions: tests on named State, evaluated only on Submit.
//
// A Condition is one of:
//   { state, target, tol, targetLabel? }   value within tolerance
//   { state, equals }                      exact or boolean match
//   { type: 'range', state, above?, below?, targetLabel? }
//                                          strictly above and/or below the bounds
//   { type: 'anyOf', conditions: [ condition, ... ] }
//                                          at least one component passes
//   { type, ...options }                   a registered Condition type
//   (state, info) => boolean | { pass, feedback }   the escape hatch
//   [ condition, ... ]                     several components; all must pass
//
// A Condition type is an evaluator (condition, state, info, { evaluate }) => { pass, feedback? },
// where info maps State names to { label, unit } and evaluate(condition) judges a
// nested Condition against the same State and registry (one result per component).

export const builtinConditionTypes = Object.freeze({
  tolerance(c, state, info) {
    const value = read(c, state);
    const pass = typeof value === 'number' && Math.abs(value - c.target) <= c.tol;
    const { label, unit } = describe(c.state, info);
    const digits = decimalsFor(c.tol);
    const need = c.targetLabel ?? `${fmt(c.target, digits)} ± ${fmt(c.tol, digits)}${withUnit(unit)}`;
    return { pass, feedback: `${label} = ${fmt(value, digits)}${withUnit(unit)}; need ${need}` };
  },
  equals(c, state, info) {
    const value = read(c, state);
    const { label, unit } = describe(c.state, info);
    const need = c.targetLabel ?? `${String(c.equals)}${withUnit(unit)}`;
    return { pass: value === c.equals, feedback: `${label} = ${String(value)}${withUnit(unit)}; need ${need}` };
  },
  range(c, state, info) {
    if (c.above === undefined && c.below === undefined) throw new Error('A range Condition needs an above or below bound.');
    const value = read(c, state);
    const isNumber = typeof value === 'number' && !Number.isNaN(value);
    const missedAbove = c.above !== undefined && !(isNumber && value > c.above);
    const missedBelow = c.below !== undefined && !(isNumber && value < c.below);
    const { label, unit } = describe(c.state, info);
    const need = c.targetLabel ?? (missedAbove || !missedBelow ? `> ${short(c.above)}` : `< ${short(c.below)}`);
    return { pass: !missedAbove && !missedBelow, feedback: `${label} = ${short(value)}${withUnit(unit)}; need ${need}` };
  },
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

function normalize(outcome) {
  return typeof outcome === 'object' && outcome !== null
    ? { pass: Boolean(outcome.pass), feedback: outcome.feedback }
    : { pass: Boolean(outcome) };
}

function read(c, state) {
  if (!(c.state in state)) throw new Error(`Condition refers to unknown State "${c.state}".`);
  return state[c.state];
}

function describe(name, info) {
  return { label: info[name]?.label ?? name, unit: info[name]?.unit ?? '' };
}

const withUnit = (unit) => (unit ? ` ${unit}` : '');

function decimalsFor(tol) {
  return tol > 0 ? Math.max(0, Math.ceil(-Math.log10(tol))) : 3;
}

// A number to four significant figures without trailing zeros (0, 0.05, 1234).
function short(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(Number(value.toPrecision(4))) : String(value);
}

function fmt(value, digits) {
  return typeof value === 'number' ? value.toFixed(digits) : String(value);
}
