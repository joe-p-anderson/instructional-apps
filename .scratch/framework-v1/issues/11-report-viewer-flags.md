# 11: Report Viewer: flags

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The class table flags likely copying, relabelling, tampering and wrong-link use, so the instructor can catch them without handing out false zeros.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Flag: a Run fingerprint shared across uploaders
- [ ] Flag: an identical Attempt history across uploaders
- [ ] Warning: a loose mismatch between the sealed name and the uploader's name, tolerant of case, middle names and nicknames
- [ ] Flag: a checksum failure
- [ ] Flag: an Activity id or version that differs from the class majority
- [ ] Node tests for each flag, including fuzzy-match tolerance cases
