// The edits the editor core applies. No DOM.
//
// EDITS maps an edit's type to a pure function (doc, edit) -> doc that returns a new document
// and never changes the one it was given (documents are frozen, so a slip throws). Return the
// same doc for an edit that changes nothing, so it makes no undo step. Build copies with object
// spread ({ ...task, title }) or the helpers below: spread carries the encoding record
// (encoding.js), so an edited object keeps the encoding of the fields it already had.
//
// To add an edit kind, add an entry here and a case to tests/unit/editor/core.test.js.

import { STATES, LIST_OF, exposureState } from './exposure.js';
import { ENCODING } from './encoding.js';
import { nodeAt, replaceAt, withFields } from './condition-model.js';

export const EDITS = {
  // { type: 'setActivityField', field: 'title' | 'course' | 'version' | 'notes', value }
  // An empty course or notes (or an undefined value) removes the field from the file.
  setActivityField(doc, { field, value }) {
    if (!ACTIVITY_FIELDS.includes(field)) throw new Error(`setActivityField can't set the Activity's "${field}" field`);
    const v = OPTIONAL_TEXT.includes(field) && value === '' ? undefined : value;
    return withField(doc, field, v);
  },

  // { type: 'addPart', title, mode } appends a Part with no Setup and no Tasks. Its id is a slug
  // of the title, unique among the Activity's Parts; retitling never changes it.
  addPart(doc, { title, mode }) {
    const parts = partsOf(doc);
    const part = { id: slug(title, parts.map((p) => p.id)), title, mode, setup: {}, tasks: [] };
    return { ...doc, parts: [...parts, part] };
  },

  // { type: 'setPartField', p, field: 'title' | 'mode' | 'notes', value } on Part p. Empty notes
  // (or an undefined value) remove the field. The id is not a field this edit sets.
  setPartField(doc, { p, field, value }) {
    if (!PART_FIELDS.includes(field)) throw new Error(`setPartField can't set a Part's "${field}" field`);
    const v = field === 'notes' && value === '' ? undefined : value;
    return withPart(doc, p, (part) => withField(part, field, v));
  },

  // { type: 'movePart', p, to } moves Part p to index to; an index outside the list changes nothing.
  movePart(doc, { p, to }) {
    const parts = partsOf(doc);
    if (!(p in parts) || !(to in parts) || p === to) return doc;
    const out = parts.filter((_, i) => i !== p);
    out.splice(to, 0, parts[p]);
    return { ...doc, parts: out };
  },

  // { type: 'deletePart', p } removes Part p and its Tasks.
  deletePart(doc, { p }) {
    const parts = partsOf(doc);
    if (!(p in parts)) return doc;
    return { ...doc, parts: parts.filter((_, i) => i !== p) };
  },

  // { type: 'setSetupValue', p, key, value } types one Setup value (a Setup key or a Setup
  // option) on Part p; an undefined value clears it, so the Tool's default applies.
  setSetupValue(doc, { p, key, value }) {
    return withPart(doc, p, (part) => withField(part, 'setup', withField(setupOf(part), key, value)));
  },

  // { type: 'captureSetup', p, setupKeys, snapshot } is Capture: the live Tool's State
  // (snapshot) at Part p's Mode, whose Setup keys are setupKeys (Tool info). It stores exactly
  // those keys from the snapshot and leaves every other Setup value (Setup options) as it was.
  captureSetup(doc, { p, setupKeys, snapshot }) {
    return withPart(doc, p, (part) => {
      let setup = setupOf(part);
      for (const key of setupKeys) if (Object.hasOwn(snapshot, key)) setup = withField(setup, key, snapshot[key]);
      return withField(part, 'setup', setup);
    });
  },

  // ── Tasks (each edit names its Part p and, but for addTask, its Task t) ──

  // { type: 'addTask', p, title, at? } inserts a Task at index at (the end by default) with an
  // empty prompt and 1 point. Its id is a slug of the title (tags stripped), unique in the Part.
  addTask(doc, { p, title, at }) {
    return withPart(doc, p, (part) => {
      const tasks = tasksOf(part);
      const task = { id: slug(stripTags(title), tasks.map((x) => x.id), 'task'), title, prompt: '', points: 1 };
      const i = Number.isInteger(at) && at >= 0 && at <= tasks.length ? at : tasks.length;
      return { ...part, tasks: [...tasks.slice(0, i), task, ...tasks.slice(i)] };
    });
  },

  // { type: 'setTaskField', p, t, field: 'title' | 'prompt' | 'points' | 'notes', value }. Empty
  // notes (or an undefined value) remove the field. The id is renamed with setTaskId.
  setTaskField(doc, { p, t, field, value }) {
    if (!TASK_FIELDS.includes(field)) throw new Error(`setTaskField can't set a Task's "${field}" field`);
    const v = field === 'notes' && value === '' ? undefined : value;
    return withTask(doc, p, t, (task) => withField(task, field, v));
  },

  // { type: 'setTaskId', p, t, id } renames a Task's id by hand. That drops students' progress on
  // the Task in Runs already started (the page warns); a duplicate is the runner's problem.
  setTaskId(doc, { p, t, id }) {
    return withTask(doc, p, t, (task) => withField(task, 'id', id));
  },

  // { type: 'moveTask', p, t, to } moves Task t to index to; an index outside the list changes nothing.
  moveTask(doc, { p, t, to }) {
    return withPart(doc, p, (part) => {
      const tasks = tasksOf(part);
      if (!(t in tasks) || !(to in tasks) || t === to) return part;
      const out = tasks.filter((_, i) => i !== t);
      out.splice(to, 0, tasks[t]);
      return { ...part, tasks: out };
    });
  },

  // { type: 'duplicateTask', p, t } inserts a copy after Task t with a new id (a slug of its id,
  // unique in the Part). The copy keeps the original's encoding records.
  duplicateTask(doc, { p, t }) {
    return withPart(doc, p, (part) => {
      const tasks = tasksOf(part);
      if (!(t in tasks)) return part;
      const copy = { ...tasks[t], id: slug(tasks[t].id ?? tasks[t].title, tasks.map((x) => x.id), 'task') };
      return { ...part, tasks: [...tasks.slice(0, t + 1), copy, ...tasks.slice(t + 1)] };
    });
  },

  // { type: 'deleteTask', p, t } removes Task t.
  deleteTask(doc, { p, t }) {
    return withPart(doc, p, (part) => {
      const tasks = tasksOf(part);
      return t in tasks ? { ...part, tasks: tasks.filter((_, i) => i !== t) } : part;
    });
  },

  // { type: 'setHint', p, t, hint } sets the whole Hint ({ after, text }), or removes it (undefined).
  setHint(doc, { p, t, hint }) {
    return withTask(doc, p, t, (task) => withField(task, 'hint', hint));
  },

  // { type: 'setHintField', p, t, field: 'after' | 'text', value } on an existing Hint. The Hint
  // object keeps its encoding record, so an encoded text is encoded again on save.
  setHintField(doc, { p, t, field, value }) {
    if (!HINT_FIELDS.includes(field)) throw new Error(`setHintField can't set a Hint's "${field}" field`);
    return withTask(doc, p, t, (task) => {
      if (!task.hint || typeof task.hint !== 'object') throw new Error(`Task ${t} of Part ${p} has no Hint`);
      return withField(task, 'hint', withField(task.hint, field, value));
    });
  },

  // { type: 'setExposure', p, t, control, state: 'open' | 'locked' | 'hidden' } makes control's
  // effective state at Task t be state, rewriting Task t's show, lock and hide lists minimally:
  // the id leaves all three, then goes into one only when state differs from what it inherits
  // from Task t-1. A list left empty is removed. Later Tasks' lists are untouched (their
  // effective states follow from carry-over).
  setExposure(doc, { p, t, control, state }) {
    if (!STATES.includes(state)) throw new Error(`"${state}" is not an exposure state`);
    const inherited = exposureState(doc, p, t - 1, control);
    return withTask(doc, p, t, (task) => {
      const named = EXPOSURE_LISTS.filter((k) => Array.isArray(task[k]) && task[k].includes(control));
      const want = state === inherited ? [] : [LIST_OF[state]];
      if (named.join() === want.join() && (!want.length || task[want[0]].filter((x) => x === control).length === 1)) return task;
      let out = withoutControl(task, control);
      if (want.length) out = withField(out, want[0], [...(Array.isArray(out[want[0]]) ? out[want[0]] : []), control]);
      return out;
    });
  },

  // { type: 'clearExposure', p, t, control } takes control out of Task t's lists (an unknown
  // Control's Remove), so it inherits again.
  clearExposure(doc, { p, t, control }) {
    return withTask(doc, p, t, (task) => withoutControl(task, control));
  },

  // ── Questions (each edit names its Part p, Task t and, but for addQuestion, Question q) ──
  // A field a Question gains takes its place in QUESTION_KEYS order (the files' order); fields
  // it has keep theirs, so an unchanged Question saves byte for byte.

  // { type: 'addQuestion', p, t, kind: 'numeric' | 'choice' | 'text', prompt, at? } inserts a
  // Question (at the end by default) worth 1 point. Its id is a slug of the prompt (tags
  // stripped), unique in the Task, and never changes after. A numeric one starts with a 2%
  // tolerance and no answer; a choice one with two empty choices, a correct.
  addQuestion(doc, { p, t, kind, prompt = '', at }) {
    if (!Object.hasOwn(KIND_FIELDS, kind)) throw new Error(`"${kind}" is not a Question kind`);
    return withTask(doc, p, t, (task) => {
      const list = questionsOf(task);
      const q = withKind({ id: slug(stripTags(prompt), list.map((x) => x.id), 'question'), kind, prompt, points: 1 }, kind);
      const i = Number.isInteger(at) && at >= 0 && at <= list.length ? at : list.length;
      return withField(task, 'questions', [...list.slice(0, i), q, ...list.slice(i)]);
    });
  },

  // { type: 'setQuestionField', p, t, q, field, value }: prompt, points, answer (a number or
  // { expr }), tol, relTol, modulus or correct (a choice id). undefined removes the field.
  setQuestionField(doc, { p, t, q, field, value }) {
    if (!QUESTION_FIELDS.includes(field)) throw new Error(`setQuestionField can't set a Question's "${field}" field`);
    return withQuestion(doc, p, t, q, (question) => withQuestionField(question, field, value));
  },

  // { type: 'setQuestionValues', p, t, q, values: { [field]: value } } sets several fields as one
  // edit: a tolerance preset ({ tol, relTol, modulus }) or the tolerance field ({ tol, relTol }).
  setQuestionValues(doc, { p, t, q, values }) {
    for (const field of Object.keys(values)) {
      if (!QUESTION_FIELDS.includes(field)) throw new Error(`setQuestionValues can't set a Question's "${field}" field`);
    }
    return withQuestion(doc, p, t, q, (question) => Object.entries(values).reduce((out, [k, v]) => withQuestionField(out, k, v), question));
  },

  // { type: 'setQuestionKind', p, t, q, kind } drops the old kind's fields and gives the new
  // kind's starting fields (as addQuestion); id, prompt and points stay.
  setQuestionKind(doc, { p, t, q, kind }) {
    if (!Object.hasOwn(KIND_FIELDS, kind)) throw new Error(`"${kind}" is not a Question kind`);
    return withQuestion(doc, p, t, q, (question) => {
      if (question.kind === kind) return question;
      let out = withField(question, 'kind', kind);
      for (const k of Object.values(KIND_FIELDS).flat()) out = withField(out, k, undefined);
      return withKind(out, kind);
    });
  },

  // { type: 'moveQuestion', p, t, q, to }; an index outside the list changes nothing.
  moveQuestion(doc, { p, t, q, to }) {
    return withTask(doc, p, t, (task) => withField(task, 'questions', moved(questionsOf(task), q, to)));
  },

  // { type: 'deleteQuestion', p, t, q }; the last one taken takes the empty list with it.
  deleteQuestion(doc, { p, t, q }) {
    return withTask(doc, p, t, (task) => {
      const list = questionsOf(task);
      if (!(q in list)) return task;
      const rest = list.filter((_, i) => i !== q);
      return withField(task, 'questions', rest.length ? rest : undefined);
    });
  },

  // { type: 'addChoice', p, t, q, text? } appends a choice whose id is the first free letter.
  addChoice(doc, { p, t, q, text = '' }) {
    return withQuestion(doc, p, t, q, (question) => {
      const list = choicesOf(question);
      const ids = list.map((c) => c.id);
      const id = [...'abcdefghijklmnopqrstuvwxyz'].find((x) => !ids.includes(x)) ?? slug('choice', ids, 'choice');
      return withQuestionField(question, 'choices', [...list, { id, text }]);
    });
  },

  // { type: 'setChoiceField', p, t, q, c, field: 'id' | 'text', value }. Renaming the correct
  // choice's id renames correct with it.
  setChoiceField(doc, { p, t, q, c, field, value }) {
    if (!CHOICE_FIELDS.includes(field)) throw new Error(`setChoiceField can't set a choice's "${field}" field`);
    return withQuestion(doc, p, t, q, (question) => {
      const list = choicesOf(question);
      if (!list[c]) throw new Error(`Question ${q} has no choice ${c}`);
      let out = withField(question, 'choices', withItem(list, c, withField(list[c], field, value)));
      if (field === 'id' && question.correct === list[c].id) out = withField(out, 'correct', value);
      return out;
    });
  },

  // { type: 'moveChoice', p, t, q, c, to }; an index outside the list changes nothing.
  moveChoice(doc, { p, t, q, c, to }) {
    return withQuestion(doc, p, t, q, (question) => withField(question, 'choices', moved(choicesOf(question), c, to)));
  },

  // { type: 'deleteChoice', p, t, q, c }. correct is left as it is (a problem if it named this one).
  deleteChoice(doc, { p, t, q, c }) {
    return withQuestion(doc, p, t, q, (question) => {
      const list = choicesOf(question);
      return c in list ? withField(question, 'choices', list.filter((_, i) => i !== c)) : question;
    });
  },

  // ── Conditions (paths as in condition-model.js: [] is the Task's whole Condition) ──

  // { type: 'setConditionNode', p, t, path, node } replaces the Condition node at path; node
  // undefined removes it (from its group, or the Task's Condition at []). A new Condition takes
  // the default encoding (the whole Condition encoded), an existing one keeps its record.
  setConditionNode(doc, { p, t, path, node }) {
    return withTask(doc, p, t, (task) => withField(task, 'condition', replaceAt(task.condition, path, node)));
  },

  // { type: 'setConditionFields', p, t, path, fields } sets fields of the node at path
  // (undefined removes one). A key replacing a removed one keeps its place (tol -> relTol).
  setConditionFields(doc, { p, t, path, fields }) {
    return withTask(doc, p, t, (task) => {
      const node = nodeAt(task.condition, path);
      if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error(`No Condition at ${path.join('.')}`);
      return withField(task, 'condition', replaceAt(task.condition, path, withFields(node, fields)));
    });
  },
};

const QUESTION_KEYS = ['id', 'kind', 'prompt', 'choices', 'correct', 'answer', 'tol', 'relTol', 'modulus', 'points'];
const QUESTION_FIELDS = ['prompt', 'points', 'answer', 'tol', 'relTol', 'modulus', 'correct'];
const CHOICE_FIELDS = ['id', 'text'];
const KIND_FIELDS = { numeric: ['answer', 'tol', 'relTol', 'modulus'], choice: ['choices', 'correct'], text: [] };
const questionsOf = (task) => (Array.isArray(task.questions) ? task.questions : []);
const choicesOf = (q) => (Array.isArray(q.choices) ? q.choices : []);

// question with the starting fields of kind added.
function withKind(question, kind) {
  if (kind === 'numeric') return withQuestionField(question, 'relTol', 0.02);
  if (kind === 'choice') {
    return withQuestionField(withQuestionField(question, 'choices', [{ id: 'a', text: '' }, { id: 'b', text: '' }]), 'correct', 'a');
  }
  return question;
}

// withField, but a key the Question doesn't have yet goes in QUESTION_KEYS order.
function withQuestionField(question, key, value) {
  if (value === undefined || Object.hasOwn(question, key)) return withField(question, key, value);
  const rank = QUESTION_KEYS.indexOf(key);
  const entries = Object.entries(question);
  const i = entries.findIndex(([k]) => QUESTION_KEYS.indexOf(k) > rank);
  if (i < 0) return { ...question, [key]: value };
  entries.splice(i, 0, [key, value]);
  const out = Object.fromEntries(entries);
  if (question[ENCODING]) out[ENCODING] = question[ENCODING];
  return out;
}

// list with item i moved to index to; list itself when either is out of range.
function moved(list, i, to) {
  if (!(i in list) || !(to in list) || i === to) return list;
  const out = list.filter((_, j) => j !== i);
  out.splice(to, 0, list[i]);
  return out;
}

// doc with Question q of Task t of Part p replaced by change(question).
function withQuestion(doc, p, t, q, change) {
  return withTask(doc, p, t, (task) => {
    const list = questionsOf(task);
    if (!list[q]) throw new Error(`Task ${t} of Part ${p} has no Question ${q}`);
    const next = withItem(list, q, change(list[q]));
    return next === list ? task : { ...task, questions: next };
  });
}

const TASK_FIELDS = ['title', 'prompt', 'points', 'notes'];
const HINT_FIELDS = ['after', 'text'];
const EXPOSURE_LISTS = ['show', 'lock', 'hide'];
const tasksOf = (part) => (Array.isArray(part.tasks) ? part.tasks : []);
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '');

// doc with Task t of Part p replaced by change(task).
function withTask(doc, p, t, change) {
  return withPart(doc, p, (part) => {
    const tasks = tasksOf(part);
    if (!tasks[t]) throw new Error(`There is no Task ${t} in Part ${p}`);
    const next = withItem(tasks, t, change(tasks[t]));
    return next === tasks ? part : { ...part, tasks: next };
  });
}

// task without control in any exposure list; a list left empty is removed.
function withoutControl(task, control) {
  let out = task;
  for (const k of EXPOSURE_LISTS) {
    if (!Array.isArray(out[k]) || !out[k].includes(control)) continue;
    const rest = out[k].filter((x) => x !== control);
    out = withField(out, k, rest.length ? rest : undefined);
  }
  return out;
}


const setupOf = (part) => (part.setup && typeof part.setup === 'object' && !Array.isArray(part.setup) ? part.setup : {});

const PART_FIELDS = ['title', 'mode', 'notes'];

// doc with Part p replaced by change(part); doc itself when Part p is missing or unchanged.
function withPart(doc, p, change) {
  const parts = partsOf(doc);
  if (!parts[p]) throw new Error(`There is no Part ${p}`);
  const next = withItem(parts, p, change(parts[p]));
  return next === parts ? doc : { ...doc, parts: next };
}

const ACTIVITY_FIELDS = ['title', 'course', 'version', 'notes'];
const OPTIONAL_TEXT = ['course', 'notes'];

const partsOf = (doc) => (Array.isArray(doc.parts) ? doc.parts : []);

// An id made from a title: lower case, runs of anything but letters and digits made one '-',
// with -2, -3, ... added until it is not in taken. 'part' when the title has nothing to use.
export function slug(title, taken = [], fallback = 'part') {
  const base = String(title ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

// A copy of obj with key set to value (removed when value is undefined); obj itself when nothing
// changes. Keeps the key's place in the object and its encoding record.
export function withField(obj, key, value) {
  if (value === undefined ? !Object.hasOwn(obj, key) : obj[key] === value) return obj;
  const out = { ...obj, [key]: value };
  if (value === undefined) delete out[key];
  return out;
}

// A copy of list with item i replaced.
export function withItem(list, i, item) {
  if (list[i] === item) return list;
  return list.map((x, j) => (j === i ? item : x));
}

export function applyEdit(doc, edit) {
  const fn = Object.hasOwn(EDITS, edit?.type) ? EDITS[edit.type] : null;
  if (!fn) throw new Error(`Unknown edit "${edit?.type}"`);
  return deepFreeze(fn(doc, edit));
}

// Freeze every object not yet frozen; parts shared with the previous document already are.
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  return value;
}
