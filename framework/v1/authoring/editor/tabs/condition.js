// The Task form's Condition tab: the Condition builder (spec stories 29-35; ticket 11). See
// task-form.js for the tab shape and the ctx it gets.
//
// A Task has a Condition or none. The builder draws the Condition's tree (condition-model.js):
// target ± tolerance, equals and range leaves, any-of groups and all-of lists nested to any
// depth, and a Tool's own Condition types (spacetime's) shown read-only and kept as they are.
// Every node is a group named by its place ("Condition", "Condition 2", "Condition 2.1"), with
// its live verdict; the section's "Live result" is what a student would get from the live Tool
// now. Value slots take a State name (picked from the Mode's State) or a State expression;
// target, above and below take a number or an expression, typed in one box. The file stores the
// Condition encoded; the builder shows it decoded.

import { h } from '../../../ui-kit.js';
import { createConditionRegistry } from '../../../runner/conditions.js';
import { cachedExpression, isExpression } from '../../../expression.js';
import { kindOf, items, childPath, nodeAt, newNode, judgeLive, LEAF_KINDS } from '../condition-model.js';
import { toleranceField } from '../tolerance-field.js';

export const conditionTab = {
  id: 'condition',
  label: () => 'Condition',
  owns: (rest) => rest[0] === 'condition',
  render(ctx) {
    const b = builder(ctx);
    const { task, base } = ctx;
    const live = h('div', { class: 'cond-live', role: 'status', 'aria-label': 'Live result' });
    ctx.onLive(() => b.drawVerdict(live, [], true));
    const body = task.condition === undefined
      ? [h('p', { class: 'muted', 'data-path': `${base}.condition` }, 'No Condition: the Questions alone decide the Task.'),
        b.addRow([], 'Add a Condition')]
      : [b.node(task.condition, [], 'Condition', null),
        LEAF_KINDS.includes(kindOf(task.condition)) || kindOf(task.condition) === 'registered' || kindOf(task.condition) === 'anyOf'
          ? b.addRow(null, 'Add another (the Task then needs all of them)') : null];
    return [ctx.section('Condition', 'judged against the State on Submit; stored encoded',
      live, ...body,
      h('p', { class: 'muted' }, 'Any value can be a State name or a State expression such as 1/sqrt(L*C). '
        + 'The verdicts follow the live Tool on the right.'))];
  },
};

const FORM_LABELS = { target: 'target ± tolerance', equals: 'equals', range: 'range' };
const GROUP_LABELS = { anyOf: 'Any one of', allOf: 'All of' };
const ADD_LABELS = { target: '+ Target', equals: '+ Equals', range: '+ Range', anyOf: '+ Any of', allOf: '+ All of' };

function builder(ctx) {
  const { p, t, base } = ctx;
  const states = ctx.mode?.state ?? null;
  const firstState = states ? Object.keys(states)[0] ?? '' : '';
  const dataPath = (path, slot) => [base, 'condition', ...path, ...(slot ? [slot] : [])].join('.');
  const current = () => ctx.editor.doc.parts[p]?.tasks?.[t]?.condition;
  const setNode = (path, node) => ctx.commitAndRender({ type: 'setConditionNode', p, t, path, node });
  const setFields = (path, fields) => ({ type: 'setConditionFields', p, t, path, fields });
  const snapshot = () => ctx.liveInstance()?.state.snapshot() ?? null;
  const unitOf = (subject) => (typeof subject === 'string' ? states?.[subject]?.unit ?? '' : '');

  // A verdict for the node at path against the live State (the whole Condition for path []).
  function drawVerdict(el, path, full) {
    const instance = ctx.liveInstance();
    const node = nodeAt(current(), path);
    el.className = `verdict${full ? ' cond-verdict' : ''}`;
    if (node === undefined) { el.replaceChildren(); return; }
    if (!instance) { el.replaceChildren(h('span', { class: 'muted' }, 'No live Tool to judge against yet.')); return; }
    const info = typeof instance.state.describe === 'function' ? instance.state.describe() : states ?? {};
    const r = judgeLive(node, instance.state.snapshot(), { info, registry: createConditionRegistry(ctx.tool?.conditionTypes) });
    if (r.error) { el.classList.add('miss'); el.replaceChildren(h('span', { class: 'lbl' }, "Can't judge"), r.error); return; }
    el.classList.add(r.pass ? 'pass' : 'miss');
    const lines = r.pass ? [full ? 'against the live Tool' : ''] : r.feedback;
    el.replaceChildren(h('span', { class: 'lbl' }, r.pass ? 'Pass now' : 'Miss now'),
      h('span', { class: 'cond-feedback' }, ...lines.map((line) => h('span', {}, line))));
  }

  // "+ Target" ... "+ All of": add a node to the group at path; path null wraps the root in an
  // all-of with the new node; path [] with no Condition makes it the Condition.
  function addRow(path, label, groupKind) {
    const kinds = ['target', 'equals', 'range', 'anyOf', ...(groupKind === 'allOf' ? [] : ['allOf'])];
    const add = (kind) => {
      const node = newNode(kind, { state: firstState });
      const cond = current();
      if (path === null) return setNode([], [cond, node]);
      if (cond === undefined) return setNode([], node);
      const group = nodeAt(cond, path);
      setNode(childPath(path, group, items(group).length), node);
    };
    return h('div', { class: 'cadd row', role: 'group', 'aria-label': label, 'data-path': path?.length === 0 && current() === undefined ? dataPath([]) : null },
      ...kinds.map((k) => h('button', { type: 'button', class: 'lnk', onclick: () => add(k) }, ADD_LABELS[k])));
  }

  function removeButton(path) {
    return h('button', { type: 'button', class: 'lnk danger', onclick: () => setNode(path, undefined) }, 'Remove');
  }

  function verdictFor(path) {
    const el = h('span', { class: 'verdict' });
    ctx.onLive(() => drawVerdict(el, path, false));
    return el;
  }

  function node(c, path, name, parentKind) {
    const kind = kindOf(c);
    if (kind === 'anyOf' || kind === 'allOf') return groupNode(c, path, name, kind, parentKind);
    if (LEAF_KINDS.includes(kind)) return leafNode(c, path, name, kind);
    return h('div', { class: 'cleaf', role: 'group', 'aria-label': name, 'data-path': dataPath(path) },
      h('div', { class: 'row' }, h('span', {}, kind === 'registered' ? `The Tool's own Condition type “${c.type}”` : 'Not a Condition the builder knows'),
        h('span', { style: 'flex:1' }), removeButton(path)),
      h('pre', { class: 'mono' }, JSON.stringify(c, null, 2)),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'kept exactly as it is'), verdictFor(path)));
  }

  function groupNode(c, path, name, kind, parentKind) {
    const select = h('select', { class: 't', 'aria-label': 'Group', 'data-path': dataPath(path), onchange: () => {
      const list = items(c);
      setNode(path, select.value === 'allOf' ? [...list] : { type: 'anyOf', conditions: [...list] });
    } }, ...Object.entries(GROUP_LABELS).map(([v, label]) => h('option', { value: v, selected: v === kind,
      disabled: v === 'allOf' && parentKind === 'allOf' && kind !== 'allOf' }, label)));
    const childName = (i) => (path.length ? `${name}.${i + 1}` : `Condition ${i + 1}`);
    return h('div', { class: 'cgroup', role: 'group', 'aria-label': name },
      h('div', { class: 'cgroup-head' }, select, h('span', { class: 'muted' }, 'these'), h('span', { style: 'flex:1' }), removeButton(path)),
      h('div', { class: 'row' }, verdictFor(path)),
      ...items(c).map((x, i) => node(x, childPath(path, c, i), childName(i), kind)),
      addRow(path, `Add to ${name}`, kind));
  }

  function leafNode(c, path, name, kind) {
    const isExpr = isExpression(c.state);
    const unit = unitOf(c.state);
    const tested = h('span', { class: 'seg small', role: 'group', 'aria-label': 'Tested' },
      ...[['state', 'State'], ['expr', 'Expression']].map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String((v === 'expr') === isExpr),
        onclick: () => {
          if ((v === 'expr') === isExpr) return;
          const name0 = isExpr ? c.state.expr.trim() : c.state;
          const state = v === 'expr' ? { expr: String(c.state ?? '') } : (states && Object.hasOwn(states, name0) ? name0 : firstState);
          ctx.commitAndRender(setFields(path, { state }));
        } }, label)));
    const subject = isExpr || !states ? textSlot(c, path, 'state', isExpr ? 'Expression' : 'State',
      (v) => (isExpr ? { expr: v } : v), isExpr ? c.state.expr : c.state ?? '') : stateSelect(c, path);
    const form = h('select', { class: 't', 'aria-label': 'Form', onchange: () => setNode(path, newNode(form.value, { from: c })) },
      ...Object.entries(FORM_LABELS).map(([v, label]) => h('option', { value: v, selected: v === kind }, label)));
    let rhs;
    if (kind === 'target') {
      rhs = [operandSlot(c, path, 'target', 'Target', unit),
        toleranceField(ctx, { owner: c, path: dataPath(path), unit, toEdit: (fields) => setFields(path, fields) }),
        useCurrent(c, path, 'target')];
    } else if (kind === 'equals') {
      rhs = [equalsSlot(c, path, unit), useCurrent(c, path, 'equals')];
    } else {
      rhs = [operandSlot(c, path, 'above', 'Above', unit), operandSlot(c, path, 'below', 'Below', unit),
        h('span', { class: 'muted' }, 'strictly; leave one empty for no bound')];
    }
    const [labelLabel, labelInput] = ctx.field({ label: 'Target label', path: dataPath(path, 'targetLabel'), value: c.targetLabel,
      class: 't', placeholder: 'optional: replaces "need …" in the feedback', style: 'width:18em',
      toEdit: (v) => setFields(path, { targetLabel: v === '' ? undefined : v }) });
    return h('div', { class: 'cleaf', role: 'group', 'aria-label': name },
      h('div', { class: 'row' }, tested, subject, form, h('span', { style: 'flex:1' }), removeButton(path)),
      h('div', { class: 'row' }, ...rhs),
      h('div', { class: 'row' }, labelLabel, labelInput, verdictFor(path)));
  }

  // The State tested: one of the Mode's State, with its label and unit.
  function stateSelect(c, path) {
    const known = Object.hasOwn(states, c.state);
    const select = h('select', { class: 't', 'aria-label': 'State', 'data-path': dataPath(path, 'state'),
      onchange: () => ctx.commitAndRender(setFields(path, { state: select.value })) },
    known ? null : h('option', { value: String(c.state ?? ''), selected: true }, `${c.state ?? ''} (not State of this Mode)`),
    ...Object.entries(states).map(([n, { label, unit }]) => h('option', { value: n, selected: n === c.state },
      `${n} · ${label}${unit ? ` (${unit})` : ''}`)));
    return select;
  }

  // A text box bound to one slot, with the expression's live value beside it when it is one.
  function textSlot(c, path, slot, label, toValue, text) {
    const [, input] = ctx.field({ label, path: dataPath(path, slot), value: text, class: 't mono', 'aria-label': label, style: 'width:12em',
      spellcheck: 'false', toEdit: (v) => setFields(path, { [slot]: toValue(v) }) });
    const value = h('span', { class: 'live' });
    ctx.onLive(() => {
      const v = nodeAt(current(), path)?.[slot];
      value.className = 'live';
      value.textContent = '';
      if (!isExpression(v)) return;
      const s = snapshot();
      if (!s) return;
      try {
        value.textContent = `= ${short(cachedExpression(v.expr).evaluate(s))}`;
      } catch (err) {
        value.className = 'live err';
        value.textContent = err.message;
      }
    });
    return h('span', { class: 'slot' }, input, value);
  }

  // target, above, below: a number, or anything else as an expression; empty removes the slot.
  function operandSlot(c, path, slot, label, unit) {
    const text = isExpression(c[slot]) ? c[slot].expr : c[slot] === undefined ? '' : String(c[slot]);
    return h('span', { class: 'slot' }, h('span', { class: 'flabel', style: 'min-width:0' }, label),
      textSlot(c, path, slot, label, operandValue, text), unit ? h('span', { class: 'unit' }, unit) : null);
  }

  // equals: a value (true, false, a number, or text) or an expression, by the switch beside it.
  function equalsSlot(c, path, unit) {
    const isExpr = isExpression(c.equals);
    const as = h('span', { class: 'seg small', role: 'group', 'aria-label': 'Equals as' },
      ...[['value', 'Value'], ['expr', 'Expression']].map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String((v === 'expr') === isExpr),
        onclick: () => {
          if ((v === 'expr') === isExpr) return;
          ctx.commitAndRender(setFields(path, { equals: v === 'expr' ? { expr: String(c.equals ?? '') } : equalsValue(c.equals.expr) }));
        } }, label)));
    const text = isExpr ? c.equals.expr : c.equals === undefined ? '' : String(c.equals);
    return h('span', { class: 'slot' }, h('span', { class: 'flabel', style: 'min-width:0' }, 'equals'),
      textSlot(c, path, 'equals', 'Equals', isExpr ? (v) => ({ expr: v }) : equalsValue, text), unit ? h('span', { class: 'unit' }, unit) : null, as);
  }

  // Fill slot (target or equals) from the tested value in the live Tool now.
  function useCurrent(c, path, slot) {
    const button = h('button', { type: 'button', class: 'btn', title: `Fill the ${slot} from the live Tool`, disabled: true, onclick: () => {
      const s = snapshot();
      const node0 = nodeAt(current(), path);
      if (!s || !node0) return;
      let v;
      try {
        v = isExpression(node0.state) ? cachedExpression(node0.state.expr).evaluate(s) : s[node0.state];
      } catch { return; }
      if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return;
      ctx.commitAndRender(setFields(path, { [slot]: typeof v === 'number' && slot === 'target' ? Number(v.toPrecision(6)) : v }));
    } }, 'Use current value');
    ctx.onLive(() => { button.disabled = !snapshot(); });
    return button;
  }

  return { node, addRow, drawVerdict };
}

function operandValue(text) {
  const s = text.trim();
  if (s === '') return undefined;
  return Number.isFinite(Number(s)) ? Number(s) : { expr: text };
}

function equalsValue(text) {
  const s = String(text ?? '').trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  return String(text ?? '');
}

const short = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Number(v.toPrecision(6))) : String(v));
