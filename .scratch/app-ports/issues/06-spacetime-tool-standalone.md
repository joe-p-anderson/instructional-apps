# 06: spacetime Tool in Standalone mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `spacetime` Tool with no Activity and gets the full spacetime-diagrams sandbox.

- The K and K′ diagrams sit side by side.
- The Event, Worldline, Rod, Join and Select tools work, along with their keyboard shortcuts.
- The student can set v/c or γ and flip it, and toggle the grids and the K′ panel.
- They can use the object sidebar and the measurements, undo and redo, export and import JSON, and save a PNG.

The diagram is autosaved and can be shared by link through the framework, instead of through the old app's own autosave and share link.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Tool is defined with id `spacetime` and one Mode, `diagram`.
- [x] The Lorentz maths, the interval and its classification, proper time along chains, and diagram normalization live in a DOM-free module.
- [x] Coarse Controls are registered, with none per object:
  - [x] one per drawing tool;
  - [x] v/c with its slider, γ, and flip;
  - [x] the K grid, the K′ grid and the K′ panel;
  - [x] `primed`, which hides every x′/t′ readout and input, including "Fixed in K′" coordinate entry, but not a rod's frame select;
  - [x] the measurements panel;
  - [x] undo, redo, JSON export and JSON import;
  - [x] new diagram, reset view and Save PNG.
- [x] The Setup accepts v, the frame names, the grid and K′-panel flags, and an optional starting list of objects.
- [x] The State holds v, γ, and the counts of events, worldlines and rods. The `diagram` State value comes in ticket 07.
- [x] serialize and restore round-trip the diagram, and a restore clears the undo and redo stacks.
- [x] The old autosave key and the old `#s=` hash handling are removed. The framework's Standalone autosave and share link replace them.
- [x] JSON import and export keep the existing format and validation. An import is one undoable step.
- [x] The Display snapshot is the existing composite PNG of both diagrams with its header. Save PNG downloads that snapshot.
- [x] The Tool uses no globals and no document-level lookups. Keyboard shortcuts act only on the instance that has focus or is under the pointer. Cursor styling is per instance, and the Tool uses the v1 theme.
- [x] Node tests of the maths module cover:
  - [x] the transforms and γ;
  - [x] interval classification;
  - [x] proper time, with the partial and spacelike flags;
  - [x] normalizing a saved diagram.
- [x] A Playwright Standalone smoke test checks that:
  - [x] every Control is unlocked;
  - [x] drawing an event updates the State;
  - [x] undo and redo work;
  - [x] a JSON export/import round trip works;
  - [x] a reload and a share link restore the same diagram.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge cd8124a); code-review fixes in 7c50e19. With primed hidden, a K′ rod's t′/x′ inputs and length are hidden too.
