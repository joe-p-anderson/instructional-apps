# 05: Analysis Mode tracer: the shaded product

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A second Mode tab, Analysis.

- **Test function:** the student picks a cos or sin test function and an integer harmonic n, from 0 to 10.
- **The Display:**
  - plots the signal times the test function over exactly one period of f₀;
  - shades positive and negative area in different colours;
  - shows the signal and the test function for reference.
- **No numbers:** no integral values are shown. Students compute aₙ and bₙ by hand.
- **Shared Controls:** the input Controls carry the same ids as in Synthesis.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The Tool has an `analysis` Mode alongside `synthesis`, and Standalone mode shows both tabs.
- [ ] Controls: test function (a cos/sin select) and n (integer, 0 to 10), both published in State. The shared input Controls appear with the same ids as in Synthesis.
- [ ] The product Display shades positive and negative area in distinct plot-theme colours over one period. n = 0 gives the DC test.
- [ ] No readout shows the integral, aₙ, bₙ, Aₙ or φₙ.
- [ ] The engine gives the product as a function of time. It can integrate the product numerically, for tests and answer keys only.
- [ ] Node tests:
  - for every waveform and n from 0 to 10, the product's average over one period equals the tabled coefficient (aₙ for cos, bₙ for sin, with the usual factor of 2 for n ≥ 1);
  - for a pure sine, the n = 2 and n = 3 products average to zero.
- [ ] The Analysis Display passes display-fit.
- [ ] Playwright: after switching to Analysis, changing cos/sin and changing n each change the shaded product.

## Comments
