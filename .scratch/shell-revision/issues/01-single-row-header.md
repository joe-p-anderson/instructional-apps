# 01: Single-row header with ⋯ menu

Spec: .scratch/shell-revision/spec.md (Header; stories 19–27).

**What to build:** The header and the tab row become one row, which gives the Display back about 60 px of height.
- **Order:** the title, the course in dim text (Activities), the Part or Mode tabs, then the actions: the student's name, Download Report and a ⋯ menu button.
- **Title:** an Activity shows its own title, never the Tool's name. Standalone mode shows only the Tool's title, with no "Standalone" subtitle.
- **⋯ menu:** a keyboard-operable menu button in the UI kit.
  - In an Activity it holds Start over and Print.
  - In Standalone mode it holds Copy share link and Print. The share box leaves the header.
- **Wrapping:** the tabs wrap to a second row only when they don't fit. The title and the actions never wrap.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] At 1366×768 the title, tablist and actions share one row, checked by their top offsets, on every Activity and Standalone page.
- [x] Activity pages show the Activity's title and course. Standalone pages show the Tool title and no "Standalone" text.
- [x] The ⋯ menu opens with Enter or Space, moves with the arrow keys and closes with Escape, returning focus to its button.
- [x] Start over (with its confirm) and Print work from the menu. In Standalone mode, Copy share link copies the same `#s=` link as before.
- [x] The existing layouts, theme and persistence e2e specs still pass; selectors are updated where the share box or Start over moved.
- [x] The framework README's frame and header description is updated.
