# 06: CH2 sources and filters

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** In the source panel, the student feeds CH2 a copy of CH1, a low-pass, high-pass or band-pass filtered version of CH1, or a second independent generator. A filtered square wave rounds off or turns into spikes exactly as theory predicts. The true gain and phase are published for future Activities.

**Blocked by:** 02

**Status:** resolved

- [x] CH2 source: off, copy, lowpass, highpass, bandpass, or independent.
- [x] Filters act on CH1: first-order RC low-pass and high-pass (cutoff fc), and a second-order band-pass (centre f0 and Q). Filtering is exact and steady-state: each harmonic is multiplied by the filter's complex gain and summed, with no start-up transient.
- [x] The independent generator has its own waveform, frequency, amplitude, offset and phase relative to CH1.
- [x] Source-panel Controls that don't apply to the current CH2 source are hidden (for example, Q unless CH2 is band-pass). All of them are registered as Controls.
- [x] State: every CH2 source setting; the true CH2 frequency and Vpp; and CH2's gain (as a ratio and in dB) and phase relative to CH1 at the CH1 fundamental.
- [x] Node test: a sine through a low-pass at fc = f has gain 1/√2 and phase −45° in the true values, and the acquired CH2 amplitude matches. A square wave through a high-pass shows spikes at the edges. A band-pass passes its centre harmonic. The independent generator's phase offset appears in the samples.
- [x] Playwright: choosing band-pass reveals the Q Control, switching away hides it, and CH2 changes on screen.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (46de4c6); review fixes in 9779e6a.
