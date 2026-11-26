# 07: Slider labels, icon reset and keyboard tidy-up

Spec: .scratch/shell-revision/spec.md (UI kit; stories 58–62, 68).

**What to build:** Kit sliders and number boxes look like this, in every Tool at once:
- The label is written "Label (unit)".
- The accessible name is the visible label with its unit, never the Control's id.
- The reset is an icon-only ↻ button named and titled "Reset to <default> <unit>", disabled while the value equals the default.

Rendered maths (MathJax) no longer adds tab stops.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] e2e (ui-kit spec): a slider with a unit shows "(unit)", and its range and number inputs have accessible names from the label.
- [x] e2e: the reset button's accessible name is "Reset to …", it is disabled at the default and enabled after a change, and clicking it restores the default.
- [x] e2e: on the oscilloscope Activity and spacetime Lab 10, no MathJax element is in the Tab order.
- [x] The existing per-Tool e2e specs pass, with locators by name updated where labels changed.
