# Shell revision: narrow screens, compact header, visible runner state, Controls kit

Vocabulary follows GLOSSARY.md (Task drawer, Name gate, Attempt and Submit as revised 2026-11-25). Builds on framework v1 (Spec 0001) and the theme refresh, and ships in place in framework v1 as a compatible change (ADR 0003).

Status: resolved

## Problem Statement

The second UX review pass of 2026-11-25 scored Framework v1 at 7.1/10. The full review is at https://claude.ai/artifact/NDnRnLkuiL1hvuJuRS5aBM. The theme refresh fixed visual style and contrast, but three things now hold every Tool and Activity back.

- **Classroom fit dropped.** The `side` panel layout has no narrow form. On a portrait tablet (768 px wide), the 250 px Controls column and the 330 px Tasks column leave the Display 138 to 160 px wide in every Activity, so plots become unreadable strips.
- **The runner hides its own state.**
  - Pressing Submit again with the same values shows exactly the same miss text, so the student can't tell whether anything happened.
  - Three unchanged Submits unlock the Hint.
  - Autosave works but is never shown.
  - Nothing tells the student that the Activity is finished and that the Report should be downloaded.
- **The page wastes height, and the Controls kit is rough.**
  - The header (title over subtitle) and the tab row together take about 110 px of a 768 px screen.
  - Units run into labels ("f Hz").
  - Reset buttons read as values ("↻ 0.25").
  - ARIA labels are internal ids.
  - Drag handles (oscilloscope markers, electrostatics joystick, arc picker, P₁ and P₂) work only with a pointer.
  - Display text is often 7 to 11 px, which is too small on a projector.
  - The least squares Display scrolls inside itself, hiding its Fit panel.

Students also have to type their name at the start of every Activity, even on their own laptop.

## Solution

The framework gives every Tool and Activity, with no change to the Activities themselves:

- **A Task drawer.** On a narrow screen the `side` layout moves its Tasks into a Task drawer.
  - It is used whenever the Display would be narrower than the Tool's minimum Display width (480 px unless the Tool says otherwise).
  - While the drawer is closed, a bar above the Display shows the current Task's title, its Submit and the last result.
  - Opening the drawer slides it over the Display to show the whole current Task.
  - The Controls column stays where it is.
- **Full-width pages.** The page frame's 1280 px cap goes, so wide monitors and projectors give the extra width to the Display. A Tool may declare a maximum Display width (unlimited unless it does). Past that width the Display centres between the Controls and Tasks columns, which stay at the window edges.
- **A single-row header.**
  - The row holds the title, the course in dim text, the Part or Mode tabs, the student's name, the save status, Download Report, and a ⋯ menu for Start over, the share link, print and sign-out.
  - An Activity's header shows the Activity's own title, never the Tool's name.
  - Standalone mode drops its "Standalone" subtitle.
- **Visible runner state.**
  - The feedback line flashes on every Submit.
  - A Submit that repeats the previous failed Attempt exactly is refused with "Nothing changed since your last try" and is not recorded.
  - The header shows "Saved hh:mm", or a warning if saving fails.
  - When the last Task passes, a completion dialog appears once. From then on the Download Report button is highlighted as "Activity complete · Download Report".
- **A name remembered for the whole site.** The Name gate appears only when the browser has no stored name. A name entered once is used for every Activity until the student signs out from the ⋯ menu.
- **A better Controls kit.**
  - Units go in parentheses.
  - The reset button is an icon-only ↻ whose tooltip names the default value.
  - ARIA labels are the Control's label.
  - Shared keyboard- and touch-friendly handle and knob Controls replace each Tool's pointer-only drag code.
  - Rendered maths is out of the tab order.
- **Readable, fitting Displays.**
  - All drawing text is at least 13 px.
  - A Display never scrolls inside itself.
  - Both rules are checked for every Tool.

Smaller content fixes from the review ride along as their own tickets: retitling and de-spoilering the oscilloscope Activity, rewording spacetime's misses and its starting drawing tool, and finishing theme ticket 05.

## User Stories

### Narrow screens and the Task drawer

1. As a student on a portrait tablet, I want the Display to keep a usable width in an Activity, so that I can read the plot I am being asked about.
2. As a student on a narrow screen, I want the current Task's title always visible above the Display, so that I know what I am doing without opening anything.
3. As a student on a narrow screen, I want Submit in the closed Task drawer's bar, so that I can finish a Condition-only Task without opening the drawer.
4. As a student on a narrow screen, I want the last pass or miss line in the bar, so that I see the result of my Submit straight away.
5. As a student on a narrow screen, I want to open the Task drawer to see the full current Task, including its prompt, Questions and Hint, so that I can answer Questions.
6. As a student, I want the open Task drawer to slide over the Display rather than squeeze it, so that the plot doesn't reflow every time I open or close it.
7. As a student, I want the open Task drawer to show only the current Task, so that it stays short and focused.
8. As a student, I want to close the Task drawer with a button, with Escape, or by focusing the Display, so that I can get back to the plot quickly.
9. As a keyboard user, I want focus to move into the Task drawer when it opens and back to its toggle when it closes, so that I don't lose my place.
10. As a screen-reader user, I want the drawer toggle to announce whether it is expanded and which Task it holds, so that I know what opening it will show.
11. As a student, I want the Part tab badges to stay visible on a narrow screen, so that I can still see my progress through each Part.
12. As a student on a laptop or a landscape tablet, I want the full `side` layout whenever the Display has room, so that I see the Tasks and the plot together.
13. As a student, I want the page to switch between the side column and the Task drawer as I resize or rotate the device, without losing typed answers, so that rotating a tablet is safe.
14. As a Tool author, I want to declare a minimum Display width for my Tool, so that a square plot or a wide diagram switches to the Task drawer before it becomes unreadable.
15. As a Tool author, I want a sensible default minimum Display width (480 px), so that I don't have to declare one for an ordinary Tool.
16. As a Tool author, I want `defineTool()` to reject a minimum Display width that is not a positive number, so that a typo can't silently disable the Task drawer.
17. As an Activity author, I want the Task drawer to work for my Activity with no change to its data, so that existing Activities improve on their next load.
18. As a student in Standalone mode, I want nothing to change on a narrow screen apart from the header, because there are no Tasks to fold away.

### Wide screens

82. As a student watching a 1920-wide projector, I want the Display to use the full width of the screen, so that the plot is as large as the room can read.
83. As a student on a 1366 px laptop, I want the page to fill the window, so that no width is lost to side margins.
84. As a Tool author, I want to declare a maximum Display width for my Tool, so that a drawing that looks wrong stretched (a square field map, a front panel) stops growing.
85. As a Tool author, I want no maximum unless I declare one, so that ordinary resizing plots use all the room they get.
86. As a student on a very wide screen, I want the Controls and Tasks to stay at the window edges, with the Display centred between them once it reaches its maximum, so that the controls stay where I expect them.

### Header

19. As a student, I want the title, tabs and actions on one row, so that the Display gets back about 60 px of height.
20. As a student, I want the Activity's own title in the header (for example "Sinusoidal Signals"), not the Tool's name, so that I know which exercise I am in.
21. As a student, I want the course shown in dim text after the title, so that I can confirm I am in the right course.
22. As a student, I want the Part tabs to wrap onto a second row only when they don't fit, so that the header stays a single row whenever possible.
23. As a student, I want Download Report always visible in the header, so that I can hand in at any point.
24. As a student, I want Start over, the share link, print and sign-out in a ⋯ menu, so that rarely used and destructive actions are out of the way.
25. As a keyboard user, I want the ⋯ menu to open with Enter or Space, move between items with the arrow keys and close with Escape, so that it behaves like a standard menu.
26. As a student using a Tool in Standalone mode, I want just the Tool's title in the header, without a "Standalone" label.
27. As a student in Standalone mode, I want the share link in the ⋯ menu, so that I can still copy a link to my Setup.

### Submit feedback and Attempts

28. As a student, I want the feedback line to flash every time I press Submit, so that I can see my Submit registered even when the result is the same.
29. As a student, I want a Submit that repeats my last failed Attempt exactly to say "Nothing changed since your last try", so that I know to change something.
30. As a student, I want a refused Submit to not count as a miss, so that it neither counts against me nor brings the Hint closer.
31. As an instructor, I want Hints to unlock only after genuinely different failed Attempts, so that students can't get the Hint by clicking Submit three times.
32. As an instructor, I want refused Submits left out of the Report entirely, so that the Attempt history reflects real tries and duplicate-history flags aren't skewed by repeated clicks.
33. As an instructor, I want a Submit counted as an Attempt when the State is the same but the Question answers differ (or the other way round), so that a changed answer is always judged.
34. As a student, I want a Submit after a passing Attempt to be impossible as today, so that passed Tasks stay passed.
35. As a student, I want no Attempt counter or Hint countdown on the card, so that the card stays uncluttered.
36. As a student who prefers reduced motion, I want the feedback flash replaced by a non-moving emphasis, so that it doesn't animate.
37. As a screen-reader user, I want each Submit's feedback, including the refusal, announced through a live region, so that I hear the result without moving focus.

### Save status

38. As a student, I want to see "Saved" and the time of the last autosave in the header, so that I trust that my work survives a reload.
39. As a student, I want an obvious warning ("Not saved: download your Report") if the browser refuses to save, so that I download my Report before closing the tab, for example in a private window or with full storage.
40. As a student in Standalone mode, I want the same save status, so that I know my Setup is kept.
41. As a screen-reader user, I want the save status not to be announced on every autosave, but a failure to be announced once, so that I am warned without being spammed.

### Completion

42. As a student, I want a dialog when my last Task passes saying the Activity is complete, with a prominent Download Report button and where to turn it in, so that I know I am finished and what to do next.
43. As a student, I want to dismiss the completion dialog and keep using the Tool, so that I can explore further after I finish.
44. As a student, I want the dialog shown only once per Run, so that reloading a finished Activity doesn't pop it up again.
45. As a student returning to a finished Run, I want the header's Download button highlighted and labelled "Activity complete · Download Report", so that I can see the Run is done and download it.
46. As a keyboard user, I want the completion dialog to take focus, trap it while it is open and return it when it closes, so that it is usable without a mouse.

### Name gate and signing out

47. As a student, I want to type my name only the first time I use any Activity on the site in this browser, so that I don't retype it for every lecture.
48. As a student opening a new Activity with a stored name, I want the Run to start straight away under that name, so that I land on Part 1.
49. As a student, I want to see my name in the header, so that I notice if the page is using someone else's.
50. As a student on a shared lab PC, I want "Not <name>? Sign out" in the ⋯ menu, so that I can stop working under the previous student's name.
51. As a student signing out, I want a confirmation that explains this Activity's Run will be discarded and my name forgotten, so that I don't lose work by accident.
52. As a student who signs out, I want the Name gate shown again on this Activity, so that I can start a new Run under my own name.
53. As a student, I want my saved Runs in other Activities kept when I sign out here, so that one sign-out doesn't erase other work.
54. As a student who reopens another Activity after signing out, I want its saved Run restored under the name it was started with, so that a Run's name never changes after it starts. The Name gate there appears only on Start over or sign-out.
55. As a student, I want Start over to keep my stored name and start the new Run with it, so that starting over doesn't make me retype it.
56. As an instructor, I want the Report Viewer's sealed-name and uploader mismatch flag to stay as it is, so that a Run done under the wrong name on a shared PC is still caught.
57. As a student, I want the Name gate to keep showing the Activity title and course, so that I know where I am the first time.

### Controls kit

58. As a student, I want each slider's label to show its unit in parentheses ("V<sub>a</sub> (V)"), so that the label and the unit don't run together.
59. As a student, I want the reset button to be a small ↻ icon, so that it doesn't look like a value.
60. As a student, I want the reset button's tooltip to say what it resets to ("Reset to 0.25 V"), so that I know what will happen before I click.
61. As a student, I want the reset button faded while the value is already at its default, so that I can see which Controls I have changed.
62. As a screen-reader user, I want every Control's accessible name to be its visible label with the unit, not an internal id, so that I know which Control I am on.
63. As a keyboard user, I want every draggable marker, point and joystick to be focusable and movable with the arrow keys, with Shift for bigger steps, so that I can do every Task without a pointer.
64. As a screen-reader user, I want a handle to announce its name and current value (both coordinates for a 2-D handle), so that I know where it is.
65. As a tablet user, I want dragging a handle to move the handle and not scroll the page, so that touch dragging works.
66. As a Tool author, I want a 1-D and 2-D handle Control and a knob Control in the UI kit, which can be locked and hidden like any other Control, so that new Tools get keyboard and touch support for free.
67. As a Tool author, I want bench-scope's knob behaviour available as the kit's knob, so that there is one keyboard pattern for knobs.
68. As a keyboard user, I want rendered maths (MathJax) out of the tab order, so that Tab moves between Controls and Tasks only.
69. As a student, I want the oscilloscope markers, the electrostatics joystick, the arc picker and the P₁ and P₂ points converted to the kit's handle, so that the Tools in use today get these fixes.

### Displays

70. As a student watching a projector, I want all text drawn in a Display (tick labels, captions, legends, readouts) at least 13 px, so that I can read it from the back of the room.
71. As a Tool author, I want one plot font-size token that sets that floor, so that every canvas, SVG and Plotly Display uses the same size.
72. As a student, I want each Display to fit its area without scrolling inside itself, so that nothing important is hidden below the fold.
73. As a student using least squares, I want the Fit panel visible at 1366×768 without scrolling, so that I can see SSE and R² while I fit.
74. As a student using least squares, I want the residual plot's frame hidden while residuals are off, and the residual-pattern guide in a collapsible note, so that the Graph gets the space.
75. As a student using bench-scope, I want its on-screen readouts to meet the 13 px floor, so that I can read measurements. Its photographic front-panel artwork is exempt, because it scales with the Display.

### Content fixes (own tickets)

76. As a student, I want the oscilloscope's phase, period and amplitude Activity titled "Sinusoidal Signals", so that its title names the topic, not the instrument.
77. As an instructor, I want Sinusoidal Signals to hide the φ readouts while a Task asks the student to set φ, so that the student has to measure rather than match a number.
78. As an instructor, I want Sinusoidal Signals' Hints to guide the student without stating the exact value, so that the Hint teaches.
79. As a student in spacetime Lab 10, I want a miss to say what is missing in the Task's own terms ("no vertical worldline at x = 2 yet"), not in internal symbols such as u.
80. As a student in spacetime Lab 10, I want each Part to open with the drawing tool its first Task uses (Worldline for Task 1.1), so that I can start straight away.
81. As a student, I want the remaining theme ticket 05 fixes finished (no faked small caps, the electrostatics plot on the plot tokens, spacetime's shortcut letters at 4.5:1), so that the ported Tools match the theme.

## Implementation Decisions

### Tool contract

- The Tool contract gains an optional `minDisplayWidth`, a positive number of CSS pixels, defaulting to 480. `defineTool()` validates it and documents it next to `layout`. It is meaningful only for the `side` layout; the other layouts ignore it.
- The Tool contract also gains an optional `maxDisplayWidth`, a positive number of CSS pixels no smaller than `minDisplayWidth`, with no default (unlimited). `defineTool()` validates it. It applies in every layout.
- **Frame width:** the page frame loses its 1280 px max width and fills the viewport. The header row spans the full width. The Controls and Tasks columns keep their fixed widths at the window edges, and the Display region takes the rest. When that region is wider than `maxDisplayWidth`, the Display centres within it on the page background. In `banner` and `strip`, where the Display spans the width, it centres the same way.
- Each existing Tool is checked at 1920×1080 and declares a maximum where its drawing degrades when stretched. Likely candidates are electrostatics' square plots and bench-scope's panel.
- `layout` stays fixed per Tool, and an Activity still cannot change it. The Task drawer is the narrow form of `side`, not a fourth layout.

### Frame and Task drawer

- The frame (`createFrame`, shared by Standalone mode and the Activity runner) decides which form `side` takes. It watches the width available to the Display and switches to the Task drawer when the Display would fall below `minDisplayWidth` with the Tasks column shown. Whenever this changes it puts a form marker on the app, such as a data attribute, and the layout rules in `theme.css` are keyed on that marker. A media query can't do this, because the threshold varies per Tool.
- The switch is hysteresis-free but recomputed on resize, and it must not remount Tool instances or lose Question drafts. The Tasks DOM moves or restyles; it is not rebuilt.
- **Closed Task drawer:** a bar above the Display showing the current Task's number and title, its Submit button, the latest feedback line and an expand toggle with `aria-expanded`.
  - A Task with Questions can still be submitted from the bar, using the answers already typed in the drawer.
  - Before the student has opened the drawer, a Task with Questions shows "Open to answer".
- **Open Task drawer:** it overlays the right part of the Display (absolute or fixed position), so the Display never resizes. It shows only the current Task card. Escape, the toggle or a click on the Display closes it.
- Finished and locked Tasks aren't shown in Task drawer form. The Part tab badges carry progress.
- When the current Task passes, the bar moves on to the next Task, and the drawer stays open if it was open.

### Header

- The header row is one flex row, holding in order: the title, the course in dim text, the tablist, then the actions cluster (student name, save status, Download Report, the ⋯ menu button). The tablist may wrap to a second row when it doesn't fit; the title and actions never do.
- In an Activity the title is `activity.title` and the course line is `activity.course`. In Standalone mode the title is the Tool's title, and the `subtitle` option of `mountStandalone` is removed or ignored. The default "Standalone" text goes.
- The ⋯ menu is a small menu-button widget in the UI kit (keyboard behaviour as in story 25).
  - In an Activity it holds Start over, Print and "Not <name>? Sign out".
  - In Standalone mode it holds the share link and Print.
  - The share box that now sits in the Standalone header moves into the menu as a Copy share link item.

### Runner core: refused identical Submit

- `runner.submit` compares the current State snapshot and the submitted answers with the Task's last Attempt. If that Attempt failed and both are deep-equal, the Submit is refused. No Attempt is pushed, the draft is unchanged, and the Hint count doesn't advance.
- The return value distinguishes a refusal from an Attempt, for example `{ refused: true, reason: 'unchanged', feedback }`, so the UI can show "Nothing changed since your last try". Its exact shape is the implementer's choice, documented in the runner header.
- Equality uses the same canonical form the Report checksum uses, so key order doesn't matter. Snapshot images are not part of the comparison.
- The comparison is with the last Attempt only, so A, B, A records three Attempts.
- No Report format change: refused Submits never appear. The Report Viewer and scoring are untouched.

### Activity runner UI

- Every Submit result, including a refusal, re-triggers a short emphasis on the feedback line. Under `prefers-reduced-motion` it is a static emphasis instead. The feedback element is a polite live region.
- **Save status:** it lives in the header's actions cluster.
  - The persistence layer reports success or failure of each write (a callback or event on the store). The UI shows "Saved hh:mm" in muted text on success.
  - On failure it shows "Not saved: download your Report" in the miss colour, announced once through an assertive live region.
  - Standalone mode shows the same status for its autosave.
- **Completion:** when the runner reports every Task in every Part passed for the first time in this Run, the UI opens a modal dialog. It uses the native `dialog` element, so focus trapping and Escape come for free. The dialog holds:
  - "Activity complete · N of N Tasks".
  - A primary Download Report button.
  - One line on turning the Report in to Brightspace.
  - Close.
- The Run records that the completion dialog has been shown, as a flag saved with the Run, not in the Report. A reload therefore doesn't show it again.
- Whenever the Run is complete, the Download Report button gets the primary style and the label "Activity complete · Download Report".

### Name storage and sign-out

- The persistence layer gains a site-wide student-name store: one key shared by every Activity on the origin, beside the per-Activity Run stores.
- On load, a saved Run is restored as today, under its own sealed name. With no saved Run and a stored name, the runner starts at once with the stored name and the Name gate is skipped. With neither, the Name gate appears, and the name entered is stored site-wide and starts the Run.
- Start over discards this Activity's Run and starts a new Run straight away with the stored name. It reaches the Name gate only if no name is stored. Its confirm text changes to match.
- **Sign out (⋯ menu):** a confirm, then the stored name is forgotten, this Activity's saved Run is discarded and the page shows the Name gate. Other Activities' saved Runs are untouched.
- A Run's name stays fixed once started (`runner.start` is unchanged).
- The header shows the Run's name, which can differ from the stored name after a sign-out elsewhere. Sign-out's label uses the Run's name.

### UI kit

- `slider` writes its label as "Label (unit)" and its accessible names from the label, never from the id.
- Its reset becomes an icon-only ↻ button with `aria-label` and `title` "Reset to <default> <unit>", disabled while the value equals the default.
- New `handle` Control, built on `createControl()`.
  - It comes in 1-D and 2-D forms, with `role="slider"` for 1-D. For 2-D it uses a focusable group whose accessible value names both coordinates.
  - Keys: the arrow keys nudge by a step, Shift+arrow by a coarse step, and Home/End go to the bounds for 1-D.
  - It uses pointer events with `touch-action: none`.
  - Like other Controls it supports get, set, lock and hide, and it emits a change.
  - The Tool supplies the mapping between value and screen position.
- New `knob` Control: bench-scope's rotary pattern (`role="slider"`, arrow keys), moved into the kit. Bench-scope switches to it.
- The `typeset()` loader marks MathJax's output as not focusable (`tabindex="-1"` on the containers it makes focusable), keeping its assistive MathML.

### Displays

- `--fw-plot-font-size` becomes 13 px, the floor for all drawing text. `plotTheme()` and `themeVars()` keep exposing it. Tools stop hard-coding smaller sizes: spacetime ticks, least squares, the electrostatics arc-picker captions, and bench-scope's screen readouts.
- Bench-scope's photographic or SVG front-panel artwork is exempt and marked as exempt, for example with a data attribute the test honours.
- **No Display scrolls inside itself.** The `.fw-displays` area has no scroll overflow. A Tool's secondary material goes in collapsible notes or the Controls column.
- Least squares hides the residual frame while residuals are off and moves its residual-pattern guide into a collapsed note.

### Content tickets

- The oscilloscope Activity is retitled "Sinusoidal Signals". Its id is kept, so saved Runs and Reports still match. The Tool name goes from the title.
  - Tasks that ask for φ hide the φ readouts through their `hide` lists.
  - Hints are rewritten to guide without the exact value.
- Spacetime Lab 10:
  - Its registered Condition evaluators produce feedback in the Task's terms.
  - Each Part's Setup selects the drawing tool its first Task uses.
- Theme ticket 05 is finished as written.

## Testing Decisions

- A good test checks behaviour a student or author can see: what the runner API returns and records, or what the page shows and does. It never asserts on CSS class names, internal module calls or the DOM structure the frame uses internally. Geometry is checked with bounding boxes, and controls are found by role and accessible name, as the existing e2e tests do.
- **Seam 1: the runner core in Node** (prior art: the runner unit tests built on the stub Tool, such as the run and Hint-exposure tests). It covers:
  - an identical repeat of a failed Attempt is refused and records nothing;
  - a changed State alone or changed answers alone are recorded;
  - A, B, A records three Attempts;
  - a refusal doesn't advance the Hint;
  - a refusal after a pass is impossible, as before;
  - the Report built after refusals equals the Report built without them.
- **Seam 2: Playwright on the real pages and the layouts fixture** (prior art: the layouts, theme, run-persistence, report-download and ui-kit specs). Tests for:
  - **Task drawer:** at 768×1024 every `side` Activity shows the Task drawer bar, the Display is at least the Tool's minimum width, Submit from the bar passes a Condition-only Task, and the open drawer leaves the Display's box unchanged. At 1366×768 the side column is shown. Resizing between the two keeps typed answers.
  - **Header:** a single row at 1366×768, with the title, tabs and actions sharing one top offset. The Activity title has no Tool name, the course is visible, Standalone mode shows no "Standalone", and the ⋯ menu works from the keyboard.
  - **Feedback:** a repeated identical Submit shows the refusal text, and the downloaded Report has one Attempt, not two.
  - **Save status:** "Saved" appears after a change. With storage stubbed to throw, the warning appears.
  - **Completion:** passing the last Task opens the dialog once, a reload doesn't reopen it, and the Download button shows the completed label.
  - **Name:** after starting one Activity, a second Activity starts without the Name gate under the same name. Sign out shows the gate, keeps the other Activity's Run and clears this one. Start over starts with no gate.
  - **Controls:** units in parentheses. The reset's accessible name is "Reset to …" and it is disabled at the default. Every handle in every Tool can be focused and moved with the arrow keys. Tab order skips MathJax.
  - **Displays:** for every Tool and Mode at 1366×768, and at the Tool's minimum Display width, no Display text under 12 px except exempt artwork, and the Display area's scroll height does not exceed its client height.
- **Wide screens (e2e):**
  - At 1920×1080 the page frame spans the viewport on every Activity and Standalone page.
  - Controls touch the left edge and Tasks the right.
  - A Tool's Display box never exceeds its declared maximum and is centred in its region.
  - An undeclared Tool's Display fills its region.
- `defineTool()` validation of `minDisplayWidth` and `maxDisplayWidth` is checked in the existing framework unit tests (accepted, defaulted, rejected).
- No new test harness. The existing e2e helper for opening an Activity (fill the name, press Start) is updated, because the Name gate is now skipped when a name is stored. Each test starts with clean storage.

## Out of Scope

- A "repeat with new random values" Task kind for drills such as the vernier caliper. It needs runner, Report schema and Report Viewer scoring changes and gets its own spec.
- An Attempt counter or Hint countdown on Task cards (decided against).
- Per-Part completion prompts; only the Activity-level completion dialog is built.
- Collapsing or moving the Controls column on narrow screens. Phone-width layouts below the Controls column plus minimum Display width.
- Narrow forms of the `strip` and `banner` layouts. Both already give the Display full width.
- Any sign-in or identity beyond a typed, stored name. The page can't learn who the student is.
- Changes to the Report format, the Report Viewer or the duplicate flags.
- A framework v2.

## Further Notes

- The decisions come from a grilling session on 2026-11-25 over the review's second pass. GLOSSARY.md was updated during it: the Attempt entry, a new Task drawer entry, the Panel layout entry and a new Name gate entry.
- **Shared lab PCs.** A stored name persists until sign-out, so a student who forgets to sign out leaves their name for the next one. The visible name in the header, the sign-out item and the Report Viewer's name and uploader mismatch flag are the mitigations. This is accepted, not solved.
- **Course line.** Keeping the course in the header row costs width on small screens. If the row gets tight, truncate the course with an ellipsis before wrapping the tabs.
- The review's Overlap note gives the two oscilloscope Tools distinct roles ("concept" against "lab prep"). It is addressed through Activity titles naming their topic rather than through subtitles. Moving the phase-measurement question onto bench-scope is left for later.
