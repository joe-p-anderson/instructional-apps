# 03: Bench-scope uses the banner layout and fills it

Spec: .scratch/theme-refresh/spec.md (decision 2); see also docs/specs/0002-bench-scope.md.

**Blocked by:** 02

**Status:** resolved

**What to build:** Bench-scope declares `layout: 'banner'`. The front panel then scales to fill the full-width Display, which fixes the review's finding that the panel's labels are about 5–8 px at 1366×768.

- [x] `tools/bench-scope` declares `banner`. The source panel's sections sit in the Controls strip below the Display.
- [x] The front-panel SVG scales to the Display area's size (width and height, keeping its aspect ratio) instead of a fixed size. No empty band is left below it.
- [x] The screen canvas renders at `devicePixelRatio` so its readouts are sharp.
- [x] At 1366×768 the median panel label is at least 11 px tall (it was 8 px).
- [x] Playwright: measure the panel label height and check for no page scroll at 1366×768.

## Comments

2026-11-25: Implemented on integration branch `theme-refresh` (tip 93ec290, includes code-review fixes). `npm test` 230/230, `npm run test:e2e` 109/109.
