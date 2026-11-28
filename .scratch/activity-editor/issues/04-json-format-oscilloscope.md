# 04: JSON Activity format, with oscilloscope as the first migration

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Activities can be stored as plain JSON (ADR 0004). This ticket adds:
- the single Activity page template, which fetches the Activity's JSON and mounts the runner;
- the optional `notes` field on the Activity, each Part and each Task, which the runner ignores;
- the one-off migration script, which imports an Activity module and writes its data as JSON with constants and spreads expanded and encoded strings copied as they are.

The oscilloscope Activity ("phase / period and amplitude") is migrated first, as the tracer.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The runner's validation accepts `notes` on the Activity, Parts and Tasks; `notes` is never shown to students and never in the Report
- [x] The page template loads the JSON beside it and calls `mountActivity` exactly as the hand-written pages did
- [x] The migration script writes JSON with a fixed key order and two-space indent
- [x] The oscilloscope Activity is a JSON file beside its page; its header comment is in its `notes`; its old module is deleted
- [x] Its URL, its Activity id and its Part and Task ids are unchanged, so Runs in progress survive
- [x] Its unit test reads the JSON, with no other change to its assertions; its e2e spec, display-fit and the other cross-Tool e2e checks pass unchanged
- [x] The framework README's "Opening an Activity" section describes the JSON format and the template

## Comments

Built on branch `ae-04`. `framework/v1/activity-file.js` (no DOM) holds the format: `serializeActivity` (saved form: fixed `KEY_ORDER`, two-space indent, final newline; throws on functions/NaN instead of dropping them) and `activityPage({ title, tool, file })`, the single page template (imports `../<tool>.js` and its optional `conditionTypes` export, fetches the JSON, calls `mountActivity`). `scripts/migrate-activity.js <module.js>...` writes `<name>.json` (header comment into `notes`, hand-check afterwards) and `<name>.html` beside any Activity module; it leaves the module for you to delete. `validateActivity` accepts string `notes` on Activity, Parts and Tasks. Oscilloscope migrated: header comment in the Activity's notes, the φ-readout remark in Part 1's notes. `tests/unit/framework/activity-files.test.js` checks every `tools/*/activities/*.json` is in saved form beside a template page with no module left; `.gitattributes` keeps those files LF. The encode-keys e2e check, the layouts fixture and the themes prototype now read the JSON.
