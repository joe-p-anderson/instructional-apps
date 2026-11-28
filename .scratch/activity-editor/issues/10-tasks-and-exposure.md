# 10: Tasks and their Controls

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The instructor edits a Part's Tasks: add, retitle, reorder, duplicate and delete, with points, a Hint (its text and the failed-Attempt count it appears after) and notes. On each Task, every Control of the Mode, including revealable layers, is listed under its label with its effective state at that Task (open, locked or hidden), as a three-way switch. Each is marked as changed here or inherited. Flipping a switch makes the editor core rewrite that Task's show, lock and hide lists minimally. Flipping it back to the inherited state removes the Control from them. The live Tool shows the student's view of the selected Task by default, with a Student / Full toggle (spec, "Editor page"). The carry-over follows exactly the runner's rule (show opens, lock shows and locks, hide hides, applied in Task order).

**Blocked by:** 08

**Status:** resolved

- [x] The Task form uses the tabs from the spec's "Editor page" layout (Prompt, Exposure, Condition, Questions, Hint & notes). Each tab shows its problem count, and the open tab is remembered between Tasks. Tickets 11 to 13 fill the Condition, Questions and prose tabs
- [x] Tasks can be added, retitled, reordered, duplicated and deleted; ids come from the title, unique within the Part, and stay frozen on retitle
- [x] Renaming an id by hand warns that it drops student progress on that Task
- [x] Points, the Hint and notes can be edited
- [x] The effective exposure the editor core computes matches the runner's carry-over at every Task of all 5 Activities (unit test)
- [x] Setting a Control writes minimal lists, and setting it back to its inherited state removes it from them (unit test)
- [x] Changing a Control at an early Task updates the effective states shown on later Tasks
- [x] A Control id that the Mode doesn't have shows in the problems list
- [x] The live Tool has a Student / Full toggle. Student is the default on a Task and applies that Task's effective exposure (locked, hidden, including layers), and it updates as soon as a switch is flipped. Full opens every Control. With an Activity or Part selected, the Tool is always Full
- [x] A Playwright journey: lock a Control at Task 1, see it locked and inherited at Task 3, open it at Task 3, save, and check the lists in the JSON

## Comments

Built on branch `ae-10`.

**Core (no DOM).**
- `editor/exposure.js`: `effectiveExposure(doc, p, t, toolInfo?)` → `{ [controlId]: { state, from, here } }` (the Mode's Controls in Tool-info order, then any other id Tasks 0..t name), and `exposureState(doc, p, t, id)`. It follows `applyExposure` exactly; t = -1 is "before the first Task".
- `edits.js` gains the Task edits: `addTask` (`{ p, title, at? }`; id = `slug(title with tags stripped, …, 'task')`; `prompt: ''`, `points: 1`), `setTaskField` (`title`, `prompt`, `points`, `notes`; empty notes remove the key), `setTaskId` (the hand rename), `moveTask` (`{ p, t, to }`), `duplicateTask` (inserted after, id `<id>-2`…; the copy keeps its encoding records), `deleteTask`, `setHint` (`{ p, t, hint }`, undefined removes it), `setHintField` (`after` | `text`, keeps the Hint's encoding record), `setExposure` (`{ p, t, control, state }`: the id leaves all three lists, then joins one only when the state differs from Task t-1's; an empty list is removed; asking for what is already minimal is no change), and `clearExposure` (`{ p, t, control }`, the unknown Control's Remove). The private helper `withTask(doc, p, t, change)` is the pattern for 11-13's edits.
- `problems.js` `CHECKS` gains `controls`: an id in a show/lock/hide list that is not a Control of the Mode, at path `['parts', p, 'tasks', t, list, i]`.
- Tests: `tests/unit/editor/tasks.test.js`. The carry-over test restores a runner Run with Tasks 0..t-1 passed (so the runner replays exposure) on stub Tools, at every Task of all 5 Activities. `parts.test.js`'s fixture Tool info now lists the real Controls.

**Page.**
- `taskForm` (page.js) draws a header (title, crumb, Move up/down, Duplicate Task, Delete Task) and hands the rest to `editor/task-form.js`. The outline has a "+ Task" per Part (accessible name `Add a Task to Part N`).
- Page state: `taskTab` (the open tab, kept between Tasks; set from the problem path in `jumpTo` before the focus step) and `studentView`.
- The live Tool: `applyView()` runs after every `renderRight`. It applies the Student view (the selected Task's effective exposure: `hide()`, or `show()` then `lock()`/`unlock()`) or Full in place, without remounting, and only when the states change (`live.viewKey`). The Student / Full toggle (`group` "Live Tool view") is in `.ed-live-head`. It is disabled, and the Tool is Full, unless a Task of the shown Part is selected. Student comes back whenever the selection changes. The toggle never edits the Activity.
- Prompt tab: Title, Points, Id with "Rename id…", which opens a field with the warning (`role=alert`) and Rename/Cancel. Exposure tab: one row per Control (`tr[data-control]`; the switch is `group` "<label>: state at this Task" with Open/Locked/Hidden `aria-pressed` buttons), a "changed here" / "inherited from Task p.t" / "inherited: default" badge, an All / Changed here filter, and rows for unknown ids with Remove. Layers are listed like any other Control (they are Controls); no Inputs/Layers grouping, since only phasors declares layers.

**Extension points for 11-14.**
- **The tab registry is `TASK_TABS` in `editor/task-form.js`.** Each tab is its own module under `editor/tabs/` and exports `{ id, label(ctx), owns(rest), render(ctx) }`. `rest` is the problem path below the Task. A problem belongs to the first tab that owns it, otherwise to Prompt, and that drives both the tab counts and `jumpTo`'s tab switch.
- **Each later ticket replaces one module's body and touches no other tab:**
  - 11 replaces `tabs/condition.js` (now a read-only JSON placeholder; it owns `condition`).
  - 12 replaces `tabs/questions.js` (now a read-only list; it owns `questions`; its label shows the count).
  - 13 replaces `editor/prose.js`'s `proseField(ctx, { label, path, value, toEdit, rows })` (now a plain textarea). The Prompt tab (prompt) and the Hint tab (Hint text) already call it, and 12 should call it for Question prompts and choice texts. So 12 and 13 meet only at that function's signature.
- **The `ctx` every tab gets** (documented in task-form.js's header): `editor`, `doc`, `p`, `t`, `part`, `task`, `base` (the data-path prefix), `tool`, `toolError`, `mode` (Tool info for the Part's Mode or null), this tab's `problems`, `commit`, `commitAndRender`, `field`, `section`, `onLive(fn)` (a liveUpdater, re-run on every mount and State change: for 11's live result and "Use current value", and 12's live values), `liveInstance()`, `exposure()`, `rerender()` and `setHeading(html)`. Tag every field with `data-path` = `${base}.…` so problems jump to it.
- **14 (preview)** doesn't touch the tabs. The Task selection is `sel` (`{ kind: 'task', p, t }`) in page.js, if the launcher wants to default to it.
- **e2e:** shared helpers are in `tests/e2e/helpers/activity-editor.js` (`openEditor`, `openActivity`, `written`, `save`, `outline`, `liveTool`, …), and this ticket's tests are in their own `tests/e2e/activity-editor-tasks.spec.js`. 11-14 should add their own spec files the same way, so they don't collide at the end of `activity-editor.spec.js`. Wait for the `Live Tool ·` heading before typing: the Tool's arrival redraws the form (08 behaviour).
