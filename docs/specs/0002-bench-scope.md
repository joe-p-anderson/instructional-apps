# Spec 0002: The bench-scope Tool (a front-panel oscilloscope)

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Builds on [Spec 0001](0001-framework-v1.md) and respects [ADR 0001](../adr/0001-json-report-with-report-viewer.md), [ADR 0002](../adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../adr/0003-major-versioned-framework-folder.md).

## Problem Statement

Students learn to use the lab's oscilloscopes, a Tektronix TBS2072B and the older TDS2001C, mostly during lab time. When they are on the bench, they struggle with the instrument itself: which knob changes V/div and which changes s/div, why the trace won't stand still, what the trigger level does, how to read a frequency off the Measure menu, and how to place cursors. The existing oscilloscope lab (which Spec 0001 ports as the `oscilloscope` Tool) teaches waveform concepts with sliders and a Plotly plot. It does not teach the instrument, because it has no front panel, no triggering and no menus.

The instructor wants a virtual scope that looks and behaves like the lab's two models. Students should be able to practise on it at any time, feed it familiar signals (sine and square waves, and filtered versions of them) and build the muscle memory before they reach the bench. Later Activities should be able to stage it.

## Solution

A new Tool, `bench-scope` ("Bench Oscilloscope"), built on framework v1. It is separate from Spec 0001's `oscilloscope` Tool, which is unchanged.

- **The instrument:** a drawn front panel for either the TBS2072B or the TDS2001C, chosen as a Setup value. Standalone mode offers a switcher between them. The knobs turn, the buttons press, the softkey menus appear on the screen, and the screen shows a realistic digital trace at the model's native resolution, in that model's on-screen style.
- **The source panel:** a compact panel beside the scope, built from the UI kit, that sets what is wired to CH1 and CH2.
  - CH1 is a function generator.
  - CH2 is off, a copy of CH1, a low-pass, high-pass or band-pass filtered version of CH1, or a second independent generator.
- **The behaviour:** the scope behaves like the real ones in everything students need to learn.
  - Vertical scale, position, coupling, probe, bandwidth limit and invert per channel.
  - Horizontal scale and position.
  - Edge triggering that really fails when it is set wrong.
  - Run/Stop, Single, Force Trig and Autoset.
  - Measure readouts, time and amplitude cursors, and the XY display.
- **The State:** the scope publishes its settings, the true signal values and what the student is reading, so future Activities can write Conditions against them.

v1 ships the Tool in Standalone mode only. There are no Activities yet.

## User Stories

### Student: the instrument

1. As a student, I want the virtual scope to look like the scope on my lab bench, so that what I practise transfers directly to the real instrument.
2. As a student, I want to switch between the new (TBS2072B) and old (TDS2001C) panels, so that I can practise on whichever model my lab section uses.
3. As a student, I want each model's controls in the same places as on the real front panel, so that I learn where things are.
4. As a student, I want controls that the simulation doesn't support to appear greyed out with a "not available in this simulation" tooltip, so that the panel stays faithful without misleading me.
5. As a student, I want to turn a knob with my scroll wheel or trackpad, one detent at a time, so that I can make fine adjustments.
6. As a student, I want to click and drag a knob up or down to turn it continuously, so that I can make large changes quickly.
7. As a student, I want to focus a knob and turn it with the arrow keys, so that I can use the scope without a mouse.
8. As a student, I want a click on a knob (without dragging) to push it, so that push actions (centre the position, set the trigger to 50%, select in the multipurpose menu) work as printed on the panel.
9. As a student, I want buttons to visibly depress when I click them, so that I get feedback that the press registered.
10. As a student, I want the screen to show a digital trace at the model's native resolution, in that model's colours and layout, so that the display reads like the real one.
11. As a student, I want the status readouts (CH1/CH2 V/div, s/div, trigger source, level and slope, Run/Stop state) shown on the screen where the real scope puts them, so that I learn to read them.
12. As a student, I want CH1 and CH2 in the model's channel colours, matching the coloured rings on the panel, so that I can tell the channels apart.

### Student: signals

13. As a student, I want to choose a sine, square or triangle wave for CH1, so that I can see how the scope shows different waveforms.
14. As a student, I want to set the generator's frequency, amplitude (Vpp) and DC offset with sliders paired with number boxes, so that I know exactly what signal I'm feeding in.
15. As a student, I want to feed CH2 a copy of CH1, so that I can compare channels and practise dual-trace settings.
16. As a student, I want to feed CH2 a low-pass filtered version of CH1 with an adjustable cutoff, so that I can see how the filter attenuates and delays the signal.
17. As a student, I want a high-pass filtered version for CH2, so that I can see a square wave differentiated into spikes.
18. As a student, I want a band-pass filtered version for CH2 with adjustable centre frequency and Q, so that I can see resonance pick out one harmonic.
19. As a student, I want to give CH2 its own independent generator, with its own waveform, frequency, amplitude, offset and phase relative to CH1, so that I can compare unrelated signals and make Lissajous figures.
20. As a student, I want to turn CH2 off at the source, so that I can practise with a single channel.
21. As a student, I want a little noise on the signals, so that the trace looks real and I learn why the trigger level matters.
22. As a student, I want the filtered square wave's edges to round off or spike exactly as theory predicts, so that what I see matches the textbook.

### Student: vertical

23. As a student, I want each channel's Scale knob to step V/div in the 1-2-5 sequence, so that I learn the standard settings.
24. As a student, I want each channel's Position knob to move its trace up and down, and a push to recentre it, so that I can separate overlapping traces.
25. As a student, I want the CH1/CH2 menu buttons to show the channel's softkey menu and toggle the channel's display, as on the real scope, so that I learn the menu workflow.
26. As a student, I want to set the coupling to DC, AC or GND, so that I can see the DC offset vanish under AC coupling and find the ground reference with GND.
27. As a student, I want a bandwidth-limit setting, so that I can see it remove noise.
28. As a student, I want to set the probe attenuation to 1× or 10×, with the V/div readout scaling to match, so that I learn why the probe setting must match the probe.
29. As a student, I want to invert a channel, so that I recognise inversion when I meet it.

### Student: horizontal

30. As a student, I want the horizontal Scale knob to step s/div in the model's own sequence, so that I learn to choose a time base.
31. As a student, I want the horizontal Position knob to move the trigger point, and a push (or "Set to Zero" on the TDS) to recentre it, so that I can look before and after the trigger.

### Student: trigger and acquisition

32. As a student, I want the trigger Level knob to move a visible level marker, so that I can see where the scope triggers.
33. As a student, I want the trace to become unstable and free-run in Auto mode when the trigger level is outside the signal, so that I learn what an untriggered scope looks like and how to fix it.
34. As a student, I want Normal mode to wait for a trigger and keep the last trace, so that I learn the difference between Auto and Normal.
35. As a student, I want to choose the trigger source (CH1 or CH2) and slope (rising or falling), so that I can trigger on the signal I care about.
36. As a student, I want "Set to 50%" (a push on the TBS Level knob, a button on the TDS) to put the level mid-signal, so that I learn the quick fix for a lost trigger.
37. As a student, I want Run/Stop to freeze and resume acquisition, so that I can study a frozen trace.
38. As a student, I want Single to capture one triggered acquisition and stop, so that I learn single-shot capture.
39. As a student, I want Force Trig to force an acquisition when the scope is waiting, so that I learn what it does.
40. As a student, I want the TDS "Trig View" button to show the trigger signal while I hold it, as on the real model, so that the old panel behaves like the real one.

### Student: Autoset, Measure, cursors, XY

41. As a student, I want Autoset to pick sensible V/div and s/div settings and trigger at 50%, so that I can recover from a mess, just as I would on the bench.
42. As a student, I want the Measure menu to let me choose readouts (frequency, period, pk-pk, amplitude, mean, RMS, rise time, CH1→CH2 delay and phase) per channel, so that I learn the automatic measurements.
43. As a student, I want measurements to reflect what the scope actually acquired, so that a clipped or badly scaled trace gives a poor or invalid reading, as it would in real life.
44. As a student, I want time cursors and amplitude cursors, moved with the multipurpose knob and with Δ readouts, so that I can measure by hand.
45. As a student, I want the "fine" button (TBS) to slow the multipurpose knob, so that I can place cursors precisely.
46. As a student, I want to switch to XY display, through Display → Format on the TDS and Acquire → XY Display on the TBS, so that I can see Lissajous figures and phase ellipses.
47. As a student, I want the functions the real scope disables in XY to be disabled here too, so that I learn the real behaviour.
48. As a student, I want the softkeys and Menu On/Off to drive the on-screen menus just as on the real models, so that the menu navigation transfers to the bench.

### Student: Standalone mode

49. As a student, I want to open the Tool any time with every Control available, so that I can practise before and after lab.
50. As a student, I want my scope and source settings autosaved, so that a reload doesn't reset everything.
51. As a student, I want to copy a link that reproduces my exact setup, including the skin, so that I can show the instructor or a classmate what I'm seeing.
52. As a student on a laptop, I want the panel and source panel to fit the screen without horizontal scrolling, so that I can use it in lecture or at home.

### Instructor and future Activity author

53. As the instructor, I want the Tool to publish every scope setting as State with units, so that future Activities can require a setting (for example "CH1 at 500 mV/div").
54. As the instructor, I want the true signal values (frequency, Vpp, CH2 gain and phase at the signal frequency) in State, so that Conditions and Questions can be checked against the truth.
55. As the instructor, I want what the student sees (trace stable or not, the active Measure readouts, cursor positions and Δ values) in State, so that a Task can require "get a stable trace" or "measure f with the cursors".
56. As the instructor, I want every knob, button, softkey, source-panel Control and cursor registered as a Control, so that an Activity can show, lock or hide any of them.
57. As the instructor, I want the skin chosen by the Setup, so that an Activity matches the model the class has on the bench.
58. As the instructor, I want a PNG snapshot of the scope screen, with its readouts, at native resolution, so that Reports show exactly what the student saw.
59. As the instructor, I want the noise seeded deterministically, so that the same setup always produces the same trace and the same measurements.

### Maintainer

60. As the maintainer, I want one engine and one control map to drive both skins, so that behaviour is written once.
61. As the maintainer, I want the panel SVGs to stay generated from the existing panel generator script, so that layout fixes are made in one place.
62. As the maintainer, I want the scope's behaviour in a DOM-free engine, so that I can test it quickly and deterministically in Node.
63. As the maintainer, I want the Tool to follow the framework v1 contract with no global state, so that it can be mounted several times on one page.

## Implementation Decisions

### Placement and relationship to Spec 0001

- `bench-scope` is a new Tool with its own id. Spec 0001's `oscilloscope` Tool and its Activity are unchanged.
- The Tool lives beside the framework's other Tools, in its own folder under the tools directory, following the `oscilloscope` Tool's layout: a Tool module, a pure core, and a Standalone page that calls `mountStandalone`. The panel generator script (which writes both SVGs and the shared control map) moves there from `oscilloscope-sim` and remains the single source of the panel art and control metadata.
- The Tool builds on framework v1, which has landed: the Tool contract, the Control base, the UI kit, the Tool host, persistence and the vendored libraries. Standalone mode has no Setup picker, so the skin switcher is a Control inside the Tool, and the skin is saved through `serialize`.
- It has one Mode (the scope), so Standalone shows a single Mode tab.

### Skins

- A **skin** is one drawn instrument model: the TBS2072B or the TDS2001C. All skins share the control names in the control map, so one engine and one binding layer drive either.
- The skin is a Setup value (`skin: "tbs2072b" | "tds2001c"`, defaulting to the TBS2072B), not a Mode. Standalone shows a skin switcher. The skin is part of the serialized State, so share links reproduce it.
- Per-skin differences live in a small skin profile:
  - the screen resolution (800×480 or 320×240) and graticule (15×8 or 10×8 divisions);
  - the s/div sequence;
  - the on-screen style (colours, fonts, readout and menu layout);
  - the controls that exist only on one model (TBS: "fine", Menu On/Off and push-to-50% on the Level knob; TDS: Horiz menu, Set to Zero, Set To 50%, Trig View, and the multipurpose LEDs);
  - where XY lives in the menus.
- Switching skin keeps every engine setting that both models support and clamps values to the new skin's ranges. Menu state resets.

### Active controls

- v1 implements the controls marked active in the control map, plus the controls needed for XY:
  - **TDS:** the Display button, with a reduced menu holding only Format YT/XY.
  - **TBS:** the Acquire button, whose side menu holds an XY Display On/Off item. That is the only item active; Mode, Record Length, Delay, Set Horizontal Position and Waveform Display are drawn greyed.
- Every other control remains drawn but inactive: greyed, with a "not available in this simulation" tooltip. This covers Math, FFT, Ref, Bus, Save/Recall, Default Setup, Utility, Help, Zoom, Search, Mark, Function, Save, Autorange, Probe Check, the probe-compensation terminals, the external trigger, USB and power.
- The control map's `active` flags are updated to match. Those flags remain the single definition of what is implemented.

### The scope engine (new deep module, DOM-free)

A pure module that owns all scope behaviour. Its interface is roughly this:

- **Create** an engine with a skin profile and an initial Setup.
- **Apply an input event:** `turn(control, detents)`, `push(control)`, `press(control)`, `softkey(n)`, and `setSource(...)` for the source panel. Every Control action becomes one of these events, so there is a single path for State changes.
- **`acquire(now)`** advances acquisition and returns the current frame. A frame is the trace samples per channel in screen coordinates, the on-screen readouts, the open menu's contents, the trigger status (`triggered`, `auto`, `waiting`, `stopped`) and the cursor and marker positions.
- **`state()`** returns the published State snapshot.
- **`serialize()` / `restore()`** save and restore settings for autosave and share links.

Behaviour inside the engine:

- **Signal synthesis:**
  - **CH1 generator:** sine, square or triangle; frequency 1 Hz–100 kHz; amplitude up to 20 Vpp; DC offset.
  - **CH2 source:** `off | copy | lowpass | highpass | bandpass | independent`.
    - Filters act on CH1: first-order RC low-pass and high-pass (cutoff fc), and a second-order band-pass (centre f0 and Q).
    - The independent generator has its own waveform, frequency, amplitude, offset and a phase relative to CH1.
  - **Filter maths:** filtering is exact and steady-state. Each harmonic of the periodic input is multiplied by the filter's complex gain at that frequency and summed (a Fourier series truncated well above the screen's sample resolution). There is no start-up transient. Gain and phase at the fundamental match the textbook formulas exactly.
  - **Noise:** a small fixed amount of additive noise, from a seeded generator, so a given setup and capture index always produce the same samples. It is small enough that Measure readouts at sensible settings land within typical Activity tolerances.
- **Vertical:**
  - V/div in a 1-2-5 sequence from 2 mV to 5 V at the probe tip with a 1× probe. The 10× probe scales the displayed V/div.
  - Position in divisions, with push-to-centre.
  - Coupling: DC, AC (removes the mean) or GND (a flat line at the channel's ground).
  - Bandwidth limit: a gentle low-pass that visibly reduces the noise.
  - Invert.
  - A per-channel display on/off.
  - Traces clip at the screen edges as the ADC would, and measurements on clipped traces are marked invalid (shown as "?" or the model's equivalent).
- **Horizontal:**
  - s/div from 1 µs to 1 s, in each skin's own sequence.
  - Horizontal position (trigger offset), with push-to-centre or Set to Zero.
  - The scope's bandwidth roll-off is not simulated.
- **Trigger:**
  - Edge trigger only, with source CH1 or CH2, rising or falling slope, a level in volts, and Auto or Normal mode.
  - **Auto** with no valid crossing: free-run with a drifting, unstable trace.
  - **Normal** with no valid crossing: wait and keep the last frame.
  - **Set to 50%:** puts the level at the midpoint of the source's acquired range.
  - **Force Trig:** produces one acquisition at an arbitrary phase.
  - **Single:** arms a single acquisition, then stops.
  - **Run/Stop:** toggles acquisition.
  - A level marker and the trigger readout are drawn on the screen.
  - Noise around the crossing gives realistic jitter when the level sits near a peak.
- **Autoset (Tek-like):**
  - For each displayed channel, choose V/div so the trace spans about 4–6 divisions, and centre it.
  - Choose s/div to show about 2–3 cycles of the lowest-frequency displayed channel.
  - Trigger on CH1, or the only displayed channel, rising edge at 50%, in Auto mode. Set coupling to DC.
  - Autoset returns the display to YT, as the real scopes do.
- **Measure:**
  - Readouts per channel: frequency, period, pk-pk, amplitude, mean, RMS and rise time, plus CH1→CH2 delay and phase.
  - They are computed from the acquired samples, not the ideal signal, so scale and clipping affect them.
  - The number of readouts shown at once and the menu flow follow each skin's style.
- **Cursors:**
  - Off, time (two vertical cursors, showing Δt and 1/Δt) or amplitude (two horizontal cursors on a chosen source, showing ΔV).
  - The multipurpose knob moves the selected cursor, the softkeys select which cursor, and "fine" slows the step (TBS).
- **XY:**
  - The display format is YT or XY. In XY, CH1 drives X and CH2 drives Y.
  - The functions the real models disable in XY are disabled: cursors, Autoset (which returns to YT), the time base and the trigger controls.
- **Menus:**
  - A reduced Tek-like softkey menu tree, modelled as a state machine in the engine and rendered by the skin:
    - **CH menu:** coupling, BW limit, probe, invert.
    - **Trigger menu:** source, slope, mode.
    - **Measure menu:** add or remove readouts by source and type.
    - **Cursor menu:** type, source and which cursor.
    - **Display/Acquire:** format only.
    - **Horiz:** TDS only, with the minimal items its active controls need.
  - Menu On/Off (TBS) shows and hides the menu.
  - The logic is identical across skins. Only the rendering and the button that opens each menu differ.

### The panel binding (thin DOM layer)

- Inlines the active skin's SVG and lays the screen canvas over the screen rectangle, sized from the control map, with pixelated scaling at the native resolution.
- **Knob input:**
  - The wheel turns one detent per notch.
  - A vertical drag turns continuously, in detents.
  - The arrow keys turn a focused knob.
  - A click without a drag pushes the knob.
  - Knob rotation is drawn from the engine's value, not accumulated separately.
- Buttons and softkeys give pressed-state feedback.
- Every element in the control map, the source-panel Controls and the cursors are registered in the framework's Control registry, with get/set value, lock/unlock and show/hide. A locked knob or button ignores input and shows a locked affordance. A hidden one is visually removed but leaves the panel layout intact.
- The binding calls `acquire` on animation frames while running, draws the frame with the skin renderer, and fires the framework's change notification when the State changes.

### The source panel

- Built from UI-kit Controls: selects for the waveform and the CH2 source, and sliders with number boxes and resets for frequency, amplitude, offset, fc, f0, Q and the CH2 phase.
- Controls irrelevant to the current CH2 source are hidden (for example, Q unless CH2 is band-pass).
- Sits beside the panel within the laptop-width layout.

### State (published to the framework)

Each value has a label and a unit. The groups below are the contract, though exact key names are fixed during implementation.

- **Scope settings:** per channel, display on/off, V/div, position, coupling, probe, BW limit and invert. Also s/div, horizontal position, trigger source, slope, level and mode, run state (running, stopped or single), and display format.
- **Source settings:** everything in the source panel.
- **Ground truth:** CH1 and CH2 frequency and Vpp, and CH2's gain (as a ratio and in dB) and phase relative to CH1 at the CH1 fundamental.
- **Student-visible readings:**
  - whether the trace is stable (triggered and not free-running);
  - the active Measure readouts, each with source, type, value and a valid flag;
  - the cursor mode, both cursor positions and the Δ values.
- **Skin:** which skin is active.

### Display snapshot

- The single Display is the scope screen. Its PNG snapshot is the canvas at native resolution, with the readouts and menus burned in, like a real scope's screen save. The front panel is not included.

## Testing Decisions

- **The seams are agreed with the user:**
  - the scope engine's public interface, tested in Node;
  - the real Tool page, tested with Playwright.

  Nothing else is tested directly.
- **What makes a good test:** it drives the engine only through events and reads only `acquire()` frames, `state()` and `serialize()`. It never tests the internal structure of the menu state machine, the Fourier truncation, or DOM structure and ids. Each test fixes its seed, so it is deterministic.
- **Seam 1: the scope engine** (Node's built-in test runner, no dependencies). The tests cover:
  - **Signals:** a sine's pk-pk readout at a sensible scale matches the generator's Vpp; a square wave through a low-pass at fc = f gives the textbook gain and phase in the ground truth, and a Measure CH1→CH2 phase close to it.
  - **Vertical:** AC coupling removes a DC offset; GND gives a flat line; a 10× probe scales the V/div readout; clipping marks measurements invalid.
  - **Trigger:**
    - In Auto, a level above the signal gives an unstable trace; in Normal, it waits with the last frame kept.
    - Set to 50% restores a stable trace.
    - Single stops after one capture.
    - Force Trig acquires while waiting.
    - Rising and falling slopes trigger on opposite edges.
  - **Autoset:** from a scrambled setup, it yields a stable trace with 2–3 cycles and a trace spanning 4–6 divisions.
  - **Menus:**
    - Softkey sequences change the expected settings.
    - XY disables cursors, the time base and the trigger.
    - Autoset returns to YT.
  - **Cursors:** knob turns move the selected cursor and update Δt, 1/Δt and ΔV.
  - **Skins:** both skin profiles produce the same settings and readings for the same events; switching skin clamps out-of-range values.
  - **Determinism and persistence:** the same seed and events give identical frames; serialize then restore round-trips.
- **Seam 2: browser tests** (Playwright, the same tooling Spec 0001 introduces). They drive the real Standalone page for both skins:
  - wheel, drag and arrow keys turn a knob and change V/div on screen;
  - a click pushes;
  - Autoset produces a stable trace;
  - a locked Control ignores input;
  - the skin switcher works and survives a reload;
  - a share link reproduces the setup;
  - the layout has no horizontal scroll at laptop width;
  - the snapshot is a PNG of the native size.
- **Prior art:** Spec 0001's runner-core tests (Node test runner with a stub Tool) and its Playwright suite. This spec adds no new test tooling.

## Out of Scope

- Any Activity built on bench-scope. v1 is Standalone mode only, but the State and Controls are designed so Activities can be written later.
- The inactive front-panel functions: Math, FFT, Ref, Bus, Save/Recall, Default Setup, Utility, Help, Zoom, Search, Mark, Function, Save, Autorange, Probe Check, the external trigger, probe compensation, USB and power.
- Acquire modes other than the XY item (sample, peak detect, average).
- Trigger types other than edge (pulse, video, runt), and trigger coupling and holdoff.
- Filter transients and time-domain circuit simulation, and filters specified by component values (R, C, L).
- Instrument bandwidth roll-off, ns/div time bases and the datasheet-level limits.
- A noise-amplitude Control. The noise is fixed and small.
- Any change to Spec 0001's `oscilloscope` Tool or its Activity.
- Glossary changes. Scope terms are defined in this spec only.
- Phone layouts.

## Further Notes

- **XY menu locations, verified so far:**
  - The TDS1000/2000 family puts XY under the Display button → Format, as Tek's own FAQ states.
  - On that family, cursors, Autoset (which resets to YT), the time base and the trigger don't work in XY. This spec copies that behaviour.
  - The TBS2000B puts XY under the Acquire button → XY Display (On/Off) in the side menu. This is confirmed from the TBS2000B user manual (figure 1525-13), which the user supplied.
  - That manual page also shows the TBS screen layout to copy: a status bar along the top (Run, Trig'd), the side menu down the right edge, and the channel, time-base and trigger readouts along the bottom.
- **Panel sources:** the control map and the generated SVGs are already in the repo, along with the "Oscilloscope panels: control test" artifact, which binds wheel and push to both skins and overlays a demo canvas. That artifact is the prototype for the panel binding.
- **Related:** the s/div sequences and the exact on-screen readout layouts per model should be taken from the two user manuals rather than guessed.
