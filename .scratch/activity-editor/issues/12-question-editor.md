# 12: Question editor

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** On a Task the instructor adds, edits, reorders and removes Questions:
- **Kinds:** numeric, choice and free text, each with a prompt and points.
- **Numeric answers:** a typed number or a State expression (ticket 02). An expression shows its value at the live Tool's current State.
- **Tolerances:** the tolerance (one number with a unit / % switch that writes `tol` or `relTol`, as in the condition builder) and the modulus can be set by hand. The editor's tolerance presets ("Amplitude 2%", "Phase ±2° mod 360", and others) stamp plain values onto the Question.
- **Choices:** choice Questions have editable, reorderable choices, with the correct one marked.

Keys are stored encoded and shown in plain text.

**Blocked by:** 02, 10

**Status:** resolved

- [x] Every Question kind can be added, edited, reordered and removed, and each existing Activity's Questions open without loss
- [x] A numeric answer switches between number and expression, and an expression's live value updates with the live Tool
- [x] Presets write plain tol, relTol and modulus; nothing preset-shaped is stored in the file
- [x] Choices can be added, reordered and removed, and the correct choice marked; a correct id that matches no choice shows as a problem
- [x] Question ids come from the prompt, unique within the Task, and stay frozen once made
- [x] Saved keys are encoded; open-and-save round trips stay byte-identical
- [x] A Playwright journey: add a numeric Question with an expression answer, apply a preset, see the live value, save, and check the JSON

## Comments

Built on branch `ae-12`.

- **Core (`edits.js`):** `addQuestion` (`{ p, t, kind, prompt, at? }`; id = `slug(prompt with tags stripped, …, 'question')`, then frozen; numeric starts with `relTol: 0.02` and no answer, choice with choices `a`, `b` and correct `a`), `setQuestionField` (prompt, points, answer, tol, relTol, modulus, correct; undefined removes), `setQuestionValues` (several fields as one edit: presets and the tolerance field), `setQuestionKind`, `moveQuestion`, `deleteQuestion` (the last one removes the empty list), `addChoice` (first free letter as id), `setChoiceField` (`id` | `text`; renaming the correct choice renames `correct`), `moveChoice`, `deleteChoice`. A key a Question gains goes in the files' key order (`QUESTION_KEYS`), so saved Questions read like the hand-written ones. New answers and corrects take the default encoding.
- **Tolerances (`editor/tolerance.js`, no DOM):** `toleranceText(owner)` and `toleranceValues(side, text)` (the unit side writes `tol`, the % side writes `relTol` = % / 100, each clears the other), `TOLERANCE_PRESETS` (plain `{ tol, relTol, modulus }` values, editor only) and `presetOf(q)`. **`editor/tolerance-field.js`** is the reusable DOM field `toleranceField(ctx, { label, path, owner, unit, toEdit })` → `[label, input, switch]`. Ticket 11's builder can use it with a `toEdit` that writes the Condition's `tol`/`relTol`; unify any duplicate at merge.
- **Problems:** `CHECKS` gains `questions`: an expression answer naming State the Mode lacks (path: the answer). A correct id matching no choice is the runner's own problem at `…questions.k.correct`, which jumps to the radio group.
- **Tab (`tabs/questions.js`):** one card per Question (`group` "Question N") with a kind select, the read-only id, points, Move up/down and remove; the prompt and each choice text go through `proseField`. Numeric: a Number / State expression switch, the answer field and its live value (`[data-live="answer"]`, re-run through `onLive`), the tolerance field, the modulus and the "Preset: … ▾" menu. Flipping an expression to Number keeps a numeric source, else takes its live value. The add row is "New Question prompt" with `+ Numeric` / `+ Choice` / `+ Free text`.
- **Tests:** `tests/unit/editor/questions.test.js`; e2e `tests/e2e/activity-editor-questions.spec.js` (the journey, the tolerance switch, choices and the correct problem, and existing Questions opening, reordering, changing kind and being removed).
