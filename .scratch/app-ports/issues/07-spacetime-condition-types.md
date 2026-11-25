# 07: spacetime Condition types and the diagram State

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** An Activity author can judge what a student drew on the spacetime Tool using declarative Conditions that can be encoded: "an event near (x, t)", "a worldline of velocity u through (x, t)" and "a rod with its ends at these two points". Every Attempt records the drawn diagram in its State, so the instructor can see in the Report Viewer what the student drew.

**Blocked by:** 06

**Status:** resolved

- [x] The State gains `diagram`: the canonical normalized object list, serialized as one JSON string and kept in step with every change.
- [x] The Tool module exports three Condition types that read `diagram`. All tolerances are absolute, in K coordinates.
  - [x] `st-event`: some event within `tol` of (x, t).
  - [x] `st-worldline`: some worldline with velocity `u` (within `uTol`) that passes within `tol` of (x, t). Parametric worldlines and joined chains both count. For a chain, the segment that matches must contain the point.
  - [x] `st-rod`: some rod whose two ends lie within `tol` of two given points, in either order and whatever the rod's frame.
- [x] Miss feedback reports the closest match, for example "nearest event is at (2.9, 4.6); need (3, 5) ± 0.1" or "no worldline with u = 0.60 found".
- [x] The types work inside Condition lists, inside `anyOf`, and when encoded.
- [x] Node tests judge each type against State snapshots built from real diagrams. They cover pass, miss and feedback, a chain that matches only on the right segment, and a rod matched with its ends reversed.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge cbc2af8); code-review fixes in 7c50e19.
