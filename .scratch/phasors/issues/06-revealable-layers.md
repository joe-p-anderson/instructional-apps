# 06: Revealable layers as Controls

Spec: .scratch/phasors/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** Each quantity an Activity asks students to compute can be hidden until they submit it:

- the Sum Mode's resultant;
- the Circuit Mode's Z_total, I, V_R, V_L, V_C and the KVL closure.

Each of these becomes a trace-visibility Control, because the framework's Task `hide` list acts on Control ids. Hiding the Control removes its layer from every Display, along with any readout of that quantity. No framework change is needed.

**Blocked by:** 02, 05

**Status:** resolved

- [ ] Each revealable layer is a Control with a stable id. Its hide()/show() hides or shows the toggle, the drawn layer on every Display, and the matching readouts.
- [ ] Hiding I also hides i(t) on the time plot and the I scale.
- [ ] Hiding Z_total also hides the Z_total readout and ∠Z, but not Z_R, Z_L or Z_C.
- [ ] In Standalone mode every layer is shown by default and can be toggled.
- [ ] Runner-core test with `stubTool`: a Task's `hide` list hides each layer, and the next Task's `show` brings it back.
- [ ] Playwright test: hiding a layer Control removes the layer from the Displays.
