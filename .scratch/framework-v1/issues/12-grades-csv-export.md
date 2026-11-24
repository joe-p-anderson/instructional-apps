# 12: Grades CSV export (provisional columns)

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The instructor exports a grades CSV from the class table for Brightspace import instead of copying grades by hand. The column format is provisional until a real Brightspace export has been inspected.

**Blocked by:** 10

**Status:** resolved

- [x] An export button produces a CSV of the recomputed scores, built in the browser
- [x] The column layout is isolated so it can change once the real Brightspace format is known
- [x] Node test of the CSV output (provisional columns)

## Comments

- Built on branch `ticket-12`. The CSV is built in a DOM-free core module, `framework/v1/report-viewer/grades-csv.js` (`gradesCsv(rows, { item })`). It is a separate file rather than part of `core.js`, so it stays apart from ticket 11's flag work. It reads `openClass` rows and uses the recomputed `earned`.
- PROVISIONAL columns, all in the one `COLUMNS` table in that file: `Submission Id` (the `<id>-<id>` prefix from `uploaderFromPath`, blank if absent), `Student`, `<item> Points Grade` (item defaults to the Activity title), `End-of-Line Indicator` (`#`). Not checked against a real Brightspace export. A real import probably needs `OrgDefinedId` or `Username`.
- Fields use RFC 4180 quoting with CRLF line endings. Text starting with `= + - @` is prefixed with `'`, so a Report's names cannot inject a spreadsheet formula.
- The UI has an "Export grades CSV" button above the class table. It saves `<Activity title> grades.csv` through a Blob URL, and nothing is uploaded.
- Tests: `tests/unit/report-viewer/grades-csv.test.js` and a new case in `tests/e2e/report-viewer-class.spec.js`. `npm test` (101) and `npm run test:e2e` (30) pass.
- Merged branch `ticket-12` into `framework-v1` via a non-fast-forward merge commit. No conflicts. `npm test` (101) and `npm run test:e2e` (30) pass.
