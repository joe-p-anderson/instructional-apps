# 03: Task drawer and per-Tool minimum Display width

Spec: .scratch/shell-revision/spec.md (Tool contract; Frame and Task drawer; stories 1–18). Glossary: Task drawer, Panel layout.

**What to build:** A Tool may declare `minDisplayWidth`, a positive number of CSS pixels, defaulting to 480. In an Activity using the `side` layout, when showing the Tasks column would leave the Display narrower than that, the Tasks move into the Task drawer.
- **The bar:** sits above the Display and shows the current Task's number and title, its Submit button, the last feedback line and an expand toggle.
- **Opening:** the drawer overlays the Display, so the Display never resizes, and shows only the current Task card. Escape, the toggle or a click on the Display closes it.
- **Switching:** the page switches back and forth on resize or rotation without remounting Tools or losing Question drafts.
- **Standalone mode:** unaffected.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `defineTool()` accepts a positive `minDisplayWidth`, defaults it to 480, and rejects zero, negative and non-number values (framework unit tests). It is documented with `layout` in the Tool contract and the README.
- [x] e2e at 768×1024, on the oscilloscope, Conductor Properties and spacetime Lab 10 Activities: the drawer bar is shown, and the Display box is at least the Tool's minimum width.
- [x] e2e: Submit from the closed bar passes a Condition-only Task, and the bar moves on to the next Task.
- [x] e2e: a Task with Questions can be opened, answered and submitted. Opening the drawer leaves the Display's bounding box unchanged.
- [x] e2e at 1366×768: the side Tasks column is shown as today.
- [x] e2e: resizing from 1366 to 768 and back keeps a typed Question answer and the Part's State.
- [x] Keyboard and screen reader: the toggle has `aria-expanded` and names the Task; focus moves into the opened drawer and back to the toggle on close.
- [x] Part tab badges stay visible in drawer form.
