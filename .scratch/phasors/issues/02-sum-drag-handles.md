# 02: Linked drag handles in the Sum Mode

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** Students set each sinusoid by dragging, in either view.

- **On the complex plane:** drag a phasor's tip.
- **On the time plot:** drag the crest handle at the crest nearest t = 0.
  - Vertical movement sets A.
  - Horizontal movement sets φ (the crest sits at t = −φ/ω).

The two views and the number inputs always agree, because they are views of the same four values.

**Blocked by:** 01

**Status:** resolved

- [ ] Phasor tips are 2-D kit `handle`s on the complex plane.
- [ ] Crest handles are 2-D kit `handle`s, mapped through an engine crest mapping: (A, φ) ↔ crest (t, A).
- [ ] Dragging either handle updates the other handle, both Displays and the number inputs, with no drift.
- [ ] All handles are keyboard-operable (arrows, Shift+arrow) and lock and hide like any Control.
- [ ] Node test: the crest mapping round-trips (A, φ) → (t, A) → (A, φ) across φ in (−180°, 180°].
- [ ] Playwright tests:
  - dragging a phasor tip moves the matching crest handle, and the reverse;
  - the keyboard nudges a handle.
