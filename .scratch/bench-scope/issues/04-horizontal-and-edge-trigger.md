# 04: Horizontal controls and edge trigger

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student sets the time base and learns triggering. A level outside the signal makes the trace free-run and drift. Pushing for 50% (TBS) or pressing Set To 50% (TDS) brings back a stable trace. Run/Stop, Single and Force Trig behave as on the real scopes.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Horizontal Scale steps s/div from 1 µs to 1 s in each skin's own sequence. Horizontal Position moves the trigger point, recentred by a push (TBS) or Set to Zero (TDS).
- [ ] Edge trigger with the defaults source CH1, rising slope and Auto mode. The level knob moves a visible level marker, and the trigger readout is drawn on screen.
- [ ] Auto mode with no valid crossing gives a free-running, unstable trace.
- [ ] Set to 50% puts the level at the midpoint of the source's acquired range.
- [ ] Run/Stop toggles acquisition. Single arms one capture, then stops. Force Trig forces an acquisition at an arbitrary phase.
- [ ] Small fixed noise, seeded per capture, so the same seed and events give identical frames. Noise around the crossing gives realistic jitter when the level sits near a peak.
- [ ] State: s/div, horizontal position, trigger source, slope, level and mode, run state, and whether the trace is stable.
- [ ] Node test: a level above the signal in Auto is unstable; Set to 50% restores stability; Single stops after one capture; Force Trig acquires; identical seeds give identical frames.
- [ ] Playwright: turning the level off the signal makes the stable flag false, and Set to 50% makes it true, on whichever skins exist when this ticket lands (both, if ticket 03 is done).
