// Conditions as the builder sees them (ticket 11). No DOM.
//
// A Condition (runner/conditions.js) is a tree. A node is addressed by a path from the Task's
// Condition, the same shape the runner's validation reports: [] is the Condition itself, a
// number steps into an all-of list (a plain array), and 'conditions', i steps into an any-of
// group. So ['conditions', 1, 0] is the first component of the any-of's second (all-of) option.
//
//   kindOf(node)            'target' | 'equals' | 'range' | 'anyOf' | 'allOf' | 'registered'
//                           (a Tool's own Condition type, such as spacetime's st-worldline: shown
//                           and kept as it is) | 'invalid' (not an object)
//   nodeAt(condition, path) the node at path, or undefined
//   replaceAt(condition, path, node)
//                           condition with the node at path replaced; node undefined removes it
//                           (from its list, or the whole Condition at []); an index one past
//                           the end of a list appends node
//   withFields(node, fields) node with fields set (undefined removes); a key that replaces a
//                           removed one takes its place, so tol -> relTol keeps the key order
//   newNode(kind, from?)    a fresh node of kind, keeping from's State and target label
//   childPath(path, node, i) the path of item i of the group node at path
//   items(node)             the group's items (all-of list or any-of conditions)
//   conditionSlots(condition) every value slot in the built-in forms, at any depth:
//                           [{ path, slot, value }] (path to the node, slot its key)
//   judgeLive(condition, state, { info, registry })
//                           what a student would get now: { pass, feedback: [text] }, or
//                           { error } when the Condition can't be judged at all

import { evaluateCondition, builtinConditionTypes } from '../../runner/conditions.js';

export const LEAF_KINDS = ['target', 'equals', 'range'];
export const GROUP_KINDS = ['anyOf', 'allOf'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function kindOf(node) {
  if (Array.isArray(node)) return 'allOf';
  if (!isObject(node)) return 'invalid';
  if (node.type === undefined) return 'equals' in node ? 'equals' : 'target';
  if (node.type === 'range' || node.type === 'anyOf') return node.type;
  return 'registered';
}

export const items = (node) => (Array.isArray(node) ? node : Array.isArray(node?.conditions) ? node.conditions : []);

export const childPath = (path, node, i) => (Array.isArray(node) ? [...path, i] : [...path, 'conditions', i]);

export function nodeAt(condition, path) {
  let node = condition;
  for (const step of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = node[step];
  }
  return node;
}

export function replaceAt(condition, path, node) {
  if (!path.length) return node;
  const [step, ...rest] = path;
  if (Array.isArray(condition)) {
    if (step === condition.length && !rest.length && node !== undefined) return [...condition, node];
    if (typeof step !== 'number' || !(step in condition)) throw new Error(`No Condition at ${path.join('.')}`);
    if (!rest.length && node === undefined) return condition.filter((_, i) => i !== step);
    const inner = replaceAt(condition[step], rest, node);
    return inner === condition[step] ? condition : condition.map((x, i) => (i === step ? inner : x));
  }
  if (!isObject(condition) || !Object.hasOwn(condition, step)) throw new Error(`No Condition at ${path.join('.')}`);
  const inner = replaceAt(condition[step], rest, node);
  return inner === condition[step] ? condition : { ...condition, [step]: inner };
}

export function withFields(node, fields) {
  const changed = Object.entries(fields).some(([k, v]) => (v === undefined ? Object.hasOwn(node, k) : node[k] !== v));
  if (!changed) return node;
  const freed = [];
  const out = {};
  for (const key of Reflect.ownKeys(node)) {
    if (typeof key === 'string' && Object.hasOwn(fields, key) && fields[key] === undefined) { freed.push(key); continue; }
    if (typeof key === 'string' && Object.hasOwn(fields, key)) out[key] = fields[key];
    else out[key] = node[key];
  }
  // New keys take the place of removed ones, in order, then go at the end.
  const added = Object.entries(fields).filter(([k, v]) => v !== undefined && !Object.hasOwn(node, k));
  if (freed.length && added.length) {
    const entries = [];
    let a = 0;
    for (const key of Reflect.ownKeys(node)) {
      if (freed.includes(key)) { if (a < added.length) entries.push(added[a++]); continue; }
      entries.push([key, out[key]]);
    }
    for (; a < added.length; a++) entries.push(added[a]);
    const ordered = {};
    for (const [k, v] of entries) ordered[k] = v;
    return ordered;
  }
  for (const [k, v] of added) out[k] = v;
  return out;
}

// A fresh node. from (a leaf) lends its State and target label to a new leaf.
export function newNode(kind, { state = '', from } = {}) {
  const subject = isObject(from) && from.state !== undefined ? from.state : state;
  const label = isObject(from) && from.targetLabel !== undefined ? { targetLabel: from.targetLabel } : {};
  switch (kind) {
    case 'target': {
      const tol = isObject(from) && from.relTol !== undefined ? { relTol: from.relTol } : { tol: isObject(from) && from.tol !== undefined ? from.tol : 0.05 };
      return { state: subject, target: isObject(from) && from.target !== undefined ? from.target : 0, ...tol, ...label };
    }
    case 'equals': return { state: subject, equals: isObject(from) && from.equals !== undefined ? from.equals : true, ...label };
    case 'range': return { type: 'range', state: subject, above: 0, ...label };
    case 'anyOf': return { type: 'anyOf', conditions: [newNode('target', { state })] };
    case 'allOf': return [newNode('target', { state })];
    default: throw new Error(`No Condition form "${kind}"`);
  }
}

const VALUE_SLOTS = ['state', 'target', 'equals', 'above', 'below'];

export function conditionSlots(condition, path = []) {
  const kind = kindOf(condition);
  if (GROUP_KINDS.includes(kind)) return items(condition).flatMap((x, i) => conditionSlots(x, childPath(path, condition, i)));
  if (!LEAF_KINDS.includes(kind)) return [];
  return VALUE_SLOTS.filter((slot) => Object.hasOwn(condition, slot)).map((slot) => ({ path, slot, value: condition[slot] }));
}

export function judgeLive(condition, state, { info = {}, registry = builtinConditionTypes } = {}) {
  try {
    const results = evaluateCondition(condition, state, { info, registry });
    const misses = results.filter((r) => !r.pass);
    return { pass: misses.length === 0, feedback: misses.map((r) => r.feedback) };
  } catch (err) {
    return { error: err.message };
  }
}
