# Spec: the Fourier Tool (synthesis and analysis of periodic signals)

Status: resolved

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Builds on framework v1 ([Spec 0001](../../docs/specs/0001-framework-v1.md)) and the shell revision. Respects [ADR 0001](../../docs/adr/0001-json-report-with-report-viewer.md), [ADR 0002](../../docs/adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../../docs/adr/0003-major-versioned-framework-folder.md).

## Problem Statement

In PHY/EGR 3120, this is the first time students meet the frequency domain. Phasors come next, as a separate Activity. Students have just studied the RC circuit in the time domain: a square wave in gives the capacitor's charging and discharging curve, or the resistor's decaying spikes.

The instructor has taught the Fourier series with a Desmos graph. The graph sums the sine series of a square wave up to N terms. It then passes each harmonic through a first-order RC low-pass filter, and compares the result with the analytic V_C and V_R exponentials.

The Desmos graph has these limits:

- **One waveform:** it only covers the square wave.
- **Coefficients are given, not derived:** it never shows where they come from.
- **Odd terms only:** N counts odd terms, which hides the zero even harmonics.
- **Wrong high-pass gain:** the high-pass amplitude is written as 1 − A, which is not a real first-order high-pass gain.
- **No student Activity:** there are no Tasks, no Report, and no way to see a student's work.

Students need to understand two things:

- **A signal has a spectrum.** The Fourier series is a second description of the same signal, not an approximation of something else.
- **Each frequency component can be scaled and delayed separately.** The RC result they already know is what you get when every harmonic is scaled *and* phase-shifted by the filter.

## Solution

A new Tool, `fourier` ("Fourier Series"), built on framework v1, with two Modes. An Activity, listed under PHY/EGR 3120, walks students through both Modes.

### Shared settings (both Modes)

- **Input waveform:** sine, square, triangle or sawtooth.
- **Input values:** amplitude, fundamental frequency f₀ in Hz, DC offset, and a phase/time shift in degrees of the fundamental.
- **Coefficient form:** every harmonic is written Aₙ cos(nω₀t + φₙ). This is the convention the phasor Activity uses next.
- **The filter:** off, first-order RC low-pass, or first-order RC high-pass.
  - Its settings are the cutoff f_c (Hz), an "Apply gain" toggle and an "Apply phase shift" toggle.
  - Each harmonic is scaled by |H| when gain is on, and shifted by ∠H when phase is on.
  - Readouts show f_c/f₀ and τ = 1/(2πf_c).
- **Units:** real units throughout (Hz, ms, V).

### Synthesis Mode

- **Time plot:** the input waveform, the partial sum through harmonic N, and an "N = ∞" curve.
  - With no filter, or with both toggles on, the N = ∞ curve is the analytic answer: the ideal waveform, or the piecewise-exponential RC steady-state response (V_C for low-pass, V_R for high-pass).
  - It is labelled as the infinite series, not as a separate comparison.
- **Highest harmonic:** only the highest included harmonic (term N) is drawn on its own, faintly.
- **N:** the highest harmonic number, from 0 to 100. The square wave's even terms are visibly zero.
- **Play/pause:** a play/pause button steps N upward.

### Analysis Mode

- **Test function:** the student picks cos or sin and an integer n from 0 to 10. n = 0 is the DC term.
- **Product plot:** the Display plots the signal × test function over exactly one period of f₀, with positive area and negative area shaded in different colours.
  - No integral values are shown. Students compute aₙ and bₙ by hand and convert them to Aₙ and φₙ.
- **Spectrum Display:** Aₙ bars and φₙ stems.
  - Students can view the spectrum of either the input or the filtered output.
- **Filter-curve Display:** gain and phase shift against f, with f_c marked and each harmonic marked on both curves.
- **Visibility:** in Standalone mode the spectrum is always shown. In an Activity it is hidden until the matching Task is submitted.

### The Activity, "Frequency Domain: Fourier Series" (PHY/EGR 3120)

1. **Part 1, Synthesis: square vs triangle.**
   - Coefficient tables are given for both waveforms.
   - Multiple choice: square Aₙ ∝ 1/n, triangle Aₙ ∝ 1/n².
   - Set N to the smallest value where each sum stays within about 5% of the original away from the jumps or corners.
   - Free text: why jumps make the terms fall slowly, and "same signal, two descriptions".
2. **Part 2, Analysis: shifted sine.**
   - Hand-compute a₁ and b₁ from the shaded products, then convert to A₁ and φ₁. These are auto-checked.
   - Multiple choice: the n = 2 and n = 3 products have zero net area.
3. **Part 3, Analysis: square.**
   - Hand-compute Aₙ and φₙ for n = 1 to 5.
   - Multiple choice on the pattern: even terms are zero, and Aₙ ∝ 1/n.
4. **Part 4, Low-pass on the square** (f₀ = 1 kHz, f_c = 3 kHz).
   - Try gain only, phase only, and both.
   - Multiple choice: which recovers the RC charging curve.
   - Free text: why both are needed.
   - Hand-compute the output 3rd harmonic. The formulas for |H| and ∠H are given in the Task.
5. **Part 5, High-pass on the square:** the same steps, ending on the decaying spikes.

## User Stories

### Instructor

1. As the instructor, I want a single Fourier Tool with Synthesis and Analysis Modes, so that one Activity can go from building signals to taking them apart.
2. As the instructor, I want to demo the Tool in Standalone mode during lecture, so that I can replace my Desmos graph.
3. As the instructor, I want Standalone mode to offer every waveform, filter and toggle, so that I can answer "what if" questions live.
4. As the instructor, I want a play button that steps N upward, so that the sum builds up on the projector without my fiddling with a slider.
5. As the instructor, I want the Tool to use real units (kHz, ms, V), so that it connects to the bench and the RC activity.
6. As the instructor, I want the readouts to show f_c/f₀ and τ, so that I can tie the cutoff back to the RC time constant students already know.
7. As the instructor, I want the Activity listed under PHY/EGR 3120 on the index page, so that students find it with the course's other Activities.
8. As the instructor, I want students' numeric answers auto-checked within ±2% (amplitudes) and ±2° (phases), so that hand-calculation round-off isn't marked wrong.
9. As the instructor, I want a phase accepted at any equivalent angle mod 360°, so that −90° and 270° both count.
10. As the instructor, I want free-text explanations recorded in the Report without auto-grading, so that I can grade the reasoning myself.
11. As the instructor, I want multiple-choice checks at the key conceptual points, so that misconceptions are caught during the Run.
12. As the instructor, I want the spectrum hidden in the Activity until the student submits the matching Task, so that students compute the coefficients rather than read them off.
13. As the instructor, I want Activity Setups to fix the waveform, shift, f₀, f_c and filter per Part, so that every student works the same problem.
14. As the instructor, I want the Report to include a snapshot of the Display at Submit, so that I can see what the student was looking at.

### Student: Synthesis Mode

15. As a student, I want to choose a sine, square, triangle or sawtooth wave, so that I can compare their series.
16. As a student, I want to set the amplitude, f₀, DC offset and shift, so that I can see how each one changes the series.
17. As a student, I want a slider for N, the highest harmonic number, so that I can add terms one at a time.
18. As a student, I want N to count harmonic numbers rather than nonzero terms, so that I notice that even harmonics of a square wave contribute nothing.
19. As a student, I want to see the original waveform, the partial sum and the N = ∞ curve on the same axes, so that I can judge how close the sum is.
20. As a student, I want the highest included harmonic drawn on its own, so that I can see how small each new term is.
21. As a student, I want to watch the newest term shrink as N rises, so that I understand why the sum converges.
22. As a student, I want to compare how fast the square and triangle sums converge, so that I connect jumps and corners to how fast the coefficients fall.
23. As a student, I want to see the overshoot at a square wave's jump stay put as N grows, so that I don't expect the partial sum to become perfect.
24. As a student, I want the coefficient table for the selected waveform shown in Part 1, so that I can relate the numbers to what is drawn.
25. As a student, I want a DC offset to appear as an n = 0 term, so that I see DC as just another frequency (zero).
26. As a student, I want to shift a waveform in time and see every φₙ change, so that I learn that a time delay shifts each harmonic's phase in proportion to n.

### Student: filters

27. As a student, I want to pass the input through a first-order RC low-pass or high-pass filter, so that I can see what the circuit from the RC activity does to each harmonic.
28. As a student, I want to set the cutoff f_c, so that I can see more or fewer harmonics get through.
29. As a student, I want to turn the filter's gain and phase shift on separately, so that I see each harmonic can be attenuated and delayed independently.
30. As a student, I want to see that gain alone and phase alone each give a strange waveform, so that I understand both are needed.
31. As a student, I want to see the series with both gain and phase land on the familiar charging and discharging curve, so that I trust the frequency-domain picture.
32. As a student, I want the N = ∞ curve to be the analytic RC response, labelled as the infinite series, so that I see that the circuit result *is* the series.
33. As a student, I want the high-pass output of a square wave to become the decaying spikes I measured, so that both halves of the RC circuit make sense.
34. As a student, I want to filter a triangle or a sawtooth in Standalone mode and compare with the N = ∞ curve, so that I can predict filtered shapes beyond the square wave.

### Student: Analysis Mode

35. As a student, I want to choose a cos or sin test function and a harmonic n, so that I can probe one frequency at a time.
36. As a student, I want the product of signal and test function plotted over one period, so that I can see what the integral adds up.
37. As a student, I want positive area and negative area shaded in different colours, so that I can judge the net area by eye and set up the integral by hand.
38. As a student, I want the off-harmonic products for a sine (n = 2, 3) to visibly cancel, so that I understand why each test function picks out one harmonic.
39. As a student, I want to use n = 0 to get the DC term, so that the average value fits the same picture.
40. As a student, I want to compute aₙ and bₙ by hand and convert them to Aₙ and φₙ, so that I learn the analysis formula and the cos convention.
41. As a student, I want my Aₙ and φₙ answers checked on Submit, so that I know whether my hand calculation is right.
42. As a student, I want the spectrum to appear once I submit, so that I can confirm my work visually.
43. As a student, I want to see the filter's gain and phase curves with each harmonic marked, so that I can see how much each harmonic is cut and delayed.
44. As a student, I want to switch the spectrum between input and filtered output, so that I see output Aₙ = input Aₙ·|H| and output φₙ = input φₙ + ∠H.
45. As a student, I want to hand-compute one filtered harmonic from the given |H| and ∠H formulas, so that I can make the connection between the spectrum and the waveform myself.

### Student: Activity shell

46. As a student, I want to start the Activity at a Name gate and have my Run autosaved, so that I can come back to it.
47. As a student, I want hints after repeated wrong attempts that guide me without giving the answer, so that I can get unstuck.
48. As a student, I want to download a Report at the end, so that I can turn my work in.
49. As a student on a narrow screen or phone, I want the Tasks in the Task drawer and the Displays to fit without scrolling, so that the Activity still works.
50. As a keyboard user, I want every Control reachable and operable from the keyboard, so that I can do the Activity without a mouse.

## Implementation Decisions

### The Fourier engine

A new pure module inside the Tool, with no DOM, so it can be tested in Node. It is the Tool's only source of signal math. Its exact interface is left to the implementer.

- **Series:** a signal is a DC term plus a list of harmonics, each with an amplitude and a phase in the cos convention.
  - The bench-scope engine uses a sine convention and Lanczos smoothing. This engine does neither, because students must see unsmoothed Gibbs overshoot and the cos convention.
- **Exact tables:** the engine gives the exact, unsmoothed harmonic table for each waveform, given its amplitude, f₀, DC offset and shift.
  - The square wave is +amp for the first half period and −amp for the second: Aₙ = 4·amp/(πn) for odd n, φₙ = −90°.
  - Triangle and sawtooth use their standard alignments, and the engine documents them.
  - A shift of Δφ degrees at the fundamental adds −nΔφ to each φₙ.
- **Filtering:** filtering multiplies each harmonic's amplitude by |H(nf₀)| when gain is on, and adds ∠H(nf₀) to its phase when phase is on.
  - The DC term is scaled by H(0).
  - It reuses bench-scope's pure complex filter gain, imported directly and not copied.
- **Partial sums:** the engine evaluates the sum through harmonic N, and any single harmonic, as a waveform over time.
- **The N = ∞ curve:** the engine gives the limit of the series as a waveform over time. The cases are:
  - no filter: the ideal waveform;
  - both toggles on: the analytic periodic steady state of the RC circuit;
  - one toggle on: a high-order numerical sum (n up to about 1000). There is no closed form for that case, and it is still the limit of the series.
- **Analytic RC response:** for each piecewise-linear input segment, the output is the linear particular solution plus C·e^(−t/τ). C is fixed by requiring the output to be periodic.
  - Low-pass outputs V_C. High-pass outputs V_R = v_in − V_C.
  - The sine case uses the single-harmonic result.
- **Analysis product:** the engine gives the input times the chosen test function (cos or sin at harmonic n) over one period.
  - The engine can also integrate it numerically, for tests and the Activity's answer keys only. The Display never shows that number.

### Tool and Modes

- **Tool contract:** the Tool follows framework v1's Tool contract, with Modes `synthesis` and `analysis`.
  - Each Mode must support being mounted several times on one page (ADR 0002).
- **Shared Controls:** waveform, amplitude, f₀, DC offset, shift, and the filter Controls (type, f_c, gain toggle, phase toggle).
  - Both Modes offer these Controls with the same ids, so an Activity Setup reads the same way in either Mode.
  - Each Part keeps its own State; the values are not live-shared across mounted Parts.
- **Synthesis Controls:** N (0 to 100, integer) and play/pause.
  - Play steps N at a fixed interval. It stops at 100, and it is cancelled on destroy, following bench-scope.
- **Analysis Controls:** test function (cos/sin select), n (integer, 0 to 10), and spectrum source (input/output).
- **Displays:**
  - Synthesis has one time plot.
  - Analysis has a product plot, a spectrum, and the filter curves.
  - The spectrum Display and the filter-curve Display have their own ids, so Activity show/hide lists can hide and reveal them.
- **Drawing:** canvas or Plotly, whichever fits framework conventions best. Colours come from the framework plot theme.
  - The Displays never scroll, and text drawn in them is at least 13 px. The Tool must pass display-fit.
- **Readouts:** f_c/f₀ and τ are shown as UI-kit metrics.
  - No readout ever shows aₙ, bₙ, Aₙ or φₙ.
  - The input's coefficient table is shown only where an Activity Setup asks for it, as in Part 1.

### State

The State publishes every Control value (Mode, waveform, amplitude, f₀, DC offset, shift, N, the filter settings, the test function and n, and the spectrum source), plus f_c/f₀ and τ, with units. Conditions can be written against these. The visual snapshot is a PNG of the Displays.

### Activity

- **Data:** the Activity is pure data in the Tool's activities. Course "PHY/EGR 3120". It follows the oscilloscope Activity's encoded answer keys.
- **Part order:** synthesis (square vs triangle), analysis (shifted sine), analysis (square), low-pass, high-pass.
- **Defaults:** f₀ = 1 kHz, amplitude ±1 V, f_c = 3 kHz, N from 0 to 100.
- **Checks:** numeric Questions use a 2% relative tolerance for amplitudes, and ±2° absolute for phases.
- **Angle equivalence:** phases are judged mod 360°, so the difference between the given and correct angle is wrapped into (−180°, 180°] before the ±2° check.
  - The framework v1 numeric Question gains an optional modulus for this. It ships in place in framework v1 per ADR 0003, with its own runner unit test.
- **Question types:** multiple-choice checks use `choice` Questions, and explanations use `text` Questions (ungraded, recorded in the Report).
- **Formulas in Part 4:** the formulas |H| = 1/√(1+(f/f_c)²) and ∠H = −arctan(f/f_c) are given in Part 4's Task text. The high-pass equivalents are given in Part 5's.
- **Revealing the spectrum:** the Task that asks for coefficients hides the spectrum Display, and the next Task shows it.

### Site

- **Pages:** a Standalone page and an Activity page.
- **Listings:** add the Tool and the Activity under PHY/EGR 3120 in the root index and the README.

## Testing Decisions

Good tests check behaviour through a public seam, not internals. These are the three seams:

1. **The Fourier engine, with node:test** (prior art: the bench-scope engine and oscilloscope signal unit tests).
   - Tabled Aₙ and φₙ for each waveform match the textbook values, including the zero even harmonics of square and triangle and the cos-convention phases.
   - A shift of Δφ changes φₙ by −nΔφ, and a DC offset appears only as the n = 0 term.
   - The numerical average of the analysis product over one period equals the tabled coefficient (aₙ for cos, bₙ for sin) for every waveform and n from 0 to 10. This ties the two Modes together.
   - Key test: the partial sum of the filtered series at large N converges to the analytic RC response (the N = ∞ curve) for low-pass and high-pass, for square, triangle, sawtooth and sine, to within a small tolerance away from the jumps.
   - Low-pass output plus high-pass output equals the input (V_C + V_R = v_in).
   - With gain only or phase only, the filtered amplitudes and phases differ from the input in exactly the one way that is switched on.
   - The partial sum with N = 0 is the DC term, and each extra harmonic changes the sum by exactly that harmonic.
2. **The Activity, through the runner core with `stubTool`** (prior art: the oscilloscope Activity unit test).
   - The Activity names the `fourier` Tool, and its Parts use the intended Modes and Setups.
   - The correct hand-computed answers pass, including phases given as any equivalent angle, and wrong ones fail.
   - The spectrum Display is hidden in each coefficient Task and shown afterwards.
   - The answer keys agree with the engine's numbers.
   - The new numeric modulus option gets its own runner unit test in the framework suite.
3. **Playwright end-to-end tests** (prior art: the oscilloscope standalone and activity specs).
   - The Standalone page loads both Mode tabs, and every Control changes what the Displays show.
   - Play advances N and pause stops it.
   - The filter toggles change the curve.
   - The Activity page covers the Name gate, Submitting a numeric Task, the spectrum appearing after Submit, and downloading the Report.
   - Add the Tool to the display-fit spec's list.

## Out of Scope

- The continuous Fourier transform of aperiodic signals (pulses, sinc), and a test frequency that varies continuously between harmonics.
- Phasors and the derivation of H(jω). That is the next Activity.
- Band-pass and higher-order filters. Bench-scope's band-pass stays there.
- Ideal brick-wall filters.
- A pulse waveform with variable duty cycle.
- A user-drawn or user-entered waveform, and a term-by-term coefficient editor.
- Numeric readouts of aₙ, bₙ, Aₙ or φₙ in Analysis Mode.
- Lanczos or other smoothing of partial sums.
- Changes to the bench-scope Tool beyond the Fourier engine importing its pure filter gain.

## Further Notes

- **Source:** the reference Desmos graph is "Square Wave Fourier Series" (desmos.com/calculator/32b54ddf9a). This Tool keeps its pedagogical arc: build the sum, then filter it, then compare with the analytic V_C and V_R.
- **High-pass gain:** the Desmos high-pass uses amplitude (1 − A). The correct first-order high-pass gain is |H| = 1/√(1+(f_c/f)²).
  - The *complex* gains do add to 1 (H_LP + H_HP = 1), which is why V_C + V_R = v_in. The *magnitudes* do not add to 1.
  - Part 5's questions can use this to draw out why phase matters.
- **Waveform alignment:** the square wave's φₙ = −90° under the cos convention is deliberate, so that φₙ carries over to the phasor Activity. Part 3's Task text should say so.
- **Why Synthesis comes first:** students see the series as a representation before learning how to compute the coefficients. Analysis then answers "where did those numbers come from?"
- **Implementation order:** a natural ticket order is engine → Tool shell with both Modes → Synthesis Displays → Analysis Displays → numeric modulus option → Activity → site listing and e2e tests.
