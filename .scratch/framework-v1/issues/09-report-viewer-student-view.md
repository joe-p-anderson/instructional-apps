# 09: Report Viewer: student view

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student drops their own Report onto the Report Viewer page and reads a clean record of their Run, which they can print or save as PDF. Everything runs client-side.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The Report Viewer is a static page in the framework; no file leaves the browser
- [ ] Report Viewer core (DOM-free) parses Reports, dispatching on Report format version so that every version still in use can be read
- [ ] One Report dropped in shows a readable student view (Activity, name, Parts, Tasks, Attempts, answers, snapshots, points) with Print / Save as PDF
- [ ] Playwright: a Report downloaded from the oscilloscope Activity opens in the student view
