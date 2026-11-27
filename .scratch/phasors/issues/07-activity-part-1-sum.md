# 07: Activity Part 1: Sum

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The Activity "Phasors and Impedance" (PHY/EGR 3120), with its Activity page and Part 1 on the Sum Mode. Every Task uses unequal amplitudes, and the Setup fixes ω and the two sinusoids.

- **Task A:** phasors 90° apart. The student hand-computes A (Pythagoras) and φ, then submits, and the resultant appears.
- **Task B:** phasors 120° apart. The student hand-computes A (law of cosines) and φ (components), then submits, and the resultant appears.
- **Task C:** multiple choice. The sum is A₁ + A₂ in phase (0°) and |A₁ − A₂| out of phase (180°).
- **Free text:** why the sum of two same-frequency sinusoids is another sinusoid at that frequency.

**Blocked by:** 06

**Status:** resolved

- [ ] The Activity is pure data in the Tool's activities, with encoded answer keys, following the Fourier Activity.
- [ ] Checks:
  - A within 2% relative;
  - φ within ±2°, using the numeric Question's modulus option (360).
- [ ] Each compute Task hides the resultant layer, and the next Task shows it.
- [ ] The Activity page exists and is listed under PHY/EGR 3120 in the root index and the README.
- [ ] Runner-core tests with `stubTool`:
  - the Activity names `phasors`, and Part 1 uses the `sum` Mode and Setup;
  - correct answers pass, including equivalent angles, and wrong ones fail;
  - the answer keys agree with the engine's sum.
- [ ] Playwright tests:
  - the Name gate;
  - a numeric Task is submitted and the resultant appears;
  - the Report downloads.
