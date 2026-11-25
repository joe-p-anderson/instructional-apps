# 10: XY display

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student switches to XY display: Display → Format on the TDS2001C, or Acquire → XY Display (On/Off) on the TBS2072B. With CH1 on X and CH2 on Y, they see Lissajous figures and phase ellipses. Functions the real scopes disable in XY are disabled here too.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] TDS: the Display button opens a reduced menu holding only Format YT/XY.
- [ ] TBS: the Acquire button opens its side menu with XY Display On/Off active. Mode, Record Length, Delay, Set Horizontal Position and Waveform Display are drawn greyed.
- [ ] In XY, CH1 drives X and CH2 drives Y, using each channel's V/div and position.
- [ ] In XY, cursors, the time base and the trigger controls are disabled, and Autoset returns to YT, as on the real models.
- [ ] The control map's `active` flags are updated for the TDS Display and TBS Acquire buttons.
- [ ] State: the display format (YT/XY).
- [ ] Node test: an independent CH2 at the same frequency with a 90° phase gives a circle-like XY frame; disabled controls ignore events in XY; Autoset returns to YT.
- [ ] Playwright: on each skin, enter XY through its own menu path and see the format change in State.
