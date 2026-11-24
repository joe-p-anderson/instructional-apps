# 03: Activity runner core: Questions and scoring

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** Tasks can ask numeric, multiple-choice and free-text Questions alongside (or instead of) a Condition, and the core computes points by the spec's scoring rules.

**Blocked by:** 02

**Status:** resolved

- [x] Numeric Questions checked against an absolute or relative tolerance
- [x] Multiple-choice Questions checked against the correct choice
- [x] Free-text Questions recorded, never judged
- [x] Answers are recorded on each Attempt
- [x] A Task passes on Submit only when its Condition (if any) and all graded Questions pass
- [x] Task points awarded if the Task ever passed; misses cost nothing
- [x] Split Question points: each Question earns its share once answered correctly in any Attempt; free text earns its points when non-empty
- [x] Node tests cover the above

## Comments

- Merged into `framework-v1` from branch `ticket-03` (commits 9775ba2 "numeric, multiple-choice and free-text Questions" and 8e888f3 "scoring recomputed from Attempts"; see git log).
- Note on scoring: Question points are additive to Task points, not a split of them. A Task's own `points` are earned once the Task passes, and each Question's `points` are earned on top of that (possible = Task points + Question points).
