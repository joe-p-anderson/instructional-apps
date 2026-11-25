# 05: Conductor Properties Activity, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A PHY 4300 student opens the "Conductor Properties" Activity link and enters their name. They then work through three Parts (electric field, potential, Gauss's law), each with the two Tasks from the old app.

- A Task passes only when the student Submits a setup that meets its Condition.
- For each Task they write a free-text modus tollens explanation.
- A Hint appears after three misses.
- Progress is autosaved, and they can download a JSON Report that opens in the Report Viewer.

The old single-file conductor_properties app is deleted.

**Blocked by:** 01, 03, 04

**Status:** resolved

- [x] The Activity has id `conductor-properties`, course "PHY 4300" and title "Conductor Properties". It has three Parts, one per Mode. Each Part starts from the old default Setup and shows all of its Mode's Controls.
- [x] The six Tasks keep their prompts and free-text Questions word for word, and use the encoded Conditions from the spec's table:
  - [x] |E₀| above 0.
  - [x] Q and θ both above 0.
  - [x] r1 below 5 cm, and anyOf(measure at infinity, r2 below 5 cm).
  - [x] Lock to surface on.
  - [x] Outer extent below 5 cm.
  - [x] Outer extent above 5 cm and inner extent below 5 cm.
- [x] Each Task has the encoded Hint text from the spec, shown after 3 misses.
- [x] Each Task earns 1 point, and each free-text Question 1 point, for 12 in total.
- [x] A Node test drives the Activity through the runner core with a stub Tool. It checks that:
  - [x] each Condition fails at the default Setup and passes at the intended State;
  - [x] values merely passed through aren't evaluated;
  - [x] Hints appear after 3 misses;
  - [x] the total is 12;
  - [x] every encoded key decodes.
- [x] A Playwright end-to-end test covers the name gate and the Part tabs. It also checks that a Task passes only on Submit at the target, that a reload restores progress, and that the downloaded Report opens in the Report Viewer.
- [x] The old conductor_properties HTML file is deleted. The matplotlib reference scripts stay.
- [x] The repo README lists the links to the new Tool and Activity.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 807e020); code-review fixes in 7c50e19. The old Gauss default (r = 2 cm at the centre) passed gl-t1 with no work, so the Part's Setup now starts the surface outside the conductor (centre (8, 0), r = 2); every Task now misses at its default Setup. Part instruction text is folded into each Task prompt.
