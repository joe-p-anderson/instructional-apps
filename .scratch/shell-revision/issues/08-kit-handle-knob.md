# 08: Kit handle and knob Controls, with the oscilloscope markers ported

Spec: .scratch/shell-revision/spec.md (UI kit; stories 63–67, 69).

**What to build:** The UI kit gains two Controls, both built on the base Control, so they lock, unlock, hide, show, get and set like any other.
- **`handle`:** a draggable handle in 1-D and 2-D forms.
  - It is focusable, the arrow keys nudge it, Shift+arrow moves a coarse step, and Home/End go to the bounds in 1-D.
  - Pointer dragging uses `touch-action: none`.
  - Its accessible name and value come from the label, with both coordinates in 2-D.
  - The Tool supplies the mapping between value and screen position.
- **`knob`:** bench-scope's rotary pattern moved into the kit.

The oscilloscope's draggable markers move onto `handle`, and bench-scope's knobs move onto `knob`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] e2e (ui-kit spec, on a fixture): a 1-D and a 2-D handle move with the arrow keys, Shift steps further, locked handles ignore keys and pointer, and the value is announced.
- [x] e2e: each oscilloscope marker can be focused and moved with the arrow keys, which updates the State the same way a drag does.
- [x] The bench-scope knob e2e specs still pass on the kit's knob.
- [x] The framework README's UI kit table documents `handle` and `knob`.
