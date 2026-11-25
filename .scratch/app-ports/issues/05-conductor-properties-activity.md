# 05: Conductor Properties Activity, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A PHY 4300 student opens the "Conductor Properties" Activity link and enters their name. They then work through three Parts (electric field, potential, Gauss's law), each with the two Tasks from the old app.

- A Task passes only when the student Submits a setup that meets its Condition.
- For each Task they write a free-text modus tollens explanation.
- A Hint appears after three misses.
- Progress is autosaved, and they can download a JSON Report that opens in the Report Viewer.

The old single-file conductor_properties app is deleted.

**Blocked by:** 01, 03, 04

**Status:** ready-for-agent

- [ ] The Activity has id `conductor-properties`, course "PHY 4300" and title "Conductor Properties". It has three Parts, one per Mode. Each Part starts from the old default Setup and shows all of its Mode's Controls.
- [ ] The six Tasks keep their prompts and free-text Questions word for word, and use the encoded Conditions from the spec's table:
  - [ ] |E₀| above 0.
  - [ ] Q and θ both above 0.
  - [ ] r1 below 5 cm, and anyOf(measure at infinity, r2 below 5 cm).
  - [ ] Lock to surface on.
  - [ ] Outer extent below 5 cm.
  - [ ] Outer extent above 5 cm and inner extent below 5 cm.
- [ ] Each Task has the encoded Hint text from the spec, shown after 3 misses.
- [ ] Each Task earns 1 point, and each free-text Question 1 point, for 12 in total.
- [ ] A Node test drives the Activity through the runner core with a stub Tool. It checks that:
  - [ ] each Condition fails at the default Setup and passes at the intended State;
  - [ ] values merely passed through aren't evaluated;
  - [ ] Hints appear after 3 misses;
  - [ ] the total is 12;
  - [ ] every encoded key decodes.
- [ ] A Playwright end-to-end test covers the name gate and the Part tabs. It also checks that a Task passes only on Submit at the target, that a reload restores progress, and that the downloaded Report opens in the Report Viewer.
- [ ] The old conductor_properties HTML file is deleted. The matplotlib reference scripts stay.
- [ ] The repo README lists the links to the new Tool and Activity.
