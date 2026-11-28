# 03: Bulk tilt and hole current

**What to build:** A tilt slider in Bulk Mode stands for an applied field. It slopes the slab's bands.

- **Partly filled band:** the liquid drifts and ripples.
- **Full band:** the liquid doesn't move.
- **Semiconductor at nonzero temperature:** droplets in the conduction band roll one way while bubbles in the valence band drift the other. A current indicator shows that both give current in the same direction.

The drift direction and size are published so that Conditions can test them, including whether the tilt has been applied.

See [spec](../spec.md): Bulk Mode (Tilt), The band engine (Tilt).

**Blocked by:** 02 (Bulk slab: bands, gap, temperature and water table).

**Status:** ready-for-agent

- [ ] The engine returns sloped band edges and the electron and hole drift for a given field:
  - zero drift for a completely full band and for an empty band;
  - electrons and holes drifting in opposite directions, with current of the same sign.

  Unit tests cover this.
- [ ] The Display slopes the bands with the tilt and animates drift. A full band shows no motion.
- [ ] Bubbles visibly drift opposite to droplets. A current-direction indicator is the same for both.
- [ ] The State publishes the tilt, the electron and hole drift, and a "tilt applied" flag for Conditions.
- [ ] The tilt behaves identically in Textbook view, apart from the styling.
