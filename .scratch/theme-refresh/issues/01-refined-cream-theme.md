# 01: Refined Cream theme

Spec: .scratch/theme-refresh/spec.md (decision 1).

**Status:** needs-triage

**What to build:** Fold prototype theme A (`framework/v1/prototype-themes/a.css`) into `framework/v1/theme.css`, and rewrite it properly rather than copying it.

- [ ] Self-host Libre Baskerville (regular, italic, bold) as woff2 in `framework/v1/vendor/`, with `@font-face` in `theme.css`. `--fw-font` starts with it; no CDN.
- [ ] Set `--fw-text-muted: #6E604A` and `--fw-yellow: #8A5F00`. Every text token reaches 4.5:1 on `--fw-bg` and `--fw-surface`.
- [ ] Section labels are upright capitals (no small caps). Prompts and hints are not italic.
- [ ] Question prompts use the text colour with a blue left rule, not red.
- [ ] The Hint sits in a tinted box with a left rule.
- [ ] Locked Task cards are at 0.6 opacity and say they are locked. Locked Controls are at 0.55.
- [ ] Slider thumbs are 18 px and round, on a 4 px track.
- [ ] Buttons, tabs and reset buttons show a visible `:focus-visible` outline.
- [ ] The theme exposes plot tokens (`--fw-plot-*`: trace/grid/axis/background colours and plot font) in `theme.css`, with a small framework helper to read them. The oscilloscope reads its palette (`C` in `oscilloscope.js`) and Plotly font from these tokens instead of hard-coding them, so the Plotly font matches the new typeface. (See spec, Resolved questions.)
- [ ] Playwright: no visible framework text below 4.5:1 on the oscilloscope Activity page (reuse the contrast audit from the review).
