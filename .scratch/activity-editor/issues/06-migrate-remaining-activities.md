# 06: Migrate the other 4 Activities to JSON

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Move electrostatics (conductor properties), spacetime (lab 10), fourier (Fourier series) and phasors (phasors and impedance) to the JSON format with ticket 04's script and page template. After this, every Activity on the site is JSON and no hand-written Activity module remains.

**Blocked by:** 04

**Status:** resolved

- [x] Each of the 4 Activities is a JSON file beside its page from the template; its old module is deleted
- [x] Each one's header comment (its design reasoning) is in its `notes`, moved by hand where the script can't extract it cleanly
- [x] URLs, Activity ids, versions, and Part and Task ids are unchanged; encoded keys are byte-identical to before
- [x] Each Activity's unit test reads the JSON with no other change to its assertions, including the phasors and fourier checks that keys agree with the engine
- [x] Every Activity e2e spec, display-fit and the other cross-Tool e2e checks pass unchanged
- [x] The site's listings still link every Activity

## Comments

Built on branch `ae-06`. The four modules went through `scripts/migrate-activity.js` and were deleted; a one-off check confirmed each JSON, notes aside, deep-equals the module's default export and carries the same `enc1:` strings in the same order. Notes hand-edited: dropped the stale "pure data, Node tests import it" remark, named the ids behind the expanded constants (FIXED, FILTER_LOCK, TOGGLES, SUM_INPUTS, CIRCUIT_SETUP, STAGE), and moved Part-specific remarks into Part notes (fourier's 4 Parts, phasors' 3, electrostatics' gauss). Electrostatics' inline comments that restate encoded Conditions in plain words were not carried over. The guard test (`tests/unit/framework/activity-files.test.js`) now decodes before validating, as the runner does (encoded numeric answers failed validation otherwise), checks all five Activities are JSON, and that no `.js` module is left in any activities folder. `tests/e2e/setup-keys.spec.js` reads JSON Activities only and still finds all five. The source-leak assertions in the fourier, phasors and spacetime unit tests now read the JSON unchanged; some of their JS-syntax probes (such as `above:`) can no longer match.
