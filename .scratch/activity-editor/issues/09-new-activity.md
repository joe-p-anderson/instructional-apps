# 09: Create a new Activity

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** From the Open screen (ticket 07) the instructor creates a new Activity: they pick a Tool and give an id, title and course. The editor writes the Activity's JSON and its page from the single template into that Tool's activities folder, then opens it, ready for Parts. The URL has the same shape as every other Activity's, so it can be linked from Brightspace.

**Blocked by:** 07

**Status:** resolved

- [x] The new-Activity form picks from the Tools listed, and needs an id (a slug, offered from the title), a title and a course
- [x] An id already used in that Tool's folder is refused
- [x] Both files are written; the page is identical to every other Activity page from the template
- [x] The new Activity opens in the editor, and its "needs at least one Part" problem shows until a Part is added
- [x] A Playwright journey with the in-memory folder checks both files are written and that the page loads the new Activity

## Comments

Built on branch `ae-09`.

- `framework/v1/tool-list.js` is the shared Tool list (`TOOLS`: `{ id, title }`, the title being the Standalone page's). `tests/unit/framework/tool-list.test.js` keeps it in step with `tools/*/<id>.js` and each `index.html` title. `display-fit.spec.js` and `setup-keys.spec.js` now take their Tool ids from it. A future Tool registry can grow from this module.
- `framework/v1/authoring/editor/new-activity.js` (no DOM): `slugFromTitle`, `newActivityProblems(folder, fields)` (per-field messages; an id is refused if a file of that name or an Activity with that id is already in the Tool's activities folder) and `createActivity(folder, fields)`, which writes `<id>.json` (version 1, `parts: []`) and `<id>.html` from `activityPage`, then returns the JSON path. The id is also the file name. Tests: `tests/unit/editor/new-activity.test.js`.
- `page.js`: the Open screen has a "New Activity…" button that opens an inline form (Tool from the list, Title, Id offered from the title until typed by hand, Course with the known courses as suggestions). Field problems are shown beside each field and wired as its accessible description. Unsaved changes in the open Activity are confirmed before anything is written; `openPath` takes `{ discard }` so it doesn't ask twice. With the download fallback, both files download and the status says to move them into the folder.
- e2e (`tests/e2e/activity-editor.spec.js`): the journey (both files written, page identical to lab10's template output, served at the Activity URL shape, the runner refuses it for no Part and mounts it once Parts are added), the field checks and duplicate id, the unsaved-changes warning, and the download fallback.
