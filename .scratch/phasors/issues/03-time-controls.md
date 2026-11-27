# 03: Time controls: rotation and projection

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The phasors become rotating vectors.

- **Play/pause:** play rotates every phasor at ω, looping t modulo one period. A period always takes a few seconds of real time, whatever ω is.
- **Time:** a t-scrubber, plus a draggable time cursor on the time plot.
  - Each phasor's real-axis projection meets its curve at the cursor.
  - The Tool starts paused at t = 0.
- **Frequency:** an ω control (rad/s), with a read-only f = ω/2π readout.

These Controls have the same ids in both Modes, so that the Circuit Mode reuses them.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Play/pause, the t-scrubber and the time cursor are Controls whose state is shared within one mounted instance.
- [ ] Play is cancelled on destroy, following the Fourier Tool.
- [ ] The rotating drawing uses an engine function that rotates a phasor A∠(ωt + φ).
- [ ] The projection of each phasor on the real axis is drawn, and lines up with its curve at the cursor.
- [ ] The relative angle between v₁ and v₂ visibly stays fixed while they rotate.
- [ ] State publishes t, playing, ω and f.
- [ ] Node test: the real part of the rotated phasor equals A cos(ωt + φ) at many t.
- [ ] Playwright tests:
  - play advances t and pause stops it;
  - dragging the time cursor changes t;
  - changing ω updates the f readout.
