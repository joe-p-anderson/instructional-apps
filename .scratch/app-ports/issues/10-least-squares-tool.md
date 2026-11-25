# 10: least-squares Tool in Standalone mode, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `least-squares` Tool and gets the full least-squares fitting app in the v1 look.

- They pick a dataset and transform the axes until the model is linear.
- They drag the (m, b) handle on the parameter plane and watch SSE, R², the residuals and how many error bars the line passes through.
- They can edit data points, use Optimize, the through-origin lock and "Check your …", and copy the data as CSV.

The whole class sees the same data until someone presses New data. A reload or a share link brings back exactly what the student had, edited points included. The old least-squares page is deleted.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Tool is defined with id `least-squares` and one Mode, `fit`.
- [x] A DOM-free module holds:
  - [x] the seeded data generator;
  - [x] the OLS and through-origin fits;
  - [x] SSE, SST and R² (R² pinned to 0 when the fit is worse than a flat line);
  - [x] the count of error bars hit;
  - [x] linearization detection and the implied physical quantities.
- [x] Controls:
  - [x] selects for the dataset, the y transform, the x transform and the coarse/fine view;
  - [x] buttons for New data, Reset data, Optimize and Copy CSV;
  - [x] toggles for show residuals, edit points and the through-origin lock;
  - [x] the "Check your …" reveal;
  - [x] the (m, b) handle and the draggable data points, as custom Controls.
- [x] The Setup accepts the dataset, seed, transforms, view, lock and an optional starting line.
- [x] The State is as listed in the spec, each value with a label and unit.
- [x] The serialized State includes the dataset, seed, edited points, transforms, view, lock, the line, and whether the check was revealed. The handle's random starting position is drawn from the seed.
- [x] The Displays and look:
  - [x] three canvas Displays (scatter, residuals, parameter plane), each with a PNG snapshot;
  - [x] a resize observer per instance;
  - [x] colours taken from theme variables;
  - [x] the vendored MathJax;
  - [x] dark mode dropped.
- [x] Node tests cover:
  - [x] the same seed giving the same data, with every point inside its error bar;
  - [x] the OLS and through-origin fits;
  - [x] R² pinning and the hit count;
  - [x] linearization and the implied g, R, A and B for each dataset.
- [x] A Playwright Standalone smoke test checks that every Control is unlocked, that dragging the handle updates the State, and that a reload and a share link restore the same data, edited points and line.
- [x] The old least-squares page is deleted, along with its folder if that leaves it empty. The repo README links the Tool.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 4d3859c); code-review fixes in 7c50e19.
