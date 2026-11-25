# 07: Report assembly and download

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** At any point in a Run, a student downloads a JSON Report (ADR 0001) that faithfully represents their work so far, ready to upload to Brightspace.

**Blocked by:** 04

**Status:** resolved

- [x] Report contents per the spec: Report format version, framework version, Activity id/version/title/course line; student name and Run fingerprint; start and download timestamps; Parts → Tasks → Attempts; points earned/possible per Task and in total; a checksum over all of it
- [x] Snapshots (PNG data URLs) of the Part's Displays taken on passing Attempts only
- [x] Filename combines the Activity id, student name and date
- [x] Download available at any time; partial work represented faithfully
- [x] Node tests: Report shape; checksum verifies, and fails after any edit
- [x] Playwright: the downloaded Report has the expected shape

## Comments

- Built on branch `ticket-07`. Report format module: `framework/v1/report.js` (no DOM): schema in its header, `sealReport`/`verifyReport`/`checksumOf`, `readReport(text)`, `reportFilename`, `createFingerprint`, `REPORT_FORMAT_VERSION`, `FRAMEWORK_VERSION` ('1.0.0').
- Runner core: `await runner.report()` returns the sealed Report so far; works in Node with a stub Tool, so Report Viewer fixtures can be generated with it. Display snapshots are taken at the passing Submit (async) and attached to that Attempt as `snapshots: [{ display, png }]`; a failing snapshot gives `[]`.
- Checksum: SHA-256 (synchronous, in-module) over a fixed key plus canonical JSON (sorted keys) of every field but `checksum`. Deterrence only (ADR 0001).
- Filename: `<activity id>_<name>_<local date>.json`, name with accents stripped and unsafe characters replaced by `-`. The Download Report button appears once the Run starts (no Report without a name).
- Merged into `framework-v1` after tickets 06 and 08. Conflicts (runner header, header buttons, theme, README) resolved keeping Start over and Download Report side by side; the Run fingerprint now comes from `report.js`. Integration gap fixed: snapshots arrive after the post-Submit autosave, so a reload could drop them; added `await runner.snapshotsTaken()` and a second autosave once they land. Unit test: a restored Run with encoded keys reports its snapshots and contains no `enc1:`/target/tol.
