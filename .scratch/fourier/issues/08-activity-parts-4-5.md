# 08: Activity Parts 4–5: low-pass and high-pass on the square wave

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The Activity gains its last two Parts.

- **Part 4, low-pass:** the square wave (f₀ = 1 kHz) through a low-pass filter with f_c = 3 kHz.
  - The student tries gain only, phase only, and both.
  - A choice Question on which one recovers the RC charging curve.
  - Free text on why both are needed.
  - Hand-compute the output 3rd harmonic, A₃·|H| and φ₃ + ∠H, using the formulas given in the Task text.
- **Part 5, high-pass:** the same story for the high-pass filter and the decaying spikes. It can draw out that the complex low-pass and high-pass gains add to 1 while their magnitudes do not.
- **Finish:** the student downloads the Report.

**Blocked by:** 07

**Status:** resolved

- [ ] The Part 4 and Part 5 Setups fix the square wave, f₀ = 1 kHz, f_c = 3 kHz and the filter type. Tasks unlock the gain and phase toggles as needed.
- [ ] Where a Task asks the student to set the toggles, encoded Conditions check the toggle states.
- [ ] Task text gives the low-pass formulas, |H| = 1/√(1+(f/f_c)²) and ∠H = −arctan(f/f_c). Part 5 gives the high-pass equivalents.
- [ ] Output-harmonic answers use a 2% relative tolerance for amplitude, and ±2° with modulus 360 for phase. The answer keys agree with the engine.
- [ ] Choice and text Questions are as described above. Text answers are recorded in the Report and not graded.
- [ ] Runner-core unit test:
  - the new Parts use the intended Setups and Modes;
  - correct answers pass and wrong ones fail.
- [ ] Playwright: a full Run through to downloading the Report, with the Report including the Display snapshot.

## Comments

- 2026-11-26: Implemented on the `fourier` integration branch (merge 917b790); code-review fixes in e950af5.
