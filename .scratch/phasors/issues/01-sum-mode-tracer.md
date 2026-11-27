# 01: Sum Mode tracer: adding two sinusoids

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A new Tool, `phasors` ("Phasors and Impedance"), that opens in Standalone mode with a Sum Mode tab.

- **Inputs:** the student sets A₁, φ₁, A₂ and φ₂ with number inputs, at a fixed ω.
- **The complex plane** shows three phasors:
  - v₁;
  - v₂, drawn from v₁'s tip;
  - the resultant A∠φ.
- **The time plot** shows v₁(t), v₂(t) and the sum, as A cos(ωt + φ).

This ticket lays the end-to-end path that every later ticket builds on: the pure phasor engine, the Tool contract with Modes, the Displays, State, the Standalone page and the site listing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A pure engine module, with no DOM, does four things:
  - complex add, multiply and divide;
  - rectangular ↔ polar conversion, with angles in degrees;
  - the sum of two phasors;
  - evaluating a phasor as A cos(ωt + φ) at time t.
- [ ] The Tool follows the framework v1 Tool contract, with a `sum` Mode and panel layout `side`. It supports being mounted several times on one page.
- [ ] Readouts show every phasor in both a + jb and A∠φ° form, using j.
- [ ] The complex plane and the time plot sit side by side, in plot-theme colours, with each quantity in one colour across both Displays.
- [ ] State publishes the Mode, A₁, φ₁, A₂, φ₂ and ω, plus the resultant A and φ, with units. The visual snapshot is a PNG of the Displays.
- [ ] The Standalone page exists, and the Tool is listed under PHY/EGR 3120 in the root index and the README, after the Fourier entries.
- [ ] The Displays never scroll, drawn text is at least 13 px, and the Tool is added to the display-fit spec's list.
- [ ] Node tests:
  - the sum matches the law of cosines for amplitude and atan2 of components for phase;
  - at 0° the sum is A₁ + A₂ and at 180° it is |A₁ − A₂|;
  - the time-domain sum equals v₁(t) + v₂(t) at many t;
  - rectangular ↔ polar round-trips.
- [ ] Playwright tests:
  - the Standalone page loads;
  - changing an input moves the phasor and the curve.
