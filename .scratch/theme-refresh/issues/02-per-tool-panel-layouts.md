# 02: Per-Tool panel layouts (side, strip, banner)

Spec: .scratch/theme-refresh/spec.md (decisions 2 and 3).

**Blocked by:** 01

**Status:** resolved

**What to build:** A Tool declares one of three panel layouts. The framework's frame applies it in both Standalone mode and the Activity runner. The prototype CSS is in `framework/v1/prototype-themes/layout-1.css` (`side`) and `layout-3.css` (`banner`).

- [x] Tool contract: an optional `layout: 'side' | 'strip' | 'banner'`, defaulting to `'side'`. `defineTool()` validates it. Document it in the `tool.js` header and the README.
- [x] The frame sets a layout class (for example `fw-layout-side`). All layout rules live in `theme.css`, keyed on that class.
- [x] `side`: Tasks in a 330 px column to the right of the Display. The current Task is outlined, finished Tasks show their title and result only, and locked Tasks show one line saying why.
- [x] `strip`: today's layout, unchanged.
- [x] `banner`: the current Task is a banner above the Display, and the other Tasks are compact steps. The Display is full width, and the Controls' sections sit side by side in a strip below it.
- [x] Each Part tab shows a progress badge ("1/3"), filled when the Part is complete, in every layout.
- [x] The oscilloscope declares `side`.
- [x] Playwright: each layout fits 1366×768 with no page scroll, and the current Task's Submit is visible without scrolling.
- [x] Settle the spec's open questions on Activity overrides and Standalone `banner` before building. (Settled in the spec's Resolved questions: layout fixed per Tool; Standalone `banner` keeps the full-width Display with Controls below.)

## Comments

2026-11-25: Implemented on integration branch `theme-refresh` (tip 93ec290, includes code-review fixes). `npm test` 230/230, `npm run test:e2e` 109/109.
