# 04: electrostatics Gauss's-law Mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The electrostatics Tool gains a "Gauss's law" tab that behaves like the Gauss' Law tab in conductor_properties. The student sets λ and E₀, drags a Gaussian surface's centre and its radius handle, and reads the enclosed charge as the surface moves through the bulk, across the edge and outside.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The Tool declares a `gauss` Mode, which Standalone mode shows as a third tab.
- [ ] The Controls keep the old ranges and defaults:
  - [ ] λ (−1 to 1, step 0.05, default 1).
  - [ ] The E₀ joystick and boxes, reusing the Control from ticket 02.
  - [ ] The Gaussian-surface centre and the radius handle (radius at least 0.3), as draggable in-plot Controls.
- [ ] The State holds the following, each with a label and unit:
  - [ ] λ, E₀x and E₀y.
  - [ ] The surface centre and radius.
  - [ ] The centre's distance from the conductor's centre.
  - [ ] The outer extent (distance + radius) and the inner extent (distance − radius).
  - [ ] Q_enc.
- [ ] The Display is a Plotly plot showing the Gaussian surface, with a PNG snapshot.
- [ ] Node tests show that Q_enc ≈ 0 for a surface entirely in the bulk, and ≈ the surface charge for one that straddles the edge.
- [ ] The Playwright Standalone smoke test covers this tab.
