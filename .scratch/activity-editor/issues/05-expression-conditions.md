# 05: State expressions in Conditions

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Any value a Condition tests can be a State expression. A Condition's `state` may be a State name or `{ expr }`, and each of `target`, `equals`, `above` and `below` may be a number or `{ expr }`. This lets a Task require, for example, ω within tol of `1/sqrt(L*C)`, or `abs(V_L - V_C)` below 0.01. The miss feedback names the expression's value where it now names the State value or the target. This builds on ticket 02's evaluator. Tolerances stay plain numbers. A target Condition also gains `relTol`, a fraction of |target|, as an alternative to `tol` (spec, "Tolerances").

**Blocked by:** 02

**Status:** resolved

- [x] target ± tol, equals and range Conditions each accept `{ expr }` in every value slot, including inside any-of, all-of and nested groups
- [x] Encoded Conditions containing expressions are decoded and judged
- [x] Miss feedback reads sensibly for an expression `state` and an expression target; `targetLabel` still overrides it
- [x] An unknown State name or a non-finite value is a miss with feedback naming it; validation rejects an expression that doesn't parse
- [x] A target Condition takes `relTol` instead of `tol` and passes within `relTol × |target|`, including against an expression target. Its miss feedback shows the percentage. Validation rejects both `tol` and `relTol`, or neither
- [x] Runner unit tests cover each form; existing Condition tests pass unchanged
- [x] The framework README's Conditions table documents expressions

## Comments

- Built in `framework/v1/runner/conditions.js`. Every built-in value slot goes through one resolver: `state` is a State name or `{ expr }`; `target`, `equals`, `above`, `below` are a value or `{ expr }`. Expressions parse once via the new `cachedExpression` in `expression.js` (questions.js now shares it).
- Feedback: an expression `state` is labelled with its source and has no unit (`abs(V_L - V_C) = 0.5; need < 0.01`); an expression target or bound shows its worked-out value. Unknown State (in an expression or as a plain State name, which used to throw) and a non-finite target or bound are a miss: `Can't judge this Condition: "1/sqrt(L*R)" has unknown State "R".` / `... works out to Infinity.` A non-finite expression `state` reads as `x = NaN; need ...`.
- `relTol` feedback: value to four figures, target to at least three (`|I| = 4.1 mA; need 5.00 mA ± 2%`).
- New `validateCondition(condition, fail)` (exported from conditions.js, called by `validateActivity`) walks lists and anyOf at any depth; it rejects unparseable expressions and a target Condition without exactly one numeric `tol`/`relTol`. Registered types and functions are skipped. All existing Activities still validate.
- Tests: `tests/unit/runner/expression-conditions.test.js`.
