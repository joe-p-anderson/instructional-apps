# 06: Junction at equilibrium: the stack

**What to build:** Junction Mode shows a symmetric p–n junction, already joined, at zero bias.

- **The stack:** a vertical stack sharing one x-axis, with depletion-edge guides through all of it:
  1. band diagram;
  2. real-space row (reused from ticket 04);
  3. ρ(x);
  4. E(x).
- **What it shows:**
  - E_F is a flat water table and the bands bend.
  - Fullness varies with position: an electron puddle on the n side, bubbles on the p side, and a middle that is dry above and full below, with no ripples in either band.
  - The real-space row shows ions with no partner in the depletion region.
  - Two opposing flow arrows across the junction (climbers n → p, rollers p → n) are equal in width.
  - A one-line note says the bent band edge already is the potential, in electron-energy units. No V(x) plot is drawn.
- **Shared Controls:** the Water/Textbook toggle and pause work here, with the same ids as in Bulk Mode.
- **Doping:** fixed and symmetric.
- **Region model:** the engine's junction is built from a composable description of regions (doping type and extent) and contacts, so that a later n–p–n BJT Mode is an extension, not a rewrite.

See [spec](../spec.md): Junction Mode, The band engine (Junction profile, Flows, BJT readiness).

**Blocked by:** 04 (Bulk doping and the real-space row).

**Status:** ready-for-agent

- [ ] The engine's junction profile at V = 0 returns E_c(x), E_v(x), the depletion edges and width, the electron and hole densities, ρ(x), E(x), and the climber and roller flows. Unit tests check:
  - E_F is flat;
  - the barrier height equals V_bi;
  - ∫ρ dx = 0;
  - E(x) is zero outside the depletion edges and peaks at the junction;
  - the bend is consistent with E(x);
  - the climber and roller flows are equal.
- [ ] The junction is defined from a list of regions and contacts, not a hard-coded two-sided shape.
- [ ] The Display stacks the band diagram, the real-space row, ρ(x) and E(x) on one x-axis, with depletion-edge guides. The stack never scrolls and passes display-fit. Declare `minDisplayWidth` if it needs one.
- [ ] In the depletion region the conduction band shows no liquid and the valence band shows no bubbles, so there are no ripples. The real-space row shows unpartnered ions there.
- [ ] Two opposing flow arrows of equal width are drawn at equilibrium.
- [ ] The Water/Textbook toggle keeps the geometry identical in Junction Mode. An e2e test asserts this.
- [ ] The State publishes the depletion width and edges, the barrier height, and the climber, roller and net flows.
