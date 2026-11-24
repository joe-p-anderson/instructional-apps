# 11: Report Viewer: flags

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The class table flags likely copying, relabelling, tampering and wrong-link use, so the instructor can catch them without handing out false zeros.

**Blocked by:** 10

**Status:** resolved

- [x] Flag: a Run fingerprint shared across uploaders
- [x] Flag: an identical Attempt history across uploaders
- [x] Warning: a loose mismatch between the sealed name and the uploader's name, tolerant of case, middle names and nicknames
- [x] Flag: a checksum failure
- [x] Flag: an Activity id or version that differs from the class majority
- [x] Node tests for each flag, including fuzzy-match tolerance cases

## Comments

- Built on branch `ticket-11`. The flag checks live in `framework/v1/report-viewer/flags.js` (`flagClass(rows)`), which `openClass` calls after sorting. The fuzzy matcher `namesMatch(a, b)` lives there too and is re-exported from `core.js`. Flags are `{ kind, severity: 'flag' | 'warning', label, message }`, with kinds `tampered`, `shared-fingerprint`, `identical-history`, `wrong-activity` and `name-mismatch`. Only `name-mismatch` is a `warning`. No flag changes a score.
- "Across uploaders" compares `row.name` case-insensitively, so one student turning in several files from the same Run is not flagged.
- An identical Attempt history means the same time, State, answers and outcome for every Attempt of every Task. Including the times keeps students who submit the same values from matching. Reports with no Attempts are never flagged.
- The class majority is the most common Activity id and version. If two or more are tied for most common, there is no majority and nothing is flagged.
- `namesMatch` ignores case, accents, punctuation, initials and word order. Each word of the shorter name must match a word of the longer one, so middle names can be left out. Two words match if they are nicknames of each other (from a small built-in table), if one is a prefix of the other of at least 3 letters, or if words of 5 letters or more differ by one letter. A row with no uploader is not checked.
- UI: warnings get `fw-class-flag fw-class-warning` (yellow, italic). Each flag's reason is its `title`. The existing bulk-download e2e test now expects `Tampered` on its inflated Report, which was edited without resealing.
- Tests: `tests/unit/report-viewer/flags.test.js`, plus a new test in `tests/e2e/report-viewer-class.spec.js`. `npm test` (107) and `npm run test:e2e` (30) pass.
