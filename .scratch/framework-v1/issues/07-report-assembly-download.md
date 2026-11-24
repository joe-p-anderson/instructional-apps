# 07: Report assembly and download

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** At any point in a Run, a student downloads a JSON Report (ADR 0001) that faithfully represents their work so far, ready to upload to Brightspace.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Report contents per the spec: Report format version, framework version, Activity id/version/title/course line; student name and Run fingerprint; start and download timestamps; Parts → Tasks → Attempts; points earned/possible per Task and in total; a checksum over all of it
- [ ] Snapshots (PNG data URLs) of the Part's Displays taken on passing Attempts only
- [ ] Filename combines the Activity id, student name and date
- [ ] Download available at any time; partial work represented faithfully
- [ ] Node tests: Report shape; checksum verifies, and fails after any edit
- [ ] Playwright: the downloaded Report has the expected shape
