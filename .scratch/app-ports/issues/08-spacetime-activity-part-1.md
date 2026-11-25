# 08: Spacetime Diagrams Activity, Part 1 (Building the diagram)

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A PHY 1200 student opens the "Spacetime Diagrams" Activity link, enters their name, and works through Part 1, which follows Lab 10 Section 1.

- They draw the lamp, rocket and light-flash worldlines at v = 0.6c, with the rocket grid drawn over the Earth diagram.
- They mark events E and F.
- They type the rocket coordinates they counted from the tilted grid lines. No x′/t′ readouts are visible.
- They answer the multiple-choice and free-text questions.

Work is judged only on Submit, is autosaved, and can be downloaded as a Report.

**Blocked by:** 07

**Status:** resolved

- [x] The Activity has id `spacetime-lab10`, course "PHY 1200" and title "Spacetime Diagrams". Its page passes the spacetime Condition types to the runner.
- [x] The Part 1 Setup:
  - [x] v = 0.6, with v, γ and flip locked;
  - [x] the K′ grid drawn over the Earth diagram;
  - [x] the K′ panel, `primed` and the measurements panel hidden;
  - [x] an empty diagram;
  - [x] the event and worldline tools shown, and the rod and join tools hidden.
- [x] Tasks 1.1–1.7 are as in the spec's table. Their Conditions, numeric and choice keys, and answer-revealing Hints are encoded. Tolerances are ±0.1 for positions, ±0.01 for velocities and ±0.1 for numeric answers.
- [x] Points:
  - [x] each Task with a Condition earns 1 point, and Tasks without a Condition earn none of their own;
  - [x] each Question earns 1 point;
  - [x] Part 1 totals 13.
- [x] A Node test drives Part 1 through the runner core with a stub Tool whose `diagram` is built from real objects. It checks that:
  - [x] each Condition fails on an empty diagram and passes on the handout's answer diagram;
  - [x] Control exposure is right (v locked, `primed` hidden, rod and join hidden);
  - [x] Hints appear after 3 misses;
  - [x] Part 1 totals 13;
  - [x] every encoded key decodes.
- [x] A Playwright end-to-end test checks that:
  - [x] the name gate works;
  - [x] drawing the Part 1 worldlines with the real drawing tools passes on Submit;
  - [x] rocket coordinates aren't visible anywhere;
  - [x] a reload restores progress;
  - [x] the Report opens in the Report Viewer.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 08c3908); code-review fixes in 7c50e19. The Event tool now adds an event when pressed on a worldline (needed to mark E and F). Review fix: K′ tick numbers are no longer drawn on the K panel while primed is off or hidden.
