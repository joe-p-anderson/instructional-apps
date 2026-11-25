# 08: Measure

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student opens the Measure menu and adds readouts (frequency, period, pk-pk, amplitude, mean, RMS, rise time, and CH1→CH2 delay and phase). The readouts are computed from what the scope acquired, so a clipped or badly scaled trace gives an invalid or poor reading, as on the real instrument.

**Blocked by:** 05, 06

**Status:** resolved

- [x] Measure menu: add and remove readouts by source and type. The number shown at once and the menu flow follow each skin's style.
- [x] Readouts are computed from the acquired samples, not the ideal signal. They show as invalid ("?" or the model's equivalent) when the trace clips.
- [x] State: the active readouts, each with source, type, value and a valid flag.
- [x] Node test: at sensible settings, the pk-pk and frequency readouts are within tolerance of the true values despite the noise. A low-pass at fc = f gives a CH1→CH2 phase readout close to −45°. A clipped trace makes the readout invalid.
- [x] Playwright: on each skin, adding a frequency readout shows it on screen and in State.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (5c40eeb); review fixes in 9779e6a.
