# 09: Cursors

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student turns on time or amplitude cursors, moves the selected cursor with the multipurpose knob (more slowly with "fine" on the TBS), and reads Δt, 1/Δt or ΔV.

**Blocked by:** 05

**Status:** resolved

- [x] Cursor menu, opened by each skin's cursor button: off, time or amplitude; the source for amplitude cursors; which cursor is selected.
- [x] The multipurpose knob moves the selected cursor. "fine" (TBS) slows the step, and the TDS multipurpose LEDs indicate that the knob is active.
- [x] The cursors are drawn on screen with Δ readouts: Δt and 1/Δt for time cursors, ΔV for amplitude cursors.
- [x] The cursors are registered as Controls.
- [x] State: the cursor mode, both cursor positions and the Δ values.
- [x] Node test: knob turns move the selected cursor; fine reduces the step; Δ values follow; 1/Δt over one period matches the true frequency.
- [x] Playwright: on each skin, turn on time cursors, turn the multipurpose knob, and the Δt readout changes.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (08af1a6); review fixes in 9779e6a.
