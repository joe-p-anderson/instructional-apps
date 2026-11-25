# 11: vernier Tool in Standalone mode, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `vernier` Tool and practises reading a 0.05 mm vernier caliper in the v1 look.

- They choose outside, inside, depth or random measurements, and zoom in to the scales.
- They type a reading and Check it, with the existing error messages for badly formatted readings.
- When they miss or reveal the answer, they see the breakdown with the marks highlighted.
- They press Next for a new reading, and watch the Correct, Attempts and Streak counters.

A reload or a share link shows the same reading. The old vernier-trainer page is deleted.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Tool is defined with id `vernier` and one Mode, `caliper`.
- [ ] A DOM-free module holds:
  - [ ] the seeded reading generator, driven by a seed and a draw counter, with the same ranges per measurement type as today;
  - [ ] the reading breakdown (the main-scale mark, the matching vernier line and the matching main-scale line);
  - [ ] answer judging: a comma is accepted as the decimal separator; non-numbers and values that aren't multiples of 0.05 mm are rejected with the existing messages; an answer is correct when it rounds to the generated number of twentieths.
- [ ] Controls:
  - [ ] selects for measurement type and zoom;
  - [ ] the reading input, with Check, Show answer and Next;
  - [ ] the counter readouts.
- [ ] The Setup accepts the measurement type, seed and zoom.
- [ ] The State holds:
  - [ ] the measurement type, seed and zoom;
  - [ ] the reading in mm and its parts;
  - [ ] whether it has been answered;
  - [ ] the Correct, Attempts and Streak counters.
- [ ] Serialization covers the seed, the draw counter, the counters and the zoom, so a reload shows the same reading.
- [ ] The caliper Display:
  - [ ] the Inkscape caliper SVG moves to its own asset, which the Tool loads and clones per instance with its ids made unique;
  - [ ] the hatch, object and highlight groups are injected per instance;
  - [ ] the PNG snapshot renders the SVG;
  - [ ] dark mode is dropped.
- [ ] Node tests cover:
  - [ ] the same seed and counter giving the same reading;
  - [ ] readings staying in range for each measurement type;
  - [ ] the breakdown;
  - [ ] each answer-judging case.
- [ ] A Playwright Standalone smoke test checks that two instances on one page don't clash, that Check accepts the correct reading and rejects a wrong one, and that a reload and a share link restore the same reading.
- [ ] The old vernier-trainer page is deleted, along with its folder if that leaves it empty. The repo README links the Tool.
