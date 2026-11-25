# Spec 0003: Porting conductor properties, spacetime, least squares and the vernier trainer to framework v1

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Builds on [Spec 0001](0001-framework-v1.md) and respects [ADR 0001](../adr/0001-json-report-with-report-viewer.md), [ADR 0002](../adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../adr/0003-major-versioned-framework-folder.md).

## Problem Statement

Framework v1 and the oscilloscope port (Spec 0001) give the instructor one consistent format: a Tool that students keep all term, Activities that stage it for one lecture, and a JSON Report that the Report Viewer grades as a class. Four other apps in the repo are still one-off single files outside that format.

- **conductor_properties** (PHY 4300) is a guided lecture activity. Its tasks pass on whatever values the student happens to pass through. A reload loses every answer. Its print-to-PDF hand-in can't be graded in bulk or checked for copying.
- **spacetime diagrams** is a polished construction sandbox with no guidance or hand-in. Its lab (Lab 10, PHY 1200) exists only as a paper handout, so in-class work can't be checked or collected.
- **least squares** and the **vernier trainer** are useful practice tools. Neither saves work, neither can share a setup, they don't look like the framework's Tools, and no future Activity can stage them.

Each app also carries its own copy of things the framework now provides: tabs, task cards, progress badges, autosave, share links, the report and the theme.

## Solution

Port all four apps onto framework v1 as Tools. Add an Activity where there is guided lecture content to carry: a faithful port of conductor_properties and a new spacetime Activity built from the first two sections of Lab 10. Delete the old single-file apps once each port is done.

- **`electrostatics` Tool:** three Modes (electric field, potential, Gauss's law), carrying over every interaction in conductor_properties.
  - **Activity:** "Conductor Properties" (PHY 4300) reproduces the six old Tasks and adds points and Hints.
- **`spacetime` Tool:** one Mode, the two-frame diagram construction sandbox.
  - It keeps undo/redo and JSON import/export.
  - Saving and share links move to the framework.
  - The Tool registers Condition types that judge what the student has drawn.
  - **Activity:** "Spacetime Diagrams" (PHY 1200) follows Lab 10 Sections 1–2 as two Parts at v = 0.6c. Students count tilted grid lines instead of reading rocket coordinates off the screen.
- **`least-squares` Tool:** one Mode. The dataset is a select Control. The generated data is seeded and saved, and the built-in "Check your g" and Optimize stay available.
- **`vernier` Tool:** one Mode. The measurement type is a select Control. The reading is seeded and saved, and the built-in Check / Show answer / Next practice loop stays available.

All four use the v1 cream and serif theme.

## User Stories

### Student: the electrostatics Tool

1. As a student, I want to open the electrostatics Tool with no Activity, so that I can explore conductors while doing E&M homework.
2. As a student, I want one tab each for electric field, potential and Gauss's law, so that the Tool covers the whole topic in one place.
3. As a student, I want to set the conductor's charge Q with a slider paired with a number box and a reset button, so that I can choose exact values.
4. As a student, I want to drag a joystick to set the applied field E₀ (up to 2000 V/m), and type E₀x and E₀y exactly, so that I can apply a bulk field in any direction.
5. As a student, I want to drag an arc picker to set the surface angle θ between 0 and π/2, so that I can change how the surface field is drawn.
6. As a student, I want toggles for induced charges and the electron/proton overlay, so that I can see how charges rearrange.
7. As a student, I want the charge overlay to keep animating as it does today, so that the redistribution looks physical.
8. As a student, I want to drag two probe points P1 and P2 on the potential plot and read V1, V2 and ΔV, so that I can measure potential differences.
9. As a student, I want "lock to surface" and "measure at infinity" toggles that can't both be on at once, so that I can compare surface paths and absolute potentials.
10. As a student, I want to drag a Gaussian surface's centre and its radius handle and read the enclosed charge, so that I can explore Gauss's law inside, outside and across the conductor.
11. As a student, I want each Mode's readouts (|E₀|, its angle, |E|max, V1, V2, ΔV, Q_enc) with units, so that I can quantify what I see.
12. As a student, I want each Mode's setup autosaved and shareable by link, so that a reload doesn't lose it and I can send it to a classmate.

### Student: the conductor properties Activity

13. As a PHY 4300 student, I want the Activity's three Parts (electric field, potential, Gauss's law) as tabs, so that I can follow the lecture.
14. As a student, I want each Task's prompt to describe what to try in the simulation, as before, so that the activity reads as it did.
15. As a student, I want to Submit my setup for each Task, so that only what I deliberately set up is judged, not values I dragged through.
16. As a student, I want to write my modus tollens explanation for each Task in a free-text box, so that my reasoning is part of my Report.
17. As a student, I want a Hint after three misses that says what to change, so that I don't get stuck.
18. As a student, I want my progress and answers autosaved, so that a reload mid-lecture doesn't cost me my writing.
19. As a student, I want to download my Report at any time and open it in the Report Viewer to print, so that I can turn in what I finished.

### Student: the spacetime Tool

20. As a student, I want to open the spacetime Tool with no Activity and draw freely, so that I can work relativity problems all term.
21. As a student, I want Event, Worldline, Rod and Join tools with their keyboard shortcuts, so that I can build diagrams quickly.
22. As a student, I want to set v/c or γ, flip the direction, and toggle each frame's grid and the K′ panel, so that I can choose what I compare.
23. As a student, I want undo and redo, so that I can recover from mistakes while drawing.
24. As a student, I want to export my diagram to a JSON file and import one back, so that I can keep and hand in homework diagrams.
25. As a student, I want to save a PNG of both diagrams, so that I can paste them into a write-up.
26. As a student, I want my diagram autosaved and shareable by link, as it is today, so that switching to the new Tool loses nothing.
27. As a student, I want the interval and proper-time measurements, so that I can check timelike, lightlike and spacelike separations.

### Student: the spacetime Activity

28. As a PHY 1200 student, I want the Activity to follow Lab 10's first two sections (Building the diagram, Relativity of simultaneity), so that it matches the handout.
29. As a student, I want each Part to start with v = 0.6c fixed and the rocket grid drawn over the Earth diagram, so that I see what the handout shows.
30. As a student, I want rocket coordinates hidden, so that I learn to read them by counting tilted lines.
31. As a student, I want to draw the lamp, rocket and light-ray worldlines and have each Submit judged, so that I know my diagram is right.
32. As a student, I want to type the coordinates I counted and have them checked within a tolerance, so that small reading slop doesn't fail me.
33. As a student, I want multiple-choice checks on which grid line a worldline or a line between two events lies along, so that conceptual points are quick.
34. As a student, I want free-text boxes for the "explain" questions, so that my reasoning is recorded.
35. As a student, I want to lay a rod between events B and F and discover that only a rocket-frame rod fits, so that I see the rocket's "now" line for myself.
36. As a student, I want a Hint after three misses, so that I'm not stuck on one drawing for the whole lab.
37. As a student, I want only the drawing tools each Task needs, so that I'm not distracted by rods and measurements too early.

### Student: the least-squares Tool

38. As a student, I want to pick a dataset (pendulum, free fall, light intensity, Ohm's law) from a select, so that I can practise linearizing different models.
39. As a student, I want the same data as my classmates until I press New data, so that we can compare results in class.
40. As a student, I want to choose x and y axis transforms (identity, square, square root, 1/x, 1/x², ln), so that I can find the linearizing plot.
41. As a student, I want to drag the line's (m, b) handle on the parameter plane and see SSE, R², residuals and how many error bars the line passes through, so that I can judge a fit by eye first.
42. As a student, I want to drag data points when editing is on, and reset them, so that I can see how outliers pull the fit.
43. As a student, I want coarse and fine views, Optimize, and a through-origin lock, so that I can compare my fit with least squares.
44. As a student, I want "Check your g / R / A and B" to reveal the physical quantity, so that I can check my linearization.
45. As a student, I want Copy CSV, so that I can take the data into a spreadsheet.
46. As a student, I want my dataset, seed, edited points, axes and line autosaved and shareable, so that a reload or a link reproduces exactly what I had.

### Student: the vernier Tool

47. As a student, I want to choose outside, inside, depth or random measurements, so that I can practise every kind of reading.
48. As a student, I want to zoom between the whole caliper and a close-up of the scales, so that I can read the vernier lines.
49. As a student, I want to type my reading in millimetres and Check it, with clear errors for non-numbers and for values that aren't multiples of 0.05 mm, so that I learn the format.
50. As a student, I want a breakdown of the correct reading (main-scale mark, matching vernier line, total) with the marks highlighted when I miss or reveal, so that I learn from mistakes.
51. As a student, I want Correct, Attempts and Streak counters, so that I can see myself improving.
52. As a student, I want the current reading autosaved and shareable, so that a reload doesn't change the problem and I can ask the instructor about a specific one.

### Instructor

53. As the instructor, I want conductor_properties graded through the Report Viewer, so that I can score the class and check for copying, as with the oscilloscope Activity.
54. As the instructor, I want the conductor Activity's Conditions to be the old ones, so that the lecture is unchanged.
55. As the instructor, I want to write spacetime Conditions such as "an event near (3, 5)", "a worldline of velocity 0.6 through the origin" or "a rod with ends at B and F", so that drawing Tasks are data and not code.
56. As the instructor, I want conductor Conditions such as "|E₀| above 0" or "P1 inside the conductor, and P2 inside too or measured at infinity" expressed declaratively and encoded, so that the answers aren't readable in the page source.
57. As the instructor, I want each Attempt in the spacetime Report to record the drawn diagram, so that I can see what a student drew when a Task failed.
58. As the instructor, I want future Activities on least squares and vernier to fix the dataset, seed or reading through a Setup and to hide the self-check Controls, so that the Tools are ready for graded Activities later.
59. As the instructor, I want the Lab 10 handout source kept next to the spacetime Tool, so that the paper and online versions stay together.

### Maintainer

60. As the maintainer, I want the old single-file apps deleted once their ports exist, so that there is one version of each app.
61. As the maintainer, I want each Tool's maths in a DOM-free module with Node tests, so that the physics is verified without a browser.
62. As the maintainer, I want each Tool mountable several times on one page without global state, so that each Part gets its own instance (ADR 0002).
63. As the maintainer, I want every port to use the v1 theme and UI kit, and canvas colours to come from theme variables, so that the look is consistent and a later dark theme is cheap.

## Implementation Decisions

### Shared across all four ports

- Each port is a v1 Tool, defined through the Tool contract and mounted by the Tool host for Standalone mode. Tool ids are `electrostatics`, `spacetime`, `least-squares` and `vernier`.
- Each Tool keeps its maths and generators in a DOM-free module the Tool imports. The Tool module owns the DOM, the Controls and the Displays.
- **No global state:** no document-level lookups by id, no globals and no document-wide listeners that assume a single instance. Keyboard shortcuts apply only while that instance has focus or the pointer is over it. SVG ids injected into a Display are made unique per instance.
- **Standard Controls** (slider with a number box and reset, toggle, select, button, metric readout) come from the UI kit. Custom interactions register through the Control interface: conductor's joystick, arc picker, probe points and Gaussian-surface handles, the least-squares (m, b) handle and draggable points, and spacetime's drawing tools.
- **Persistence:** autosave and the share link come from the framework, through each Tool's serialize and restore. App-specific autosave and share links are removed.
- **Theme:** the v1 theme. Dark mode in least squares and the vernier trainer is dropped. Canvas and SVG drawing colours read from theme variables.
- **Math:** MathJax and Plotly load through the framework's vendored copies, not their old CDN links.
- **Displays:** every Display provides a PNG snapshot. Plotly-based Displays use Plotly's image export. Canvas and SVG Displays render to a PNG.
- **Deletion:** each old app's HTML file is deleted in the ticket that ports it, along with any folder that ends up empty. The matplotlib scripts for conductor_properties are kept as a physics reference. The Lab 10 handout source moves into the spacetime Tool's folder.

### Framework v1 additions (compatible, made in place per ADR 0003)

- **Two built-in Condition types**, needed because encoded Conditions are JSON and can't carry functions:
  - **`range`**: a named State value strictly above an `above` bound, strictly below a `below` bound, or both. Miss feedback is generated, for example "|E₀| = 0 V/m; need > 0".
  - **`anyOf`**: passes when any of its component Conditions passes. Its feedback lists the components.
- Both are added to the built-in registry, so existing Activities are unaffected.

### The electrostatics Tool

- **Modes:** `electric-field`, `potential` and `gauss`, matching the three old tabs. Each Mode's maths is the existing code moved into the Tool's maths module, with the conductor radius at 5 cm and the window at ±10 cm.
- **Controls per Mode**, keeping the old ranges and defaults:
  - **electric-field:**
    - Q (−3 to 3 nC, step 0.1)
    - θ, the arc picker plus a number box (0 to π/2)
    - the E₀ joystick plus E₀x and E₀y boxes (each −2000 to 2000 V/m, |E₀| ≤ 2000)
    - toggles for induced charges and the charge overlay
  - **potential:**
    - Q
    - the P1 and P2 probe points
    - "lock to surface" and "measure at infinity", which stay mutually exclusive
  - **gauss:**
    - λ (−1 to 1, step 0.05)
    - the E₀ joystick and boxes
    - the Gaussian-surface centre and the radius handle (radius at least 0.3)
- **State per Mode**, from the old variable catalogue, each value with a label and unit. Derived values are published so the old Conditions become declarative:
  - **electric-field:** Q, E₀x, E₀y, |E₀|, the angle of E₀, θ, induced-charges and overlay flags, |E|max.
  - **potential:**
    - Q, and the effective P1 and P2 coordinates after constraints
    - the distances r1 and r2 from the centre
    - V1, V2 and ΔV
    - the two toggle flags
  - **gauss:**
    - λ, E₀x and E₀y
    - the surface centre and radius
    - the centre's distance from the conductor's centre
    - the surface's outer extent (distance + radius) and inner extent (distance − radius)
    - Q_enc
- **Displays:** one Plotly plot per Mode: the |E| heatmap, quiver arrows, and the conductor boundary or σ ring.
- **Animation:** the charge-overlay animation runs only while its instance is visible, and stops on destroy.
- **Layout:** the old hand-wired tabs, progress dots, Prev/Next buttons, badges and PDF report are removed. The Tool host and the Activity runner provide all of them.

### The conductor properties Activity

- **Identity:** id `conductor-properties`, course "PHY 4300", title "Conductor Properties". Three Parts, one per Mode, each with the old default Setup.
- **Tasks:** two per Part, ported from the old task list. Prompts and free-text Questions are carried over verbatim. Each Task's Condition is encoded:

  | Task | Condition | Hint (after 3 misses, encoded) |
  |---|---|---|
  | ef-t1 Apply a bulk field | |E₀| above 0 | "Drag the E₀ joystick away from its centre, or type a nonzero E₀x or E₀y." |
  | ef-t2 Change the surface field | Q above 0 and θ above 0 | "Give the conductor a positive charge Q, then move the θ picker off zero." |
  | pf-t1 Measure the potential inside | r1 below 5 cm, and anyOf(measure at infinity, r2 below 5 cm) | "Drag P1 inside the conductor. Then put P2 inside too, or turn on measure at infinity." |
  | pf-t2 Potential difference along surface paths | lock to surface is on | "Turn on lock to surface." |
  | gl-t1 The charge in the bulk | outer extent below 5 cm | "Shrink or move the Gaussian surface until all of it lies inside the conductor." |
  | gl-t2 The charge at the surface | outer extent above 5 cm and inner extent below 5 cm | "Make the Gaussian surface straddle the conductor's edge, partly inside and partly outside." |

- **Points:** each Task earns 1 point for passing and 1 for its non-empty free-text Question, for 12 in total.
- **One behaviour change:** in the old app the free-text box unlocked only after the check passed. Under the framework the student can write before Submitting, and the Task passes when its Condition passes. The answer is recorded with every Attempt.
- **Control exposure:** each Part shows all of its Mode's Controls. The old app locked nothing, and the port keeps it that way.

### The spacetime Tool

- **One Mode** (`diagram`): the K and K′ diagrams side by side, the toolbar and the object sidebar. Units are c = 1.
- **Coarse Controls:** the Tool registers Controls for the parts of the UI an Activity needs to stage. It does not register one per object:
  - one Control per drawing tool (select, event, worldline, rod, join);
  - v/c with its slider, γ, and flip;
  - the K grid, the K′ grid, and the K′ panel;
  - `primed`, which hides every x′/t′ readout and input in the sidebar, including "Fixed in K′" coordinate entry. A rod's frame select stays visible, because choosing a frame reveals no coordinates;
  - the measurements panel;
  - undo, redo, JSON export and JSON import;
  - new diagram and reset view.
- **Setup:** v, the frame names, the grid and K′-panel flags, and an optional starting list of objects.
- **State:**
  - flat values: v, γ, and the counts of events, worldlines and rods;
  - `diagram`, the canonical normalized object list serialized as one JSON string. It stays within v1's flat-snapshot contract, so every Attempt in a Report records exactly what was drawn.
- **Condition types**, exported by the Tool module and passed by the Activity page to the runner. Each one parses `diagram`, and each tolerance is absolute in K coordinates:
  - `st-event`: some event within `tol` of a point (x, t).
  - `st-worldline`: some worldline with velocity `u` (within `uTol`) passing within `tol` of a point (x, t). Both parametric worldlines and joined chains count; for a chain, the matching segment must contain the point.
  - `st-rod`: some rod whose two ends lie within `tol` of two given points, in either order, whatever the rod's frame.
  - Miss feedback says what is closest. For example, "nearest event is at (2.9, 4.6); need (3, 5) ± 0.1", or "no worldline with u = 0.60 found".
- **Undo/redo:** kept inside the Tool, with the view excluded as today. Restoring a saved State clears both stacks.
- **JSON import/export:** kept, with the existing format and validation. An import becomes one undoable step.
- **The PNG Display snapshot** is the existing composite of both diagrams with its header. It replaces the separate Save PNG path, and the button stays as a Control that downloads that snapshot.
- **Removed:** the old autosave key and the old `#s=` hash handling, which now go through the framework.

### The spacetime Activity

- **Identity:** id `spacetime-lab10`, course "PHY 1200", title "Spacetime Diagrams". Prompts paraphrase Lab 10. Math is rendered.
- **Both Parts' Setup:**
  - v = 0.6, with the v, γ and flip Controls locked;
  - the K′ grid drawn over the Earth diagram, with the K′ panel, `primed` and the measurements panel hidden;
  - an empty diagram.
- **Tolerances:** positions ±0.1, velocities ±0.01, numeric answers ±0.1 (absolute).
- **Points:** every Condition-bearing Task earns 1 point, and every Question earns 1. A Task without a Condition earns 0 own points, so a blank Submit earns nothing.
- **Encoding:** Conditions, numeric and multiple-choice keys, and answer-revealing Hints are encoded.
- **Part 1, Building the diagram** (event and worldline tools shown, rod and join hidden):

  | Task | Condition | Questions | Hint |
  |---|---|---|---|
  | 1.1 Lamp at rest at x = 2 | worldline u = 0 through (2, 0) | none | "A lamp at rest stays at the same x, so its worldline is vertical." |
  | 1.2 Rocket from the origin at 0.6c | worldline u = 0.6 through (0, 0) | numeric: x at t = 5 yr → 3 | "At 0.6c the rocket covers 0.6 ly each year. Aim it from the origin through (3, 5)." |
  | 1.3 Flash both ways from the origin | worldlines u = +1 and u = −1, both through (0, 0) | none | "Light covers 1 ly per yr: one 45° line each way from the origin." |
  | 1.4 Why no worldline tilts past 45° | none | text | none |
  | 1.5 The rocket's worldline and the tilted grid | none | choice: which tilted line is it on? (t′ axis ✓, x′ axis, a light ray, none); text: why must the rocket's time axis be its worldline? | none |
  | 1.6 Mark E (3, 5) and F (5, 5) | events at (3, 5) and (5, 5) | numeric: x′_E → 0, t′_E → 4, x′_F → 2.5, t′_F → 2.5 | "For x′ count the tilted lines parallel to the t′ axis; for t′ count those parallel to the x′ axis." |
  | 1.7 F and the speed of light | none | text | none |

  Part 1 is worth 13 points.

- **Part 2, Relativity of simultaneity** (a 4 ly rocket at 0.6c with a lamp at its middle flashing at the origin; event and worldline tools shown; the rod tool shown only from Task 2.5):

  | Task | Condition | Questions | Hint |
  |---|---|---|---|
  | 2.1 The rocket's ends and the flash | worldlines u = 0.6 through (−1.6, 0) and (1.6, 0); worldlines u = ±1 through (0, 0) | none | "Each end stays at a constant x′ (−2 and +2), so it runs parallel to the t′ axis. At t = 0 those lines cross x = ∓1.6. Then add both light rays." |
  | 2.2 Mark B and F | events at (−1, 1) and (4, 4) | numeric: t′_B → 2, t′_F → 2 | "B is where the leftward ray meets the back's worldline; F is where the rightward ray meets the front's." |
  | 2.3 Earth times | none | numeric: t_B → 1, t_F → 4; choice: which arrival comes first in the Earth frame? (B ✓, F, both at once) | none |
  | 2.4 Why the back is reached first | none | text | none |
  | 2.5 Connect B and F | rod with ends at (−1, 1) and (4, 4) | choice: parallel to which lines? (t axis, x axis, t′ axis, x′ axis ✓, a light ray); text: what does that say about "simultaneous"? | "Use the Rod tool, set the rod's frame to the rocket's, and drag its ends onto B and F." |

  Part 2 is worth 11 points, for 24 in total.

- **Mounting:** the Activity page passes the spacetime Tool's Condition types to the runner.

### The least-squares Tool

- **One Mode** (`fit`).
- **Controls:**
  - selects: dataset, y transform, x transform, and coarse/fine view
  - buttons: New data, Reset data, Optimize, Copy CSV
  - toggles: show residuals, edit points, through-origin lock
  - the "Check your …" reveal
  - the (m, b) handle and the draggable data points
- **Setup:** dataset, seed, transforms, view, lock, and an optional starting line.
- **State:**
  - inputs: dataset, seed, transforms, m and b;
  - results: SSE, SST, R² (pinned to 0 when worse than flat), SSE/SST, error bars hit out of n, the OLS m and b, the through-origin OLS slope, whether the axes linearize the model, and the implied physical quantity or quantities.
- **Serialized State:** the dataset, seed, any edited points, the transforms, view, lock, the line, and whether the check has been revealed.
- **Seeding:**
  - The data generator keeps its seeded scheme: each dataset's seed starts at 0, so the whole class sees the same data until New data.
  - The handle's random starting position is also drawn from the seed, so a restore reproduces it.
  - Changing the dataset or the axes still resets the plane. A restore applies the saved line after the axes are set.
- **Displays:** three canvases (the scatter with error bars and line, the residuals, and the parameter plane), each with a PNG snapshot. The old window-wide resize observer is replaced by one per instance.
- **Removed:** the "story" text's own MathJax CDN load. It uses the framework's vendored MathJax.

### The vernier Tool

- **One Mode** (`caliper`).
- **Controls:**
  - selects: measurement type (outside, inside, depth, random) and zoom (whole, close-up)
  - the reading input, with Check, Show answer and Next
  - the counter readouts
- **Setup:** measurement type, seed and zoom.
- **State:**
  - inputs: measurement type, seed and zoom;
  - the current reading in mm and its parts: the main-scale mark, the matching vernier line, and the matching main-scale line;
  - progress: whether it has been answered, Correct, Attempts and Streak.
  - The reading is in State by design. The Tool is a practice Tool, and a future graded Activity would fix the seed through a Setup and grade with an encoded numeric Question, hiding the self-check Controls.
- **Seeding:** readings come from a seeded generator. The seed and a draw counter are serialized, so a reload or share link shows the same reading. Next advances the counter.
- **Checking:** the existing rules, moved into the maths module:
  - a comma is accepted as the decimal separator;
  - non-numbers are rejected with the existing message;
  - values that aren't multiples of 0.05 mm are rejected with the existing message;
  - an answer is correct when it rounds to the generated number of twentieths;
  - a miss or a reveal shows the breakdown and highlights the marks.
- **Display:** the Inkscape caliper SVG moves out of the page into its own asset, which the Tool loads and clones per instance with ids made unique. The hatch pattern, object and highlight groups are injected per instance. The PNG snapshot renders the SVG.

## Testing Decisions

- **What a good test is:** it exercises behaviour through a public interface: a maths function's inputs and outputs, an Activity definition driven through the runner, or the page as a student uses it. It never asserts DOM structure, storage key formats or internal helpers.
- **Seam 1: each Tool's maths module, in Node's test runner.**
  - **electrostatics:** field superposition for the induced and applied cases; potential inside the conductor constant and equal to the surface value; Q_enc ≈ 0 for a surface entirely in the bulk and ≈ the surface charge for one that straddles the edge; the effective probe points under each toggle.
  - **spacetime:**
    - Lorentz transforms and γ;
    - the interval and its classification;
    - proper time along chains, including the partial and spacelike flags;
    - normalizing a saved diagram;
    - each Condition type judged against a State snapshot, with pass, miss and feedback cases. These include a chain that matches only on the right segment, and a rod matched with its ends in either order.
  - **least squares:** the same seed gives the same data, and every point lies within its error bar; OLS and through-origin fits; R² pinning; the error-bar hit count; linearization detection and the implied g, R, A and B for each dataset.
  - **vernier:** the same seed and counter give the same reading; readings stay in range for each measurement type; the reading breakdown; answer judging (comma, non-number, not a multiple of 0.05, correct, wrong).
  - **The framework's new `range` and `anyOf` types** are tested with the runner's existing Condition tests.
  - **Prior art:** the oscilloscope signal tests and the runner's Condition tests.
- **Seam 2: each Activity definition through the runner core, in Node.**
  - A stub Tool with settable State and the Activity's Control ids. For spacetime, the stub's `diagram` value is built from real objects, and the Tool's Condition types are passed to the runner.
  - The tests check:
    - every Task's Condition fails at the default Setup and passes at the intended State;
    - values merely passed through aren't evaluated;
    - Control exposure follows each Task (spacetime's v locked, `primed` hidden, the rod tool shown only from Task 2.5);
    - Hints appear after three misses;
    - point totals are 12 and 24;
    - every encoded key decodes.
  - **Prior art:** the oscilloscope Activity tests and the runner's stub Tool.
- **Seam 3: Playwright browser tests.**
  - A Standalone smoke test for each Tool: it loads, shows every Control unlocked, a Control change updates the State, and a reload and a share link restore the same State. That State includes least squares' data and vernier's reading.
  - For spacetime the smoke test also covers undo/redo and a JSON export/import round trip.
  - One end-to-end test for each Activity:
    - the name gate;
    - the Part tabs;
    - a Task passing only on Submit at the target;
    - a reload restoring progress;
    - the downloaded Report opening in the Report Viewer.
    - For spacetime it also draws the Part 1 worldlines with the real drawing tools, and confirms the rocket coordinates aren't visible.
  - **Prior art:** the oscilloscope Standalone and Activity specs.

## Out of Scope

- Activities for least squares and the vernier trainer. The Tools are built to support them later.
- Lab 10 Sections 3 onwards (time dilation, pole and barn, the interval, muons, the twin paradox) as online Parts.
- Porting maxwell-construction, cross-product, the K-Map editor, the diode load-line scripts or the bench-scope work.
- Dark mode and the visual refresh.
- Per-object Controls in spacetime, or dynamic Controls in the framework.
- Changing the physics, ranges or task wording of conductor_properties beyond adding points and Hints.
- Redirect stubs at the old URLs. Old links break by choice.

## Further Notes

- **Order of work:** conductor first (it exercises multi-Mode Tools and the new Condition types), then spacetime, least squares and vernier. Each Activity ticket is blocked by its Tool ticket.
- **Prior art in the repo:**
  - **Physics references:** the matplotlib conductor scripts, and the variable catalogue at the end of conductor_properties.
  - **Port pattern:** the oscilloscope Tool.
  - **Spacetime Part content and answer key:** the Lab 10 handout. Its answer-key values are those used in the Activity tables above.
- **Spacetime rods:** a rod's sidebar shows T and its end positions in the rod's own frame. That reveals t′ = 2 for the B–F rod, which is why the rod tool appears only in Task 2.5, after Task 2.2 (which asks for t′) has passed and frozen.
- **Report Viewer:** spacetime's `diagram` State value is a long string. The Viewer shows it verbatim in the detail view. A rendered diagram is a possible later improvement.
- **Brightspace:** the PHY 1200 and PHY 4300 assignment folders must allow `.json` uploads.
