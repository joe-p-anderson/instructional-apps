# 09: Port the electrostatics handles to the kit

Spec: .scratch/shell-revision/spec.md (UI kit; story 69).

**What to build:** The electrostatics Tool's E₀ joystick, θ arc picker and the draggable P₁ and P₂ points use the kit's `handle`, so they can be focused, moved with the arrow keys and dragged on a tablet without scrolling the page. Conductor Properties can then be completed without a pointer.

**Blocked by:** 08 (kit handle and knob).

**Status:** ready-for-agent

- [x] e2e: the joystick, arc picker, P₁ and P₂ can each be focused and moved with the arrow keys in every Mode they appear in, and the Live Metrics update.
- [x] e2e: the Conductor Properties Tasks that need these Controls pass using only the keyboard.
- [x] The joystick no longer has `role="img"`.
- [x] The existing electrostatics e2e specs pass.
