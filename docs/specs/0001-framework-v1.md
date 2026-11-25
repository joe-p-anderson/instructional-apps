# Spec 0001: Framework v1, the Report Viewer, and the oscilloscope port

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md). Respects [ADR 0001](../adr/0001-json-report-with-report-viewer.md), [ADR 0002](../adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../adr/0003-major-versioned-framework-folder.md).

## Problem Statement

Each instructional app in this repo was built as a one-off. The older lecture apps (conductor_properties, the oscilloscope lab) have guided tasks, questions and a print-to-PDF hand-in, but:

- the scaffolding was rewritten each time, data-driven in one app and hand-wired per task in the other;
- conditions pass on whatever values the student happens to pass through;
- a page reload loses all work;
- the "PDF" can't be graded in bulk or checked for copying.

The newer apps (spacetime, least-squares) are polished open tools with no guidance, tasks or hand-in at all. The instructor wants a single consistent format: a Tool students keep using all term, Activities that stage that Tool through Parts and Tasks for one lecture, and a Report they turn in to Brightspace that the instructor can grade as a class and check for duplicates.

## Solution

A shared, static, no-build JavaScript framework, hosted on GitHub Pages under a major-versioned folder, provides three things.

- **The Tool contract and UI kit.** A Tool is a simulation with Modes. It draws its own Controls and Displays using a shared component kit and look, and exposes them to the framework through a small interface. Any Tool opened with no Activity runs in **Standalone mode**.
- **The Activity runner.**
  - An Activity is a declarative script naming one Tool, made up of Parts (tabs) that each contain Tasks.
  - The runner gates the student's name at the start of the Run.
  - It shows, locks and hides Controls for each Task.
  - It evaluates Conditions and graded Questions only on an explicit Submit, and records every Attempt.
  - It shows Hints, autosaves the Run, and downloads a JSON Report at any time.
- **The Report Viewer.** Students drop in their own Report to read or print it. The instructor drops in the Brightspace bulk-download zip to:
  - see a class table;
  - see duplicate, name-mismatch and tamper flags;
  - read each student's detail;
  - export grades.

The first deliverable is the oscilloscope lab ported onto this framework as an oscilloscope Tool plus a "phase shift / period and amplitude" Activity.

## User Stories

### Student: standalone Tool

1. As a student, I want to open a Tool with no Activity, so that I can use it to study or do homework long after the lecture.
2. As a student, I want every Control available in Standalone mode, so that nothing is artificially locked when I'm working on my own.
3. As a student, I want one tab per Mode in Standalone mode, laid out like an Activity's Part tabs, so that the Tool feels the same in lecture and on my own.
4. As a student, I want my Standalone work autosaved, so that a reload or a closed tab doesn't lose it.
5. As a student, I want to copy a link that reproduces my current Tool state, so that I can share a setup with a classmate or the instructor.
6. As a student, I want each slider paired with a number box and a reset button, so that I can set exact values and recover the defaults.

### Student: doing an Activity

7. As a student, I want to type my name when I start an Activity, so that my Report is clearly mine.
8. As a student, I want my name fixed for the Run once I've entered it, so that I understand the Report is bound to me.
9. As a student, I want a deliberate "Start over" (with a confirmation) that begins a new Run, so that I can recover from a mistake such as a mistyped name.
10. As a student, I want to see the Activity's Parts as tabs, all available from the start, so that I can follow the instructor when they say "everyone jump to Part 2".
11. As a student, I want Tasks within a Part to unlock in order, so that I'm guided step by step.
12. As a student, I want to see only the Controls the current Task needs, so that I'm not overwhelmed or distracted.
13. As a student, I want Controls an earlier Task fixed to stay locked when that matters (for example Δt after I've set the phase shift), so that later measurements build on what I did.
14. As a student, I want each Part to keep its own Tool state when I switch tabs, so that work in one Part doesn't disturb another.
15. As a student, I want a Submit button for each Task, so that I decide when my setup or answer is ready to be judged.
16. As a student, I want a value I merely pass through while dragging not to count, so that the activity reflects deliberate work.
17. As a student, I want specific feedback on a failed Submit (for example "φ = 1.48 rad; need π/2"), so that I know how far off I am.
18. As a student, I want a Hint after several failed Attempts, so that I don't get stuck for the whole lecture.
19. As a student, I want to answer numeric Questions and have them checked within a tolerance, so that rounding doesn't fail me.
20. As a student, I want to answer multiple-choice Questions, so that conceptual checks are quick.
21. As a student, I want to answer free-text Questions, so that I can explain my reasoning.
22. As a student, I want a passed Task to show as done and stay done, so that I can see my progress.
23. As a student, I want a progress indicator for each Part, so that I can see what's left.
24. As a student, I want my Activity progress autosaved, so that a reload or a laptop crash mid-lecture doesn't cost me my work.
25. As a student, I want to download my Report at any time, even part-way through, so that I can turn in what I finished when class ends.
26. As a student, I want the Report's filename to identify the Activity, me and the date, so that I upload the right file.
27. As a student, I want to open my Report in the Report Viewer and print or save it as a PDF, so that I keep a readable record.
28. As a student, I want math rendered properly in prompts and Questions, so that the physics is readable.
29. As a student on a laptop in a lecture hall, I want the layout to fit a laptop screen without horizontal scrolling, so that I can work comfortably.

### Instructor: authoring

30. As the instructor, I want to write an Activity as one declarative script naming a Tool, Parts, Tasks, Conditions, Questions, Hints and points, so that a new lecture activity doesn't require writing scaffolding code.
31. As the instructor, I want one Tool to host many Activities, so that I can reuse a simulation across lectures and courses.
32. As the instructor, I want each Part to choose a Mode and a Setup of the Tool, so that two experiments on the same scope start from different presets.
33. As the instructor, I want to declare for each Task which Controls are shown, locked or hidden, so that staging is data and not hand-written code.
34. As the instructor, I want to write the common Conditions as declarative targets with tolerances on named State, so that most Tasks are one line and the miss feedback comes for free.
35. As the instructor, I want to register new Condition types, or fall back to a function over the State, so that unusual Tasks still fit the framework.
36. As the instructor, I want to give each Task and Question a points value, so that the Report Viewer can compute scores.
37. As the instructor, I want a Task to earn full points once it has ever passed, regardless of misses, so that students are rewarded for persisting.
38. As the instructor, I want free-text Questions to earn their points when the answer isn't empty, so that I don't have to hand-grade every reflection.
39. As the instructor, I want answer keys and targets not to appear in plain text in the page source, so that casual students can't read them off.
40. As the instructor, I want to edit an Activity after students have started it without wiping their progress on Tasks that still exist, so that I can fix a typo mid-lecture.
41. As the instructor, I want every Report to record the Activity id and version and the framework version, so that I can interpret old Reports.
42. As the instructor, I want Activities to keep working after the framework evolves, so that last semester's links still work.
43. As the instructor, I want a course line and title on each Activity, so that Reports are labelled per course (for example "PHY/EGR 3120").

### Instructor: grading with the Report Viewer

44. As the instructor, I want to drop the Brightspace bulk-download zip onto the Report Viewer, so that I can grade the whole class in one place.
45. As the instructor, I want a class table showing each student, Tasks passed, Attempts, points and flags, so that I can see the whole class at a glance.
46. As the instructor, I want to click a student and see their full Report (Attempts, State at each Attempt, answers, snapshots), so that I can judge their work.
47. As the instructor, I want a flag when two students' Reports share a Run fingerprint or an identical Attempt history, so that I catch copied files.
48. As the instructor, I want a warning when a Report's sealed name doesn't loosely match the Brightspace uploader, so that I catch relabelled or borrowed Runs without false zeros.
49. As the instructor, I want a flag when a Report fails its checksum, so that I catch hand-edited files.
50. As the instructor, I want a flag when a Report comes from a different Activity or version than the others, so that I notice when someone used the wrong link.
51. As the instructor, I want to export a grades CSV that Brightspace can import, so that I don't copy grades by hand.
52. As the instructor, I want the Report Viewer to process files entirely in my browser, so that student data never leaves my machine.
53. As the instructor, I want the Report Viewer to read Reports from every framework major version still in use, so that I can regrade old work.

### Maintainer

54. As the maintainer, I want the framework to need no build step or package install to run, so that GitHub Pages serves it as-is.
55. As the maintainer, I want the framework's look based on the old apps' cream and serif design language, so that it matches what already works in lecture, with a visual refresh to follow.
56. As the maintainer, I want the Tool contract to let a Tool be mounted several times on one page, so that each Part can have its own instance.

## Implementation Decisions

### The framework

- **Hosting:** the framework is static ES modules plus CSS, loaded from a major-versioned folder (`v1`). Third-party libraries (MathJax, Plotly where a Tool uses it, a small zip reader for the Report Viewer) are either vendored into the repo or loaded from a pinned CDN version. Nothing requires a build.
- **Separate modules:**
  - **UI kit:** components and theme.
  - **Tool host:** mounting, Standalone mode, Mode tabs.
  - **Activity runner core:** pure logic with no DOM. It covers Run, Task progression, Condition and Question evaluation, Attempts, points, Hints and Report assembly.
  - **Activity runner UI:** the thin DOM layer over the core.
  - **Persistence.**
  - **Report format:** the schema, checksum and fingerprint.
  - **Report Viewer core:** pure logic for parsing, matching, flags, scores and CSV.
  - **Report Viewer UI.**

### The Tool contract

- A Tool declares an id, a title and its list of Modes.
- Mounting a Tool takes a container, a Mode and a Setup, and returns an instance. A page may hold several instances at once, so Tools keep no global state.
- The instance exposes:
  - **State:** named values, each with a label and unit, readable as a plain snapshot.
  - **Change notification:** fired when the State changes.
  - **Controls:** a registry keyed by Control id. Each Control supports get value, set value, lock, unlock, show and hide. This includes interactions that live inside a Display, such as a draggable marker or a clickable cell, which register like any other Control.
  - **Displays:** each one can produce a PNG snapshot.
  - **State serialization:** to save and restore the State for autosave and share links.
- Standard Controls (slider with a number box and reset, toggle, select, button, metric readout) come from the UI kit. Custom Controls only have to implement the Control interface.

### Standalone mode

- Opening a Tool's page without an Activity shows one tab per Mode with every Control unlocked.
- State is autosaved to browser storage, separately for each Tool and Mode.
- A share link encodes the State, following the precedent of spacetime's `#s=` link.
- There are no Tasks and no Report.

### Activities

- An Activity is a declarative script with:
  - an id, a version, a title and a course line;
  - the Tool id;
  - its Parts. Each Part has an id, a title, a Mode, a Setup and its Tasks.
- Each Task has:
  - an id, a title and a prompt (math allowed);
  - Control exposure: lists of the Controls to show, lock and hide;
  - an optional Condition;
  - zero or more Questions;
  - points;
  - an optional Hint (the number of misses before it appears, and its text).
- An Activity is selected by a query parameter on the Tool's page, or by a tiny HTML page per Activity. Either way, the URL identifies one Activity.

### Conditions

- **Default form:** declarative targets on named State, either a value within a tolerance or an exact or boolean match.
- **Miss feedback** is generated automatically from the target and the submitted value.
- **Extensibility:** Condition types live in a registry that Activities or Tools can add to (for example "within a range", "any of", "relation between two values"). A plain function over the State is the escape hatch.
- **Grading:** a Condition is evaluated only on Submit, against the State at that moment.

### Questions

- **Numeric** answers are checked against a tolerance, absolute or relative.
- **Multiple-choice** answers are checked against the correct choice.
- **Free text** is recorded and never judged.

### Submit and Attempts

- **Passing:** a Task passes on Submit when its Condition (if any) and all of its graded Questions pass.
- **What an Attempt records:**
  - a timestamp;
  - the full State;
  - the answers given;
  - the result for each component;
  - whether the Attempt passed.
- **On a pass:**
  - snapshots are taken of the Part's Displays (for passing Attempts only);
  - the Task's record is frozen, and passed Tasks can't be redone;
  - the next Task in the Part unlocks;
  - that Task's Control exposure is applied. A later Task can unlock a Control that an earlier Task locked.
- **On a miss:** the student sees the feedback, the Attempt is recorded, and the Hint appears once the miss count reaches its threshold.
- **Order:** Tasks unlock in order within a Part. All Parts are open from the start.

### The Run and identity

- **Name gate:** opening an Activity shows a name gate before Part 1. Entering a name starts a Run.
- **Run fingerprint:** each Run has a random fingerprint and a start time.
- **Fixed name:** the name and fingerprint can't be changed within the Run. "Start over" (with a confirmation) discards the Run and begins a new one.

### Persistence

- The Run autosaves to browser storage, keyed by Activity id.
- If the Activity's version has changed when the Run is restored, Attempts are kept for Task ids that still exist. Unknown Task ids are dropped.

### The Report

The Report is a JSON document with:

- the Report format version, the framework version, and the Activity id, version, title and course line;
- the student name and the Run fingerprint;
- the Run's start and download timestamps;
- Parts → Tasks → Attempts, with snapshot PNG data URLs on passing Attempts only;
- points earned and possible, for each Task and in total;
- a checksum over all of the above.

Further details:

- The filename combines the Activity id, the student name and the date.
- Downloading is allowed at any time, and partial work is represented faithfully.
- The checksum and the encoding of answer keys only deter cheating (ADR 0001). The keying material ships in the client.
- Answer keys and targets are stored in a lightweight encoded form, not plain text. Encoding happens at authoring time with a helper the framework provides, either a small authoring page or a function the author runs in the browser console.

### Scoring

- Points are additive. A Task and each of its Questions carry their own points, and a Task's possible points are its own points plus those of its Questions.
- A Task's own points are awarded if it ever passed. Misses cost nothing.
- A graded Question earns its points once it has been answered correctly in any Attempt. A Task can't pass until all of its graded Questions pass, so these points always arrive by the time the Task passes.
- A free-text Question earns its points if the answer isn't empty.
- The Report Viewer recomputes scores from the Attempts rather than trusting the totals stored in the Report.

### The Report Viewer

- It is a static page in the framework that runs entirely client-side. No file leaves the browser.
- **One Report dropped in:** a readable student view with Print / Save as PDF.
- **A Brightspace bulk-download zip (or many Reports) dropped in:**
  - **Matching:** each Report is matched to its uploader using the zip's folder and file names.
  - **Class table:** name, Tasks passed, Attempts, points and flags.
  - **Detail:** a page for each student.
  - **Flags:**
    - a Run fingerprint shared across uploaders;
    - an identical Attempt history across uploaders;
    - a loose (fuzzy) mismatch between the sealed name and the uploader's name, shown as a warning;
    - a checksum failure;
    - an Activity id or version that differs from the class majority.
  - **Grades CSV export:** the exact columns are deferred until a real Brightspace bulk-download zip and grades export have been inspected. The export is designed in, but its format stays provisional.
- It reads Reports from every Report format version that is still in use.

### The oscilloscope port

- **The oscilloscope Tool:**
  - It has one Mode (the dual-trace scope).
  - It has the existing signal Controls (sliders with number boxes and resets).
  - The draggable Δt marker is a registered Control, so it can be locked like any slider.
  - It has a Plotly Display and live metrics (phase φ, period T, peak-to-peak) published as State with units.
- **The Activity:**
  - Part 1 is the phase shift. Part 2 is period and amplitude. Both use the same Mode with different Setups.
  - The existing Tasks are carried over faithfully: φ = π/2 ± 0.05, T = 3 ± 0.05, pk-pk = 4 ± 0.05, with Δt locked after Task 1.1, and the free-text Question after Task 1.2.
  - The old per-task code is replaced by data.
- **Look:** the old apps' cream and serif theme becomes the v1 theme. The visual refresh prototype is a separate later step.

## Testing Decisions

- **What a good test is:** it tests behaviour through a module's public interface (Activity definition and Submits in, Report out; Reports in, table, flags and CSV out). It never tests internals such as storage key formats or DOM structure.
- **Seam 1: Activity runner core.** Tested in Node's built-in test runner with no dependencies. The inputs are:
  - an Activity definition;
  - a stub Tool that exposes settable State and Control handles;
  - a scripted sequence of State changes and Submits.

  The tests check the resulting Report and the Control exposure after each step:
  - Attempts are recorded with their State;
  - only Submitted values are evaluated;
  - passes freeze the Task and unlock the next one;
  - Hints appear after N misses;
  - points follow the scoring rules;
  - the checksum verifies, and fails after any edit;
  - the name and fingerprint are fixed for the Run;
  - restoring after an Activity version change keeps matching Task ids;
  - custom Condition types and the function escape hatch work.
- **Seam 2: Report Viewer core.** Tested in Node's test runner. The inputs are fixture Reports plus uploader names shaped like a Brightspace bulk download. The tests check:
  - the class table;
  - the shared-fingerprint, identical-history, name-mismatch (fuzzy, with tolerance for case, middle names and nicknames), tamper and wrong-version flags;
  - scores recomputed from the Attempts;
  - the CSV output (provisional columns).
- **Seam 3: browser tests.** These use Playwright, the only npm dev dependency; it is needed only for testing, never for serving. They drive the real oscilloscope Activity:
  - the name gate blocks Part 1;
  - the exposure rules show, lock and hide the expected Controls, including the Δt marker;
  - dragging through the target without Submitting doesn't pass;
  - a Submit at the target passes and unlocks the next Task;
  - a reload restores progress;
  - the downloaded Report has the expected shape and opens in the Report Viewer's student view;
  - Standalone mode shows every Control.
- **Prior art:** none in the repo; these are its first tests. Fixtures for the Report Viewer are generated by the runner core itself so that the schemas stay in sync.

## Out of Scope

- Porting conductor_properties (the next port, as an electrostatics Tool with three Modes), spacetime, least-squares, maxwell-construction, vernier-trainer and the K-Map editor.
- The visual refresh. It is a separate prototype that compares variants against the oscilloscope Activity.
- The final grades CSV column format, pending a real Brightspace export.
- Any server, real integrity guarantees, LMS integration (LTI) or automatic upload to Brightspace.
- Phone-first layout. Laptops are the target.
- Instructor-entered manual scores in the Report Viewer. Free text is auto-awarded when it isn't empty.

## Further Notes

- **Source for the port:** the newest version of the oscilloscope lab only exists outside the repo, as the Downloads copy "oscilloscope_lab (8).html". It should be copied into the repo (alongside the finished apps) as the reference for the port.
- **Prior examples in the repo:**
  - conductor_properties already has a data-driven task list and a documented catalogue of the variables available to conditions. Both are good references for the Condition registry and the State naming.
  - maxwell-construction is prior art for hints after misses.
  - spacetime is prior art for autosave and share links.
- **Brightspace file types:** the assignment folder must allow `.json` uploads.
