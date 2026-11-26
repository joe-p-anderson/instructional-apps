# 02: Synthesis Mode tracer: square-wave Fourier series

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A new Tool, `fourier` ("Fourier Series"), that opens in Standalone mode with a Synthesis Mode tab.

- **The input:** a ±1 V, 1 kHz square wave.
- **N:** the student moves N, the highest harmonic number, from 0 to 100. A play/pause button steps N upward.
- **The time plot** shows four things on one set of axes:
  - the square wave;
  - the partial sum through harmonic N;
  - the N = ∞ curve, which is the ideal square wave, labelled as the infinite series;
  - the highest included harmonic, drawn faintly on its own.
- **Even harmonics:** they visibly add nothing.

This ticket lays the end-to-end path that every later ticket builds on: the pure Fourier engine, the Tool contract with Modes, the Display, State, the Standalone page and the site listing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A pure engine module, with no DOM, does three things for the square wave:
  - gives its exact, unsmoothed harmonic table in the cos convention: Aₙ = 4·amp/(πn) for odd n, φₙ = −90°, and zero for even n;
  - evaluates partial sums and single harmonics over time;
  - gives the N = ∞ curve.
- [ ] The Tool follows the framework v1 Tool contract with a `synthesis` Mode, and supports being mounted several times on one page. The `analysis` Mode arrives in 05.
- [ ] N is a UI-kit slider (integer, 0 to 100).
  - Play steps N at a fixed interval and stops at 100.
  - Pause stops it.
  - Play is cancelled on destroy.
- [ ] The time plot shows the input, the partial sum, the N = ∞ curve and the highest harmonic in plot-theme colours, with a legend.
  - Time is in ms and the vertical axis is in volts.
  - N = 0 shows only the DC term.
- [ ] No readout shows aₙ, bₙ, Aₙ or φₙ.
- [ ] State publishes the Mode, waveform, amplitude, f₀, DC offset, shift and N, with units. The visual snapshot is a PNG of the Display.
- [ ] The Standalone page exists, and the Tool is listed under PHY/EGR 3120 in the root index and the README.
- [ ] The Display never scrolls, drawn text is at least 13 px, and the Tool is added to the display-fit spec's list.
- [ ] Node tests:
  - the tabled square-wave coefficients match the textbook values;
  - each extra harmonic changes the partial sum by exactly that harmonic;
  - an even N adds nothing;
  - a high-N partial sum approaches the ideal square away from the jumps.
- [ ] Playwright tests:
  - the Standalone page loads;
  - moving N changes the partial sum;
  - play advances N and pause stops it.

## Comments
