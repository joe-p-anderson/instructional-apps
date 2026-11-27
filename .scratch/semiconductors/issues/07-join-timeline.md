# 07: Join timeline

**What to build:** Junction Mode can start with the n slab and the p slab apart.

- **Before joining:** both slabs are the same material, so their E_c and E_v line up and their water tables sit at different heights.
- **Join:** a Join Control brings them together and enables a join timeline, with play/pause and a scrubber over a normalised time τ from 0 to 1.
- **Scrubbing or playing shows the approach to equilibrium:**
  - liquid spills n → p and bubbles move p → n;
  - ions are exposed in the real-space row;
  - ρ(x) and E(x) grow;
  - the band bend (the hill) grows;
  - the net flow falls until the water tables match at τ = 1.
- **Timing:** the join timeline is driven by τ and is separate from the ambient ripple animation.

See [spec](../spec.md): Junction Mode (Join), The band engine (Join timeline).

**Blocked by:** 06 (Junction at equilibrium: the stack).

**Status:** ready-for-agent

- [ ] The engine's join timeline returns the junction profile quantities at any τ ∈ [0, 1]. Unit tests check:
  - τ = 0 gives flat bands with misaligned E_F;
  - τ = 1 matches the V = 0 equilibrium profile from ticket 06;
  - the transferred charge, exposed ions and bend grow monotonically with τ;
  - the net flow falls monotonically to 0.
- [ ] A Setup can start Junction Mode with the slabs apart. The Join Control joins them and enables the timeline Controls.
- [ ] Play advances τ, pause stops it, and the scrubber sets τ directly. The play loop is cancelled on destroy.
- [ ] The State publishes "joined" and τ, so that Conditions such as "joined and τ = 1" can be written.
- [ ] Join and the timeline Controls are keyboard-operable.
- [ ] An e2e test checks that Join enables the timeline and that scrubbing changes the State's τ.
