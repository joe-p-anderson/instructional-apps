# 06: Spectrum and filter-curve Displays in Analysis Mode

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** Analysis Mode gains two Displays.

- **The spectrum:** Aₙ bars and φₙ stems for either the input or the filtered output, chosen with a spectrum-source Control. Students can see that output Aₙ = input Aₙ·|H| and output φₙ = input φₙ + ∠H.
- **The filter curves:** gain and phase shift plotted against f, with f_c marked and each harmonic marked on both curves.

Each Display has its own id, so Activity show/hide lists can hide and reveal it.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] The spectrum Display shows Aₙ bars and φₙ stems (in degrees) for n from 0 to 10, taken from the engine's tables. A spectrum-source Control (input/output) is published in State.
- [ ] The filter-curve Display:
  - plots gain and phase against f, with f_c marked and a marker at each harmonic nf₀;
  - shows the selected filter type and responds to f_c;
  - says the filter is off, when it is, instead of drawing flat lines.
- [ ] Both Displays have distinct ids that Activity show/hide lists can use. Hiding them leaves the product Display usable.
- [ ] In Standalone mode both are always shown.
- [ ] All three Analysis Displays fit together without scrolling, including in the narrow-screen layout, and pass display-fit.
- [ ] Node test: at each harmonic, the output spectrum entries equal the input entries scaled by |H| and shifted by ∠H, honouring the gain and phase toggles.
- [ ] Playwright:
  - with a filter on, switching the spectrum source changes the bars;
  - changing f_c moves the f_c marker.

## Comments
