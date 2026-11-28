# 03: All waveforms and the input Controls

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** In Synthesis Mode the student chooses a sine, square, triangle or sawtooth wave. They set its amplitude, f₀, DC offset, and a phase/time shift in degrees of the fundamental. The partial sum, the highest harmonic and the N = ∞ curve all follow.

What students can now see:

- **Decay rates:** square and triangle sums can be compared for how fast their terms fall (1/n against 1/n²).
- **DC:** a DC offset appears as the n = 0 term.
- **Shift:** shifting a waveform shifts each harmonic's phase in proportion to n.

These input Controls are the shared Controls that both Modes will use, with the same ids.

**Blocked by:** 02

**Status:** resolved

- [ ] A waveform select (sine, square, triangle, sawtooth) and sliders for amplitude, f₀ (Hz), DC offset (V) and shift (degrees), all built from the UI kit, registered as Controls and published in State.
- [ ] The engine gives exact, unsmoothed cos-convention tables for every waveform. The triangle and sawtooth alignments are documented in the engine.
- [ ] A shift of Δφ degrees adds −nΔφ to each φₙ. A DC offset changes only the n = 0 term.
- [ ] For each waveform the N = ∞ curve is the ideal waveform, including the shift and DC offset.
- [ ] Node tests:
  - the tables match textbook values for all four waveforms: square and triangle have zero even harmonics, and the sawtooth has nonzero even harmonics;
  - the shift law and the DC rule hold;
  - high-N partial sums approach each ideal waveform away from the jumps.
- [ ] Playwright: changing the waveform, and each input Control, changes the Display.

## Comments

- 2026-11-26: Implemented on the `fourier` integration branch (merge 5feca71); code-review fixes in e950af5.
