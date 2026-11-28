# 02: Bulk slab: bands, gap, temperature and water table

**What to build:** Bulk Mode shows one slab's band diagram, with energy up and position across.

- **f(E) strip:** a narrow occupancy strip on the same energy axis, to the slab's right.
- **Water table:** E_F drawn as a dashed line across both the slab and the strip.
- **Material:**
  - A picker chooses "partly filled band" (metal) or "filled band."
  - For a filled band, a gap slider has a semiconductor region and an insulator region marked on it, judged against kT.
- **Temperature:**
  - A slider sprays droplets across the gap and leaves bubbles behind.
  - It smears f(E).
  - It moves E_F into the gap for a filled band.
- **Liquid:** electrons are a blue liquid filling each band from its bottom edge, and holes are bubbles at the top of the valence band.
  - Ripples animate on a surface only where the band has both carriers and headroom.
  - A full band and an empty band never ripple.
- **Water/Textbook toggle:**
  - Textbook view removes the liquid fill, ripples, bubbles and metaphor colour, and leaves labelled E_c, E_v and E_F lines with plain carrier marks.
  - The geometry is identical in both views, because it comes from one render path with a style switch.
- **Pause:** stops the ambient animation. Under prefers-reduced-motion nothing animates, and surfaces are drawn as static wavy lines.

See [spec](../spec.md): Shared conventions, Bulk Mode, The band engine (Bulk statistics), Rendering, Animation.

**Blocked by:** 01 (Tool shell and Atoms Mode).

**Status:** ready-for-agent

- [ ] The engine returns E_F, f(E), and the electron and hole densities for a given material, E_g and T:
  - E_F lies inside a partly filled band, and mid-gap for an undoped filled band.
  - Raising T raises the intrinsic carrier density, and a wider gap at fixed T gives fewer carriers.
  - Unit tests cover all of this.
- [ ] The Bulk Display draws the slab, the f(E) strip and the water table. The gap slider shows the semiconductor and insulator regions.
- [ ] Ripples appear only where the band has carriers and headroom. A full band and an empty band show none.
- [ ] The Water/Textbook toggle and the pause Control use shared Control ids, for reuse by the Junction Mode.
- [ ] Switching views leaves the band-edge geometry unchanged. An e2e test asserts this.
- [ ] One animation loop drives the ripples. It is cancelled on destroy and stopped by pause. Under prefers-reduced-motion it doesn't run, and static wavy surfaces are drawn.
- [ ] The State publishes the material, E_g, T, the view, paused, E_F and both carrier densities.
- [ ] The Display still passes display-fit.
