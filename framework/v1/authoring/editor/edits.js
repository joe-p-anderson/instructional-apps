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
};

const ACTIVITY_FIELDS = ['title', 'course', 'version', 'notes'];
const OPTIONAL_TEXT = ['course', 'notes'];

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
