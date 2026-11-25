# 07: Autoset

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** From any scrambled setup, the student presses Autoset and gets a stable, sensibly scaled trace, as on the bench.

**Blocked by:** 04, 06

**Status:** resolved

- [x] For each displayed channel, Autoset chooses V/div so the trace spans about 4–6 divisions, and centres it.
- [x] It chooses s/div to show about 2–3 cycles of the lowest-frequency displayed channel.
- [x] It triggers on CH1 (or the only displayed channel), rising edge at 50%, in Auto mode, and sets coupling to DC.
- [x] Autoset returns the display format to YT. That only becomes visible once XY exists in ticket 10, but the engine resets the format field now.
- [x] Node test: from several scrambled setups (including an independent CH2 at a lower frequency), Autoset yields a stable trace with 2–3 cycles and a 4–6 division span.
- [x] Playwright: scramble the knobs, press Autoset, and the trace is stable on every skin that exists.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (afb130d); review fixes in 9779e6a.
