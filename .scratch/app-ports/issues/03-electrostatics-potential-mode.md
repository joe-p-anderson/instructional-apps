# 03: electrostatics potential Mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The electrostatics Tool gains a "Potential" tab that behaves like the Potential Field tab in conductor_properties. The student sets Q, drags probe points P1 and P2 on the plot, and reads V1, V2 and ΔV. They can turn on "lock to surface" or "measure at infinity", but not both at once.

**Blocked by:** 02

**Status:** resolved

- [x] The Tool declares a `potential` Mode, which Standalone mode shows as a second tab.
- [x] The Controls keep the old defaults:
  - [x] Q (default 1 nC).
  - [x] P1 and P2 as draggable in-plot Controls (defaults (−6, −6) and (7, 7) cm).
  - [x] "Lock to surface" and "measure at infinity" toggles that stay mutually exclusive, even when an Activity locks or hides one of them.
- [x] The State holds the following, each with a label and unit:
  - [x] Q.
  - [x] The effective P1 and P2 coordinates after constraints.
  - [x] The distances r1 and r2 from the centre.
  - [x] V1, V2 and ΔV (V1 − V2, or V1 − V(∞)).
  - [x] Both toggle flags.
- [x] The Display is a Plotly plot of the potential, showing the conductor boundary and the probe points, with a PNG snapshot.
- [x] Node tests show that the potential inside the conductor is constant and equal to the surface value, and that the effective probe points are right under each toggle.
- [x] The Playwright Standalone smoke test covers this tab: every Control is unlocked, a drag updates the State, and a reload and a share link restore the setup.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge d7c02b8); code-review fixes in 7c50e19.
