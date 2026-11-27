# 02: State expressions as Question answers, recorded in the Report

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** A numeric Question's answer can be a State expression (`{ expr }`) as well as a number. On Submit the runner works it out from the Part's live State, and judges the student's value against it with the Question's tol, relTol and modulus. Every judged numeric result in an Attempt records the expected value it was judged against, whether that came from a number or an expression. The Report Viewer's student view shows that value beside the student's answer.

This brings in the expression evaluator, a pure module (no `eval` or `Function`):
- numbers, State names, `+ − * /`, `^` (right-associative), unary minus and parentheses;
- the constants pi and e;
- the functions sqrt, abs, exp, ln, log10, sin, cos, tan, asin, acos, atan, atan2, min, max, deg and rad, with trig in radians.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The evaluator parses once and evaluates against a State snapshot; it reports parse errors with their position, and lists the State names an expression uses
- [ ] Unit tests give a table of expressions, snapshots and values covering precedence, the associativity of `^`, unary minus, every function, and deg and rad
- [ ] An `{ expr }` answer is accepted encoded (`enc1:`) like any other key, and decoded by the runner
- [ ] Runner validation rejects an Activity whose expression doesn't parse
- [ ] On Submit, a correct and a wrong value are judged against the live State; an unknown State name, or a non-finite result, is a miss whose feedback names the problem
- [ ] Each judged numeric result in an Attempt carries the expected value; the Report stays at format version 1, and the framework version becomes 1.1.0
- [ ] The Report Viewer's student view shows the expected value beside the student's answer when it is present; older Report fixtures open and score unchanged
- [ ] The framework README documents expression answers and the new result field
