# 08: Bias, battery and recombination

**What to build:** A bias slider in Junction Mode runs from reverse through 0 to forward, in units of V_bi.

- **Battery:** drawn across the two contacts, with + and − on the correct sides. It flips when the bias crosses 0.
- **Contact water levels:** one tick at each contact, separated by qV. This is the "pump" that holds the two water tables apart. Quasi-Fermi levels are used inside the engine and never named on screen. Inside the junction, only the film depth shows the carrier populations.
- **Forward bias:**
  - The hill drops and the electron film reaches over the top.
  - The depletion region narrows but never vanishes. Its ions stay exposed in the real-space row while the film runs over them.
  - The climber arrow swells.
  - Droplets fall into bubbles, spread over a fading zone about one diffusion length past each depletion edge, each emitting a photon of energy ≈ E_g.
- **Reverse bias:**
  - The hill grows and the film dies out well below the top.
  - Only occasional p-side minority droplets roll down.
  - Only a thin roller arrow remains, fixed in size (the saturation current).
- **Exaggerated film:** minority and injected films are drawn exaggerated so they are visible. The exaggeration applies to the drawing only, never to the physics outputs.
- **No plots:** there is no I–V plot.

See [spec](../spec.md): Junction Mode (Bias, Flow arrows, Recombination), The band engine (Junction profile, Flows, Recombination, Display scaling).

**Blocked by:** 06 (Junction at equilibrium: the stack).

**Status:** ready-for-agent

- [ ] The engine's junction profile takes the bias V. Unit tests check:
  - the contact water levels are separated by qV;
  - forward bias lowers the barrier by qV and narrows the depletion width without reaching 0 for V < V_bi, while reverse bias widens it;
  - exposed ion charge persists under forward bias;
  - the climber flow grows exponentially with V and the roller flow is independent of V;
  - the recombination profile peaks just outside the depletion edges and decays over the diffusion length, with photon energy ≈ E_g;
  - display exaggeration changes drawn thickness only.
- [ ] The bias slider drives the profile. The battery's polarity flips across 0. An e2e test asserts this.
- [ ] Water-level ticks are drawn at the two contacts. No quasi-Fermi lines are drawn inside the junction.
- [ ] The flow arrows scale with the climber and roller flows. In reverse bias the roller arrow is fixed in size.
- [ ] In forward bias, recombination drops and photon marks appear past each depletion edge, fading with distance.
- [ ] The State publishes the bias, the barrier height, the depletion width, and the climber, roller and net flows, so that Conditions such as "bias > 0.5 V_bi" can be written.
- [ ] The Display still passes display-fit, in both views.
