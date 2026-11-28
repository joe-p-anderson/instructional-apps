// Encoded fields for the editor core: decode an Activity on open, remembering exactly where each
// enc1: string was, and encode it again on save in the same places, so an unchanged file comes
// back byte for byte. No DOM.
//
// The record lives on the object that owns the field, under the ENCODING symbol:
//   owner[ENCODING] = { [key]: depth }
// depth is how many times the value at owner[key] was encoded (0 = stored plain, 1 = one enc1:
// string, 2 = an enc1: string whose value was itself an enc1: string). So a whole Condition is
// task[ENCODING].condition, a single answer is question[ENCODING].answer, and a Hint text is
// hint[ENCODING].text. Because the record sits on the owner, it survives the value being
// replaced, and object spread ({ ...task, title }) carries it into the edited copy. JSON
// ignores symbol keys, so the record never reaches the file.
//
// Fields with no record (new objects made by an edit) take DEFAULT_ENCODING: a Task's whole
// Condition, a Question's answer and correct, and a Hint's text are encoded; everything else is
// plain. That is where the five existing Activities encode today.

import { encodeKey, decodeKey, isEncodedKey } from '../../runner/keys.js';

export const ENCODING = Symbol('encoding');

// Which kind of object sits under a key of each kind (lists apply it to every item); the same
// shape as activity-file.js, used to find the defaults below.
const CHILDREN = {
  activity: { parts: 'part' },
  part: { tasks: 'task' },
  task: { hint: 'hint', questions: 'question', condition: 'condition' },
  question: { choices: 'choice' },
  condition: { conditions: 'condition' },
};

export const DEFAULT_ENCODING = {
  task: { condition: 1 },
  question: { answer: 1, correct: 1 },
  hint: { text: 1 },
};

// The parsed file (plain JSON data) -> the decoded document, with encoding records.
export function decodeDocument(value) {
  if (Array.isArray(value)) return value.map(decodeDocument);
  if (!isPlainObject(value)) return value;
  const out = {};
  const record = {};
  for (const [key, raw] of Object.entries(value)) {
    let v = raw;
    let depth = 0;
    while (isEncodedKey(v)) { v = decodeKey(v); depth += 1; }
    record[key] = depth;
    out[key] = decodeDocument(v);
  }
  out[ENCODING] = record;
  return out;
}

// The decoded document -> plain data for the file, every recorded (or default) field encoded.
export function encodeDocument(value, kind = 'activity') {
  if (Array.isArray(value)) return value.map((item) => encodeDocument(item, kind));
  if (!isPlainObject(value)) return value;
  const record = value[ENCODING] ?? {};
  const defaults = DEFAULT_ENCODING[kind] ?? {};
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    let encoded = encodeDocument(v, CHILDREN[kind]?.[key]);
    const depth = record[key] ?? defaults[key] ?? 0;
    for (let i = 0; i < depth; i++) encoded = encodeKey(encoded);
    out[key] = encoded;
  }
  return out;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
