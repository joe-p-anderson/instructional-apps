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

**Status:** resolved

- [x] Every data form of Condition can be built, nested and removed, and each existing Activity's Conditions open in the builder without loss
- [x] A target's tolerance can be given in the State's unit or as a %, which writes `tol` or `relTol`. Switching clears the other key
- [x] State pickers list only the Part's State; "Use current value" fills from the live State
- [x] The live pass or miss line updates as the Condition or the live Tool changes
- [x] An expression that doesn't parse, or names unknown State, shows in the problems list
- [x] Saved Conditions are encoded; open-and-save round trips stay byte-identical
- [x] A Playwright journey: build an any-of group with a target and an expression range, see the live result change as the live Tool moves, save, and check the encoded Condition decodes to what was built

## Comments

Built on branch `ae-11`.

- **Core (no DOM).** `editor/condition-model.js` addresses Condition nodes by the runner's validation paths (`[]` is the whole Condition, a number steps into an all-of list, `'conditions', i` into an any-of). It holds `kindOf`, `nodeAt`, `replaceAt` (undefined removes; one past the end appends), `withFields` (a key replacing a removed one keeps its place, so tol -> relTol doesn't move keys), `newNode`, `conditionSlots` and `judgeLive`. `edits.js` gains `setConditionNode` (`{ p, t, path, node }`) and `setConditionFields` (`{ p, t, path, fields }`). `problems.js` gains the `conditions` check: an empty group, a target with no value, a range with no bound, and (with Tool info) unknown State, as a State name or inside an expression. Parse errors stay the runner's.
- **Tolerance field, shared for ticket 12.** `editor/tolerance.js` (DOM-free `toleranceOf(owner)` and `toleranceFields(side, text)`) and `editor/tolerance-field.js` (`toleranceField(ctx, { owner, path, unit, toEdit(fields) })`; the input is "Tolerance", the switch the group "Tolerance in"). The % side writes `relTol` = % / 100; each side clears the other key.
- **Tab.** `tabs/condition.js`: each node is a `group` named "Condition", "Condition 2", "Condition 2.1", ..., with its own verdict. The section's `status` "Live result" is what a student would get now (registered types judged with the Tool's `conditionTypes`). target, above and below take a number or else an expression in one box; equals has a Value / Expression switch (true, false and numbers parsed); the tested slot has State / Expression. A Tool's own Condition types (spacetime) are shown read-only and kept. An all-of can't be put directly inside an all-of (the runner wouldn't judge it).
- `parts.test.js`'s oscilloscope fixture Tool info now lists the Mode's State names, which the new check needs.
- Tests: `tests/unit/editor/conditions.test.js`; `tests/e2e/activity-editor-conditions.spec.js` (the journey, Use current value with the tolerance switch, problems jumping to the field, nesting and removing, and every existing Condition opening without loss or problems).
