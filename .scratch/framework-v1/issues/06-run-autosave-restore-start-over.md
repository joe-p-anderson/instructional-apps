# 06: Run autosave, restore and Start over

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student's Activity progress survives a reload or a crash mid-lecture, the instructor can edit an Activity without wiping progress on Tasks that still exist, and a student can deliberately start over.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The Run (name, fingerprint, Attempts, per-Part Tool State) autosaves to browser storage keyed by Activity id and restores on load
- [ ] On restore after an Activity version change, Attempts for Task ids that still exist are kept; unknown Task ids are dropped
- [ ] "Start over", with a confirmation, discards the Run and begins a new one (new name gate, new fingerprint)
- [ ] Node test: restore across a version change keeps matching Task ids
- [ ] Playwright: a reload restores progress
