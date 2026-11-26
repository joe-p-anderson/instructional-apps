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

- [x] Section-style captions in spacetime and least-squares are upright capitals or normal case, matching the framework's section labels, with no small caps.
- [x] The electrostatics plot reads its font, and its palette where it fits, from the theme's plot tokens.
- [x] Settle the `themeVars()` / `plotTheme()` question above, and update `framework/v1/README.md` to match.
- [x] Playwright: extend the no-small-caps check in `tests/e2e/theme.spec.js` to the electrostatics, spacetime and least-squares pages. Extend the contrast audit to them too, if they pass it.

## Answer

One reader: `plotTheme()` is rebuilt on top of `themeVars()`. It maps the `--fw-plot-*` tokens through `themeVars(el, ...)` and reshapes them (`traces`, `font.size` in px). The plot tokens joined `themeVars`' fallback palette in `ui-kit.js`, resolved to the v1 values.

As a result `plotTheme()` no longer throws when a token is missing. It falls back to the v1 plot palette like every other drawing read. Its argument is now an element, as for `themeVars`, not a computed style. No caller broke: the oscilloscope calls `plotTheme()` with no argument, and only its unit test passed a computed style or relied on the throw. The test now checks the fallback. `framework/v1/README.md` is updated to match.

The electrostatics `plotColors()` now takes the plot ground, grid, axes, text and font from the plot tokens. Its marks keep the named theme colours (`--fw-blue`, `--fw-red`, ...), because the three `--fw-plot-trace-*` slots don't name what those marks mean. To pass the contrast audit, spacetime's tool-shortcut letters now use `--fw-text-dim` instead of `opacity: .7` (3.78:1).
