// The edits the editor core applies. No DOM.
//
// EDITS maps an edit's type to a pure function (doc, edit) -> doc that returns a new document
// and never changes the one it was given (documents are frozen, so a slip throws). Return the
// same doc for an edit that changes nothing, so it makes no undo step. Build copies with object
// spread ({ ...task, title }) or the helpers below: spread carries the encoding record
// (encoding.js), so an edited object keeps the encoding of the fields it already had.
//
// To add an edit kind, add an entry here and a case to tests/unit/editor/core.test.js.

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
};

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
