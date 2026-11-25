# 02: Knob input and vertical controls

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student turns the CH1 and CH2 Scale and Position knobs and watches the traces rescale and move. The on-screen V/div readouts follow. Every front-panel element becomes a Control that an Activity could lock or hide.

**Blocked by:** 01

**Status:** resolved

- [x] Knob input: the wheel turns one detent per notch, a vertical drag turns continuously in detents, arrow keys turn a focused knob, and a click without a drag pushes it. Knob rotation is drawn from the engine's value.
- [x] Buttons and softkeys show a pressed state. Inactive controls stay greyed, with a "not available in this simulation" tooltip.
- [x] CH1/CH2 Scale steps V/div through the 1-2-5 sequence from 2 mV to 5 V. CH1/CH2 Position moves the trace in divisions, and a push recentres it.
- [x] CH2 shows a copy of CH1 for now, until ticket 06 adds the CH2 sources. The CH1/CH2 menu buttons toggle that channel's display.
- [x] Traces clip at the screen edges.
- [x] Every active control in the control map is registered as a Control (get/set/lock/unlock/show/hide). A locked knob or button ignores all input and shows a locked affordance, and a hidden one disappears without disturbing the panel layout.
- [x] State: per-channel display on/off, V/div and position.
- [x] Node test: turn events step V/div through the sequence and clamp at the ends; position push recentres; samples clip at the screen bounds.
- [x] Playwright: wheel, drag and arrow keys each change the CH1 V/div readout; a click pushes; a locked knob ignores the wheel.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (e59330e); review fixes in 9779e6a.
