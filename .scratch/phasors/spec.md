# Spec: the Phasors Tool (adding sinusoids, impedance, and series RLC)

Status: resolved

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Builds on framework v1 ([Spec 0001](../../docs/specs/0001-framework-v1.md)) and the shell revision. Respects [ADR 0001](../../docs/adr/0001-json-report-with-report-viewer.md), [ADR 0002](../../docs/adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../../docs/adr/0003-major-versioned-framework-folder.md). Follows the [Fourier spec](../fourier/spec.md), whose Aₙ cos(nω₀t + φₙ) convention this Activity picks up.

## Problem Statement

In PHY/EGR 3120, phasors come right after the Fourier series. Students have just seen that a first-order RC filter scales and phase-shifts each harmonic. They have not yet seen where |H| and ∠H come from.

The instructor has taught phasors with a Desmos geometry graph, "Phasors" (desmos.com/geometry/4tbuumgjjm). It works like this:

- A source phasor V₀∠ωt rotates, and its projection on the real axis traces V_in(t).
- The resistor phasor stands in for the current.
- The capacitor phasor is drawn as v − i.
- The impedance R − j/(ωC) is drawn as a static vector, with its angle marked.

The graph has these limits:

- **One circuit:** series RC only. There is no inductor, so students never see a lead next to a lag.
- **No free-standing sum:** the first idea, that two same-frequency sinusoids add like vectors, is never isolated.
- **The current is a proxy:** the resistor phasor stands in for I, which blurs current and voltage.
- **One mixed plane:** Ω and V share one set of axes.
- **Normalized units:** w₀ = 1, so there is no link to the bench.
- **No student Activity:** there are no Tasks, no Report, and no way to see a student's work.

Students need to learn three things:

1. **What a phasor is.** A sinusoid A cos(ωt + φ) is the real part of a rotating complex number. Two same-frequency sinusoids therefore add by vector addition: the law of cosines gives the amplitude of the sum, and components give its phase.
2. **Total impedance gives the current.** Impedances in series add as complex numbers, Z = Z_R + Z_L + Z_C, and the current phasor is I = V/Z. Rotating phasors are multiplied and divided by static impedances.
3. **The current gives each device's voltage.** V_k = I·Z_k: V_R is in phase with I, V_L leads it by 90° and V_C lags it by 90°. The device voltages add head-to-tail to the source (KVL).

## Solution

A new Tool, `phasors` ("Phasors and Impedance"), built on framework v1, with two Modes. An Activity, "Phasors and Impedance", listed under PHY/EGR 3120, walks students through both Modes.

### Shared conventions (both Modes)

- **Frequency:** angular frequency ω in rad/s is the frequency Control. A read-only readout beside it shows f = ω/2π in Hz, to connect with the Fourier Tool and the bench. No hand calculation divides by 2π.
- **Sinusoid form:** every sinusoid is A cos(ωt + φ), with φ in degrees. Its phasor is A∠φ.
- **Complex notation:** j (EE convention). Every phasor and impedance readout shows both rectangular a + jb and polar A∠φ°.
- **Time controls:** a play/pause button and a t-scrubber.
  - The Tool starts paused at t = 0, so every phasor sits at its static angle.
  - Play rotates every phasor at ω, looping t modulo one period, as the old Desmos did.
  - A time cursor on the time plot marks t and can be dragged. Each phasor's projection on the real axis meets its curve at the cursor.
- **Units:** real units throughout (V, A, Ω, mH, µF, rad/s).

### Sum Mode

- **Two sinusoids:** v₁ = A₁ cos(ωt + φ₁) and v₂ = A₂ cos(ωt + φ₂), at one shared ω.
- **Two linked views, side by side:**
  - a complex plane showing the two phasors, with v₂ drawn head-to-tail from v₁'s tip;
  - a time plot of v₁(t), v₂(t) and the sum.
- **Dragging, in either view:**
  - On the complex plane, drag a phasor's tip.
  - On the time plot, each curve has a crest handle at the crest nearest t = 0. Dragging it vertically sets A, and dragging it horizontally sets φ (the crest sits at t = −φ/ω).
  - The two views always agree. A and φ number inputs give the same values exactly.
- **The resultant:** the sum phasor (A∠φ) and the sum curve.
  - Always shown in Standalone mode.
  - In an Activity, hidden until the student submits their hand-computed A and φ.

### Circuit Mode

- **The circuit:** one series loop driven by a voltage source V₀ cos(ωt). The source has phase 0 and is the phase reference.
  - R, L and C each have an include toggle. That allows R, RC, RL, LC and RLC; at least one element must stay on.
- **Controls:**
  - V₀ (V), R (Ω), L (mH) and C (µF): sliders with number inputs.
  - ω: a logarithmic slider from about 10² to 10⁶ rad/s.
  - Trace-visibility toggles for each drawn quantity.
  - The shared play/pause and t-scrubber.
- **Readouts:**
  - the impedances Z_R = R, Z_L = jωL and Z_C = 1/(jωC), and Z_total, each in both forms;
  - f = ω/2π;
  - ω₀ = 1/√(LC) when both L and C are on;
  - ω_c = 1/(RC) when R and C are on without L.
  - The quantities are always called impedances Z, never reactances X.
- **Displays:**
  1. **Impedance plane (static):** Z_R, Z_L and Z_C drawn head-to-tail, with their resultant Z_total and its angle marked.
  2. **Phasor plane (rotating):**
     - The phasors are V_in, I, V_R, V_L and V_C.
     - The device voltages are drawn head-to-tail, closing on V_in (KVL).
     - I is drawn on the same plane in its own colour, as a dashed arrow, auto-scaled to a comparable length, with a labelled scale in A. This makes the angle comparison direct: V_R is parallel to I, V_L leads it by 90° and V_C lags it by 90°.
  3. **Time plot:** v_in(t), i(t), v_R(t), v_L(t) and v_C(t), with trace toggles. i(t) is on its own labelled axis scale.
  4. **Schematic:** a small series-loop schematic that shows which elements are included.
- **Revealing in stages (Activity only):**
  - The impedance arrows Z_R, Z_L and Z_C are always drawn.
  - Z_total and its readout appear once the student submits Z.
  - I appears once they submit I = V/Z.
  - Each device voltage appears once they submit I·Z_k.
  - The KVL head-to-tail closure is the final reveal.
  - Standalone mode shows everything.

### The Activity, "Phasors and Impedance" (PHY/EGR 3120)

1. **Part 1, Sum.** All three Tasks use unequal amplitudes. The Setup fixes ω and the two sinusoids.
   - **Task A:** two sinusoids 90° apart. The student hand-computes A (Pythagoras) and φ, then submits, and the resultant appears.
   - **Task B:** two sinusoids 120° apart. The student hand-computes A (law of cosines) and φ (components), then submits, and the resultant appears.
   - **Task C:** multiple choice on the extremes: in phase (0°) the amplitude is A₁ + A₂, and out of phase (180°) it is |A₁ − A₂|. Students may drag to check.
   - **Free text:** why the sum of two same-frequency sinusoids is another sinusoid at the same frequency.
2. **Part 2, Series RC.** L is off, and the Setup fixes V₀, R, C and ω.
   - Compute Z in both forms (R + jX and |Z|∠θ), then submit to reveal Z_total.
   - Compute I = V/Z (magnitude and phase), then submit to reveal I.
   - Compute V_R = I·Z_R and V_C = I·Z_C, then submit to reveal them and the KVL closure.
   - Multiple choice: V_R is in phase with I, and V_C lags I by 90°.
   - **Closing Fourier link:**
     - Compute V_C/V_in at the given ω and recognize it as 1/(1 + jωRC).
     - Multiple choice: the matching Fourier cutoff is f_c = ω_c/2π, with ω_c = 1/RC.
     - Sweep ω and watch |V_C/V_in| and its angle change (a Condition on having swept ω).
3. **Part 3, Series RLC.** All three elements are on, and the Setup fixes V₀, R, L, C and ω.
   - Repeat the chain: Z in both forms, then I, then V_R, V_L and V_C, revealed in stages.
   - Multiple choice: V_L leads I by 90° and V_C lags I by 90°, so V_L and V_C point opposite ways.
   - **Brief resonance Task:**
     - Sweep ω until ∠Z = 0 (a Condition on the State). Read ω₀ and compare it with 1/√(LC).
     - Free text: why V_L and V_C cancel there, and why each can exceed V₀.

## User Stories

### Instructor

1. As the instructor, I want a single phasor Tool with a Sum Mode and a Circuit Mode, so that one Activity can cover adding sinusoids, impedance and device voltages.
2. As the instructor, I want to demo the Tool in Standalone mode during lecture, so that I can replace my Desmos phasor graph.
3. As the instructor, I want Standalone mode to offer every element toggle, slider and trace, so that I can answer "what if" questions live.
4. As the instructor, I want a play button that rotates the phasors, so that the class sees rotating vectors trace out sinusoids on the projector.
5. As the instructor, I want ω in rad/s to be the frequency Control, so that hand calculations of jωL and 1/(jωC) never need a 2π.
6. As the instructor, I want an f = ω/2π readout, so that I can tie the frequency back to the Fourier Tool and the bench.
7. As the instructor, I want real component units (Ω, mH, µF), so that the numbers look like parts on the bench.
8. As the instructor, I want the Tool to use j and to show both rectangular and polar forms, so that it matches EE convention and the forms students must convert between.
9. As the instructor, I want the cos convention with phase in degrees, so that the Activity continues the Fourier Activity's Aₙ cos(nω₀t + φₙ).
10. As the instructor, I want the Activity listed under PHY/EGR 3120 on the index page, so that students find it after the Fourier Activity.
11. As the instructor, I want numeric answers auto-checked within ±2% for magnitudes and ±2° for phases, so that round-off isn't marked wrong.
12. As the instructor, I want phases accepted at any equivalent angle mod 360°, so that −90° and 270° both count.
13. As the instructor, I want the sum resultant hidden until the student submits it, so that students compute it rather than read it off.
14. As the instructor, I want Z_total, I and each device voltage revealed in stages after each Submit, so that each step of the chain is computed before it is shown.
15. As the instructor, I want Activity Setups to fix every value per Part, so that every student works the same problem.
16. As the instructor, I want free-text explanations recorded in the Report without auto-grading, so that I can grade the reasoning myself.
17. As the instructor, I want the Report to include a snapshot of the Displays at Submit, so that I can see what the student was looking at.
18. As the instructor, I want the RC Part to close by linking V_C/V_in to the Fourier low-pass H, so that students see where the filter gain and phase come from.

### Student: Sum Mode

19. As a student, I want to set two sinusoids' amplitudes and phases, so that I can explore how they combine.
20. As a student, I want to see each sinusoid as a phasor on the complex plane and as a curve in time, side by side, so that I connect the two pictures.
21. As a student, I want to drag a phasor's tip on the complex plane, so that I can change amplitude and phase directly.
22. As a student, I want to drag a crest handle on the time plot, so that I see that raising the crest is amplitude and sliding it is phase.
23. As a student, I want the two views to stay in sync while I drag either one, so that I trust they are the same thing.
24. As a student, I want number inputs for A and φ, so that I can set exact values.
25. As a student, I want the second phasor drawn from the first one's tip, so that I see vector addition head-to-tail.
26. As a student, I want to press play and watch the phasors rotate while their projections trace the curves, so that I understand a sinusoid as the real part of a rotating vector.
27. As a student, I want to drag the time cursor, so that I can line up a phasor's projection with its curve at any instant.
28. As a student, I want to see that the relative angle between two same-frequency phasors never changes as they rotate, so that I understand why their sum is a single sinusoid.
29. As a student, I want to hand-compute the amplitude of a sum with the law of cosines, so that I can find it without plotting.
30. As a student, I want to hand-compute the phase of a sum from components, so that I can get the full sinusoid.
31. As a student, I want the resultant to appear once I submit, so that I can confirm my work in both views.
32. As a student, I want to see the in-phase and out-of-phase extremes, so that I understand the sum's amplitude ranges from |A₁ − A₂| to A₁ + A₂.

### Student: Circuit Mode

33. As a student, I want to include or exclude R, L and C in a series loop, so that I can study each element alone and in combination.
34. As a student, I want sliders and number inputs for V₀, R, L, C and ω, so that I can set up the circuit I'm given.
35. As a student, I want a logarithmic ω slider, so that I can sweep across ω_c or ω₀ easily.
36. As a student, I want to see Z_R, Z_L and Z_C as vectors on an impedance plane, so that I see that resistance is real, Z_L points up and Z_C points down.
37. As a student, I want the impedances drawn head-to-tail to Z_total, so that I see that series impedances add as complex numbers.
38. As a student, I want each impedance shown as a + jb and as |Z|∠θ, so that I can check both my rectangular and polar forms.
39. As a student, I want to see Z_L grow and Z_C shrink as I raise ω, so that I understand how the frequency dependence works.
40. As a student, I want the current phasor drawn on the phasor plane with its own scale and colour, so that I can compare its angle with the voltages without mixing units.
41. As a student, I want to compute I = V/Z in polar form, so that I learn that dividing phasors divides magnitudes and subtracts angles.
42. As a student, I want to compute each V_k = I·Z_k, so that I learn that multiplying phasors multiplies magnitudes and adds angles.
43. As a student, I want to see that V_R is parallel to I, V_L leads by 90° and V_C lags by 90°, so that I remember each element's phase relationship.
44. As a student, I want the device voltages drawn head-to-tail closing on V_in, so that I see that KVL holds for phasors.
45. As a student, I want to see that the magnitudes of V_R, V_L and V_C don't add to V₀, so that I understand why phase matters.
46. As a student, I want a time plot of every signal with trace toggles, so that I can see the leads and lags as shifts in time.
47. As a student, I want play and the time cursor to work in the Circuit Mode too, so that I see every phasor rotate together at ω.
48. As a student, I want a small schematic showing which elements are in the loop, so that I always know what circuit I'm analysing.
49. As a student, I want Z_total, I and each voltage revealed after I submit it, so that I can check each step before the next.
50. As a student, I want to compute V_C/V_in for the RC circuit and recognize it as the Fourier low-pass H, so that the filter from the last Activity makes sense.
51. As a student, I want ω_c = 1/RC and the matching f_c = ω_c/2π shown, so that I can connect to the Fourier Tool's f_c.
52. As a student, I want to sweep ω to find where ∠Z = 0 in the RLC circuit, so that I discover resonance at ω₀ = 1/√(LC).
53. As a student, I want to see V_L and V_C cancel at resonance while each exceeds V₀, so that I don't think a component's voltage is limited by the source.

### Student: Activity shell

54. As a student, I want to start the Activity at the Name gate and have my Run autosaved, so that I can come back to it.
55. As a student, I want Hints after repeated wrong attempts that guide me without giving the answer, so that I can get unstuck.
56. As a student, I want to download a Report at the end, so that I can turn my work in.
57. As a student on a narrow screen, I want the Tasks in the Task drawer and the Displays to fit without scrolling, so that the Activity still works.
58. As a keyboard user, I want every Control, including the phasor tips and crest handles, reachable and operable from the keyboard, so that I can do the Activity without a mouse.

## Implementation Decisions

### The phasor engine

A new pure module inside the Tool, with no DOM, so that it can be tested in Node. It is the Tool's only source of phasor and circuit math. Its exact interface is left to the implementer.

- **Complex arithmetic:** add, multiply, divide, and convert between rectangular and polar, with angles in degrees.
- **Sum:** given (A₁, φ₁) and (A₂, φ₂), it returns the resultant (A, φ).
- **Impedance:** given which of R, L and C are included, their values and ω, it returns Z_R, Z_L, Z_C and Z_total.
- **Circuit solve:** given V₀ and the impedances, it returns I = V/Z and V_k = I·Z_k for each included element. Excluded elements give no phasor, not a zero phasor.
- **Characteristic values:** ω₀ = 1/√(LC) and ω_c = 1/(RC).
- **Time domain:** it evaluates any phasor (A∠φ) as A cos(ωt + φ) at time t, and as a rotated complex value A∠(ωt + φ) for the rotating drawings.
- **Crest mapping:** a phasor's crest nearest t = 0 converts to and from (t, A), so the time-plot handle and the phasor tip share one source of truth.

### Tool and Modes

- **Tool contract:** the Tool follows framework v1's Tool contract, with Modes `sum` and `circuit`. Its panel layout is `side`.
  - Each Mode must support being mounted several times on one page (ADR 0002).
  - Each Part keeps its own State.
- **Shared Controls:** ω (log slider in the Circuit Mode), play/pause, and the t-scrubber. These Controls have the same ids in both Modes.
- **Sum Controls:** A₁, φ₁, A₂ and φ₂. Each is a 2-D handle on the complex plane and a crest handle on the time plot, plus number inputs. All of these are views of the same four values.
  - Handles use the framework's kit `handle` (2-D on the plane), so they are keyboard-operable.
  - The crest handle is a 2-D handle mapped through the engine's crest mapping.
- **Circuit Controls:** include toggles for R, L and C, plus sliders for V₀, R, L, C and ω.
- **Revealing in stages:**
  - The framework's Task `hide` list acts on Control ids.
  - Each revealable layer is a trace-visibility Control whose hide() hides both the toggle and the drawn layer:
    - Sum Mode: the sum resultant;
    - Circuit Mode: Z_total, I, V_R, V_L, V_C and the KVL closure.
  - No framework change is needed.
- **Play:** play advances t at a fixed real-time rate, chosen so that one period takes a few seconds whatever ω is. It loops modulo one period and is cancelled on destroy, following the Fourier Tool.
- **Displays:**
  - Sum Mode has the complex plane and the time plot.
  - Circuit Mode has the impedance plane, the phasor plane, the time plot and the schematic.
  - Each Display has an id.
- **Drawing:** canvas or SVG, whichever fits framework conventions best. Colours come from the framework plot theme.
  - Each quantity has one colour across every Display.
  - The Displays never scroll, and text drawn in them is at least 13 px. The Tool must pass display-fit.
- **Readouts:**
  - f = ω/2π.
  - Each impedance in both forms (where not hidden).
  - ω₀ and ω_c where they apply.
  - No readout shows a quantity that the current Task hides.

### State

The State publishes:

- every Control value: Mode, A₁, φ₁, A₂, φ₂, ω, t, playing, the include toggles, V₀, R, L, C, and trace visibility;
- the derived values, with units: f, Z_total (both forms), |I| and ∠I, each |V_k| and ∠V_k, ∠Z, ω₀ and ω_c, plus the swept ω range for sweep Conditions.

Conditions can be written against these. The visual snapshot is a PNG of the Displays.

### Activity

- **Data:** the Activity is pure data in the Tool's activities. Course "PHY/EGR 3120". It uses encoded answer keys, following the Fourier Activity.
- **Part order:** Sum, Series RC, Series RLC.
- **Values:** the implementer picks the Setup values.
  - Part 1: amplitudes must differ.
  - Parts 2 and 3: keep ω within about a factor of 3 of ω_c or ω₀, so that resistance and reactance both matter.
  - Prefer values that give clean but non-trivial hand arithmetic.
- **Answer forms:**
  - Z is entered in both rectangular (real and imaginary parts) and polar (magnitude and angle) form.
  - I and each V_k are entered as magnitude and phase.
  - The sum is entered as A and φ.
- **Checks:**
  - Magnitudes: 2% relative tolerance.
  - Phases: ±2° absolute, using the framework v1 numeric Question's modulus option (360).
- **Question types:** multiple-choice checks use `choice` Questions, and explanations use `text` Questions.
- **Formulas:** the Circuit Tasks' text gives Z_L = jωL and Z_C = 1/(jωC). The RC link Task's text gives the Fourier H for comparison.
- **Hide lists:** each compute Task hides the layer it asks for, and the next Task shows it.

### Site

- **Pages:** a Standalone page and an Activity page.
- **Listings:** add the Tool and the Activity under PHY/EGR 3120 in the root index and the README, after the Fourier entries.

## Testing Decisions

Good tests check behaviour through a public seam, not internals. These are the three seams, the same as the Fourier Tool's:

1. **The phasor engine, with node:test** (prior art: the Fourier engine unit tests).
   - The sum matches the law of cosines for amplitude and atan2 of components for phase, including the 0° (A₁ + A₂) and 180° (|A₁ − A₂|) extremes.
   - The time-domain sum equals the sum of the two time-domain sinusoids at many t (phasor addition is right).
   - Z for every R/L/C subset matches R + jωL + 1/(jωC). Excluded elements contribute nothing.
   - I = V/Z, and V_R ∥ I, ∠V_L − ∠I = +90°, ∠V_C − ∠I = −90°.
   - KVL: the sum of the device voltage phasors equals V_in.
   - At ω = ω₀, ∠Z = 0 and V_L = −V_C.
   - For series RC, V_C/V_in = 1/(1 + jωRC) at many ω.
   - Crest mapping round-trips: (A, φ) → crest (t, A) → (A, φ).
2. **The Activity, through the runner core with `stubTool`** (prior art: the Fourier Activity unit test).
   - The Activity names the `phasors` Tool, and its Parts use the intended Modes and Setups.
   - The correct hand-computed answers pass, including phases given as any equivalent angle, and wrong ones fail.
   - Each compute Task hides its layer, and the next Task shows it.
   - The answer keys agree with the engine's numbers.
3. **Playwright end-to-end tests** (prior art: the Fourier standalone and activity specs).
   - The Standalone page loads both Mode tabs.
   - Dragging a phasor tip moves the matching crest handle, and the reverse.
   - Play advances t, pause stops it, and the time cursor can be dragged.
   - The element toggles change the schematic and the Displays.
   - The Activity page covers the Name gate, Submitting a numeric Task, the layer appearing after Submit, and downloading the Report.
   - Add the Tool to the display-fit spec's list.

## Out of Scope

- Parallel and mixed series-parallel circuits (1/Z sums).
- Current sources, and source phases other than 0.
- More than one of each element, and more than two sinusoids in the Sum Mode.
- Sinusoids of different frequencies in the Sum Mode.
- Transients. Only the sinusoidal steady state is shown.
- Q factor, bandwidth and Bode plots beyond the brief resonance Task and the RC sweep.
- Power: complex power, power factor and RMS values.
- Changes to the Fourier Tool.

## Further Notes

- **Source:** the reference Desmos graph is "Phasors" (desmos.com/geometry/4tbuumgjjm). It has a rotating V_in, R and C phasors, the impedance vector R − j/(ωC), and "sync to real axis" vs "show rotation". This Tool keeps the rotation and projection idea and splits impedance and phasors onto separate planes.
- **The old current proxy:** the Desmos graph drew the resistor voltage as "the current". This Tool draws I in its own right, with its own scale.
- **Why ω:** the instructor chose ω over f so that jωL and 1/(jωC) need no 2π. f appears only as a readout, and in the Fourier link's f_c = ω_c/2π.
- **Implementation order:** a natural ticket order is engine → Tool shell with both Modes and the time controls → Sum Mode Displays and linked handles → Circuit Mode Displays → staged-reveal Controls → Activity → site listing and e2e tests.
