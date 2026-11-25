# 05: Softkey menus: the CH and Trigger menus

Spec: docs/specs/0002-bench-scope.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** The student presses a channel's menu button or the trigger Menu button. A softkey menu appears on screen in the skin's style, and the softkeys change coupling, bandwidth limit, probe, invert, trigger source, slope and mode. This makes AC/DC/GND coupling and Normal-mode waiting reachable.

**Blocked by:** 03, 04

**Status:** resolved

- [x] A reduced Tek-like menu tree as a state machine in the engine. Each skin renders it, and its logic is identical across skins. Softkeys select items, and Menu On/Off (TBS) shows and hides the menu.
- [x] CH menu: coupling DC/AC/GND (AC removes the mean; GND is a flat line at the channel's ground), BW limit (visibly less noise), probe 1×/10× (scales the displayed V/div), and invert.
- [x] Trigger menu: source CH1/CH2, slope rising/falling, mode Auto/Normal. Normal with no valid crossing waits and keeps the last frame.
- [x] The TDS Horiz menu holds the minimal items its active controls need, and TDS Trig View shows the trigger signal while it is held.
- [x] State: per-channel coupling, probe, BW limit and invert.
- [x] The control map's `active` flags match what is implemented.
- [x] Node test: softkey sequences change the expected settings; AC removes the offset; GND is flat; a 10× probe scales the V/div readout; Normal waits and keeps the frame; rising and falling trigger on opposite edges.
- [x] Playwright: on each skin, open the CH1 menu, switch to AC coupling with a softkey, and the DC offset disappears from the trace.

## Comments

- 2026-11-25: Implemented on the `bench-scope` integration branch (b8b2596); review fixes in 9779e6a.
