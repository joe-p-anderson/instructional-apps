// The editor core: one open Activity, edited as a series of immutable documents. No DOM, no
// files, no live Tool; the page (page.js) and the tests drive it through this interface.
//
// openActivity(text) -> editor      text is the Activity file (JSON); throws if it isn't JSON
//   editor.doc                      the current document: the Activity with every enc1: field
//                                   decoded (Conditions, answers, Hint texts), deeply frozen
//   editor.edit(edit, { group }?)   apply one edit (see EDITS in edits.js); returns the new doc.
//                                   Consecutive edits with the same group (typing in one field)
//                                   make one undo step. An edit that changes nothing is no step.
//   editor.undo() / editor.redo()   -> whether there was a step; canUndo / canRedo
//   editor.dirty                    the doc differs from the last one saved (or opened)
//   editor.problems(toolInfo?)      [{ path, message, source }] (problems.js)
//   editor.preview()                the Activity object for the runner: the file as it would save
//   editor.serialize()              the file text in its saved form, every encoded field encoded
//                                   where it was (encoding.js), so an unchanged file comes back
//                                   byte for byte
//   editor.save(write)              await write(text); the doc written becomes the saved one
//                                   (unless write throws)
//
// toolInfo, for checks against the Tool, is what the page learns by mounting each Mode:
// { modes: { [modeId]: { title, setupKeys, setupOptions, controls: [{ id, label }],
//   state: { [name]: { label, unit } } } } }. The core never mounts anything itself.

import { serializeActivity } from '../../activity-file.js';
import { decodeDocument, encodeDocument } from './encoding.js';
import { applyEdit, deepFreeze } from './edits.js';
import { findProblems } from './problems.js';

export function openActivity(text) {
  let doc = deepFreeze(decodeDocument(JSON.parse(text)));
  let savedDoc = doc;
  const past = []; // [{ doc, group }] the documents before each undo step
  const future = [];
  let lastGroup = null;
  const serialize = () => serializeActivity(encodeDocument(doc));

  return {
    get doc() { return doc; },
    get dirty() { return doc !== savedDoc; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    edit(edit, { group } = {}) {
      const next = applyEdit(doc, edit);
      if (next === doc) return doc;
      if (!(group != null && group === lastGroup && past.length)) past.push(doc);
      future.length = 0;
      lastGroup = group ?? null;
      doc = next;
      return doc;
    },
    undo() {
      if (!past.length) return false;
      future.push(doc);
      doc = past.pop();
      lastGroup = null;
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(doc);
      doc = future.pop();
      lastGroup = null;
      return true;
    },

    problems(toolInfo) {
      return findProblems(doc, toolInfo);
    },
    preview() {
      return JSON.parse(serialize());
    },
    serialize,
    async save(write) {
      const writing = doc;
      await write(serialize());
      savedDoc = writing;
      lastGroup = null;
    },
  };
}
