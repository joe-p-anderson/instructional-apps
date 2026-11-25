# 09: Cursors

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student turns on time or amplitude cursors, moves the selected cursor with the multipurpose knob (more slowly with "fine" on the TBS), and reads Δt, 1/Δt or ΔV.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Cursor menu, opened by each skin's cursor button: off, time or amplitude; the source for amplitude cursors; which cursor is selected.
- [ ] The multipurpose knob moves the selected cursor. "fine" (TBS) slows the step, and the TDS multipurpose LEDs indicate that the knob is active.
- [ ] The cursors are drawn on screen with Δ readouts: Δt and 1/Δt for time cursors, ΔV for amplitude cursors.
- [ ] The cursors are registered as Controls.
- [ ] State: the cursor mode, both cursor positions and the Δ values.
- [ ] Node test: knob turns move the selected cursor; fine reduces the step; Δ values follow; 1/Δt over one period matches the true frequency.
- [ ] Playwright: on each skin, turn on time cursors, turn the multipurpose knob, and the Δt readout changes.
