# 01: Framework v1 `range` and `anyOf` Condition types

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** An Activity author can write two new kinds of Condition as plain data that the encode-keys helper can encode: "a State value strictly above and/or below a bound" (`range`), and "any one of these Conditions passes" (`anyOf`). Both become built-in Condition types in framework v1, added in place as a compatible change (ADR 0003), so existing Activities keep working unchanged.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `range` takes a named State value with an `above` bound, a `below` bound, or both, and passes only when the value is strictly between them.
- [x] A `range` miss gives generated feedback that names the State value with its label and unit, plus the bound it missed (e.g. "|E₀| = 0 V/m; need > 0").
- [x] `anyOf` takes a list of component Conditions (of any kind, including other registered types) and passes when at least one of them passes. A miss lists each component's feedback.
- [x] Both work when the whole Condition is encoded with the authoring helper and decoded by the runner.
- [x] Node tests, added to the runner's existing Condition tests, cover pass, miss and feedback for each type, including an `anyOf` nested in a Condition list.
- [x] The framework README documents both types.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 5077431); code-review fixes in 7c50e19.
