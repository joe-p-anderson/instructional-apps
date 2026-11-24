# 09: Report Viewer: student view

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student drops their own Report onto the Report Viewer page and reads a clean record of their Run, which they can print or save as PDF. Everything runs client-side.

**Blocked by:** 07

**Status:** resolved

- [x] The Report Viewer is a static page in the framework; no file leaves the browser
- [x] Report Viewer core (DOM-free) parses Reports, dispatching on Report format version so that every version still in use can be read
- [x] One Report dropped in shows a readable student view (Activity, name, Parts, Tasks, Attempts, answers, snapshots, points) with Print / Save as PDF
- [x] Playwright: a Report downloaded from the oscilloscope Activity opens in the student view

## Comments

- Built on branch `ticket-09`. Page: `framework/v1/report-viewer/index.html`. Core (no DOM): `framework/v1/report-viewer/core.js`, `openReport(text)` returns a plain student view (activity, student, fingerprint, timestamps, `checksumOk`, points, Parts with Tasks numbered `1.1`…, Attempts with State, answers, miss feedback, snapshots). Throws a readable Error for non-Reports or unknown versions. Version dispatch is the `readers` table (`READABLE_FORMAT_VERSIONS`); a new format adds a reader mapping onto the same view. UI: `report-viewer/ui.js`, `mountReportViewer(root) -> { open(files) }`; styles in `theme.css` (`.fw-viewer`, `.fw-report-*`, print rules hide the chrome).
- The student view shows the points stored in the Report: recomputing needs the Activity definition, left to ticket 10 (class view). A failed checksum still opens, with a warning. Only `data:image/png;base64,` snapshots are rendered; Report content is inserted as text only.
- More than one file currently shows "Open one Report at a time"; ticket 10 replaces that branch in `open()` with the zip / many-Reports class view.
- Tests: `tests/unit/report-viewer/` (fixtures made by the runner core with the stub Tool), `tests/e2e/report-viewer-student.spec.js`.
- Merged branch `ticket-09` into `framework-v1` via a non-fast-forward merge commit. No conflicts. `npm test` (84) and `npm run test:e2e` (26) pass.
