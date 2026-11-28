# Spec: the Semiconductors Tool (energy bands, doping, and the p–n junction)

Status: ready-for-agent

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Builds on framework v1 ([Spec 0001](../../docs/specs/0001-framework-v1.md)) and the shell revision. Respects [ADR 0001](../../docs/adr/0001-json-report-with-report-viewer.md), [ADR 0002](../../docs/adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../../docs/adr/0003-major-versioned-framework-folder.md). Follows the [Phasors spec](../phasors/spec.md) and the Fourier Tool for structure, testing and site listing.

## Problem Statement

The course needs semiconductors as the bridge to diodes and transistors. The topic is peripheral, so it gets two lecture periods. The students are junior engineers and physics majors, and they meet the same difficulties every year:

- **Bands are asserted, not earned.** Students are told that bands exist, but not that a band is a huge number of closely spaced states. So "empty states just above" means nothing to them.
- **"Full means it conducts."** Students think more electrons means more current. They don't see that a completely full band carries none, because nothing has room to move.
- **The Fermi level is a mystery.** In a semiconductor it sits in the gap, where there are no electrons, and students can't say what it is.
- **Holes are bookkeeping.** Students don't see an empty spot in a full band as something that moves and carries current, or why hole current points the same way as electron current.
- **"n-type is negatively charged."**
- **Depletion is misread.** Students don't see that how full the bands are can change with position, or that a depletion region is defined by exposed ion charge. They think forward bias makes the depletion region disappear.
- **The reverse current is magic.** The small, bias-independent saturation current is never explained.
- **Signs get tangled.** Students mix up the sign of electron energy against electric potential, and so the sign of forward bias.

The instructor's picture is a liquid in tanks:

- **Bands are tanks.** Electrons fill them like a liquid.
- **Conduction is ripples on the surface.** A ripple needs headroom: a moving carrier gains a little kinetic energy, so it needs empty states just above it.
- **A full tank cannot ripple.**
- **Holes are bubbles.**
- **The Fermi level is a water table.** When two materials touch, their water tables equalize.

No Tool shows this picture, and none ties it to the standard band diagrams that students will meet in textbooks and exams.

## Solution

A new Tool, `semiconductors` ("Bands and Junctions"), built on framework v1, with three Modes: **Atoms**, **Bulk** and **Junction**. A fourth Mode (BJT) is planned later and is out of scope here, but the Junction model must be able to grow into two junctions without a rewrite.

Two Activities are built on the Tool, each about 50 minutes, listed under PHY/EGR 3120:

1. **"Energy Bands and Doping"** (Atoms, then Bulk). Takeaway: *a material conducts only where carriers have empty states just above them, and the Fermi level (set by the gap, temperature and doping) decides where that happens.*
2. **"The p–n Junction"** (Junction). Takeaway: *carriers spill across until the ions they leave exposed build a hill (the bent bands) that stops them; bias lowers or raises that hill, so current flows easily one way only.*

### Shared conventions

- **Axes:** energy points up and position runs across, in every Bulk and Junction Display. A slab in Bulk looks exactly like one side of the Junction.
- **The water metaphor:**
  - **Electrons:** a blue liquid filling a band from its bottom edge up.
  - **Holes:** bubbles, or missing liquid, at the top of the valence band.
  - **Ripples:** an animated texture on a liquid surface, drawn only where the band has both carriers and headroom.
- **Water view and Textbook view:** a toggle in Bulk and Junction, always available and never locked by an Activity.
  - Both views use identical geometry: the same band edges, positions, scales, plots and layout.
  - Textbook view only removes the metaphor styling: the liquid fill, ripples, bubbles and metaphor colour. What remains are labelled E_c, E_v and E_F lines, plus carriers drawn as plain textbook marks.
- **The water table (E_F):** a dashed line. It is defined to students as "the energy where a state, if one existed, would be 50% occupied."
- **The real-space row:** a strip under the band diagram, in Bulk and in Junction. It shows:
  - a faint grid of neutral host-lattice atoms, with no charge marks;
  - dopants as substitutions in that grid, drawn as ⊕ (donor) and ⊖ (acceptor);
  - mobile carriers: electron dots and hole circles.

  Ions never move; carriers do. A depletion region reads as "ions with no partner nearby."
- **Dopant levels:** short dashes in the gap, with no charge marks. Donor levels sit just below E_c and acceptor levels just above E_v. Charge appears only in the real-space row.
- **Animation:**
  - Ripples, droplets and bubbles animate continuously, with a pause Control.
  - Under prefers-reduced-motion, liquid surfaces are drawn as static wavy lines.
  - Pausing freezes the picture for snapshots.
- **Exaggerated film:** the thin films of minority and injected carriers are drawn much thicker than they really are, so they are visible at moderate bias. The Task where this matters says so inline.
- **Caveats inline:** each "where the analogy lies" caveat appears in the Task where it matters, not in a separate panel. There are about 3–4 in total:
  - E_F isn't a surface (Bulk, gap and temperature).
  - Films are exaggerated (Junction, bias).
  - Electrons aren't a continuous fluid (optional, in Atoms or Bulk).
- **Units:** energies in eV with qualitative scales. Bias is in units of V_bi. No I–V plot appears anywhere; it belongs to the later diode-as-device lecture.

### Atoms Mode

- **Display:** a row of N atoms drawn as potential wells, with their energy levels above them.
- **Controls:**
  - an atom-count slider (1, 2, 4, 8 … "many");
  - an interatomic-spacing slider, with a marker at the real crystal spacing.
- **Behaviour:**
  - Each atomic level splits into N levels.
  - Closer spacing spreads the splitting.
  - At "many", the levels merge into bands with a gap between them.
- **Takeaway:** a band is a huge number of closely spaced states.

### Bulk Mode

- **Display:**
  - one slab's band diagram;
  - beside it, a narrow f(E) occupancy strip on the same energy axis, with the water table drawn across both;
  - the real-space row under the slab.
- **Controls:**
  - **Material picker:** "partly filled band" (metal) or "filled band." For a filled band, a gap slider has a semiconductor region and an insulator region marked on it, judged against kT, so the boundary reads as a matter of degree.
  - **Temperature slider.** Raising it sprays droplets across the gap and leaves bubbles behind. f(E) smears.
  - **Tilt slider (applied field):** slopes the bands.
    - The liquid in a partly filled band drifts and ripples.
    - A full tank doesn't move.
    - In a semiconductor, droplets roll one way and bubbles drift the other.
  - **Doping type** (none, n or p) and **concentration slider.** Doping is at room temperature, with every dopant ionized.
    - E_F moves toward the band.
    - Majority carriers appear, and the minority carriers visibly shrink (np = n_i², not derived).
    - Ions appear in the real-space row.
  - **Net-charge readout.** It always reads 0 for an isolated slab.
  - **Water/Textbook toggle** and **pause.**
- **Not modelled:** freeze-out, compensation (both donors and acceptors in one slab), and the hot-intrinsic regime.

### Junction Mode

- **Display:** a vertical stack sharing one x-axis, with depletion-edge guides through all of it:
  1. band diagram;
  2. real-space row;
  3. ρ(x);
  4. E(x).

  A one-line note points out that the bent band edge already *is* the potential, in electron-energy units, so no V(x) plot is drawn. The stack is shown in every Junction Part.
- **Doping:** fixed and symmetric on both sides. Asymmetry is mentioned in a sentence only.
- **Join:**
  - The Setup can start with the n slab and the p slab apart. Both are the same material, so their E_c and E_v line up and their water tables sit at different heights.
  - A Join Control brings them together.
  - A **join timeline** with play/pause and a time scrubber shows the approach to equilibrium:
    - liquid spills n → p and bubbles move p → n;
    - ions are exposed;
    - ρ and E grow;
    - the hill grows;
    - the flow slows to a stop when the water tables match.
- **Bias:**
  - **Control:** a single slider, from reverse through 0 to forward, in units of V_bi.
  - **Battery:** drawn across the two contacts, with + and − on the correct sides. It flips when the bias crosses 0.
  - **Water-level ticks:** one at each contact, separated by qV. This is the "pump" that holds the two water tables apart, and stands in for quasi-Fermi levels without naming them. Inside the junction, only the film depth shows the carrier populations.
  - **Forward:**
    - The hill drops and the film reaches over the top.
    - The depletion region narrows but never vanishes. Its ions stay exposed while the film runs over them.
  - **Reverse:**
    - The hill grows and the film dies out well below the top.
    - The only crossing is the occasional p-side minority droplet rolling down.
- **Flow arrows:** two opposing arrows across the junction.
  - Climbers go n → p and rollers go p → n. Each arrow's width shows that flow.
  - At equilibrium they are equal.
  - In forward bias the climber arrow swells.
  - In reverse bias only a thin roller arrow remains, and it is fixed in size (the saturation current).
- **Recombination:** in forward bias, droplets fall into bubbles, spread over a fading zone about one diffusion length past each depletion edge, each emitting a photon of energy ≈ E_g. There is no material choice.
- **Water/Textbook toggle** and **pause.**

### Activity 1: "Energy Bands and Doping" (PHY/EGR 3120)

1. **Part 1, Atoms to bands** (Atoms, about 5 minutes).
   - Step N from 1 to "many" and vary the spacing.
   - Questions: what a band is, and why spacing sets the band width and the gap.
2. **Part 2, Filling and headroom** (Bulk, T = 0, no doping).
   - **Prediction gate:** before the tilt is unlocked, students answer "which tank will carry current, the partly filled one or the full one?"
   - Tilt the metal, then the full band. Only the partly filled band ripples and drifts.
   - The water table is the liquid surface here.
3. **Part 3, Gap and temperature** (Bulk, filled band).
   - Insulator vs semiconductor by E_g compared with kT.
   - Raising T makes droplets and bubbles appear.
   - E_F now sits in the gap, introduced with the 50% definition and f(E). An inline caveat says the water table is not a surface.
   - Tilt the semiconductor. A Task asks why droplets and bubbles moving opposite ways give current in the same direction.
4. **Part 4, Doping** (Bulk, room temperature).
   - **Prediction gate:** before donors are unlocked, students answer "where will the water table move?" (and/or "will the slab be charged?").
   - Add donors, then acceptors.
   - E_F moves, the majority carriers appear and the minority carriers shrink. A Task asks why.
   - The net charge stays 0, and the ions are visible in the real-space row.

### Activity 2: "The p–n Junction" (PHY/EGR 3120)

1. **Part 1, Join** (Junction, slabs apart, equilibrium bias).
   - **Prediction gate:** before Join is unlocked, students answer "which way will the liquid flow, and what happens to the n-side bands?"
   - Join, then scrub the timeline. Tasks point at early moments (big flow, small hill) and late ones (no net flow, full hill).
2. **Part 2, Equilibrium anatomy** (Junction, joined, V = 0).
   - Fullness varies with position: a puddle on the n side, bubbles on the p side, and a middle that is dry above and full below, with no ripples in either band.
   - Depletion = exposed ions.
   - Ions → ρ → E → bend.
   - The climber and roller arrows balance.
3. **Part 3, Bias** (Junction).
   - **Prediction gate:** before forward bias is first unlocked, students predict what forward bias does to the hill.
   - Forward and reverse.
   - The depletion region narrows but keeps its exposed ions. An inline caveat says the films are exaggerated.
   - The saturation current comes from the rolling minority droplets.
   - One Task asks what sets the photon energy.

### Prediction gates

A prediction gate is a Task whose Question must be Submitted before the next Task unlocks the Control it hides. The prediction is recorded in the Report; it may be a `choice` or `text` Question and is never graded for correctness (any answer passes). There are five gates:

- **Activity 1:** before the first tilt, and before donors.
- **Activity 2:** before Join, and before forward bias.

## User Stories

### Instructor

1. As the instructor, I want one semiconductor Tool with Atoms, Bulk and Junction Modes, so that both lectures use one consistent picture and Standalone mode covers the whole topic.
2. As the instructor, I want two 50-minute Activities on that Tool, so that bands and doping and the junction each fit one lecture period.
3. As the instructor, I want both Activities listed under PHY/EGR 3120, so that students find them before the diode lectures.
4. As the instructor, I want to demo every Mode in Standalone mode with every Control available, so that I can answer "what if" questions live.
5. As the instructor, I want the liquid metaphor (tanks, ripples, bubbles, water table) drawn consistently in every Mode, so that the analogy I teach with is the one students see.
6. As the instructor, I want a Water/Textbook toggle with identical geometry in both views, so that students can map the metaphor onto standard band diagrams one-to-one.
7. As the instructor, I want ripples drawn only where carriers have headroom, so that the picture encodes "conduction needs empty states just above."
8. As the instructor, I want E_F drawn as a water table defined as the 50% occupancy level, so that a Fermi level in the gap makes sense.
9. As the instructor, I want an f(E) strip beside the Bulk slab, so that the 50% definition is visible and smears with temperature.
10. As the instructor, I want holes drawn as bubbles, so that hole motion and hole current are intuitive.
11. As the instructor, I want a tilt Control for the applied field, so that conduction is shown as tilted bands, which matches textbooks.
12. As the instructor, I want a material picker plus a gap slider with semiconductor and insulator regions judged against kT, so that students see that the distinction is one of degree.
13. As the instructor, I want doping at room temperature only, n or p, so that the Part stays focused on where E_F goes.
14. As the instructor, I want minority carriers visibly shrinking as doping rises, so that Activity 2's saturation current has a setup.
15. As the instructor, I want a net-charge readout that stays 0, so that the "n-type is negative" misconception is addressed directly.
16. As the instructor, I want a real-space row with fixed ions, mobile carriers and a faint neutral lattice, so that depletion can be defined as exposed ions.
17. As the instructor, I want dopant levels drawn as dashes near the band edges, so that students see why dopants ionize so easily.
18. As the instructor, I want the join to play as a scrubbable timeline, so that students watch diffusion build the field that stops it.
19. As the instructor, I want ρ(x) and E(x) stacked under the band diagram on one x-axis, so that "ions → ρ → E → bend" reads straight down the page.
20. As the instructor, I want no V(x) plot, with a note that the band edge is the potential, so that I avoid the sign flip between potential and electron energy.
21. As the instructor, I want bias drawn as a battery with correct polarity and water-level ticks at the contacts, so that students get the sign of forward bias right without quasi-Fermi levels.
22. As the instructor, I want forward bias to narrow the depletion region while its ions stay exposed, so that students don't learn that the depletion region disappears.
23. As the instructor, I want two opposing flow arrows instead of an I–V plot, so that equilibrium balance and the saturation current are visible without a plot I teach later.
24. As the instructor, I want recombination spread past each depletion edge with photons ≈ E_g, so that the LED connection is physically right.
25. As the instructor, I want prediction gates at the five key reveals, so that students commit to a prediction before seeing the answer.
26. As the instructor, I want predictions recorded but never graded for correctness, so that students predict honestly.
27. As the instructor, I want the "where the analogy lies" caveats inline in the Tasks where they matter, so that students meet each limit at the right moment.
28. As the instructor, I want the exaggerated film disclosed, so that the picture stays honest.
29. As the instructor, I want free-text explanations recorded in the Report without auto-grading, so that I can grade the reasoning.
30. As the instructor, I want the Report to include a snapshot of the Display at Submit, so that I see what the student saw.
31. As the instructor, I want the Junction model built so that a later BJT Mode can reuse it as two junctions, so that adding the BJT isn't a rewrite.

### Student: Atoms Mode

32. As a student, I want to add atoms one count at a time and see each level split into N, so that I understand where a band comes from.
33. As a student, I want to change the atomic spacing and see the bands widen and the gap change, so that I connect bands to the crystal.
34. As a student, I want a marker at the real crystal spacing, so that I know which picture describes the real material.

### Student: Bulk Mode

35. As a student, I want to see a metal's partly filled band ripple and drift when I tilt it, so that I see what conduction looks like.
36. As a student, I want to see a full band stay still when tilted, so that I understand why a full band carries no current.
37. As a student, I want to raise the temperature and watch droplets jump the gap and leave bubbles, so that I understand thermal carriers.
38. As a student, I want to change the gap and see when a material behaves like a semiconductor or an insulator, so that I understand the difference.
39. As a student, I want to see E_F in the gap with f(E) beside it, so that I understand what the Fermi level means where there are no states.
40. As a student, I want to tilt a semiconductor and watch droplets and bubbles move opposite ways, so that I understand hole current.
41. As a student, I want to add donors or acceptors and watch E_F move toward a band, so that I understand what doping does.
42. As a student, I want to see minority carriers shrink as majority carriers grow, so that I understand both populations in a doped slab.
43. As a student, I want to see the dopant ions in a real-space row and a net charge of 0, so that I know a doped slab is neutral.
44. As a student, I want to switch to Textbook view and see the same diagram without the liquid, so that I can read standard band diagrams.

### Student: Junction Mode

45. As a student, I want to predict what happens when n and p slabs touch before I join them, so that I test my own understanding.
46. As a student, I want to scrub the join timeline and see liquid spill, ions get exposed and the hill grow until flow stops, so that I understand how the junction forms.
47. As a student, I want ρ(x) and E(x) under the band diagram on the same x-axis, so that I see that exposed ions make the field that bends the bands.
48. As a student, I want to see fullness change with position (a puddle on one side, bubbles on the other, a full-or-dry middle), so that I understand the depletion region.
49. As a student, I want the real-space row to show ions with no partner in the depletion region, so that I know what "depleted" means.
50. As a student, I want two opposing flow arrows that balance at equilibrium, so that I understand zero net current is a balance, not stillness.
51. As a student, I want a bias slider with a drawn battery and polarity, so that I can tell forward from reverse.
52. As a student, I want to see the film spill over the lowered hill in forward bias, so that I understand why current flows.
53. As a student, I want to see the depletion region narrow but stay, with its ions still exposed, so that I don't think forward bias removes it.
54. As a student, I want to see only rare minority droplets roll down in reverse bias, so that I understand the small, flat reverse current.
55. As a student, I want to see recombination past each edge emit photons of energy ≈ E_g, so that I understand how an LED makes light.
56. As a student, I want to pause the animation, so that I can study a frozen picture.

### Student: Activity shell

57. As a student, I want to start each Activity at the Name gate and have my Run autosaved, so that I can come back to it.
58. As a student, I want Hints after repeated wrong attempts, so that I can get unstuck.
59. As a student, I want to download a Report at the end, so that I can turn my work in.
60. As a student on a narrow screen, I want the Tasks in the Task drawer and the Display to fit without scrolling, so that the Activity still works.
61. As a keyboard user, I want every Control, including Join, the timeline scrubber and the view toggle, operable from the keyboard, so that I can do the Activities without a mouse.
62. As a student who prefers reduced motion, I want a static rendering of ripples and flows, so that the Activities work without animation.

## Implementation Decisions

### The band engine

A new pure module inside the Tool, with no DOM, so that it can be tested in Node. It is the Tool's only source of physics. Its exact interface is left to the implementer. It works in dimensionless, qualitative units (energies in eV-like units, kT, V_bi), tuned for the picture rather than for silicon data.

- **Level splitting (Atoms):** given N, the spacing and the single-atom levels, it returns the N split levels per atomic level, whose spread grows as the spacing shrinks. At "many", it returns band extents and the gap.
- **Bulk statistics:** given the material (partly filled or filled band), E_g, T and the doping (type and concentration), it returns:
  - E_F;
  - f(E);
  - the electron and hole densities, with np = n_i² for filled-band materials;
  - the ionized dopant densities;
  - net charge = 0.
- **Tilt:** given a field, it returns sloped band edges and the drift direction and magnitude for electrons and holes. A completely full or empty band returns zero drift.
- **Junction profile:** given symmetric doping, E_g, T and bias V (in units of V_bi), it returns, as functions of x:
  - E_c(x) and E_v(x);
  - the depletion edges and width (narrowing as V → V_bi, widening in reverse);
  - the electron and hole densities;
  - ρ(x) and E(x);
  - the water-level positions at the two contacts (separated by qV).

  Inside the profile, densities follow a hidden quasi-Fermi treatment. Past each depletion edge, minority densities decay over a diffusion length.
- **Flows:** the climber (n → p) and roller (p → n) magnitudes. They are equal at V = 0. The climber flow grows exponentially with forward bias, and the roller flow is independent of bias.
- **Recombination:** a recombination rate profile vs x (peaking just past each edge and fading over a diffusion length) and a photon energy ≈ E_g.
- **Join timeline:** a relaxation from "slabs just joined, flat bands, misaligned E_F" to equilibrium, parameterised by a normalised time τ ∈ [0, 1]. At each τ it returns the same profile quantities, with transferred charge, exposed ions, ρ, E and the bend growing monotonically and net flow falling monotonically to 0.
- **Display scaling:** separate from the physics, the engine (or a thin helper beside it) provides the exaggeration applied to film thickness for drawing. The physics outputs stay honest.
- **BJT readiness:** the junction profile is built from a composable description of regions (doping type and extent) and contacts, so that n–p–n with two biases is an extension, not a rewrite.

### Tool and Modes

- **Tool contract:** the Tool follows framework v1's Tool contract, with Modes `atoms`, `bulk` and `junction`. Its panel layout is `side`.
  - Each Mode must support being mounted several times on one page (ADR 0002).
  - Each Part keeps its own State.
- **Shared Controls (Bulk and Junction):** the Water/Textbook toggle and pause. They have the same ids in both Modes and are never put in a Task's `hide` list by these Activities.
- **Atoms Controls:** atom count and spacing.
- **Bulk Controls:** material, gap, temperature, tilt, doping type and doping concentration.
- **Junction Controls:** Join; the join-timeline play/pause and scrubber (enabled after Join); bias.
- **Prediction gates:** built from the framework's existing Task `hide` list on Control ids. The gate Task hides the Control and the next Task shows it. No framework change is expected; if one turns out to be needed, raise it instead of working around it.
- **Displays, each with an id:**
  - Atoms: the wells-and-levels Display.
  - Bulk: the slab band diagram with its f(E) strip, and the real-space row.
  - Junction: the band diagram, the real-space row, ρ(x) and E(x), stacked with a shared x-axis and depletion-edge guides.
- **Rendering:**
  - Drawn from engine output only.
  - Water and Textbook views are one render path with a style switch. Geometry (band edges, positions, scales, plot axes) is computed once and shared, and the switch changes only fills, ripples, bubbles and colour.
  - Colours come from the framework plot theme, and each quantity has one colour across Displays.
  - Displays never scroll, and drawn text is at least 13 px.
  - The Tool must pass display-fit. Declare `minDisplayWidth` if the Junction stack needs it.
- **Animation:**
  - Ripple, drift and droplet animation runs on one animation loop, cancelled on destroy (following the Fourier and Phasors play loops).
  - Pause stops it.
  - Under prefers-reduced-motion it doesn't run, and surfaces are drawn as static wavy lines.
  - The join timeline is separate from the ambient animation; it is driven by τ.
- **Battery:** drawn on the Junction band diagram across the contacts. Its polarity follows the sign of the bias.

### State

The State publishes:

- every Control value:
  - Mode, view (water/textbook), paused;
  - Atoms: N, spacing;
  - Bulk: material, E_g, T, tilt, doping type, doping concentration;
  - Junction: joined, τ, bias.
- the derived values:
  - E_F (Bulk), the electron and hole densities (Bulk), net charge (Bulk);
  - the band width and gap (Atoms);
  - the depletion width and edges (Junction), the barrier height (Junction);
  - the climber and roller flows and the net flow (Junction);
  - whether the tilt has been applied, for Conditions.

Conditions can be written against these, for example "joined and τ = 1", "bias > 0.5 V_bi" or "doping type = n". The visual snapshot is a PNG of the Displays.

### Activities

- **Data:** both Activities are pure data in the Tool's activities, course "PHY/EGR 3120", with encoded answer keys, following the Fourier and Phasors Activities.
- **Part order:**
  - Activity 1: Atoms to bands, Filling and headroom, Gap and temperature, Doping.
  - Activity 2: Join, Equilibrium anatomy, Bias.
- **Setups:** the implementer picks the values. Activity 2's Setups use fixed, symmetric doping throughout.
- **Question types:**
  - Conceptual checks are `choice` Questions.
  - Explanations are `text` Questions, recorded only.
  - Prediction gates are `choice` or `text` Questions that always pass.
  - There are no numeric hand calculations. The treatment is qualitative.
- **Caveats:** the inline caveats are part of Task text in the Parts listed under Shared conventions.

### Site

- **Pages:** a Standalone page and one Activity page per Activity.
- **Listings:** add the Tool and both Activities under PHY/EGR 3120 in the root index and the README, after the Phasors entries.

## Testing Decisions

Good tests check behaviour through a public seam, not internals. These are the three seams, the same as the Fourier and Phasors Tools':

1. **The band engine, with node:test** (prior art: the Fourier and Phasors engine unit tests).
   - **Atoms:** N levels per atomic level. The spread grows monotonically as the spacing shrinks. At "many", a gap exists between the bands.
   - **Bulk, E_F:** in a partly filled band, E_F lies inside the band. In an undoped filled band, E_F is mid-gap. n-type moves E_F toward E_c and p-type toward E_v, monotonically with concentration.
   - **Bulk, carriers:**
     - np = n_i² across doping levels.
     - Raising T raises the intrinsic carrier density.
     - A wider gap at fixed T gives fewer carriers.
     - Net charge = 0 for every doping.
   - **Tilt:** zero drift for a completely full band and for an empty band. Electrons and holes drift in opposite directions and give current of the same sign.
   - **Junction at V = 0:**
     - E_F is flat across the device.
     - The barrier height equals V_bi.
     - ∫ρ dx = 0.
     - E(x) is zero outside the depletion edges and peaks at the junction.
     - The band bend is consistent with E(x).
     - The climber and roller flows are equal.
   - **Junction under bias:**
     - The contact water levels are separated by qV.
     - Forward bias lowers the barrier by qV and narrows the depletion width without reaching zero for V < V_bi.
     - Reverse bias widens it.
     - Exposed ion charge persists under forward bias.
     - The climber flow grows exponentially with V.
     - The roller flow is independent of V.
   - **Recombination:** its profile peaks just outside the depletion edges and decays over the diffusion length. The photon energy ≈ E_g.
   - **Join timeline:**
     - τ = 0 gives flat bands with misaligned E_F.
     - τ = 1 matches the V = 0 equilibrium profile.
     - The transferred charge and bend grow monotonically with τ, and the net flow falls monotonically to 0.
   - **Display scaling:** exaggeration changes drawn thickness only, never the physics outputs.
2. **The Activities, through the runner core with `stubTool`** (prior art: the Fourier and Phasors Activity unit tests).
   - Both Activities name the `semiconductors` Tool, and their Parts use the intended Modes and Setups.
   - Each prediction gate hides its Control, and the following Task shows it.
   - Gate Questions pass for any answer. Correct `choice` answers pass and wrong ones fail.
   - The answer keys are encoded.
3. **Playwright end-to-end tests** (prior art: the Fourier and Phasors standalone and activity specs).
   - The Standalone page loads all three Mode tabs.
   - The Water/Textbook toggle changes the styling but leaves the band-edge geometry unchanged. Compare the published geometry State, or the drawn band-edge positions, before and after.
   - Join enables the timeline, and scrubbing changes the State's τ.
   - The bias slider flips the battery polarity across 0.
   - Pause stops the animation.
   - Each Activity page: the Name gate, a prediction gate blocking its Control until Submit, Submitting a Task, and downloading the Report.
   - Add the Tool to the display-fit spec's list.

## Out of Scope

- **Reserved for later:** the BJT, planned as a fourth Mode in a later spec. This spec only keeps the junction model composable.
- **Out of scope for the course:**
  - reverse breakdown and Zener tunnelling (Zener is covered later from the device side only);
  - photodiodes and solar cells;
  - E–k diagrams;
  - Si vs GaAs and direct vs indirect gaps.
- **Plots left out:** I–V plots of any kind (they come in the diode-as-device lecture), and V(x) plots.
- **Junction variations:** asymmetric doping in the Junction Mode, and heterojunctions.
- **Bulk effects:** freeze-out, compensation and the hot-intrinsic regime.
- **Other:** quantitative silicon numbers, hand calculations, the Shockley equation, density-of-states-shaped tanks, and named quasi-Fermi levels.
- **No changes to:** the DiodesLoadLines Tool or any other Tool.

## Further Notes

- **Origin:** this spec came from a design discussion and a grilling session. The key physics choices settled there:
  - **Ripples mean headroom.** A ripple requires both carriers and empty states just above them.
  - **E_F is a water table, not a surface.** It coincides with the liquid surface only in a metal.
  - **"Depleted" is about charge, not about zero carriers.** Carriers are scarce compared with the dopant density, so the exposed ions set the field. Under typical forward bias, carrier density in the middle reaches around 10% of the doping while the region remains a depletion region.
  - **Height blocks crossing, not width.** Students may picture carriers "splashing" across the depletion region; the Tool must avoid that picture. Width matters only for tunnelling, which is out of scope.
  - **Recombination is spread out.** It happens over about a diffusion length past each edge; a small amount inside the depletion region is ignored.
- **Course assumption:** the course is assumed to be PHY/EGR 3120 (junior engineers and physics majors, with diodes and BJTs in the course). Change the listing if it belongs elsewhere.
- **Implementation order:** a natural ticket order is:
  1. engine;
  2. Tool shell with three Modes, the view toggle and pause;
  3. Atoms Mode;
  4. Bulk band diagram, f(E) strip and real-space row;
  5. Bulk tilt, temperature and doping;
  6. Junction static profile and stack;
  7. join timeline;
  8. bias, battery, flow arrows and recombination;
  9. Activity 1;
  10. Activity 2;
  11. site listing and e2e tests.
