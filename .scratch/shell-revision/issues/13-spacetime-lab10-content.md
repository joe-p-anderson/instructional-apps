# 13: Spacetime Lab 10 miss wording and starting tool

Spec: .scratch/shell-revision/spec.md (Content tickets; stories 79–80).

**What to build:** Spacetime's registered Condition evaluators word misses in the Task's own terms, for example "No vertical worldline at x = 2 yet" rather than "no worldline with u = 0.00 found". Each Part of Lab 10 opens with the drawing tool its first Task uses selected (Worldline for Task 1.1).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Spacetime Condition unit tests: miss feedback contains no internal symbols such as u, and names what is missing.
- [ ] e2e: Lab 10 Part 1 opens with Worldline selected, and each later Part opens on the tool its first Task names.
- [ ] The existing spacetime Activity e2e spec passes.
