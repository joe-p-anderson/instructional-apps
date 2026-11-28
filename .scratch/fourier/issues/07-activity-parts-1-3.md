# 07: Activity "Frequency Domain: Fourier Series", Parts 1–3

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A student opens the Activity (PHY/EGR 3120), passes the Name gate, and works through three Parts.

- **Part 1, Synthesis: square vs triangle.** The coefficient tables for both waveforms are given.
  - A choice Question on 1/n against 1/n².
  - Find the smallest N that keeps each sum within about 5% of the original away from the jumps or corners.
  - Free text on jumps against corners, and on "same signal, two descriptions".
- **Part 2, Analysis: a shifted sine.**
  - Hand-compute a₁ and b₁ from the shaded products, and convert them to A₁ and φ₁.
  - A choice Question on the zero-area n = 2 and n = 3 products.
- **Part 3, Analysis: the square wave.**
  - Hand-compute Aₙ and φₙ for n = 1 to 5.
  - A choice Question on the pattern: even terms are zero, and Aₙ ∝ 1/n.
- **Spectrum visibility:** the spectrum Display is hidden while a Task asks for coefficients, and appears after Submit.

**Blocked by:** 01, 06

**Status:** resolved

- [ ] The Activity is pure data that names the `fourier` Tool, with course "PHY/EGR 3120", and it has an Activity page. It is listed under PHY/EGR 3120 in the root index and the README.
- [ ] Setups fix the waveform, shift, f₀ (1 kHz), amplitude (±1 V) and filter (off) for each Part. Part 1 shows the coefficient table for the selected waveform.
- [ ] Amplitude answers use a 2% relative tolerance. Phase answers use ±2° with modulus 360 (ticket 01).
- [ ] Questions:
  - choice and text Questions are as described above;
  - text answers are recorded in the Report and not graded;
  - Hints never state the passing value;
  - Conditions and Hints that would give answers away are encoded answer keys.
- [ ] Each coefficient Task hides the spectrum Display, and the Task after it shows it.
- [ ] Part 3's Task text explains why the square wave's φₙ is −90° under the cos convention.
- [ ] Runner-core unit test with stubTool:
  - the Activity names the Tool, and its Parts use the intended Modes and Setups;
  - correct hand-computed answers pass, with phases accepted at any equivalent angle, and wrong ones fail;
  - the answer keys agree with the engine;
  - the spectrum is hidden in each coefficient Task and shown afterwards.
- [ ] Playwright:
  - the Name gate blocks Part 1;
  - submitting a correct numeric Task succeeds;
  - the spectrum appears after Submit.

## Comments

- 2026-11-26: Implemented on the `fourier` integration branch (merge c22bf28); code-review fixes in e950af5.
