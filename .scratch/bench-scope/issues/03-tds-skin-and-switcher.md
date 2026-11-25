# 03: TDS2001C skin and skin switcher

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student switches between the new (TBS2072B) and old (TDS2001C) panels. The old panel draws its own 320×240 screen in its own style and drives the same engine. From this ticket on, every feature is built for both skins.

**Blocked by:** 02

**Status:** resolved

- [x] A skin profile holds the per-skin differences: resolution and graticule (800×480 with 15×8 divisions, or 320×240 with 10×8), the s/div sequence, the on-screen style (colours, fonts, readout and menu layout), the controls only one model has, and where XY lives in the menus.
- [x] The skin is a Setup value (TBS by default). Standalone exposes it through a `skin` select Control, because the Tool host has no Setup picker. It is saved through serialize, so reloads and share links keep it.
- [x] Switching skin keeps the engine settings both models support, clamps values to the new skin's ranges and resets menu state.
- [x] The TDS panel's vertical knobs work exactly as the TBS ones do. Its multipurpose LEDs light when the knob has a function.
- [x] State includes the active skin.
- [x] Node test: the same events on either skin give the same settings and readings; switching clamps out-of-range values.
- [x] Playwright: the switcher swaps panels, the canvas resizes to the new skin's native resolution, the skin survives a reload, and knobs work on the TDS.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (f9f3db7); review fixes in 9779e6a.
