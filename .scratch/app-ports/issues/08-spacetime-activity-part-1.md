# 08: Spacetime Diagrams Activity, Part 1 (Building the diagram)

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A PHY 1200 student opens the "Spacetime Diagrams" Activity link, enters their name, and works through Part 1, which follows Lab 10 Section 1.

- They draw the lamp, rocket and light-flash worldlines at v = 0.6c, with the rocket grid drawn over the Earth diagram.
- They mark events E and F.
- They type the rocket coordinates they counted from the tilted grid lines. No x′/t′ readouts are visible.
- They answer the multiple-choice and free-text questions.

Work is judged only on Submit, is autosaved, and can be downloaded as a Report.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The Activity has id `spacetime-lab10`, course "PHY 1200" and title "Spacetime Diagrams". Its page passes the spacetime Condition types to the runner.
- [ ] The Part 1 Setup:
  - [ ] v = 0.6, with v, γ and flip locked;
  - [ ] the K′ grid drawn over the Earth diagram;
  - [ ] the K′ panel, `primed` and the measurements panel hidden;
  - [ ] an empty diagram;
  - [ ] the event and worldline tools shown, and the rod and join tools hidden.
- [ ] Tasks 1.1–1.7 are as in the spec's table. Their Conditions, numeric and choice keys, and answer-revealing Hints are encoded. Tolerances are ±0.1 for positions, ±0.01 for velocities and ±0.1 for numeric answers.
- [ ] Points:
  - [ ] each Task with a Condition earns 1 point, and Tasks without a Condition earn none of their own;
  - [ ] each Question earns 1 point;
  - [ ] Part 1 totals 13.
- [ ] A Node test drives Part 1 through the runner core with a stub Tool whose `diagram` is built from real objects. It checks that:
  - [ ] each Condition fails on an empty diagram and passes on the handout's answer diagram;
  - [ ] Control exposure is right (v locked, `primed` hidden, rod and join hidden);
  - [ ] Hints appear after 3 misses;
  - [ ] Part 1 totals 13;
  - [ ] every encoded key decodes.
- [ ] A Playwright end-to-end test checks that:
  - [ ] the name gate works;
  - [ ] drawing the Part 1 worldlines with the real drawing tools passes on Submit;
  - [ ] rocket coordinates aren't visible anywhere;
  - [ ] a reload restores progress;
  - [ ] the Report opens in the Report Viewer.
