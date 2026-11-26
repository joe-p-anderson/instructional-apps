# 11: No Display scroll, with least squares fixed

Spec: .scratch/shell-revision/spec.md (Displays; stories 72–74).

**What to build:** A Display never scrolls inside itself. Least squares hides its residual plot's frame while residuals are off, and moves its residual-pattern guide into a collapsed note, so the Fit panel (SSE, R²) is visible at 1366×768. The rule is documented for Tool authors.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] e2e: for every Tool and Mode at 1366×768, and at the Tool's minimum Display width, the Display area's scroll height doesn't exceed its client height.
- [x] e2e: least squares at 1366×768 shows the Fit panel's R² without scrolling. With residuals off, no empty residual frame is shown.
- [x] e2e: the residual guide opens and closes.
- [x] The framework README states the rule.
