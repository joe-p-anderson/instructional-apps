# 02: electrostatics Tool with its electric-field Mode, in Standalone mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `electrostatics` Tool with no Activity and gets an "Electric field" tab that behaves like the Electric Fields tab in conductor_properties.

- They set Q, θ (with the arc picker) and E₀ (with the joystick, or by typing E₀x and E₀y).
- They toggle the induced-charge and charge-overlay views and watch the charges animate.
- They read |E₀|, its angle and |E|max.
- Their setup is autosaved and can be shared by link.

This is the tracer bullet for the whole Tool. It proves the Tool definition, the DOM-free maths module, the custom Controls and the Plotly Display on one Mode.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Tool is defined with id `electrostatics` and declares its `electric-field` Mode. The other two Modes come in tickets 03 and 04.
- [x] The conductor maths (the field, σ, and the superposition of the induced and applied cases) lives in a DOM-free module. The conductor radius is 5 cm and the window is ±10 cm, as in the old app and the matplotlib reference scripts.
- [x] The Controls keep the old ranges and defaults:
  - [x] Q (−3 to 3 nC, step 0.1) as a UI-kit slider.
  - [x] θ (0 to π/2) as a custom arc-picker Control, paired with a number box and a reset button.
  - [x] E₀ as a custom joystick Control (|E₀| ≤ 2000 V/m), paired with E₀x and E₀y boxes and a reset button.
  - [x] Toggles for induced charges and the charge overlay.
- [x] The custom Controls implement the full Control interface (get, set, lock, unlock, show, hide), and a locked one can't be dragged.
- [x] The State holds Q, E₀x, E₀y, |E₀|, the angle of E₀, θ, both toggle flags and |E|max, each with a label and unit.
- [x] The Display is a Plotly plot (the |E| heatmap, quiver arrows and the σ ring) with a PNG snapshot.
- [x] The charge animation runs only while its instance is visible and stops on destroy. Two instances on one page don't interfere.
- [x] The Tool uses no globals, no document-wide listeners and no document-level id lookups. It uses the v1 theme and the vendored Plotly.
- [x] Node tests of the maths module cover field superposition and the zero bulk field in equilibrium.
- [x] A Playwright Standalone smoke test shows that the tab loads with every Control unlocked, that changing Q updates the State, and that a reload and a share link restore the same setup.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 4c2fcf6); code-review fixes in 7c50e19.
