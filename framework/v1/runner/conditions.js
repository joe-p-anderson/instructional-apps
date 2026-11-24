// Conditions: tests on named State, evaluated only on Submit.
//
// A Condition is one of:
//   { state, target, tol, targetLabel? }   value within tolerance
//   { state, equals }                      exact or boolean match
//   { type, ...options }                   a registered Condition type
//   (state, info) => boolean | { pass, feedback }   the escape hatch
//   [ condition, ... ]                     several components; all must pass
//
// A Condition type is an evaluator (condition, state, info) => { pass, feedback? },
// where info maps State names to { label, unit }.

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
});

// Combine the built-in types with any number of extension maps (later ones win).
export function createConditionRegistry(...extensions) {
  return Object.freeze(Object.assign({}, builtinConditionTypes, ...extensions.filter(Boolean)));
}

// Evaluate a Condition against a State snapshot; returns one result per component.
export function evaluateCondition(condition, state, { info = {}, registry = builtinConditionTypes } = {}) {
  const components = Array.isArray(condition) ? condition : [condition];
  return components.map((c) => {
    const outcome = typeof c === 'function' ? normalize(c(state, info)) : normalize(evaluator(c, registry)(c, state, info));
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

function fmt(value, digits) {
  return typeof value === 'number' ? value.toFixed(digits) : String(value);
}
