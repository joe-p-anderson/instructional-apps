# 12: Question editor

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** On a Task the instructor adds, edits, reorders and removes Questions:
- **Kinds:** numeric, choice and free text, each with a prompt and points.
- **Numeric answers:** a typed number or a State expression (ticket 02). An expression shows its value at the live Tool's current State.
- **Tolerances:** tol, relTol and modulus can be set by hand. The editor's tolerance presets ("Amplitude 2%", "Phase ±2° mod 360", and others) stamp plain values onto the Question.
- **Choices:** choice Questions have editable, reorderable choices, with the correct one marked.

Keys are stored encoded and shown in plain text.

**Blocked by:** 02, 10

**Status:** ready-for-agent

- [ ] Every Question kind can be added, edited, reordered and removed, and each existing Activity's Questions open without loss
- [ ] A numeric answer switches between number and expression, and an expression's live value updates with the live Tool
- [ ] Presets write plain tol, relTol and modulus; nothing preset-shaped is stored in the file
- [ ] Choices can be added, reordered and removed, and the correct choice marked; a correct id that matches no choice shows as a problem
- [ ] Question ids come from the prompt, unique within the Task, and stay frozen once made
- [ ] Saved keys are encoded; open-and-save round trips stay byte-identical
- [ ] A Playwright journey: add a numeric Question with an expression answer, apply a preset, see the live value, save, and check the JSON
