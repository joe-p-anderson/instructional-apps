# 11: Condition builder

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** A Task can have a Condition, or none, built in the editor:
- **Forms:** target ± tol, equals and range, nested in any-of and all-of groups to any depth, with an optional target label.
- **Value slots:** each one takes a State name, picked from the live Tool's State with its unit shown, or a State expression (ticket 05).
- **Tolerance:** a plain number with a unit / % switch. The unit side writes `tol` and the % side writes `relTol` (spec, "Tolerances").
- **"Use current value":** fills a target from the live Tool.
- **Live result:** as the Condition is edited, it is judged against the live Tool's current State, showing pass or the feedback a student would see.

The file stores the Condition encoded; the editor shows it in plain text.

**Blocked by:** 05, 10

**Status:** ready-for-agent

- [ ] Every data form of Condition can be built, nested and removed, and each existing Activity's Conditions open in the builder without loss
- [ ] A target's tolerance can be given in the State's unit or as a %, which writes `tol` or `relTol`. Switching clears the other key
- [ ] State pickers list only the Part's State; "Use current value" fills from the live State
- [ ] The live pass or miss line updates as the Condition or the live Tool changes
- [ ] An expression that doesn't parse, or names unknown State, shows in the problems list
- [ ] Saved Conditions are encoded; open-and-save round trips stay byte-identical
- [ ] A Playwright journey: build an any-of group with a target and an expression range, see the live result change as the live Tool moves, save, and check the encoded Condition decodes to what was built
