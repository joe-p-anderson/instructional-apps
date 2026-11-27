# 01: Tool shell and Atoms Mode

**What to build:** The `semiconductors` Tool ("Bands and Junctions") on framework v1:

- **Layout:** `side`.
- **Modes:** `atoms`, `bulk` and `junction`, one tab per Mode in Standalone mode. Bulk and Junction are placeholders here.
- **Atoms Mode works end to end:**
  - The student moves an atom-count slider (1, 2, 4, 8 … "many") and an interatomic-spacing slider.
  - The Display shows a row of N potential wells with their energy levels above them.
  - Each atomic level splits into N levels. The splitting spreads as the spacing shrinks.
  - At "many", the levels merge into bands with a gap between them.
  - A marker shows the real crystal spacing.
- **Engine:** the pure band engine starts here, with level splitting only. It is the Tool's only source of physics.
- **Page:** a Standalone page, listed under PHY/EGR 3120 in the root index and the README after the Phasors entries.

See [spec](../spec.md): Atoms Mode, The band engine, Tool and Modes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Tool follows the framework v1 Tool contract with Modes `atoms`, `bulk` and `junction` and the `side` layout. Each Mode can be mounted several times on one page (ADR 0002).
- [ ] The engine is a pure module with no DOM. Its level splitting returns N levels per atomic level, with a spread that grows monotonically as the spacing shrinks, and band extents plus a gap at "many". node:test unit tests cover this.
- [ ] The Atoms Display draws the wells, the levels and the crystal-spacing marker. It never scrolls, and drawn text is at least 13 px.
- [ ] The State publishes the Mode, N, the spacing, the band width and the gap.
- [ ] The atom-count and spacing Controls are keyboard-operable.
- [ ] The Standalone page loads all three Mode tabs (Bulk and Junction may show placeholder Displays). It is listed in the index and the README.
- [ ] A Playwright Standalone spec covers the Mode tabs and the Atoms sliders. The Tool is added to the display-fit spec's list.
