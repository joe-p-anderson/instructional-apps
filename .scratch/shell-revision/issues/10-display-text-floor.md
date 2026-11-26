# 10: 13 px floor for Display text, checked on every Tool

Spec: .scratch/shell-revision/spec.md (Displays; stories 70, 71, 75).

**What to build:** `--fw-plot-font-size` becomes 13 px, the floor for all text drawn in a Display: canvas, SVG and Plotly. Tools that hard-code smaller sizes follow it:
- spacetime's tick labels;
- least squares;
- the electrostatics arc-picker captions;
- bench-scope's screen readouts.

Bench-scope's front-panel artwork is exempt and marked as exempt.

**Blocked by:** theme-refresh 05 (.scratch/theme-refresh/issues/05-app-ports-tools-follow-refined-cream.md), which points the electrostatics plot at the plot tokens and settles `themeVars()` against `plotTheme()`.

**Status:** resolved

- [x] e2e: for every Tool and Mode at 1366×768, no visible text inside the Display area is under 12 px, except elements marked as exempt artwork.
- [x] e2e: the same check on the three Activities.
- [x] The framework README documents the floor and the exemption marker.
