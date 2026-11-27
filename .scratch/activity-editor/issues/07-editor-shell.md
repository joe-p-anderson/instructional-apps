# 07: Editor shell: open, outline, save

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The first working Activity editor, built to the approved mockup (ticket 01).
- **Folder:** the instructor grants the repo folder once, in Chrome or Edge, and it is remembered between visits.
- **Open:** the Open screen (spec, "Editor page") lists every Activity. It is searchable, filterable by course and Tool, and sorted by last modified, with recents pinned at the top. It opens the chosen Activity into the outline of Parts and Tasks.
- **Edit:** the Activity-level fields (title, course, version, notes) can be edited.
- **Save:** Ctrl+S, or the Save button, writes the JSON back into the checkout.

This ticket creates the DOM-free **editor core**: open (decode every encoded field), edits returning new documents (with undo and redo), save (stable JSON, re-encoded), and problems. It also creates the folder-access interface (list folders, read file, write file), with a Chrome implementation, a download fallback and an in-memory implementation for tests.

**Blocked by:** 01, 06

**Status:** resolved

- [x] The editor page lives with the existing authoring helper in framework v1; it starts the folder grant and remembers the folder handle, asking for permission again when the browser requires it
- [x] The Open screen lists every Activity with its title, id, Tool, course, version and last-modified time. Typing filters on title, id and course. Course and Tool filters work. Recents are pinned and remembered between visits. Opening an Activity shows its outline and the Activity form
- [x] The Open screen appears once the folder is granted, on Ctrl+O, and when the header's Activity title is clicked
- [x] Opening any of the 5 Activities and saving with no edits writes a byte-identical file (editor core unit test)
- [x] Editing title, course, version or notes and saving writes only that change
- [x] Undo and redo work for edits
- [x] Closing or switching Activities with unsaved changes warns first
- [x] Without the File System Access API, save downloads the file
- [x] The problems list shows the runner's own validation errors, each with a path to its field
- [x] A Playwright journey with the in-memory folder: open an Activity, change its title, save, and check the written JSON

## Comments

Built on branch `ae-07`.

**Files.** The page is `framework/v1/authoring/activity-editor.html`; everything else is in `framework/v1/authoring/editor/`:
- `core.js` has no DOM and is the one interface: `openActivity(text)` returns an editor with `doc`, `edit(edit, { group })`, `undo`/`redo`/`canUndo`/`canRedo`, `dirty`, `problems(toolInfo?)`, `preview()`, `serialize()` and `save(write)`. Its header comment documents each one, and the `toolInfo` shape later tickets should build.
- `edits.js` holds `EDITS`, a table of pure `(doc, edit) -> doc` functions, plus the `withField`/`withItem` helpers. Documents are deep-frozen, so an edit that mutates throws. Ticket 07 adds only `setActivityField` (title, course, version, notes). An empty course or notes, or an undefined value, removes the key.
- `encoding.js` decodes on open and re-encodes on save. Each owner object records, under the `ENCODING` symbol, how many times each of its fields was encoded: `task[ENCODING].condition` covers a whole Condition, and `question[ENCODING].answer` and `hint[ENCODING].text` cover single fields; 0 means plain. Object spread carries the record into edited copies, so encoding survives edits and value replacement. A field with no record (on a new object) takes `DEFAULT_ENCODING`: the whole Condition, `answer`, `correct` and Hint `text`, which matches the 5 Activities.
- `problems.js`: `findProblems` is the runner's validation (source `'runner'`) followed by every entry of `CHECKS` (`{ source, run(doc, toolInfo) }`). `CHECKS` is empty in 07.
- `folder.js` defines the folder interface (`name`, `saves: 'folder'|'download'`, `list(path)`, `readFile(path) -> { text, lastModified }`, `writeFile(path, text)`), and `findActivities(folder)` for the Open screen. It has three implementations:
  - `createDirectoryFolder(handle)`: File System Access.
  - `createFileListFolder(files)`: the fallback, an `<input webkitdirectory>` whose writes download the file.
  - `createMemoryFolder(files)`: for tests.
- `page.js` is the page, and `editor.css` holds the mockup's styles, including those for tabs, exposure, the builder, Questions and prose, which later tickets need.

**Runner validation, refactored.** `runner/activity.js` now exports `activityProblems(activity)`. It returns every problem as `{ path, message }`, in the order the old code checked them. `validateActivity` throws `Invalid Activity: <first message>`, so the runner's behaviour and messages are unchanged. `validateCondition(c, fail)` now calls `fail(msg, subpath)`, and the `questionKinds` validators call `fail(msg, field)`. Both remain compatible with a one-argument `fail`. Paths are arrays such as `['parts', 0, 'tasks', 2, 'condition', 'conditions', 1, 'target']`.

**How the page fits together.** `commit(edit, { group })` is the only way the page changes the Activity:
- It applies the edit and calls `refresh()`, which redraws the header, outline, problems and right column, but not the form being typed in.
- `render()` redraws everything after an open, undo, redo or a change of selection.
- Text fields come from `field({ label, path, value, toEdit })`, which makes one undo group per visit to the field and sets a `data-path` such as `parts.0.tasks.1.points`.
- Clicking a problem calls `jumpTo(path)`. That selects the owning Activity, Part or Task and focuses the nearest `[data-path]` on the path. A form only has to tag its fields to become a jump target.
- Folder handle and recents are kept in IndexedDB (`fw1-activity-editor`, store `kv`, keys `folder` and `recents`). The permission state is checked on load, and a "Reconnect to …" button asks for permission again.

**Tests.**
- `tests/unit/editor/core.test.js` covers the byte-identical round trip of all 5 files, decoding, each Activity-field edit writing only its line, undo/redo and groups, dirty state, problems with paths (each checked against the runner's own thrown message), and the preview.
- `tests/unit/editor/folder.test.js` covers the memory folder and `findActivities`.
- `tests/e2e/activity-editor.spec.js` injects the in-memory folder with `page.addInitScript`, setting `window.activityEditorFolder = (folderModule) => folderModule.createMemoryFolder(files)`. It covers:
  - the journey, the Open screen filters, recents, Ctrl+O and the header title, undo/redo, the unsaved-changes warnings and problems;
  - the folder grant, using a `showDirectoryPicker` stub that returns an origin-private (OPFS) directory, so the real `createDirectoryFolder` reads and writes;
  - the download fallback, with the API removed and a real folder passed to `setInputFiles`.
- To read what the page wrote, a test calls `window.activityEditor.folder.readFile(path)`.

**Where later tickets plug in.**
- **08 (Parts, Setup, live Tool):**
  - Add Part edits to `EDITS` (use `withItem`/`withField`). For new Part ids, add a slug helper there; ids are unique within their scope and frozen on retitle.
  - Replace `partForm` in `FORMS` (page.js), and replace `renderRight` with the live Tool.
  - Build `toolInfo` in the page by mounting each Mode, pass it to `editor.problems(toolInfo)` (inside `refresh()`), and append the unknown Mode and Setup checks to `CHECKS`.
- **09 (New Activity):**
  - Add a "New Activity" button to `renderOpen`.
  - Write the JSON (`serializeActivity`) and the page (`activityPage`) with `folder.writeFile`, which creates missing files and folders. A download folder downloads both.
  - Then open the new file with `openPath`.
  - There is still no Tool registry: the Open screen's Tool filter uses the Tool ids found in Activity files.
- **10 (Tasks and exposure):**
  - Add Task edits and set-exposure to `EDITS`, and put the effective-exposure function beside the core. It reads `doc` and `toolInfo`.
  - Replace `taskForm`; the remembered tab lives in page state.
  - Append the unknown-Control check to `CHECKS`.
  - Tag fields with `data-path` so problems jump to them. For tab switching, map a path to a tab before the `jumpTo` focus step.
- **11-13:** a new Condition, answer or Hint gets the default encoding automatically. Keep edits spread-based so existing records survive.
- **14:** `editor.preview()` is the runner's object. A problem with `source === 'runner'` blocks the preview.

Not done here: the outline shows Task titles' `\( \)` math as source, not typeset (13 can typeset it). The editor is not linked from the site index yet.
