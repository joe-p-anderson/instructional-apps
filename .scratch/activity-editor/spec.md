# Spec: the Activity editor

Status: ready-for-agent

Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md) (new terms: **Activity editor**, **State expression**). Builds on framework v1 ([Spec 0001](../../docs/specs/0001-framework-v1.md)). Respects [ADR 0001](../../docs/adr/0001-json-report-with-report-viewer.md), [ADR 0002](../../docs/adr/0002-one-tool-per-activity-with-modes.md) and [ADR 0003](../../docs/adr/0003-major-versioned-framework-folder.md), and adds [ADR 0004](../../docs/adr/0004-activities-stored-as-json.md) and [ADR 0005](../../docs/adr/0005-state-expression-answer-keys.md).

## Problem Statement

The instructor writes every Activity by hand as a JavaScript data module. Building or changing one means:

- **Looking things up:** Control ids, State names and Setup keys live in each Tool's source and header comments. A typo shows up only when the Activity throws in the browser.
- **Staging by hand:** a Task's show, lock and hide lists only change the Controls they name, and everything else carries over from earlier Tasks. Working out what the student actually sees at Task 6 means tracing Tasks 1 to 5 in your head.
- **Working keys out offline:** numeric answers are computed by hand or in a test, then pasted into the encoding helper, then pasted back as `enc1:` strings. A key that disagrees with the Tool is caught only by a unit test written for that purpose.
- **Testing slowly:** to try Task 6 you solve Tasks 1 to 5 in the real page, every time.
- **Writing prose blind:** prompts are HTML strings with `<sub>` and `\( \)` math inside JS string concatenation, seen rendered only in the page.

Five Activities exist (oscilloscope, electrostatics, spacetime, fourier, phasors), and each new lecture adds one. The hand-writing cost is now the bottleneck.

## Solution

An **Activity editor**: a page on the site that becomes the instructor's main way of building and changing Activities. The instructor still publishes by committing with git.

- **Opening and saving:** the instructor opens the editor in Chrome or Edge and grants it the repo folder once. An Open screen lists every Activity, searchable and filterable by course and Tool, with recent ones first. Ctrl+S saves an Activity back into the checkout, ready to commit. A new Activity starts by picking a Tool and an id; the editor writes its data file and its page.
- **The live Tool:** each Part mounts the real Tool at that Part's Mode and Setup. Control and State pickers come from that live Tool, so names can't be mistyped. The Setup is set by operating the Tool and clicking Capture, or by typing values.
- **Exposure:** on each Task, every Control is listed with what the student actually gets at that Task: open, locked or hidden. The instructor flips a three-way switch, and the editor writes the show, lock and hide lists.
- **Conditions:** a builder for target ± tolerance, equals and range, nested inside any-of and all-of groups. The State tested and the target, equals and range values can each be a State name or a **State expression**. A tolerance is a plain number, either absolute or a percentage of the target.
- **Question answers:** a numeric answer can be a typed number or a State expression such as `I * 1000` or `1/sqrt(L*C)`. The runner works it out from the live State on Submit, so the key can't disagree with what the Tool shows.
- **Prose:** prompts and Hints are written as source, with a rendered preview beside them. An info hover explains the allowed tags and the `\( \)` math.
- **Problems and preview:** a live problems list catches unknown Controls and State, bad expressions and duplicate ids. A throwaway preview runs the unsaved Activity in the real runner, starting at any Task.

Activities are stored as plain JSON instead of JS modules (ADR 0004), so the editor can open and save them faithfully. The five existing Activities are migrated once, by script, before the editor ships.

## User Stories

### Opening, creating and saving

1. As the instructor, I want to open the Activity editor from the site in Chrome or Edge, so that there's nothing to install or run.
2. As the instructor, I want to grant the editor my repo folder once and have it remembered between visits, so that I don't pick the folder every time.
3. As the instructor, I want an Open screen that lists every Activity in the repo, searchable and filterable by course and Tool, with the ones I opened recently at the top, so that I can find the one to edit however large the library grows.
4. As the instructor, I want to open an existing Activity and see every Part, Task, Condition, Question and Hint it has, so that the editor is a complete view of the file.
5. As the instructor, I want to save with Ctrl+S or a Save button, writing the Activity back into the repo folder, so that I can commit it with git straight away.
6. As the instructor, I want a saved file to be stable, formatted JSON whose unchanged parts don't move between saves, so that my git diffs show only what I changed.
7. As the instructor, I want the editor to warn me before I close or switch Activities with unsaved changes, so that I don't lose work.
8. As the instructor, I want to create a new Activity from the Open screen by choosing a Tool and giving it an id, title and course, so that I can start a new lecture exercise in seconds.
9. As the instructor, I want a new Activity to get both its data file and its page in the Tool's activities folder, so that its URL has the same shape as every other Activity and I can link it from Brightspace.
10. As the instructor, I want every Activity page to come from one fixed template, so that all Activity pages stay identical.
11. As the instructor in Firefox or Safari, I want the editor to fall back to downloading the file on save, so that I can still use it and move the file in by hand.

### Parts and Setup

12. As the instructor, I want to add, retitle, reorder and delete Parts, so that I can shape the Activity.
13. As the instructor, I want to choose each Part's Mode from the Tool's Modes, so that I can't name a Mode that doesn't exist.
14. As the instructor, I want each Part to show the live Tool mounted at that Part's Mode and Setup, so that I see what the student starts from.
15. As the instructor, I want to set a Part's Setup by operating the live Tool and clicking Capture, so that I can arrange a scenario by hand instead of typing numbers.
16. As the instructor, I want Capture to store only the Mode's Setup keys, not every State value, so that derived values like the resultant amplitude don't clutter the Setup.
17. As the instructor, I want to type or clear individual Setup values, so that I can set exact numbers like ω = 1000 rad/s.
18. As the instructor, I want a Setup value the Mode doesn't recognise listed as a problem, so that stale keys don't linger after a Tool changes.

### Tasks

19. As the instructor, I want to add, retitle, reorder, duplicate and delete Tasks within a Part, so that I can stage the exercise.
20. As the instructor, I want to set each Task's points, so that the Report Viewer scores it as I intend.
21. As the instructor, I want to add a Hint with the number of failed Attempts after which it appears, so that I can stage help.
22. As the instructor, I want optional notes on the Activity, each Part and each Task, which the runner ignores, so that my design reasoning (such as why a Setup gives a 3-4-5 triangle) stays next to what it explains.

### Exposure (active inputs)

23. As the instructor, I want each Task to list every Control of its Mode with its effective state at that Task (open, locked or hidden), so that I see exactly what the student gets without tracing earlier Tasks.
24. As the instructor, I want to change a Control's state at a Task with a three-way switch, so that staging is a click, not a list edit.
25. As the instructor, I want Controls whose state the Task changes marked as changed here, and the rest marked as inherited, so that I can tell what this Task does from what it carries over.
26. As the instructor, I want flipping a Control back to its inherited state to drop it from the Task's lists, so that the file stays minimal.
27. As the instructor, I want changing a Control at an early Task to update the effective states shown on later Tasks, so that the carry-over is always visible.
28. As the instructor, I want revealable layers to appear in the same list as the other Controls, under their labels, so that hiding a resultant is the same action as locking a slider.

    (Added after the mockup review: on a Task, the live Tool shows the student's view by default. A Student / Full toggle opens every Control while arranging the Tool; see "Editor page".)

### Conditions

29. As the instructor, I want to give a Task a Condition, or none, so that some Tasks just ask Questions.
30. As the instructor, I want to build a target ± tolerance, equals or range Condition on a State name chosen from the live Tool's State, with its unit shown, so that I can't name State that doesn't exist.

    (Added after the mockup review: the tolerance can be given in the State's unit or as a percentage of the target; see "Tolerances".)
31. As the instructor, I want a "Use current value" button that fills a target from the live Tool, so that I can set a target by arranging the Tool.
32. As the instructor, I want to group Conditions in any-of and all-of groups nested to any depth, so that every Condition the framework supports can be built.
33. As the instructor, I want to set an optional target label, so that the miss feedback reads the way I want.
34. As the instructor, I want any value slot in a Condition to take either a State name or a State expression, so that I can require ω = 1/√(LC) or |V_L − V_C| < 0.01 directly.
35. As the instructor, I want to see the Condition's result against the live Tool's current State as I edit it (pass, or the feedback a student would see), so that I can check it before previewing.

### Questions

36. As the instructor, I want to add numeric, choice and free-text Questions to a Task, with prompts and points, so that every Question kind can be authored.
37. As the instructor, I want a numeric answer to be either a typed number or a State expression, so that keys the Tool computes can't disagree with it.
38. As the instructor, I want to see what a State expression works out to at the live Tool's current State, so that I can check it while writing it.
39. As the instructor, I want tolerance presets such as "Amplitude 2%" and "Phase ±2° mod 360" that stamp plain values onto a Question, so that I set tolerances consistently without shared constants.
40. As the instructor, I want to set the tolerance (in the unit or as a percentage) and the modulus by hand as well, so that unusual Questions still fit.
41. As the instructor, I want to add, reorder and remove the choices of a choice Question and mark the correct one, so that multiple choice is quick to write.

### Prose

42. As the instructor, I want to write prompts, Hints and choice texts as raw source with the rendered result beside them, MathJax included, so that I control the markup and see what the student will see.
43. As the instructor, I want an info hover listing the HTML tags prompts use (such as `<sub>`, `<sup>`, `<b>`, `<i>`, `<br>`) and saying that math goes in `\( \)`, so that I don't have to remember the conventions.

### Answer keys and State expressions

44. As the instructor, I want to read and write every key, Condition, expression and Hint in plain text in the editor while the file stores them encoded, so that I never handle `enc1:` strings again.
45. As the instructor, I want State expressions to support arithmetic, powers, pi and e, and the usual math functions, with deg() and rad() for angles, so that I can express any key the Tools' State allows.
46. As the instructor, I want an expression that doesn't parse, or that names unknown State, listed as a problem, so that I find mistakes before students do.
47. As a student, I want a numeric Question whose answer is a State expression to be judged against what the Tool shows at the moment I Submit, so that my answer is marked against the scenario on my screen.
48. As the instructor, I want each judged Question in an Attempt to record the expected value it was judged against, so that I can see why a miss missed.
49. As the instructor, I want the Report Viewer to show that expected value next to the student's answer, so that grading questions are quick to settle.
50. As the instructor, I want older Reports without expected values to open exactly as before, so that last semester's Reports still read.

### Problems and preview

51. As the instructor, I want a live problems list (unknown Controls, unknown State, bad expressions, duplicate or missing ids, unknown Setup keys, anything the runner's validation rejects), so that I see every mistake as I make it.
52. As the instructor, I want each problem to link to the field that causes it, so that I can fix it in one click.
53. As the instructor, I want to save even while problems are listed, so that I can save half-finished work.
54. As the instructor, I want to preview the unsaved Activity in the real runner, so that I see exactly what students will.
55. As the instructor, I want to start the preview at any Part and Task with the earlier Tasks treated as passed, so that I can test Task 6 without solving Tasks 1 to 5.
56. As the instructor, I want the preview to be a throwaway Run that never autosaves and never touches a student's Run in the same browser, so that testing leaves no trace.
57. As the instructor, I want the preview to refuse to start while the runner would reject the Activity, saying why, so that a broken preview doesn't mislead me.

### Ids and versions

58. As the instructor, I want a new Part, Task or Question to get an id made from its title, so that I don't invent ids.
59. As the instructor, I want ids to stay frozen when I retitle, so that a typo fix doesn't wipe students' progress on that Task.
60. As the instructor, I want to rename an id by hand, with a warning that it drops student progress on that Task, so that I can still clean up ids before an Activity is used.
61. As the instructor, I want to set the Activity's version myself, so that I decide which changes matter for interpreting Reports.

### Migration and compatibility

62. As the instructor, I want the five existing Activities converted to JSON once, with constants and spreads expanded, keys still encoded and header comments moved into notes, so that they open in the editor.
63. As a student, I want every existing Activity link to keep working after the migration, so that links already in Brightspace don't break.
64. As a student with a Run in progress, I want my progress kept across the migration, so that the format change is invisible to me.
65. As the instructor, I want each Tool's Modes to declare their Setup keys, so that the editor knows what Capture stores.

## Implementation Decisions

### Activity format (ADR 0004)

- Each Activity is a JSON document with the same shape the runner already validates: id, version, title, course, tool, parts, tasks, conditions, questions, points and hints. Only plain data is allowed, so function Conditions and Activity-level registered Condition types can't be written in JSON. None of the existing Activities uses either. A Tool or `mountActivity` caller can still register Condition types.
- **New optional field:** `notes` on the Activity, each Part and each Task. It holds plain text the runner ignores; it is never shown to students and never goes in the Report. Notes are stored unencoded, so the instructor keeps answer-revealing detail out of them.
- **Activity pages:** each one is generated from a single template. The page fetches its JSON, then calls `mountActivity` as today. The page's file name and folder are unchanged, so URLs and storage keys are unchanged.
- **Encoding:** keys, Conditions, State expressions and Hint texts stay encoded with the existing `enc1:` scheme, in the same places as today. The editor decodes them on open and encodes them on save, through the existing key encoding module.
- **Saved form:** JSON with a fixed key order and two-space indent, so diffs are stable.
- **Version:** ADR 0003 treats the changes as non-breaking, so they stay in framework v1. The runner still accepts an Activity object from any source; only where the pages get it from changes.

### Migration

- **The script:** a one-off Node script imports each of the five Activity modules and writes its data as JSON. Spreads and constants come out expanded; encoded strings are copied as they are. The header comment goes into the Activity's `notes`, pasted by hand where a script can't extract it cleanly.
- **The rest of the switch:** the five pages switch to the template, the per-Activity unit tests read the JSON instead of importing the module, and the old modules are deleted.
- **Progress:** Part and Task ids don't change, so students' Runs in progress survive.

### Tool contract: Setup keys

- Each Mode declares its Setup keys: a list of State names that its mount accepts as a Setup. This is declared on the Tool's `modes` entries, so it can be read without mounting the Tool, and `defineTool` checks that it is a list of strings.
- All 8 Tools declare them, taken from the Setups each Mode reads today (the header comments and the mount code).
- A Mode's Setup keys must be names in that Mode's State. A contract test checks this for every Tool and Mode.
- **Setup options** (added after ticket 03): each Mode also declares `setupOptions`, the Setup values its mount reads that are not State, such as bench-scope's noise `seed`, the fourier synthesis `coefficientTable`, and spacetime's `names`, `grid`, `showKp`, `objs`, `tool` and `view`. `defineTool` checks it the same way (an optional list of distinct non-empty strings) and rejects a name that is in both lists. The contract test also checks that no Setup option is a State name, and that every Setup value each existing Activity uses is a Setup key or a Setup option of its Mode.
- **How the editor treats them:** Capture stores only the Setup keys and leaves any Setup option values already in the Setup untouched. Setup options are typed by hand. The problems list flags a Setup value only if it is in neither list.

### State expressions (ADR 0005)

- **A new pure module, the expression evaluator:**
  - It parses a State expression into a tree once and evaluates it against a State snapshot.
  - It reports a parse error with its position.
  - It reports the State names an expression uses, so the editor can check them.
  - It never uses `eval` or `Function`.
- **Syntax:**
  - numbers, State names, `+ − * /`, `^` for powers, unary minus and parentheses;
  - the constants `pi` and `e`;
  - functions: sqrt, abs, exp, ln, log10, sin, cos, tan, asin, acos, atan, atan2, min, max, deg and rad.
  - Trig works in radians; `deg(x)` and `rad(x)` convert. The result is always a number, and a non-finite result fails the judgement with feedback naming the expression's value.
- **Where it appears:** a numeric Question's `answer` may be a number or `{ expr }`. In a Condition, `state` may be a State name or `{ expr }`, and each of `target`, `equals`, `above` and `below` may be a number or `{ expr }`. The Condition miss feedback names the expression's value where it today names the State's value or target.
- **Tolerances stay plain numbers.** `tol`, `relTol` and `modulus` are never expressions.

### Tolerances (added after the mockup review)

- **Two kinds of tolerance:** a tolerance is either absolute or relative.
  - Absolute: `tol`, in the State's or the answer's unit.
  - Relative: `relTol`, a fraction of |target| or |answer|.
- **Questions:** numeric Questions already take either one.
- **target Conditions gain `relTol`:** a target Condition, `{ state, target, relTol }`, now accepts `relTol` as an alternative to `tol`. It passes when the value is within `relTol × |target|` of the target, where the target may be an expression worked out at Submit. Exactly one of `tol` and `relTol` is given; validation rejects both or neither. The miss feedback shows the percentage, for example `|I| = 4.1 mA; need 5.00 mA ± 2%`.
- **The editor's tolerance field:** in the builder and on numeric Questions, the tolerance is one number with a unit / % switch.
  - The unit side writes `tol`.
  - The % side writes `relTol` as the percentage ÷ 100, so typing 2 % stores `relTol: 0.02`.
  - Switching sides clears the other key.
  - The file keeps the plain fraction, as today.
- **Encoding:** an `{ expr }` value is encoded as a whole like any other key. The runner decodes it, then evaluates it at Submit against the Part's State at that moment.
- **Validation:** an Activity naming an expression that doesn't parse is rejected by the runner's validation, the same as a malformed Condition. Unknown State names can't be caught there, because State is known only once the Tool is mounted. They are reported by the editor's problems list, and at Submit as a miss with feedback naming the unknown State.

### Report: expected value

- Each judged numeric Question's result in an Attempt gains an optional expected value: the key it was judged against, whether that came from a number or an expression. Choice and text results are unchanged.
- **Format version:** the field is additive and optional, so the Report stays at format version 1, and existing readers ignore it. The framework version moves to 1.1.0, so a Report shows which runner wrote it.
- **Report Viewer:** the student view shows the expected value beside the student's answer when it is present. Scores are still recomputed from the recorded results, unchanged.

### Editor core (new, DOM-free)

A deep module behind one interface, the main new seam. It knows nothing about the page, the file system or a live Tool. It works from an Activity document and, for each Mode, its **Tool info**: Mode ids and titles, Setup keys and Setup options, Control ids and labels, State names with labels and units. The page collects Tool info by mounting each Mode once in a hidden container.

The core provides:

- **Open:** take the JSON text, decode every encoded field, and produce an editable document.
- **Edit:** apply edits to Parts, Tasks, Conditions, Questions, Hints, Setup, notes, ids and version. Each edit returns a new document, so undo and redo come from keeping the history. New ids are made from titles, as a slug unique within their scope. Retitling never changes an id.
- **Effective exposure:** for a Part and Task, each Control's state after carry-over (open, locked or hidden), and whether this Task set it or inherited it. This follows exactly the runner's rule: show opens, lock shows and locks, hide hides, applied in Task order.
- **Set exposure:** set a Control's effective state at a Task; the core rewrites that Task's show, lock and hide lists minimally. Setting a Control back to its inherited state removes it from them.
- **Problems:** the runner's own validation, plus checks against Tool info (unknown Modes, Controls and State names, and Setup values that are neither a Setup key nor a Setup option), expression parse errors, and duplicate or missing ids. Each problem carries a path to the field that causes it.
- **Save:** produce the JSON text in its saved form, encoding every field that must be encoded.
- **Preview:** produce the Activity object for the runner.

### Editor page

- **Where:** it lives with the existing authoring helper in framework v1.
- **Layout:**
  - On the left, an outline of the Activity, with its Parts and their Tasks.
  - In the middle, the form for whatever is selected (Activity, Part or Task), and the problems list.
  - **The Task form is split into tabs** (mockup variant B, chosen at review): Prompt (title, points, id, prompt), Exposure, Condition, Questions, and Hint & notes. Each tab shows how many problems it holds. Clicking a problem switches to its tab before jumping to the field. The editor remembers the open tab when you move between Tasks.
  - On the right, the live Tool mounted at the selected Part's Mode and Setup.
- **Open screen:** where you choose the Activity to edit, sized for one Activity per lecture across several courses and years.
  - **When it shows:** first, once the folder is granted; again on Ctrl+O, or by clicking the Activity title in the header. It replaces a dropdown of Tools and Activities, which doesn't scale.
  - **The table:** one searchable table of every Activity, with title, id, Tool, course, version and last modified. Typing filters on title, id and course together.
  - **Filters and sort:** filters by course (the main grouping, since the instructor looks for "this lecture in this course") and by Tool. The default sort is most recently modified.
  - **Recents:** the last few Activities opened are pinned above the table, kept in IndexedDB beside the folder handle.
  - **New Activity:** starts here (story 8), and the new Activity opens straight away.
  - **Building the list:** the editor scans `tools/*/activities/*.json` through the folder interface and reads only each file's header fields (id, title, course, version, tool), plus the file's last-modified time. Nothing is added to the Activity format, and nothing is stored beyond the recents.
- **Folder access:** the File System Access API. The folder handle is kept in IndexedDB, so the folder is remembered, and permission is asked again when the browser requires it. Where the API is missing, save downloads the file. The folder access sits behind a small interface (list folders, read file, write file), so tests can replace it with an in-memory folder.
- **The live Tool's uses:** Capture for the Setup, "Use current value" for targets, live expression values and the live Condition result. Operating it never changes the Activity unless the instructor clicks one of those.
- **Student / Full toggle:** a two-way toggle on the live Tool.
  - **Student**, the default whenever a Task is selected, mounts the Tool with that Task's effective exposure applied. Locked Controls are locked, and hidden Controls and layers are hidden, exactly as the student gets them. Flipping a Control in the exposure list updates the Tool at once.
  - **Full** opens every Control, so the instructor can arrange the Tool for Capture or "Use current value".
  - With an Activity or Part selected there is no Task to apply, so the Tool is always Full.
  - The toggle only changes the view. It never changes the Activity or the live State.
- **Preview:**
  - It mounts the runner with autosave off, under a preview Activity id, in a pane or a new tab.
  - To start at a given Task, it marks the earlier Tasks as passed without Attempts. That is done through a preview-only runner option. It never appears in a student's Run or in a Report.
- **Prose fields:** a source box, the rendered preview typeset with MathJax, and an info hover with the tag and math conventions.
- **Tolerance presets:** they live in the editor only. Applying one writes plain tol, relTol and modulus values onto the Question.

### Delivery order

The editor's look and feel are checked before any editor UI is built:

1. **UI mockup first.** A throwaway, clickable mockup of the editor page with fake data and no real Tool, folder or runner. It shows:
   - the outline;
   - a Part with its Setup and Capture;
   - a Task with the exposure list, a nested Condition, a numeric Question with an expression answer, the prose box with preview and info hover;
   - the problems list and the preview launcher.

   The instructor reviews it for usability, and the editor page tickets start only once the instructor approves it. Its changes go back into this spec.
2. In parallel with the mockup (no UI): State expressions in the runner, expected values in the Report and the Report Viewer, Setup keys on all Tools, and the JSON migration.
3. The editor core.
4. The editor page, built to the approved mockup: open and save, then Parts and Setup, then Tasks and exposure, then Conditions and Questions, then prose, problems and preview.

## Testing Decisions

A good test drives a module through its public interface and checks observable results: a judgement and its feedback, a saved JSON text, a list of problems, what the page shows. It never checks internal structure, so the implementation can change freely.

- **Runner core (existing seam, Node):** createRunner judges Questions and Conditions whose values are State expressions against the State at Submit. The cases cover a correct and a wrong answer, the expected value recorded in the Attempt, an unknown State name, and a non-finite result. Encoded expressions are decoded. Validation rejects an expression that doesn't parse. A target Condition with `relTol` passes and misses at the right bounds, including against an expression target. Validation rejects one with both `tol` and `relTol`, or neither. Prior art: the existing runner tests in the unit runner folder.
- **Expression evaluator (Node):** a table of expressions and snapshots with their values, covering operator precedence, the right associativity of `^`, unary minus, every function, and deg and rad. Parse errors give a position. It reports the State names an expression uses. Inputs that would need `eval` are refused.
- **Report and Report Viewer (Node):** a sealed Report with expected values verifies, opens, and shows the values in the student view. An older fixture without them opens unchanged, and its scores are unchanged. Prior art: the report and report-viewer unit tests and their fixtures.
- **Tool contract (Node, plus a Playwright contract test since Tools need a DOM):** `defineTool` rejects bad Setup key and Setup option declarations. A contract test mounts every Tool and Mode and checks that each Setup key is a State name and no Setup option is, and that every existing Activity's Setup values are declared. Prior art: the framework unit tests.
- **Migration (existing specs):** every Activity's existing unit test, switched to read the JSON, passes with no other change to its assertions, including the keys-agree-with-the-engine checks. Every existing Activity e2e spec passes unchanged, which checks the page, staging, judging and Report.
- **Editor core (new seam, Node):** open each migrated Activity, save it unchanged, and require output byte-identical to the file. Other cases:
  - every edit kind;
  - effective exposure matching the runner's carry-over on every existing Activity;
  - set exposure writing minimal lists, and setting a Control back to its inherited state removing it from them;
  - id generation and ids frozen on retitle;
  - the problems list, case by case;
  - encoded fields encoded on save and decoded on open.
- **Editor page (Playwright, in-memory folder):** a short set of journeys:
  - open an Activity, retitle a Task, save, and check the written JSON;
  - create a new Activity and check that both files are written;
  - flip a Control at an early Task and see later Tasks' effective states change;
  - build a nested Condition and see its live result;
  - an expression answer showing its live value;
  - a problem linking to its field;
  - a preview started at a later Task.

  Prior art: the existing e2e specs, such as the encode-keys spec for the authoring helper.
- **Display fit and the other cross-Tool e2e checks:** unchanged. The migrated Activity pages must still pass them.

## Out of Scope

- Colleagues authoring: anyone other than the instructor, authoring without git, and publishing without a commit.
- A backend, accounts, or Activities packed into URLs.
- Committing or pushing from the editor; git stays outside it.
- Writing function Conditions or registered Condition types in an Activity.
- A rich-text (WYSIWYG) prompt editor.
- A whole-Part exposure grid; exposure is edited one Task at a time.
- Bumping the Activity version automatically.
- Hiding notes from students. Notes are stored plain, and the instructor keeps revealing detail out of them.
- Changing Panel layouts, Tools' Controls, or the runner's carry-over rule.
- Rewriting existing Activities' numeric keys as State expressions. They can be converted later, Task by Task, in the editor.

## Further Notes

- **Mockup gate:** the UI mockup is the first editor deliverable, so the instructor can check it matches the usability they expect. Nothing in step 4 of the delivery order starts until it is approved, and any changes it prompts are written back into this spec first.
- **State in a Run:** expression keys follow the live State at Submit. If a Task leaves a Control open, the key moves with what the student sets. That is intended, and it is what makes such keys safe against a student who changes the scenario.
- **Unknown State is not caught before a Run:** the runner can't check expression State names until the Tool is mounted. The editor's problems list is the main defence, and the miss feedback at Submit is the fallback.
- **Browsers:** the File System Access API is Chromium-only. The download fallback keeps the editor usable elsewhere, but the instructor's daily use assumes Chrome or Edge.
