# 05: State expressions in Conditions

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Any value a Condition tests can be a State expression. A Condition's `state` may be a State name or `{ expr }`, and each of `target`, `equals`, `above` and `below` may be a number or `{ expr }`. This lets a Task require, for example, ω within tol of `1/sqrt(L*C)`, or `abs(V_L - V_C)` below 0.01. The miss feedback names the expression's value where it now names the State value or the target. This builds on ticket 02's evaluator. Tolerances stay plain numbers. A target Condition also gains `relTol`, a fraction of |target|, as an alternative to `tol` (spec, "Tolerances").

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] target ± tol, equals and range Conditions each accept `{ expr }` in every value slot, including inside any-of, all-of and nested groups
- [ ] Encoded Conditions containing expressions are decoded and judged
- [ ] Miss feedback reads sensibly for an expression `state` and an expression target; `targetLabel` still overrides it
- [ ] An unknown State name or a non-finite value is a miss with feedback naming it; validation rejects an expression that doesn't parse
- [ ] A target Condition takes `relTol` instead of `tol` and passes within `relTol × |target|`, including against an expression target. Its miss feedback shows the percentage. Validation rejects both `tol` and `relTol`, or neither
- [ ] Runner unit tests cover each form; existing Condition tests pass unchanged
- [ ] The framework README's Conditions table documents expressions
