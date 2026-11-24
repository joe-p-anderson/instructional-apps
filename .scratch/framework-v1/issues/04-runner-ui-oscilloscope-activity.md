# 04: Activity runner UI and the oscilloscope Activity

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the oscilloscope "phase shift / period and amplitude" Activity link, enters their name, and works through Part 1 (phase shift) and Part 2 (period and amplitude) as tabs, with task cards, Submit, feedback, Hints and per-Part progress. The old per-task code is replaced by a declarative Activity script.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Thin DOM layer over the runner core: name gate blocking Part 1; Part tabs, each with its own Tool instance and State; task cards with Submit, feedback, Hint and done state; progress indicator per Part
- [ ] Math in prompts and Questions rendered with MathJax
- [ ] An Activity is selected by a query parameter on the Tool's page or by a tiny per-Activity HTML page; the URL identifies one Activity
- [ ] The oscilloscope Activity carries over the existing Tasks faithfully: φ = π/2 ± 0.05, T = 3 ± 0.05, pk-pk = 4 ± 0.05; Δt locked after Task 1.1; the free-text Question after Task 1.2; both Parts use the same Mode with different Setups
- [ ] Playwright: name gate blocks Part 1; exposure rules show/lock/hide the expected Controls including the Δt marker; dragging through the target without Submitting doesn't pass; a Submit at the target passes and unlocks the next Task
