# 09: Spacetime Diagrams Activity, Part 2 (Relativity of simultaneity), and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** The Spacetime Diagrams Activity gains Part 2, which follows Lab 10 Section 2.

- The student draws the ends of a 4 ly rocket and the flash from the lamp at its middle.
- They mark B and F, where the light reaches the back and the front.
- They read the rocket and Earth times of B and F, and explain why the back is reached first.
- They lay a rod from B to F, and discover that only a rod in the rocket's frame fits: the line is one of the rocket's "now" lines.

The old spacetime-diagrams HTML file is deleted, and the Lab 10 handout source moves next to the Tool.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The Part 2 Setup matches Part 1's: v = 0.6 and locked, the K′ grid overlaid, the K′ panel, `primed` and measurements hidden, and an empty diagram. The rod tool is hidden until Task 2.5 and shown from then on.
- [ ] Tasks 2.1–2.5 are as in the spec's table, with encoded Conditions, keys and Hints, and the same tolerances as Part 1.
- [ ] Part 2 totals 11 points, and the whole Activity totals 24.
- [ ] The Node Activity test is extended to check that:
  - [ ] Part 2's Conditions fail on an empty diagram and pass on the handout's answer diagram;
  - [ ] the rod tool is hidden until Task 2.5;
  - [ ] the B–F rod Condition passes only for a rod with its ends at B and F;
  - [ ] the totals are 11 and 24.
- [ ] The Playwright end-to-end test covers Task 2.5: laying a rod in the rocket's frame from B to F passes on Submit.
- [ ] The old spacetime-diagrams HTML file is deleted, and the Lab 10 handout source moves into the spacetime Tool's folder.
- [ ] The repo README lists the links to the spacetime Tool and Activity.
