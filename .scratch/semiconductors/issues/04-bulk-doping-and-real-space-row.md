# 04: Bulk doping and the real-space row

**What to build:** Doping in Bulk Mode, at room temperature with every dopant ionized.

- **Controls:** the student picks the doping type (none, n or p) and moves a concentration slider.
- **What changes:**
  - E_F moves toward the conduction band for n-type and toward the valence band for p-type, monotonically with concentration.
  - The majority carriers appear.
  - The minority carriers visibly shrink, so np = n_i² holds; the readout shows this without deriving it.
- **Dopant levels:** drawn as short dashes in the gap, with no charge marks. Donor levels sit just below E_c and acceptor levels just above E_v.
- **The real-space row:** a strip under the slab showing:
  - a faint grid of neutral host-lattice atoms, with no charge marks;
  - dopants as substitutions in that grid, drawn as ⊕ (donor) or ⊖ (acceptor);
  - the mobile carriers, as electron dots and hole circles.
- **Net charge:** a readout that always shows 0.
- **Not modelled:** freeze-out, compensation and the hot-intrinsic regime.

See [spec](../spec.md): Shared conventions (real-space row, dopant levels), Bulk Mode (Doping), The band engine (Bulk statistics).

**Blocked by:** 02 (Bulk slab: bands, gap, temperature and water table).

**Status:** ready-for-agent

- [ ] The engine handles doping:
  - n-type moves E_F toward E_c and p-type toward E_v, monotonically with concentration.
  - np = n_i² across doping levels.
  - The ionized dopant density equals the doping.
  - Net charge = 0 for every doping.

  Unit tests cover this.
- [ ] Dopant-level dashes are drawn in the gap, with no charge marks.
- [ ] The real-space row shows the faint neutral lattice, the ⊕/⊖ dopant substitutions and the mobile carriers. Their counts track the engine's densities, with minorities visibly shrinking.
- [ ] The real-space row is a reusable Display piece that the Junction Mode (ticket 06) can stack under its band diagram on a shared x-axis.
- [ ] The net-charge readout shows 0.
- [ ] The State publishes the doping type, the concentration, E_F, both densities and the net charge.
- [ ] The Display still passes display-fit.
