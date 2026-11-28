# 14: Preview

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** From the editor the instructor previews the unsaved Activity in the real runner, in a pane or a new tab. The preview is a throwaway Run: autosave is off, it runs under a preview Activity id, and it never touches a student's Run in the same browser. The instructor can start at any Part and Task, with the earlier Tasks treated as passed. That uses a preview-only runner option that marks them passed without Attempts, and it never appears in a student's Run or a Report. While the runner would reject the Activity, the preview refuses to start and says why.

**Blocked by:** 10

**Status:** resolved

- [x] The preview runs the editor's current, unsaved Activity
- [x] It writes nothing to browser storage and leaves any existing Run of that Activity untouched
- [x] Starting at a chosen Part and Task opens it with every earlier Task shown as passed
- [x] The preview-only start option can't be reached from an Activity page; a runner unit test shows that a normal Run ignores it
- [x] With a validation problem, the preview button explains why it won't start
- [x] A Playwright journey: open the preview at Part 2, Task 3 of an Activity, Submit there, and check that no Run was saved

## Comments

Built on branch `ae-14`.

- **Runner option.** `framework/v1/runner/preview.js` exports `PREVIEW_START`, a Symbol. `createRunner(activity, { tools, [PREVIEW_START]: { partId, taskId } })` marks every Task of the earlier Parts, and the earlier Tasks of that Part, passed with no Attempts; `start()` (like `restore()`) now replays exposure up to the first unpassed Task. Being a Symbol, it can't come from an Activity file, a URL or a string option, and no Activity page or the page template imports it (`tests/unit/runner/preview-start.test.js`, which also shows a normal Run ignores `previewStart`/`startAt` fields and options, and that a preview's save and Report carry no passes). `mountActivity` passes the option through and opens that Part.
- **Plan (no DOM).** `editor/preview.js` `planPreview(editor, { p, t }, toolInfo)` → `{ blockers, activity, start }`: blockers are problems of source `runner`, `modes` or `controls` (each would make the runner or Tool refuse), or a Part with no Tasks; the activity is `editor.preview()` under id `<id>~preview`. Tests: `tests/unit/editor/preview.test.js`.
- **Launcher.** `editor/preview-launcher.js`: the header's "Preview ▾" popover (`group` "Preview the unsaved Activity", comboboxes "Start at Part"/"Start at Task", defaulting to the selection when opened), the reason as a `role=alert` line and the button's `title`, and "Preview here" (a modal `dialog` "Preview" with an iframe, "Close preview") / "In a new tab". The page calls `previewLauncher.refresh()` from `refresh()`; a tool load error also blocks.
- **Preview page.** `authoring/preview.html` + `editor/preview-page.js`: reads plan `?run=n` from `window.activityEditorPreviews` on its opener or parent (a reload, e.g. Start over, reads it again), imports the Tool module with its `conditionTypes`, and mounts with an in-memory Storage pre-seeded with the name "Instructor preview" (no name gate, nothing reaches localStorage; the save status is hidden). Opened on its own it says there is nothing to preview.
- **e2e:** `tests/e2e/activity-editor-preview.spec.js` (the Part 2, Task 3 journey in a new tab with a student's Run seeded and checked unchanged; the pane; the blocked launcher; an Activity page ignoring the query; the bare page).
