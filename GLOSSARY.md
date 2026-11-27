# Instructional Apps

Interactive single-page lecture activities: a simulation that students manipulate through a guided, staged series of tasks, ending in a file they turn in.

## Language

**Tool**:
A simulation with its own Controls and Displays, usable on its own indefinitely, independent of any lecture.
_Avoid_: app, sim, widget

**Standalone mode**:
Using a Tool with no Activity loaded: every Control available, work autosaved, no Tasks and no Report.
_Avoid_: free play, sandbox

**Mode**:
One of the distinct interactions a Tool offers (e.g. electric field, potential, Gauss's law within an electrostatics Tool).
_Avoid_: view, tab, screen

**Setup**:
The starting values a Tool is put into, such as preset Control values or a chosen Mode.
_Avoid_: preset, config, initial state

**Activity**:
A guided lecture exercise built on a single Tool: an ordered set of Parts that ends in a Report. One Tool can host many Activities.
_Avoid_: app, lab, assignment

**Part**:
One major section of an Activity, shown to the student as a tab: a Mode and Setup of the Tool, with its own State and an ordered list of Tasks.
_Avoid_: tab, experiment, stage, section

**Task**:
One step within a Part: the Controls it exposes, an optional Condition, and its Questions.
_Avoid_: step, stage, exercise

**Control**:
An input the student uses to change the simulation (slider, toggle, draggable marker).
_Avoid_: knob, widget, input

**Display**:
A view that renders the simulation for the student (plot, diagram, canvas).
_Avoid_: graph, panel, view

**Panel layout**:
How the page arranges a Tool's Controls and Displays and an Activity's Tasks: `side`, `strip` or `banner`. Fixed per Tool; an Activity cannot change it. When the screen is too narrow for the Tool's Display, `side` moves its Tasks into the Task drawer.
_Avoid_: theme, skin, template

**Task drawer**:
The narrow-screen home of a `side` layout's Tasks: a bar above the Display with the current Task's title, Submit and last result, which opens over the Display to show the whole current Task.
_Avoid_: tasks panel, sidebar

**Revealable layer**:
A part of a Display that a Task can hide while it asks the student for that quantity and a later Task shows again (e.g. the resultant phasor, or Z_total). It is a Control, so Task hide and show lists act on it; hiding it hides its drawing and its readouts, while State keeps publishing its values.
_Avoid_: overlay, reveal, mask

**State**:
The named values a simulation exposes for tasks to read and record.
_Avoid_: params, sim variables

**Condition**:
A test on the State that a task requires to pass; it judges what the student did in the simulation, not what they wrote.
_Avoid_: check, goal

**Question**:
Something a task asks the student to answer; either graded (numeric with tolerance, multiple choice) or recorded only (free text).
_Avoid_: prompt, reflection

**Submit**:
The student's deliberate act of committing the current state of a task for evaluation; values the student merely passes through are never evaluated.
_Avoid_: check, submission

**Attempt**:
One Submit of a task, with the State and answers at that moment and whether it passed. A Submit that repeats the previous failed Attempt's State and answers exactly is refused and is not an Attempt.
_Avoid_: try, submission

**Hint**:
Guidance a Task reveals after a set number of failed Attempts.
_Avoid_: help, tip

**Run**:
One student's work through an Activity in one browser, from first load onward; every Report from it carries the same Run fingerprint and the student's name.
_Avoid_: session, attempt (an Attempt is one Submit within a Run)

**Name gate**:
The screen that asks for the student's name before a Run starts. It is shown only when the browser has no stored name; a name entered once is used for every Activity on the site until the student signs out.
_Avoid_: login, sign-in screen

**Report**:
The file a student downloads from an Activity and turns in to Brightspace, holding their name, Attempts, answers and snapshots from one Run. It may be partial.
_Avoid_: submission, PDF, assignment

**Report Viewer**:
The page for opening Reports: instructors open a class's Reports together to check for duplicates, score and export grades; students open their own Report to read or print it.
_Avoid_: grader, dashboard
