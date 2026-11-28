# 13: Prose fields

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Task prompts, Hints, Question prompts and choice texts are written in a source box, with the rendered result beside it, typeset with MathJax as the Task card shows it. An info hover beside each prose field lists the HTML tags prompts use (such as `<sub>`, `<sup>`, `<b>`, `<i>`, `<br>`) and says that math goes in `\( \)`. The stored text is exactly what was typed. Encoded Hint texts are decoded for editing and encoded on save.

**Blocked by:** 10

**Status:** resolved

- [x] Every prose field has a source box, a live rendered preview and the info hover
- [x] The preview renders `<sub>` and `\( \)` math the way the Activity runner does
- [x] The info hover can be opened by keyboard as well as by hover
- [x] Hint texts round trip encoded; open-and-save stays byte-identical
- [x] A Playwright journey: type a prompt with a subscript and inline math, and see both rendered in the preview

## Comments

Built on branch `ae-13`.

- `editor/prose.js` keeps `proseField(ctx, { label, path, value, toEdit, rows })`. It draws the source box (the textarea from `ctx.field`, named by `label`, so undo groups and `data-path` jumps are unchanged), a preview region named "`<label>` preview", and a "Formatting help for `<label>`" button whose tooltip opens on hover or focus and closes with Escape.
- The preview picks the Task card's markup from the path, so ticket 12 needs nothing extra: `…prompt` → `div.fw-task-prompt`; `…hint.text` → `div.fw-task-hint` with "Hint:" first; `…questions.N.prompt` → `div.fw-question-prompt`; `…choices.N.text` → `span.fw-choice` (compact layout). It redraws 150 ms after typing and typesets with `vendor.js` `typeset` once attached (MathJax gives NaN sizes on detached nodes).
- Hint texts: the core (07/10) already decodes on open and re-encodes on save, keeping a plain Hint plain (oscilloscope's is stored plain). `tests/unit/editor/prose.test.js` pins this for all 5 Activities, with a byte-identical type-and-restore save.
- e2e: `tests/e2e/activity-editor-prose.spec.js`.
- Not done: the outline still shows Task titles' `\( \)` as source.
