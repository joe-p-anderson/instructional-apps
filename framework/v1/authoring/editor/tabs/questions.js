// The Task form's Questions tab: one card per Question (numeric, choice or free text), each with
// its kind, frozen id, points, prompt and its kind's fields, moved and removed in place; and a
// row that adds a Question from its prompt. See task-form.js for the tab shape.
//
// Numeric: the answer is a number or a State expression (a switch), and an expression shows its
// value at the live Tool's current State. The tolerance is tolerance-field.js's unit / % field,
// beside the modulus and a menu of TOLERANCE_PRESETS (tolerance.js), which stamp plain values.
// Choice: the choices, each with an id and a text, the correct one marked with a radio button.
// Prompts and choice texts go through prose.js. Keys are shown decoded; the core encodes them.

import { h } from '../../../ui-kit.js';
import { proseField } from '../prose.js';
import { toleranceField } from '../tolerance-field.js';
import { TOLERANCE_PRESETS, presetOf } from '../tolerance.js';
import { parseExpression, isExpression } from '../../../expression.js';

const questionsOf = (task) => (Array.isArray(task.questions) ? task.questions : []);
const KINDS = [['numeric', 'Numeric'], ['choice', 'Choice'], ['text', 'Free text']];
const fmt = (v) => (typeof v === 'number' ? String(Number(v.toPrecision(6))) : String(v));

// The answer switch's side per Question ('number' | 'expr'), kept while an answer is empty.
const answerSides = new Map();
let focusNext = null; // a data-path to focus after the next render (a Question just added)

export const questionsTab = {
  id: 'questions',
  label: (ctx) => `Questions (${questionsOf(ctx.task).length})`,
  owns: (rest) => rest[0] === 'questions',
  render(ctx) {
    const { task, base } = ctx;
    const qs = questionsOf(task);
    const cards = qs.map((q, i) => questionCard(ctx, q, i, qs.length));
    const nodes = [ctx.section('Questions', `${qs.length}`,
      h('div', { 'data-path': `${base}.questions` }, ...(cards.length ? cards : [h('p', { class: 'muted' }, 'No Questions.')])),
      addRow(ctx))];
    if (focusNext) {
      const path = focusNext;
      focusNext = null;
      queueMicrotask(() => document.querySelector(`[data-path="${CSS.escape(path)}"]`)?.focus());
    }
    return nodes;
  },
};

function addRow(ctx) {
  const { p, t, task, base } = ctx;
  const prompt = h('input', { type: 'text', class: 't wide', id: `${base}-new-question`, placeholder: 'e.g. |I| (mA): the id is made from it' });
  const add = (kind) => {
    const at = questionsOf(task).length;
    ctx.commit({ type: 'addQuestion', p, t, kind, prompt: prompt.value });
    focusNext = `${base}.questions.${at}.prompt`;
    ctx.rerender();
  };
  return h('div', { class: 'row qadd' }, h('label', { for: prompt.id }, 'New Question prompt'), prompt,
    ...KINDS.map(([kind, word]) => h('button', { type: 'button', class: 'lnk', onclick: () => add(kind) }, `+ ${word}`)));
}

function questionCard(ctx, q, i, count) {
  const { p, t, base } = ctx;
  const path = `${base}.questions.${i}`;
  const n = i + 1;
  const kind = h('select', { class: 't', 'aria-label': `Question ${n} kind`, 'data-path': `${path}.kind`,
    onchange: (e) => ctx.commitAndRender({ type: 'setQuestionKind', p, t, q: i, kind: e.target.value }) },
  ...KINDS.map(([v, word]) => h('option', { value: v, selected: q.kind === v }, word)),
  ...(KINDS.some(([v]) => v === q.kind) ? [] : [h('option', { value: q.kind, selected: true }, String(q.kind))]));
  const [pointsLabel, points] = ctx.field({ label: 'Points', path: `${path}.points`, value: q.points === undefined ? '' : String(q.points),
    class: 't num', inputmode: 'decimal', toEdit: (v) => set(ctx, i, 'points', numberOrText(v)) });
  const move = (to) => ctx.commitAndRender({ type: 'moveQuestion', p, t, q: i, to });
  const head = h('div', { class: 'qcard-head' }, h('span', { class: 'qn' }, `Question ${n}`), kind,
    h('span', { class: 'idfield', 'data-path': `${path}.id`, title: 'made from the first prompt; changing the prompt keeps it' },
      h('span', { class: 'flabel' }, 'id'), h('code', {}, String(q.id ?? ''))),
    pointsLabel, points, h('span', { style: 'flex:1' }),
    h('button', { type: 'button', class: 'lnk', disabled: i === 0, 'aria-label': `Move Question ${n} up`, onclick: () => move(i - 1) }, '↑'),
    h('button', { type: 'button', class: 'lnk', disabled: i === count - 1, 'aria-label': `Move Question ${n} down`, onclick: () => move(i + 1) }, '↓'),
    h('button', { type: 'button', class: 'lnk danger', 'aria-label': `Remove Question ${n}`,
      onclick: () => ctx.commitAndRender({ type: 'deleteQuestion', p, t, q: i }) }, 'remove'));
  const body = [proseField(ctx, { label: `Question ${n} prompt`, path: `${path}.prompt`, value: q.prompt, rows: '2',
    toEdit: (v) => set(ctx, i, 'prompt', v) })];
  if (q.kind === 'numeric') body.push(...numericBody(ctx, q, i, path));
  else if (q.kind === 'choice') body.push(...choiceBody(ctx, q, i, path));
  else if (q.kind === 'text') body.push(h('p', { class: 'muted', style: 'margin:0' }, 'Never judged: the answer is recorded in the Report.'));
  return h('div', { class: 'qcard', role: 'group', 'aria-label': `Question ${n}`, 'data-question': String(q.id ?? '') }, head, ...body);
}

const set = (ctx, q, field, value) => ({ type: 'setQuestionField', p: ctx.p, t: ctx.t, q, field, value });

// A number as typed: empty removes it, a number is that number, anything else is kept as text
// so the runner's validation lists it.
function numberOrText(text) {
  const s = text.trim();
  if (s === '') return undefined;
  return Number.isFinite(Number(s)) ? Number(s) : s;
}

// ── Numeric ──

function numericBody(ctx, q, i, path) {
  const { p, t, base } = ctx;
  const n = i + 1;
  const key = `${base}#${q.id}`;
  const side = isExpression(q.answer) ? 'expr' : q.answer !== undefined ? 'number' : answerSides.get(key) ?? 'number';
  const answerValue = (text) => (side === 'expr' ? (text.trim() === '' ? undefined : { expr: text }) : numberOrText(text));
  const [answerLabel, answer] = ctx.field({ label: `Question ${n} answer`, path: `${path}.answer`, class: 't mono expr', spellcheck: 'false',
    value: isExpression(q.answer) ? q.answer.expr : q.answer === undefined ? '' : String(q.answer),
    toEdit: (v) => set(ctx, i, 'answer', answerValue(v)) });
  answer.placeholder = side === 'expr' ? 'IMag * 1000, 1/sqrt(L*C), deg(atan2(A2, A1))' : 'a number';
  const live = h('span', { class: 'live', 'data-live': 'answer' });
  const showLive = () => {
    live.className = 'live';
    if (side !== 'expr') { live.textContent = ''; return; }
    const src = answer.value;
    if (src.trim() === '') { live.textContent = ''; return; }
    let expr;
    try { expr = parseExpression(src); } catch (err) { live.className = 'live err'; live.textContent = `doesn't parse: ${err.message}`; return; }
    const instance = ctx.liveInstance();
    if (!instance) { live.textContent = ctx.toolError ? '' : 'waiting for the live Tool'; return; }
    try {
      const value = expr.evaluate(instance.state.snapshot());
      live.textContent = `= ${fmt(value)} at the live Tool`;
      if (!Number.isFinite(value)) live.className = 'live err';
    } catch (err) { live.className = 'live err'; live.textContent = err.message; }
  };
  answer.addEventListener('input', showLive);
  ctx.onLive(showLive);

  const flip = (to) => {
    if (to === side) return;
    answerSides.set(key, to);
    const text = answer.value.trim();
    let value;
    if (to === 'expr') value = text === '' ? undefined : { expr: text };
    else if (text !== '' && Number.isFinite(Number(text))) value = Number(text);
    else value = liveValue(ctx, text);
    ctx.commitAndRender(set(ctx, i, 'answer', value));
  };
  const sideSwitch = h('span', { class: 'seg small', role: 'group', 'aria-label': `Question ${n} answer is` },
    ...[['number', 'Number'], ['expr', 'State expression']].map(([v, word]) => h('button', { type: 'button', 'aria-pressed': String(side === v),
      onclick: () => flip(v) }, word)));

  const tolerance = toleranceField(ctx, { owner: q, path, unit: answerUnit(ctx, q) ?? '', name: `Question ${n} tolerance`,
    toEdit: (values) => ({ type: 'setQuestionValues', p, t, q: i, values }) });
  const [modLabel, modInput] = ctx.field({ label: 'modulus', path: `${path}.modulus`, value: q.modulus === undefined ? '' : String(q.modulus),
    class: 't num mono', inputmode: 'decimal', placeholder: 'none', toEdit: (v) => set(ctx, i, 'modulus', numberOrText(v)) });
  const tolRow = h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Tolerance'), tolerance, modLabel, modInput, presetMenu(ctx, q, i));
  return [
    h('div', { class: 'row' }, answerLabel, sideSwitch, answer, live),
    h('div', { class: 'row' }, h('span', { class: 'flabel' }), h('span', { class: 'muted' },
      side === 'expr' ? 'worked out from the live State at Submit, so the key matches what the student sees' : 'a fixed number')),
    tolRow,
  ];
}

// The value of an expression's source at the live Tool, or undefined.
function liveValue(ctx, src) {
  const instance = ctx.liveInstance();
  if (!instance || !src) return undefined;
  try {
    const v = parseExpression(src).evaluate(instance.state.snapshot());
    return Number.isFinite(v) ? Number(v.toPrecision(12)) : undefined;
  } catch { return undefined; }
}

// The answer's unit when it is one State name with a unit.
function answerUnit(ctx, q) {
  if (!isExpression(q.answer) || !ctx.mode) return null;
  const name = q.answer.expr.trim();
  return Object.hasOwn(ctx.mode.state ?? {}, name) ? ctx.mode.state[name].unit || null : null;
}

// "Preset: <name> ▾", a menu of TOLERANCE_PRESETS; the name follows typed tolerances.
function presetMenu(ctx, q, i) {
  const { p, t } = ctx;
  const name = h('span', {}, presetOf(q)?.name ?? 'Custom');
  const pop = h('div', { class: 'pop', role: 'menu', hidden: true, 'aria-label': `Question ${i + 1} tolerance presets` },
    ...TOLERANCE_PRESETS.map((preset) => h('button', { type: 'button', role: 'menuitem',
      onclick: () => ctx.commitAndRender({ type: 'setQuestionValues', p, t, q: i, values: preset.values }) },
    preset.name, ' ', h('span', { class: 'pop-sub' }, preset.sub))));
  const button = h('button', { type: 'button', class: 'btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': `Question ${i + 1} tolerance preset`,
    onclick: () => { pop.hidden = !pop.hidden; button.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) pop.querySelector('button')?.focus(); } },
  'Preset: ', name, ' ▾');
  const wrap = h('span', { class: 'menu-wrap' }, button, pop);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); pop.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); }
  });
  // Typing a tolerance or modulus by hand may match a preset, or leave one.
  queueMicrotask(() => wrap.closest('.row')?.addEventListener('input', () => {
    const now = ctx.editor.doc.parts[p]?.tasks[t]?.questions?.[i];
    name.textContent = presetOf(now)?.name ?? 'Custom';
  }));
  return wrap;
}

// ── Choice ──

function choiceBody(ctx, q, i, path) {
  const { p, t } = ctx;
  const n = i + 1;
  const choices = Array.isArray(q.choices) ? q.choices : [];
  const rows = choices.map((c, k) => {
    const cpath = `${path}.choices.${k}`;
    const m = k + 1;
    const [idLabel, id] = ctx.field({ label: `Question ${n} choice ${m} id`, path: `${cpath}.id`, value: c.id, class: 't mono', spellcheck: 'false',
      toEdit: (v) => ({ type: 'setChoiceField', p, t, q: i, c: k, field: 'id', value: v }) });
    idLabel.className = 'fw-sr-only';
    const radio = h('input', { type: 'radio', name: `${path}-correct`, checked: q.correct === c.id, 'aria-label': `Choice ${m} is correct`,
      onchange: () => ctx.commitAndRender(set(ctx, i, 'correct', ctx.editor.doc.parts[p].tasks[t].questions[i].choices[k].id)) });
    const move = (to) => ctx.commitAndRender({ type: 'moveChoice', p, t, q: i, c: k, to });
    return h('div', { class: 'choice' }, radio, h('span', {}, idLabel, id),
      proseField(ctx, { label: `Question ${n} choice ${m} text`, path: `${cpath}.text`, value: c.text, rows: '1',
        toEdit: (v) => ({ type: 'setChoiceField', p, t, q: i, c: k, field: 'text', value: v }) }),
      h('span', {},
        h('button', { type: 'button', class: 'lnk', disabled: k === 0, 'aria-label': `Move choice ${m} up`, onclick: () => move(k - 1) }, '↑'), ' ',
        h('button', { type: 'button', class: 'lnk', disabled: k === choices.length - 1, 'aria-label': `Move choice ${m} down`, onclick: () => move(k + 1) }, '↓'), ' ',
        h('button', { type: 'button', class: 'lnk danger', 'aria-label': `Remove choice ${m}`,
          onclick: () => ctx.commitAndRender({ type: 'deleteChoice', p, t, q: i, c: k }) }, '✕')));
  });
  const known = choices.some((c) => c.id === q.correct);
  return [
    h('div', { class: 'row', style: 'margin-bottom:3px' }, h('span', { class: 'muted' }, '● marks the correct choice · id · text')),
    h('div', { role: 'radiogroup', 'aria-label': `Question ${n} correct choice`, 'data-path': `${path}.correct`, tabindex: '-1' },
      h('div', { 'data-path': `${path}.choices` }, ...rows)),
    known ? null : h('p', { class: 'sev', style: 'margin:2px 0' }, `The correct choice “${q.correct ?? ''}” is not one of the choices.`),
    h('button', { type: 'button', class: 'lnk', onclick: () => ctx.commitAndRender({ type: 'addChoice', p, t, q: i }) }, '+ Choice'),
  ];
}
