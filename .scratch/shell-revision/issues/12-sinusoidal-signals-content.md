# 12: Sinusoidal Signals content fixes

Spec: .scratch/shell-revision/spec.md (Content tickets; stories 76–78).

**What to build:** The oscilloscope's phase, period and amplitude Activity is retitled "Sinusoidal Signals", and its id is kept so saved Runs and Reports still match. Tasks that ask the student to set φ hide the readouts that print φ. Hints guide the measurement and no longer state the exact value. The course index page is updated with the new title.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The page title and header read "Sinusoidal Signals", and the Activity id is unchanged.
- [ ] e2e: on the φ Tasks, no visible readout shows φ's value, and the readouts reappear when a later Task no longer hides them.
- [ ] No Hint text contains the target value (the oscilloscope Activity e2e or the runner fixtures check it).
- [ ] The existing oscilloscope Activity e2e spec passes.
