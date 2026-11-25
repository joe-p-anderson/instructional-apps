# 05: The app-ports Tools follow the Refined Cream theme

Spec: .scratch/theme-refresh/spec.md (decision 1 and the plot-tokens resolved question). Follow-up found while merging main (app-ports) into theme-refresh.

**Status:** needs-triage

**Problem:** The Tools added by app-ports (docs/specs/0003-app-ports.md) were written against the old theme. Some of their own styling now contradicts ticket 01's rules:

- **Small caps:** the theme no longer uses `font-variant: small-caps`, because Libre Baskerville has to fake it (see the `theme.css` header). Two Tools still use it:
  - `tools/spacetime/spacetime.js`, `.st-side h2`
  - `tools/least-squares/least-squares.js`, `.ls-caption`
- **Hard-coded plot font:** `tools/electrostatics/plot.js` sets Plotly's font to `'Baskerville Old Face', Baskerville, Georgia, serif`. It should take the font from the plot tokens, as the oscilloscope does through `plotTheme()` in `framework/v1/plot-theme.js`.

**Open question:** main's `themeVars()` (`framework/v1/ui-kit.js`) and theme-refresh's `plotTheme()` now both read theme variables for drawing.
- `themeVars()` falls back to a built-in palette.
- `plotTheme()` throws if a token is missing.

Should `plotTheme()` be rebuilt on top of `themeVars()`, so there is one reader, or should both stay?

**What to build:**

- [ ] Section-style captions in spacetime and least-squares are upright capitals or normal case, matching the framework's section labels, with no small caps.
- [ ] The electrostatics plot reads its font, and its palette where it fits, from the theme's plot tokens.
- [ ] Settle the `themeVars()` / `plotTheme()` question above, and update `framework/v1/README.md` to match.
- [ ] Playwright: extend the no-small-caps check in `tests/e2e/theme.spec.js` to the electrostatics, spacetime and least-squares pages. Extend the contrast audit to them too, if they pass it.
