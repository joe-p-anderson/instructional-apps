# 04: Activity runner UI and the oscilloscope Activity

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the oscilloscope "phase shift / period and amplitude" Activity link, enters their name, and works through Part 1 (phase shift) and Part 2 (period and amplitude) as tabs, with task cards, Submit, feedback, Hints and per-Part progress. The old per-task code is replaced by a declarative Activity script.

**Blocked by:** 01, 03

**Status:** resolved

- [x] Thin DOM layer over the runner core: name gate blocking Part 1; Part tabs, each with its own Tool instance and State; task cards with Submit, feedback, Hint and done state; progress indicator per Part
- [x] Math in prompts and Questions rendered with MathJax
- [x] An Activity is selected by a query parameter on the Tool's page or by a tiny per-Activity HTML page; the URL identifies one Activity
- [x] The oscilloscope Activity carries over the existing Tasks faithfully: φ = π/2 ± 0.05, T = 3 ± 0.05, pk-pk = 4 ± 0.05; Δt locked after Task 1.1; the free-text Question after Task 1.2; both Parts use the same Mode with different Setups
- [x] Playwright: name gate blocks Part 1; exposure rules show/lock/hide the expected Controls including the Δt marker; dragging through the target without Submitting doesn't pass; a Submit at the target passes and unlocks the next Task

## Comments

- Built on branch `ticket-04`. Runner UI: `framework/v1/activity-ui.js` (`mountActivity`); styles appended to `theme.css`; MathJax 3.2.2 loader + `typeset()` in `vendor.js`.
- Activity selection: a tiny per-Activity page, `tools/oscilloscope/activities/phase-period-amplitude.html` (data in `phase-period-amplitude.js`). No query-parameter route on the Tool page, to leave the Standalone path (ticket 05) untouched.
- Deviation: the free-text Question is its own Task 1.3 (no Condition), unlocked when Task 1.2 passes, since Questions in the core belong to a Task and are judged on its Submit.
- Deviation: Part 2 Setup starts at Va = 1.5 V (old lab: 2 V, which made pk-pk = 4 V pass with no change). Part 2 hides the Δt slider and marker, locks Va for Task 2.1, then unlocks Va and locks f for Task 2.2; the old lab had no staging there. Hints (after 3 misses) are new.
- Not in scope here: Display snapshots on passing Attempts (left for the Report, ticket 07).
