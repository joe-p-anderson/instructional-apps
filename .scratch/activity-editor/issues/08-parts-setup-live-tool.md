# 08: Parts, Setup and the live Tool

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The instructor edits Parts in the editor:
- add, retitle, reorder and delete Parts;
- pick each Part's Mode from the Tool's Modes;
- see the real Tool mounted at that Part's Mode and Setup, beside the form.

The Setup can be set by operating the live Tool and clicking Capture, which stores only the Mode's Setup keys (ticket 03) and leaves any Setup option values already in the Setup untouched, or by typing or clearing individual values. Setup options (`setupOptions` on each `modes` entry: Setup values the mount reads that are not State, such as spacetime's `tool` or fourier synthesis's `coefficientTable`) are typed by hand. The editor core gains **Tool info**: Mode ids and titles, Setup keys and Setup options (read from `tool.modes`, no mount needed), Control ids and labels, and State names with labels and units, gathered by mounting each Mode once in a hidden container.

**Blocked by:** 03, 07

**Status:** resolved

- [x] Parts can be added, retitled, reordered and deleted; a new Part's id is a slug of its title, unique in the Activity, and stays frozen on retitle
- [x] The Mode picker offers only the Tool's Modes
- [x] The live Tool remounts when the selected Part, its Mode or its Setup changes; operating it never changes the Activity on its own
- [x] Capture stores exactly the Mode's Setup keys from the live State and leaves existing Setup option values untouched; typed values (Setup keys and Setup options) can be set or cleared one by one
- [x] A Setup value that is neither a Setup key nor a Setup option of the Mode, or an unknown Mode, shows in the problems list
- [x] Editor core unit tests cover Part edits, Capture and the new problems
- [x] A Playwright journey: add a Part, choose its Mode, move a Control on the live Tool, Capture, save, and check the Setup in the JSON

## Comments

Built on branch `ae-08`.

**Core (no DOM).**
- `edits.js` gains `addPart` (`{ title, mode }`, appended with `setup: {}` and `tasks: []`), `setPartField` (`title`, `mode`, `notes`; empty notes remove the key; the id is not settable), `movePart` (`{ p, to }`; an index out of range is no change), `deletePart`, `setSetupValue` (`{ p, key, value }`; undefined clears) and `captureSetup` (`{ p, setupKeys, snapshot }`: writes exactly `setupKeys` from the snapshot, keeps every other Setup value and the Setup's key order, so a Capture diff shows only the changed lines). The Setup keys come from Tool info, passed in by the page; the core still mounts nothing.
- `slug(title, taken, fallback = 'part')` is exported from `edits.js` for 10's new Task and 12's new Question ids (pass `'task'` / `'question'` as the fallback).
- `withPart(doc, p, change)` (module-private in `edits.js`) is the pattern for Task edits: wrap it to reach `part.tasks[t]` with `withItem`.
- `problems.js` `CHECKS` has two entries: `modes` (an unknown Mode, path `['parts', p, 'mode']`) and `setup` (a value in neither list, path `['parts', p, 'setup', key]`; skipped for an unknown Mode). Both return `[]` without Tool info.
- Tests: `tests/unit/editor/parts.test.js` (fixture Tool info objects in the shape below).

**Tool info and the live Tool (`editor/tool-info.js`, needs a DOM).**
- `loadTool(toolId)` resolves to `{ tool, conditionTypes, info }`. It imports `tools/<id>/<id>.js` and is cached per id. `info` is `{ modes: { [modeId]: { title, setupKeys, setupOptions, controls: [{ id, label }], state: { [name]: { label, unit } } } } }`, built by mounting each Mode once off-screen (1200×700, `visibility: hidden`) and then destroying it. `conditionTypes` is already there for 11 and 14.
- `mountLive(container, tool, modeId, setup)` mounts the Tool and shows and unlocks every Control (the Full view). It mounts a clone of the frozen Setup.

**Page (`page.js`).**
- Module state: `tool` (the loaded `{ tool, conditionTypes, info }`, or null while it loads), `toolError`, and `live` = `{ session, tool, p, mode, setup, box, instance, unsub }`. `useTool(session)` loads the Tool on open and calls `render()` when it arrives. `refresh()` passes `tool?.info` to `editor.problems`.
- `renderRight()` remounts only when the session, Tool, Part index, Mode or Setup object (by identity) changes, through `mountRight`. Otherwise it keeps the instance. Either way it then runs `liveUpdaters`.
- **For 10 (Student/Full):**
  - Add the view to that comparison, e.g. a `live.view` key built from the selected Task and its effective exposure. A Control flip changes the Task's lists, not the Setup, so without it the Tool is not remounted. The alternative is to re-apply exposure to `live.instance` in place.
  - Apply exposure right after `mountLive` in `mountRight`.
  - The toggle goes in `.ed-live-head`, beside the `h3`. The "Full view: every Control open." line under it is where the view text goes.
  - The live Tool shows Part `sel.p` for a Task selection too, so it already follows Task selection within a Part.
- `liveUpdaters` (reset in `renderForm`) are form callbacks re-run on every live State change and after each mount. The Setup table's "Live Tool now" cells and the Capture/Reset buttons use them. 11's "Use current value" and live Condition results, and 12's live expression values, can do the same, reading `live.instance.state.snapshot()`.
- `window.activityEditor` also exposes `toolInfo` and `live` (the instance) for tests.
- Other page pieces:
  - `commitAndRender(edit)` is a commit that also redraws the form.
  - The outline ends with a "+ Part" button (`addPart`: the Tool's first Mode, title "Part N: New Part", focused and selected).
  - Move up, Move down and Delete Part are in the Part form. Delete asks first when the Part has Tasks; Undo restores it.
- Setup values are typed as JSON, falling back to text (`setupValue`). Each field's accessible name is `Setup <key>`, and each clear button's is `Clear <key>` (`Remove <key>` for an unknown value).
- `editor.css` adds `.ol-add`, `.ed-live*`, `.ed-tool` (stacks the Tool's Controls above its Display to fit the column), `.right-h` and `.state-tbl`.

**e2e:** 5 new tests at the end of `tests/e2e/activity-editor.spec.js`: the journey, remount behaviour, typed and cleared values with Setup options kept by Capture, reorder and delete, and the problems linking to the Mode field.

Open screen untouched (09 is parallel).
