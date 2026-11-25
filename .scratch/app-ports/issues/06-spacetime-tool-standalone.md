# 06: spacetime Tool in Standalone mode

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `spacetime` Tool with no Activity and gets the full spacetime-diagrams sandbox.

- The K and K′ diagrams sit side by side.
- The Event, Worldline, Rod, Join and Select tools work, along with their keyboard shortcuts.
- The student can set v/c or γ and flip it, and toggle the grids and the K′ panel.
- They can use the object sidebar and the measurements, undo and redo, export and import JSON, and save a PNG.

The diagram is autosaved and can be shared by link through the framework, instead of through the old app's own autosave and share link.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Tool is defined with id `spacetime` and one Mode, `diagram`.
- [ ] The Lorentz maths, the interval and its classification, proper time along chains, and diagram normalization live in a DOM-free module.
- [ ] Coarse Controls are registered, with none per object:
  - [ ] one per drawing tool;
  - [ ] v/c with its slider, γ, and flip;
  - [ ] the K grid, the K′ grid and the K′ panel;
  - [ ] `primed`, which hides every x′/t′ readout and input, including "Fixed in K′" coordinate entry, but not a rod's frame select;
  - [ ] the measurements panel;
  - [ ] undo, redo, JSON export and JSON import;
  - [ ] new diagram, reset view and Save PNG.
- [ ] The Setup accepts v, the frame names, the grid and K′-panel flags, and an optional starting list of objects.
- [ ] The State holds v, γ, and the counts of events, worldlines and rods. The `diagram` State value comes in ticket 07.
- [ ] serialize and restore round-trip the diagram, and a restore clears the undo and redo stacks.
- [ ] The old autosave key and the old `#s=` hash handling are removed. The framework's Standalone autosave and share link replace them.
- [ ] JSON import and export keep the existing format and validation. An import is one undoable step.
- [ ] The Display snapshot is the existing composite PNG of both diagrams with its header. Save PNG downloads that snapshot.
- [ ] The Tool uses no globals and no document-level lookups. Keyboard shortcuts act only on the instance that has focus or is under the pointer. Cursor styling is per instance, and the Tool uses the v1 theme.
- [ ] Node tests of the maths module cover:
  - [ ] the transforms and γ;
  - [ ] interval classification;
  - [ ] proper time, with the partial and spacelike flags;
  - [ ] normalizing a saved diagram.
- [ ] A Playwright Standalone smoke test checks that:
  - [ ] every Control is unlocked;
  - [ ] drawing an event updates the State;
  - [ ] undo and redo work;
  - [ ] a JSON export/import round trip works;
  - [ ] a reload and a share link restore the same diagram.
