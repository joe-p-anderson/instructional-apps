# 05: Completion dialog and completed Download button

Spec: .scratch/shell-revision/spec.md (Activity runner UI, completion; stories 42–46).

**What to build:** When the last Task in the Activity passes for the first time in a Run, a modal dialog opens. It holds:
- "Activity complete · N of N Tasks".
- A primary Download Report button.
- One line on turning the Report in to Brightspace.
- Close.

The dialog is shown once per Run, and that fact is saved with the Run, not the Report. Whenever the Run is complete, the header's Download button gets the primary style and reads "Activity complete · Download Report". The Tool stays usable after the dialog closes.

**Blocked by:** 01 (single-row header).

**Status:** resolved

- [x] e2e: passing the last Task of an Activity opens the dialog, focus is inside it, Escape or Close dismisses it, and focus returns to the page.
- [x] e2e: Download Report from the dialog saves the Report.
- [x] e2e: reloading the completed Run doesn't reopen the dialog, and the header button shows the completed label.
- [x] The dialog-shown flag survives `save()`/`restore()` (runner restore unit test) and doesn't appear in the Report.
