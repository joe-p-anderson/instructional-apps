# 02: Activity runner core: Run, Tasks, Conditions, Attempts, Control exposure, Hints

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The DOM-free core that drives an Activity. Given an Activity definition and a Tool instance, a student starts a Run by giving a name, works through Tasks in order, Submits, and is judged only on the State at Submit time, with miss feedback, Hints, and Control exposure applied as Tasks unlock.

**Blocked by:** None (can start immediately; tested against a stub Tool that follows the spec's Tool contract)

**Status:** ready-for-agent

- [ ] Activity definition shape per the spec (id, version, title, course line, Tool id, Parts with Mode/Setup/Tasks; Tasks with id, title, prompt, show/lock/hide lists, optional Condition, points, optional Hint)
- [ ] Name gate: a Run starts only once a name is given; the Run has a random fingerprint and start time; name and fingerprint can't change within the Run
- [ ] All Parts open from the start; Tasks unlock in order within a Part
- [ ] Declarative Conditions on named State (value within tolerance; exact/boolean match) with automatically generated miss feedback (e.g. "φ = 1.48 rad; need π/2")
- [ ] Condition registry that Activities/Tools can extend, plus a plain-function escape hatch
- [ ] Conditions evaluated only on Submit; values passed through between Submits are never evaluated
- [ ] Each Attempt records timestamp, full State, per-component results and pass/fail
- [ ] A pass freezes the Task (can't be redone), unlocks the next, and applies its Control exposure; a later Task can unlock a Control an earlier one locked
- [ ] Hint becomes available once the miss count reaches its threshold
- [ ] Node tests through the public interface cover all of the above
