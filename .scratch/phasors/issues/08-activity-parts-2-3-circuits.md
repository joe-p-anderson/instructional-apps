# 08: Activity Parts 2 and 3: series RC and RLC

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The Activity's Circuit Parts. Both reveal the chain Z → I → V in stages.

- **Part 2, Series RC.** L is off.
  - Compute Z in both forms (real and imaginary parts, then magnitude and angle). Submit reveals Z_total.
  - Compute I = V/Z (magnitude and phase). Submit reveals I.
  - Compute V_R and V_C. Submit reveals them and the KVL closure.
  - Multiple choice: V_R is in phase with I, and V_C lags I by 90°.
  - **Fourier link:**
    - compute V_C/V_in and recognize it as 1/(1 + jωRC);
    - multiple choice on the matching Fourier f_c = ω_c/2π;
    - sweep ω (a Condition on the swept range).
- **Part 3, Series RLC.**
  - The same chain, plus V_L.
  - Multiple choice: V_L leads I by 90° and V_C lags it by 90°.
  - **Resonance Task:**
    - sweep to ∠Z = 0 (a Condition) and compare ω₀ with 1/√(LC);
    - free text on V_L and V_C cancelling while each can exceed V₀.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The State gains the swept-ω range (min and max ω visited in the Part) for sweep Conditions.
- [ ] Setup values are the implementer's choice:
  - ω within about a factor of 3 of ω_c (RC) or ω₀ (RLC);
  - clean but non-trivial hand arithmetic.
- [ ] The Task text gives Z_L = jωL and Z_C = 1/(jωC). The RC link Task gives the Fourier H for comparison.
- [ ] Each compute Task hides its layer, and the next Task shows it.
- [ ] Checks:
  - magnitudes within 2% relative;
  - phases within ±2° mod 360.
- [ ] Runner-core tests with `stubTool`:
  - Parts 2 and 3 use the `circuit` Mode with the intended Setups;
  - correct answers pass, including equivalent angles, and wrong ones fail;
  - the hide and show sequence is right;
  - the answer keys agree with the engine;
  - the sweep and resonance Conditions pass only after sweeping and at ∠Z ≈ 0.
- [ ] Playwright test: in Part 2, submitting Z reveals Z_total and submitting I reveals I.
