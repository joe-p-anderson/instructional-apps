# 12: Grades CSV export (provisional columns)

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The instructor exports a grades CSV from the class table for Brightspace import instead of copying grades by hand. The column format is provisional until a real Brightspace export has been inspected.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] An export button produces a CSV of the recomputed scores, built in the browser
- [ ] The column layout is isolated so it can change once the real Brightspace format is known
- [ ] Node test of the CSV output (provisional columns)
