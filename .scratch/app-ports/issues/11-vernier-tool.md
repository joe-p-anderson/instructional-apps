# 11: vernier Tool in Standalone mode, and removing the old app

Spec: docs/specs/0003-app-ports.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the new `vernier` Tool and practises reading a 0.05 mm vernier caliper in the v1 look.

- They choose outside, inside, depth or random measurements, and zoom in to the scales.
- They type a reading and Check it, with the existing error messages for badly formatted readings.
- When they miss or reveal the answer, they see the breakdown with the marks highlighted.
- They press Next for a new reading, and watch the Correct, Attempts and Streak counters.

A reload or a share link shows the same reading. The old vernier-trainer page is deleted.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Tool is defined with id `vernier` and one Mode, `caliper`.
- [x] A DOM-free module holds:
  - [x] the seeded reading generator, driven by a seed and a draw counter, with the same ranges per measurement type as today;
  - [x] the reading breakdown (the main-scale mark, the matching vernier line and the matching main-scale line);
  - [x] answer judging: a comma is accepted as the decimal separator; non-numbers and values that aren't multiples of 0.05 mm are rejected with the existing messages; an answer is correct when it rounds to the generated number of twentieths.
- [x] Controls:
  - [x] selects for measurement type and zoom;
  - [x] the reading input, with Check, Show answer and Next;
  - [x] the counter readouts.
- [x] The Setup accepts the measurement type, seed and zoom.
- [x] The State holds:
  - [x] the measurement type, seed and zoom;
  - [x] the reading in mm and its parts;
  - [x] whether it has been answered;
  - [x] the Correct, Attempts and Streak counters.
- [x] Serialization covers the seed, the draw counter, the counters and the zoom, so a reload shows the same reading.
- [x] The caliper Display:
  - [x] the Inkscape caliper SVG moves to its own asset, which the Tool loads and clones per instance with its ids made unique;
  - [x] the hatch, object and highlight groups are injected per instance;
  - [x] the PNG snapshot renders the SVG;
  - [x] dark mode is dropped.
- [x] Node tests cover:
  - [x] the same seed and counter giving the same reading;
  - [x] readings staying in range for each measurement type;
  - [x] the breakdown;
  - [x] each answer-judging case.
- [x] A Playwright Standalone smoke test checks that two instances on one page don't clash, that Check accepts the correct reading and rejects a wrong one, and that a reload and a share link restore the same reading.
- [x] The old vernier-trainer page is deleted, along with its folder if that leaves it empty. The repo README links the Tool.

## Comments

- 2026-11-25: Implemented on the `app-ports` integration branch (merge 538b654); code-review fixes in 7c50e19.
