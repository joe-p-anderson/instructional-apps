# 05: Impedance plane and schematic

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** Two more Circuit Mode Displays.

- **The static impedance plane:** Z_R along the real axis, Z_L up and Z_C down, drawn head-to-tail to Z_total, with ∠Z marked. The student sees series impedances add as complex numbers, and Z_L grow and Z_C shrink as ω rises.
- **A small series-loop schematic:** it shows the source and whichever of R, L and C are included.

**Blocked by:** 04

**Status:** resolved

- [ ] The impedance plane auto-scales to fit Z_total and the largest component impedance, with an Ω scale.
- [ ] Excluded elements disappear from both the impedance plane and the schematic.
- [ ] The layout fits the impedance plane, the phasor plane, the time plot and the schematic in the `side` layout, including the Task drawer form, and still passes display-fit.
- [ ] Playwright tests:
  - toggling an element updates the schematic and the impedance plane;
  - raising ω lengthens Z_L and shortens Z_C.
