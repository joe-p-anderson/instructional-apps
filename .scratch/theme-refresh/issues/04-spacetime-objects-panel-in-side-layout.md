# 04: Spacetime's objects panel is cramped in an Activity's side layout

Spec: .scratch/theme-refresh/spec.md (decision 2). Follow-up found while merging main (app-ports) into theme-refresh.

**Status:** needs-triage

**Problem:** In an Activity, the `side` layout's 330 px Task column left spacetime's diagram about 430 px wide. That was too small for precise drags. Commit d2deda7 fixed the diagram by moving the objects panel (`.st-side`: Frames and Objects) under the Controls column in `tools/spacetime/spacetime.js`. The diagram is now about 700 px wide at 1366×768, but the objects panel gets only about 150 px of height and scrolls there. Students select and edit drawn objects in that panel while working, so it is hard to use.

Standalone mode is unaffected, because it has no Task column.

**What to decide and build:**

- [ ] Choose how the objects panel gets usable room in an Activity. Options include:
  - a drawer or popover, like bench-scope's source drawer (`tools/bench-scope/bench-scope.js`);
  - a more compact Controls column;
  - a collapsible Frames section;
  - a spacetime-specific `banner` refinement. The generic `banner` layout was tried and does not fit spacetime's three columns.
- [ ] At 1366×768 in `tools/spacetime/activities/lab10.html`, the diagram stays at least about 650 px wide, and at least four object rows are visible without scrolling.
- [ ] Playwright: measure both at 1366×768. `tests/e2e/spacetime-activity.spec.js` still passes.
