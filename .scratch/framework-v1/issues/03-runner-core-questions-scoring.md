# 03: Activity runner core: Questions and scoring

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** Tasks can ask numeric, multiple-choice and free-text Questions alongside (or instead of) a Condition, and the core computes points by the spec's scoring rules.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Numeric Questions checked against an absolute or relative tolerance
- [ ] Multiple-choice Questions checked against the correct choice
- [ ] Free-text Questions recorded, never judged
- [ ] Answers are recorded on each Attempt
- [ ] A Task passes on Submit only when its Condition (if any) and all graded Questions pass
- [ ] Task points awarded if the Task ever passed; misses cost nothing
- [ ] Split Question points: each Question earns its share once answered correctly in any Attempt; free text earns its points when non-empty
- [ ] Node tests cover the above
