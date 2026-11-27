# 04: JSON Activity format, with oscilloscope as the first migration

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Activities can be stored as plain JSON (ADR 0004). This ticket adds:
- the single Activity page template, which fetches the Activity's JSON and mounts the runner;
- the optional `notes` field on the Activity, each Part and each Task, which the runner ignores;
- the one-off migration script, which imports an Activity module and writes its data as JSON with constants and spreads expanded and encoded strings copied as they are.

The oscilloscope Activity ("phase / period and amplitude") is migrated first, as the tracer.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The runner's validation accepts `notes` on the Activity, Parts and Tasks; `notes` is never shown to students and never in the Report
- [ ] The page template loads the JSON beside it and calls `mountActivity` exactly as the hand-written pages did
- [ ] The migration script writes JSON with a fixed key order and two-space indent
- [ ] The oscilloscope Activity is a JSON file beside its page; its header comment is in its `notes`; its old module is deleted
- [ ] Its URL, its Activity id and its Part and Task ids are unchanged, so Runs in progress survive
- [ ] Its unit test reads the JSON, with no other change to its assertions; its e2e spec, display-fit and the other cross-Tool e2e checks pass unchanged
- [ ] The framework README's "Opening an Activity" section describes the JSON format and the template
