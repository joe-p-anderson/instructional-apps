# 06: Run autosave, restore and Start over

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student's Activity progress survives a reload or a crash mid-lecture, the instructor can edit an Activity without wiping progress on Tasks that still exist, and a student can deliberately start over.

**Blocked by:** 04

**Status:** resolved

- [x] The Run (name, fingerprint, Attempts, per-Part Tool State) autosaves to browser storage keyed by Activity id and restores on load
- [x] On restore after an Activity version change, Attempts for Task ids that still exist are kept; unknown Task ids are dropped
- [x] "Start over", with a confirmation, discards the Run and begins a new one (new name gate, new fingerprint)
- [x] Node test: restore across a version change keeps matching Task ids
- [x] Playwright: a reload restores progress

## Comments

- Built on branch `ticket-06`. Core: `runner.save()` / `runner.restore(saved)` in `framework/v1/runner/index.js`. Restore replays Control exposure up to the first unpassed Task, and a Task counts as passed if any kept Attempt passed. UI: `mountActivity` autosaves on Start, Submit and every Tool State change under `runKey(activity.id)` (`persistence.js`), and restores in place of the name gate.
- "Start over" is a header button behind `window.confirm`. On confirm it clears the saved Run and reloads the page, so the Tools return to their Setup and the name gate shows again. There is no core `startOver()`.
- Tests: `tests/unit/runner/restore.test.js`, `tests/e2e/run-persistence.spec.js`. The stub Tool gained `serialize`/`restore`.
- Merged branch `ticket-06` into `framework-v1` via a non-fast-forward merge commit. No textual conflicts with ticket 08 (encoded keys): `createRunner` decodes before `save()`/`restore()`, so Runs of encoded Activities save and restore; added a unit test for that in `restore.test.js`. `npm test` (63) and `npm run test:e2e` (21) pass.
