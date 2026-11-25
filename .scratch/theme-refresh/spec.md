# Theme refresh: Refined Cream look and per-Tool panel layouts

Vocabulary follows GLOSSARY.md. Builds on framework v1 (Spec 0001) and respects ADR 0003 (major-versioned framework folder).

Status: needs-triage

## Background

The UX review of 2026-11-25 scored Framework v1 at 6.2/10, with most points lost on visual style and accessibility. The full review is at https://claude.ai/artifact/NDnRnLkuiL1hvuJuRS5aBM. The main causes:

- The muted and Hint colours in `theme.css` fail WCAG contrast (3.09:1 and 2.65:1).
- Question prompts are red, so they read as errors.
- Locked Tasks are faded to 0.32 opacity, so they can't be read.
- The typeface is Windows-only.
- The Task strip takes a third of the screen height at 768 px.

## Decisions (2026-11-25)

The prototype these came from is `tools/oscilloscope/activities/phase-period-amplitude.prototype-themes.html` with `framework/v1/prototype-themes/`. Screenshots are in `.scratch/theme-prototype/`.

1. **Theme: A, Refined Cream.**
   - Keep the current cream-and-serif identity.
   - Self-host Libre Baskerville.
   - Contrast-safe tokens: muted `#6E604A`, Hint `#8A5F00`.
   - Section labels become upright capitals.
   - Question prompts use the text colour with a blue left rule.
   - Hints sit in a tinted box.
   - Locked Tasks are at 0.6 opacity and say why they are locked.
   - Slider thumbs grow to 18 px.
2. **Layouts: three named panel layouts, chosen per Tool, in this order of preference.**
   - **`side`** (prototype L1). Controls | Display | Tasks, with Tasks in a column on the right. Finished Tasks collapse to their title, and locked Tasks show one line saying why. This is the default.
   - **`strip`** (today's layout). Controls | Display, with Tasks in a strip across the bottom.
   - **`banner`** (prototype L3). The current Task is a banner above the Display, and the other Tasks are compact steps. The Display is full width, with Controls in a horizontal strip below it. Wide Tools such as bench-scope need this; the oscilloscope uses `side`.
3. Each Part tab shows a progress badge ("1/3") in every layout.

## Resolved questions (2026-11-25)

- **Activity override of layout:** no. The layout is fixed per Tool, as part of the Tool contract.
- **Standalone `banner`:** yes. In Standalone mode `banner` still puts the Display full width with the Controls in a strip below it; only the Task banner is absent.
- **Plot tokens:** yes. The theme exposes `--fw-plot-*` CSS custom properties (plot colours and font) and Tools read them at runtime instead of hard-coding palettes such as the `C` palette in `oscilloscope.js`. Built in ticket 01.
