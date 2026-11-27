# 13: Prose fields

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Task prompts, Hints, Question prompts and choice texts are written in a source box, with the rendered result beside it, typeset with MathJax as the Task card shows it. An info hover beside each prose field lists the HTML tags prompts use (such as `<sub>`, `<sup>`, `<b>`, `<i>`, `<br>`) and says that math goes in `\( \)`. The stored text is exactly what was typed. Encoded Hint texts are decoded for editing and encoded on save.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Every prose field has a source box, a live rendered preview and the info hover
- [ ] The preview renders `<sub>` and `\( \)` math the way the Activity runner does
- [ ] The info hover can be opened by keyboard as well as by hover
- [ ] Hint texts round trip encoded; open-and-save stays byte-identical
- [ ] A Playwright journey: type a prompt with a subscript and inline math, and see both rendered in the preview
