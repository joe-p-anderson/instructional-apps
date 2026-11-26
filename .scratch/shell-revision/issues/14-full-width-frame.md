# 14: Full-width frame and per-Tool maximum Display width

Spec: .scratch/shell-revision/spec.md (Tool contract, frame width; stories 82–86).

**What to build:** The page frame no longer stops at 1280 px. It fills the window, so a 1366 laptop loses no side margins, and a 1920-wide projector gives the extra width to the Display.
- **Maximum Display width:** a Tool may declare an optional `maxDisplayWidth`, a positive number of CSS pixels and at least `minDisplayWidth`. It is unlimited unless declared.
- **Placement:** Controls and Tasks keep their fixed widths at the window edges. Once the Display reaches its maximum, it centres in the space between them, and the same applies in `banner` and `strip`.
- **Existing Tools:** each is checked at 1920×1080, and a maximum is declared where a drawing degrades when stretched. Likely candidates are electrostatics' square plots and bench-scope's panel.

**Blocked by:** 03 (Task drawer and per-Tool minimum Display width). Both change the same Tool-contract validation and the frame's width logic, and this ticket validates against `minDisplayWidth`.

**Status:** ready-for-agent

- [ ] `defineTool()` accepts a positive `maxDisplayWidth` no smaller than `minDisplayWidth`, leaves it unset by default, and rejects other values (framework unit tests). It is documented in the Tool contract and the README.
- [ ] e2e at 1920×1080: on every Activity and Standalone page the frame spans the viewport, and the header row spans the full width.
- [ ] e2e at 1920×1080: in `side`, the Controls are at the left edge and the Tasks at the right.
- [ ] e2e: a Tool with a declared maximum has a Display no wider than it, centred in its region.
- [ ] e2e: a Tool without one has a Display that fills its region.
- [ ] e2e: at 1366×768 the layouts still fit with no page scroll, and the current Task's Submit is visible (existing layouts spec).
- [ ] Each existing Tool is checked at 1920×1080, and any declared maximum is noted with a one-line reason beside the declaration.
