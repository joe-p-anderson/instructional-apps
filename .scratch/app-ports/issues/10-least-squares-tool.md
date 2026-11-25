# 10: least-squares Tool in Standalone mode, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `least-squares` Tool and gets the full least-squares fitting app in the v1 look.

- They pick a dataset and transform the axes until the model is linear.
- They drag the (m, b) handle on the parameter plane and watch SSE, R², the residuals and how many error bars the line passes through.
- They can edit data points, use Optimize, the through-origin lock and "Check your …", and copy the data as CSV.

The whole class sees the same data until someone presses New data. A reload or a share link brings back exactly what the student had, edited points included. The old least-squares page is deleted.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Tool is defined with id `least-squares` and one Mode, `fit`.
- [ ] A DOM-free module holds:
  - [ ] the seeded data generator;
  - [ ] the OLS and through-origin fits;
  - [ ] SSE, SST and R² (R² pinned to 0 when the fit is worse than a flat line);
  - [ ] the count of error bars hit;
  - [ ] linearization detection and the implied physical quantities.
- [ ] Controls:
  - [ ] selects for the dataset, the y transform, the x transform and the coarse/fine view;
  - [ ] buttons for New data, Reset data, Optimize and Copy CSV;
  - [ ] toggles for show residuals, edit points and the through-origin lock;
  - [ ] the "Check your …" reveal;
  - [ ] the (m, b) handle and the draggable data points, as custom Controls.
- [ ] The Setup accepts the dataset, seed, transforms, view, lock and an optional starting line.
- [ ] The State is as listed in the spec, each value with a label and unit.
- [ ] The serialized State includes the dataset, seed, edited points, transforms, view, lock, the line, and whether the check was revealed. The handle's random starting position is drawn from the seed.
- [ ] The Displays and look:
  - [ ] three canvas Displays (scatter, residuals, parameter plane), each with a PNG snapshot;
  - [ ] a resize observer per instance;
  - [ ] colours taken from theme variables;
  - [ ] the vendored MathJax;
  - [ ] dark mode dropped.
- [ ] Node tests cover:
  - [ ] the same seed giving the same data, with every point inside its error bar;
  - [ ] the OLS and through-origin fits;
  - [ ] R² pinning and the hit count;
  - [ ] linearization and the implied g, R, A and B for each dataset.
- [ ] A Playwright Standalone smoke test checks that every Control is unlocked, that dragging the handle updates the State, and that a reload and a share link restore the same data, edited points and line.
- [ ] The old least-squares page is deleted, along with its folder if that leaves it empty. The repo README links the Tool.
