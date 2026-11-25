# 01: Bench-scope skeleton: TBS panel with a live CH1 trace

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** A student opens the bench-scope Tool's Standalone page and sees the TBS2072B front panel with a live CH1 trace on its screen. The source panel beside it sets the CH1 generator. Reloading keeps the setup, a share link reproduces it, and the screen can be saved as a PNG. This lays down the Tool's folder, the DOM-free scope engine's interface and both test seams. Later tickets add behaviour behind that same interface.

**Blocked by:** None (can start immediately; framework v1 has landed)

**Status:** ready-for-agent

- [ ] The Tool has its own folder under the tools directory, laid out like the `oscilloscope` Tool: a Tool module, a pure engine module, and a Standalone page calling `mountStandalone`. The panel generator, both SVGs and the control map move there from `oscilloscope-sim`, and the generator still regenerates them in place.
- [ ] The Tool is `defineTool`-valid, with id `bench-scope`, title "Bench Oscilloscope" and one Mode. It keeps no global state and can be mounted twice on one page.
- [ ] Engine interface: create (skin profile + Setup), input events (`turn`/`push`/`press`/`softkey`/`setSource`), `acquire(now)` returning a frame, `state()`, `serialize()`/`restore()`. The engine has no DOM.
- [ ] CH1 generator: sine, square or triangle; frequency 1 Hz–100 kHz; amplitude up to 20 Vpp; DC offset.
- [ ] The TBS SVG is inlined, with the screen canvas overlaid on the control map's screen rectangle at 800×480 with pixelated scaling. It shows the 15×8 graticule and the CH1 trace at fixed default scales, plus basic readouts.
- [ ] The source panel uses UI-kit Controls (a waveform select, and sliders with number boxes and resets for frequency, amplitude and offset). They are registered in the Control registry.
- [ ] State, with labels and units: the source settings, plus the true CH1 frequency and Vpp.
- [ ] Autosave and the `#s=` share link work through serialize/restore.
- [ ] The `screen` Display's `snapshot()` returns a PNG of the canvas at native resolution.
- [ ] The "Oscilloscope panels: control test" artifact's wheel and push binding is the prototype for the panel binding.
- [ ] Node test: the engine's acquired CH1 samples match the generator (amplitude, period, offset) for each waveform, and serialize/restore round-trips.
- [ ] Playwright: the page loads with one Mode tab, the canvas draws, the source Controls are registered and unlocked, and there is no horizontal scroll at 1366×768.
