# 04: electrostatics Gauss's-law Mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The electrostatics Tool gains a "Gauss's law" tab that behaves like the Gauss' Law tab in conductor_properties. The student sets λ and E₀, drags a Gaussian surface's centre and its radius handle, and reads the enclosed charge as the surface moves through the bulk, across the edge and outside.

**Blocked by:** 02

**Status:** resolved

- [x] The Tool declares a `gauss` Mode, which Standalone mode shows as a third tab.
- [x] The Controls keep the old ranges and defaults:
  - [x] λ (−1 to 1, step 0.05, default 1).
  - [x] The E₀ joystick and boxes, reusing the Control from ticket 02.
  - [x] The Gaussian-surface centre and the radius handle (radius at least 0.3), as draggable in-plot Controls.
- [x] The State holds the following, each with a label and unit:
  - [x] λ, E₀x and E₀y.
  - [x] The surface centre and radius.
  - [x] The centre's distance from the conductor's centre.
  - [x] The outer extent (distance + radius) and the inner extent (distance − radius).
  - [x] Q_enc.
- [x] The Display is a Plotly plot showing the Gaussian surface, with a PNG snapshot.
- [x] Node tests show that Q_enc ≈ 0 for a surface entirely in the bulk, and ≈ the surface charge for one that straddles the edge.
- [x] The Playwright Standalone smoke test covers this tab.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 980cd8f); code-review fixes in 7c50e19. Two old-app bugs, first kept for faithfulness, were then fixed: the heatmap and arrows now use the same 1/r line-charge field as Q_enc (the old app drew 1/r²), and Q_enc samples 100 distinct angles instead of counting t = 0 twice.
