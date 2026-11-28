# 04: The RC filter in Synthesis Mode

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student passes the input through a first-order RC low-pass or high-pass filter with cutoff f_c.

- **Toggles:** "Apply gain" and "Apply phase shift" turn on separately. Each harmonic is scaled by |H| when gain is on, and shifted by ∠H when phase is on.
- **Both toggles on:** the N = ∞ curve is the analytic RC steady-state response, V_C for low-pass and V_R for high-pass. So a square wave gives the charging/discharging curve or the decaying spikes.
- **One toggle on:** the N = ∞ curve is still the limit of the series, computed numerically.
- **Readouts:** f_c/f₀ and τ.

**Blocked by:** 03

**Status:** resolved

- [ ] Filter Controls: type (off, low-pass, high-pass), f_c (Hz), a gain toggle and a phase toggle. They are shared Controls with the same ids in both Modes, and they are published in State.
- [ ] f_c/f₀ and τ = 1/(2πf_c) are UI-kit metrics, also published in State.
- [ ] The engine filters a series by reusing bench-scope's pure complex filter gain, imported rather than copied. The DC term is scaled by H(0).
- [ ] The N = ∞ curve, case by case:
  - no filter: the ideal waveform;
  - both toggles on: the analytic piecewise steady state, for every waveform. It is the linear particular solution plus C·e^(−t/τ), with C fixed by periodicity;
  - one toggle on: a high-order numerical sum of about 1000 harmonics.
- [ ] The partial sum and the highest harmonic show the filtered terms.
- [ ] Node tests:
  - key test: for square, triangle, sawtooth and sine, through both low-pass and high-pass, the filtered partial sum at large N converges to the analytic curve away from the jumps;
  - low-pass output plus high-pass output equals the input;
  - gain-only and phase-only each change exactly the one thing that is switched on.
- [ ] Playwright:
  - turning the filter on, and toggling gain and phase, each change the curve;
  - the readouts update with f_c.

## Comments

- 2026-11-26: Implemented on the `fourier` integration branch (merge 9def501); code-review fixes in e950af5.
