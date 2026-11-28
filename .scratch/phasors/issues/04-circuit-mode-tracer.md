# 04: Circuit Mode tracer: impedance, current and device voltages

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A Circuit Mode tab for one series loop, driven by V₀ cos(ωt) at phase 0.

- **Controls:**
  - include toggles for R, L and C (at least one must stay on);
  - sliders with number inputs for V₀ (V), R (Ω), L (mH) and C (µF);
  - a log ω slider from about 10² to 10⁶ rad/s.
- **The rotating phasor plane** shows V_in, I, V_R, V_L and V_C.
  - I is drawn in its own colour, as a dashed arrow, auto-scaled to a comparable length, with a labelled scale in A.
  - The device voltages are drawn head-to-tail, closing on V_in.
- **The time plot** shows every signal, with trace toggles. i(t) is on its own labelled scale.
- **Readouts:**
  - Z_R = R, Z_L = jωL, Z_C = 1/(jωC) and Z_total, each in both forms (always called impedances, never reactances);
  - ω₀ = 1/√(LC) when both L and C are on;
  - ω_c = 1/(RC) when R and C are on without L.
- **Time controls:** play, the scrubber and the cursor from 03 work here too.

**Blocked by:** 03

**Status:** resolved

- [ ] The engine gains the circuit math:
  - Z for any subset of R, L and C;
  - I = V/Z;
  - V_k = I·Z_k for each included element (excluded elements give no phasor);
  - ω₀ and ω_c.
- [ ] The Tool gains a `circuit` Mode. The shared Controls (ω, play, t) keep the same ids as in the Sum Mode.
- [ ] State publishes every Circuit Control value plus Z_total (both forms), ∠Z, |I| and ∠I, each |V_k| and ∠V_k, ω₀ and ω_c, with units.
- [ ] Node tests:
  - Z for every R/L/C subset matches R + jωL + 1/(jωC);
  - V_R ∥ I, ∠V_L − ∠I = +90°, and ∠V_C − ∠I = −90°;
  - KVL: the sum of the V_k equals V_in;
  - at ω₀, ∠Z = 0 and V_L = −V_C;
  - for series RC, V_C/V_in = 1/(1 + jωRC) at many ω.
- [ ] Playwright tests:
  - the Circuit tab loads;
  - toggling L or C adds or removes its phasor and trace;
  - moving ω changes the readouts.
