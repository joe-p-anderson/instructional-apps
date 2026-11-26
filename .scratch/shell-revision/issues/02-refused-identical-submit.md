# 02: Refused identical Submit and feedback flash

Spec: .scratch/shell-revision/spec.md (Runner core: refused identical Submit; stories 28–37). Glossary: Attempt.

**What to build:** Submitting a Task again with exactly the State and answers of its last failed Attempt is refused. The student sees "Nothing changed since your last try", no Attempt is recorded, the Hint doesn't come any closer and the Report is unaffected. Every Submit result, including a refusal, briefly re-emphasises the feedback line, so a Submit always visibly registers.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `runner.submit` returns a distinguishable refusal when the State snapshot and the answers deep-equal the last Attempt and that Attempt failed. Comparison uses canonical form, so key order doesn't matter, and snapshot images are excluded.
- [x] Runner unit tests:
  - an identical repeat records nothing and doesn't advance the Hint;
  - a changed State alone, or changed answers alone, is recorded;
  - A, B, A records three Attempts;
  - the Report after refusals equals the Report without them.
- [x] The Task card shows the refusal text in the feedback line. The feedback line is a polite live region.
- [x] Every Submit re-triggers an emphasis on the feedback line, which is static under `prefers-reduced-motion`.
- [x] e2e: on the oscilloscope Activity, two identical failed Submits show the refusal, and the downloaded Report holds one Attempt for that Task.
- [x] The runner's header comment and the framework README document the refusal.
