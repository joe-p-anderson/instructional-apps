# Framework v1

Static ES modules and CSS, served as-is (no build, no install). Breaking changes go to `framework/v2/` (ADR 0003). Vocabulary follows `GLOSSARY.md`; design in `docs/specs/0001-framework-v1.md`.

| Module | What it is |
| --- | --- |
| `tool.js` | **The Tool contract** (documented in its header comment), `defineTool()` validator, `createEmitter()`. No DOM, so it can be imported from Node. |
| `control.js` | `createControl()`: base implementation of the Control interface (lock/unlock, show/hide). Lock disables every input, button, select and textarea in the Control's `el`, and `el` itself when it is one (so a bare `<button>` can be the `el`). Use it for custom Controls such as draggable markers. |
| `ui-kit.js` | Standard Controls: `slider` (with number box and reset; `log: true` for a logarithmic scale), `toggle`, `select`, `button` (optional `title`; a locked button is disabled and neither a click nor `set()` presses it); `toggle` and `button` also take `onLock`/`onHide` for extra work. Plus `menuButton({ items })` (the header's ⋯ menu: a keyboard-operable WAI-ARIA menu button; `add(item, { before })` adds items later), `metric` readout, `section`, `h()` element helper, `escapeHtml(s)`, and `themeVars(el, { key: '--fw-var' })`: theme variables as computed at `el` (the v1 palette while `el` is not in a page), the one way to read drawing colours for canvas, SVG rendered to PNG and Plotly. |
| `handle.js` | Two more kit Controls, re-exported by `ui-kit.js` (full options in its header comment). `handle`: a draggable handle, 1-D (`role="slider"`, `min`/`max`/`step`/`coarse`, `reversed` for a value that grows leftwards or downwards) or 2-D (`x: {...}, y: {...}`, value `{ x, y }`; a focusable group described by both coordinates). Arrow keys nudge it, Shift+arrow moves `coarse`, Home/End go to the bounds (1-D); pointer drags use `touch-action: none`. The Tool supplies the mapping: `toScreen(value) -> { x, y }` client position (the kit then places its `.fw-handle` over that point; call `place()` after a resize) and `fromScreen(clientX, clientY) -> value` for drags; or pass its own `el` (e.g. an SVG shape) and draw it. `update(value)` shows a value without `onChange`. Put kit handles in a `.fw-handle-layer` over the Display. `knob`: bench-scope's rotary pattern (`role="slider"`; arrows turn, Enter/Space push, wheel, vertical drag, click pushes) with `onTurn(detents)`/`onPush()`, on its own `.fw-knob` or a given `el`; `refresh()` redraws its value. Both lock, hide, get and set like any Control. |
| `theme.css` | The v1 Refined Cream theme (cream and serif, WCAG AA text contrast) and layout classes (`.fw-*`). Self-hosts Libre Baskerville from `vendor/libre-baskerville/` (SIL OFL, `OFL.txt` there). Its `:root` variables (`--fw-blue`, `--fw-surface`, `--fw-paper` for a white drawing ground, ...) are also the drawing colours; keep `themeVars`' fallback palette in `ui-kit.js` in step. Exposes plot tokens `--fw-plot-*` (background, grid, axis, text, ink, muted, trace-1..3, font, font-size), also in that fallback palette. |
| `plot-theme.js` | `plotTheme(el?)`: the `--fw-plot-*` tokens as computed at `el` (default: the root element), as `{ background, grid, axis, text, ink, muted, traces, font: { family, size } }`: the plot-shaped view of the theme for a Tool's plots. Built on `themeVars`, so it shares its fallback (the v1 plot palette). Call it at mount. |
| `tool-host.js` | `mountStandalone(tool, root)`: Standalone mode, one tab per Mode, every Control unlocked, State autosaved per Tool and Mode, `#s=` share link (Copy share link in the ⋯ menu). Also exports `createFrame`/`createTabs` for the Activity runner UI; see "Frame and header" below. |
| `persistence.js` | Autosave (`standaloneStore(toolId, modeId)`, `runStore(activityId)`, the site-wide student name `nameStore()`, `createStore(key, storage)`, `browserStorage()`) and `#s=` share links (`shareHash`/`readShareHash`). No DOM. |
| `runner/` | Activity runner core (pure logic, no DOM). `await runner.report()` assembles the sealed Report so far, also in Node (fixtures); `runner.save()`/`restore()` carry the Run, including unsubmitted Question drafts (`runner.draft()`). `runner.submit()` refuses a Submit whose State and answers deep-equal the Task's last Attempt when that Attempt missed (canonical form, as the Report checksum): it returns `{ refused: true, reason: 'unchanged', feedback, hint }`, records no Attempt and doesn't bring the Hint closer, so refused Submits never reach the Report; the Task card shows "Nothing changed since your last try". Every Submit result briefly emphasises the Task's feedback line (a polite live region; static under `prefers-reduced-motion`). `runner/questions.js`: `questionKinds`, the one table of Question kinds (validation and judging). `runner/scoring.js`: the scoring rules (`scoreActivity`, `earnedFromResults`). `runner/keys.js`: encoded answer keys (`encodeKey`/`decodeKey`); the runner and scoring decode them, and an encoded Hint text is decoded only when the Hint is revealed. |
| `report.js` | **The Report format**: schema (header comment), `sealReport`/`verifyReport`/`checksumOf` (keyed SHA-256 over canonical JSON), `readReport(text)`, `reportFilename`, `createFingerprint`, `REPORT_FORMAT_VERSION`, `FRAMEWORK_VERSION`. No DOM. |
| `authoring/encode-keys.html` | Authoring helper: paste a Condition, Question key or Hint text (JS expression), copy the `enc1:` string into the Activity in its place. Also exposes `encodeKey()`/`decodeKey()` in the console. Deters casual cheating only (ADR 0001). |
| `activity-ui.js` | Activity runner UI: `mountActivity(tool, activity, root)`, a thin DOM layer over the core (name gate, Part tabs each with its own Tool instance, Task cards with Submit/feedback/Hint, per-Part progress, Download Report, and Start over, Print and "Not <name>? Sign out" in the ⋯ menu). A reload restores the Run under its sealed name, including Question answers and the last miss feedback. The name entered at the name gate is stored for the whole site: an Activity with no saved Run starts at once under the stored name, Start over begins a new Run under it, and sign-out (confirmed) forgets it and discards only this Activity's Run before showing the name gate. |
| `report-viewer/` | **The Report Viewer** page, `report-viewer/index.html` (client-side only; no file leaves the browser). The core is DOM-free and tested in Node; every score is recomputed from the Attempts' recorded results with the runner's scoring rules (`earnedFromResults` in `runner/scoring.js`). See the table below. |
| `vendor.js` | Loaders for the vendored, pinned libraries in `vendor/` (`loadPlotly()`, `loadMathJax()`, `typeset(elements)`). |

### Report Viewer modules (`report-viewer/`)

| Module | What it is |
| --- | --- |
| `core.js` | `openReport(text)`: one Report into a plain student view, dispatching on Report format version through its `readers` table (`READABLE_FORMAT_VERSIONS`). `uploaderFromPath(path)`: uploader, upload id and date from Brightspace bulk-download naming (provisional). `await readUploads(files)`: expands zips and keeps the `.json` Reports. `openClass(uploads) -> { rows, errors }`: the class table, one row per readable Report (name, Tasks passed, Attempts, points, flags, student view), sorted by name; unreadable files are listed as errors. |
| `flags.js` | `flagClass(rows)`, called by `openClass`: flags a Run fingerprint shared across uploaders, an identical Attempt history across uploaders (State, answers and outcomes, ignoring times; only when it contains a failed Attempt), a checksum failure and an Activity id or version that differs from the class majority; warns on a loose sealed-name / uploader mismatch (`namesMatch`, also re-exported from `core.js`). Flags never change a score. |
| `grades-csv.js` | `gradesCsv(rows, { item })`: the grades CSV for Brightspace import, built from the class rows with the recomputed points. Its columns are provisional until checked against a real Brightspace export. |
| `zip.js` | `isZip(bytes)`, `await readZip(bytes)`: a small dependency-free zip reader (stored and deflate entries via `DecompressionStream`) for the Brightspace bulk download. |
| `ui.js` | `mountReportViewer(root)`: the thin DOM layer. Drop or choose files: one Report opens in the student view (Print / Save as PDF); a zip or many Reports open as the class table (Flags column, click a student for their view and Back to class, Export grades CSV). |

## Opening an Activity

Each Activity is a pure-data module plus a tiny HTML page beside it, so the URL identifies one Activity:
`tools/oscilloscope/activities/phase-period-amplitude.html` loads `phase-period-amplitude.js` and calls
`mountActivity(oscilloscope, activity, root)`. Prompts may use `\( \)` math (MathJax).

## Conditions

A Task's `condition` is judged against the State only on Submit (`runner/conditions.js`). Every form except a function is plain data, so a whole Condition can be encoded with `authoring/encode-keys.html`.

| Condition | Passes when | Miss feedback |
| --- | --- | --- |
| `{ state, target, tol, targetLabel? }` | the value is within `tol` of `target` | `T = 2.50 s; need 3.00 ± 0.05 s` |
| `{ state, equals, targetLabel? }` | the value is exactly `equals` | `Coupling = DC; need AC` |
| `{ type: 'range', state, above?, below?, targetLabel? }` | the value is strictly above `above` and/or strictly below `below` (give one or both) | the bound it missed: `\|E₀\| = 0 V/m; need > 0` |
| `{ type: 'anyOf', conditions: [...] }` | at least one component passes; components may be any Condition, including registered types, functions and lists | each component's feedback: `Any one of: Coupled = false; need true — or — T = 2 s; need < 1` |
| `{ type, ...options }` | the registered evaluator says so (`conditionTypes` on the Activity, or passed to `createRunner`/`mountActivity`) | the evaluator's `feedback` |
| `(state, info) => boolean \| { pass, feedback }` | the function says so (escape hatch; can't be encoded) | its `feedback` |
| `[condition, ...]` | every component passes; one result is recorded per component | per component |

`targetLabel` replaces the generated "need …" text. A registered evaluator is `(condition, state, info, { evaluate }) => { pass, feedback? }`; `evaluate(inner)` judges a nested Condition.

## Tool contract in brief

```js
// A Tool module default-exports:
{ id, title, modes: [{ id, title }], layout?, minDisplayWidth?, mount(container, modeId, setup) }   // mount -> instance

// instance
{
  state: {
    snapshot(),              // { phi: 0.785, T: 2, ... }  plain snapshot
    describe(),              // { phi: { label: 'Phase shift φ', unit: 'rad' }, ... }
    onChange(fn),            // fn(snapshot) on every State change; returns unsubscribe
  },
  controls: { get(id), ids() },  // Control: { id, label, get, set, lock, unlock, isLocked, hide, show, isHidden }
  displays: [{ id, label, snapshot(), toScreen?(x, y) }],  // snapshot(): Promise<PNG data URL>
                                          // toScreen: client pixel position of a plot point, or null until laid out

  serialize(), restore(saved),
  resize?(), destroy?(),
}
```

Tools keep no global state; mount the same Tool as many times as needed. Example: `tools/oscilloscope/`.

### Frame and header

`createFrame` (in `tool-host.js`) builds the page frame shared by Standalone mode and the Activity runner: a
single-row header above the panel area. The header row holds, in order, the title, the course in dim text, the
tablist (Modes or Parts), and the actions cluster, which ends with the ⋯ menu. When the row is tight the course
truncates with an ellipsis first, then the tabs wrap onto more lines in their own column; the title and the
actions never wrap.

| | Title | Course | Actions | ⋯ menu |
| --- | --- | --- | --- | --- |
| Activity | `activity.title` (never the Tool's name) | `activity.course` | student's name (the Run's), Download Report | Start over, Print, Not <name>? Sign out |
| Standalone | the Tool's title | none | ("Link copied" note) | Copy share link, Print |

The frame returns `addAction(el)`, which adds to the actions cluster before the ⋯ menu, and `menu`, whose
`add({ id, label, onSelect }, { before })` adds a menu item. The ⋯ menu opens with Enter, Space or the arrow
keys, moves with the arrow keys, Home and End, and closes with Escape, returning focus to its button.

### Panel layouts

`layout` is optional: `'side'` (the default), `'strip'` or `'banner'`, checked by `defineTool()`. It is fixed per
Tool; an Activity cannot change it. The frame (`createFrame` in `tool-host.js`) puts `fw-layout-<layout>` on
`.fw-app`, in Standalone mode and in the Activity runner, and the layout rules live in `theme.css` keyed on it.
The Tool itself builds `.fw-tool` with `.fw-controls` (made of `.fw-section`s) and `.fw-displays`. A Tool may
refine a layout for its own Controls or Display (sizes, spacing, how a section's Controls are arranged) in its
own CSS, scoped under its root class, such as bench-scope's compact Controls strip under `.bs-tool`; it does not
move the panels themselves, and anything every Tool would want belongs in `theme.css`.

`minDisplayWidth` is optional: a positive number of CSS pixels, default 480, checked by `defineTool()`. It is the
narrowest the Display may get in the `side` layout; the other layouts ignore it. Declare a larger value when the
drawing becomes unreadable below it (least squares declares 760 for its Graph beside the Fit panel).

| Layout | Arrangement |
| --- | --- |
| `side` | Controls \| Display \| Tasks. Tasks stack in a 330 px column on the right; the current Task is outlined, finished Tasks show their title and result, locked Tasks one line saying why.<br>**Task drawer:** in an Activity, when the Tasks column would leave the Display narrower than `minDisplayWidth`, the frame sets `data-side-form="drawer"` on `.fw-app` (otherwise `"column"`) and the Tasks move into a bar above the Display: the current Task's number and title as an expand toggle (`aria-expanded`), its latest feedback and its Submit ("Open to answer" for a Task with Questions not yet opened). Opened, the drawer lies over the Display's right part (the Display never resizes) and shows only the current Task; Escape, the toggle or a click on the Display closes it. The switch is recomputed on resize, restyling the same DOM, so Tools are not remounted and typed answers stay. Standalone mode has no Tasks and always shows Controls \| Display. |
| `strip` | Controls \| Display, with the Tasks in a row across the bottom (the original v1 layout). |
| `banner` | The current Task is a banner above a full-width Display, the other Tasks compact steps beside it (a locked step says why it is locked); the Controls' sections sit side by side in a strip below the Display. In Standalone mode only the banner is absent. For wide Tools. |

**A Display never scrolls inside itself.** Whatever the layout, `.fw-displays` must hold its content without
overflow (its `scrollHeight` never exceeds its `clientHeight`), at 1366×768 and at the Tool's minimum Display
width, so nothing important sits below the fold. Let the main plots take the height that is left (flex) rather
than fixing tall heights, hide a plot's frame while it is switched off, and put secondary material (reading
guides, caveats, legends for rare states) in a collapsed note (`<details>`) or in the Controls column.
`tests/e2e/display-fit.spec.js` checks every Tool and Mode; add a new Tool to its list. Example:
`tools/least-squares/`.

**Display text is at least 13 px.** `--fw-plot-font-size` (13 px) is the floor for all text drawn in a Display,
canvas, SVG and Plotly alike: tick labels, captions, legends, readouts. Read it with `plotTheme()` or
`themeVars(el, { size: '--fw-plot-font-size' })` and draw at that size or larger; don't hard-code a smaller
one. The floor is for the size as shown: SVG or canvas drawn in its own units and scaled to the Display (a
`viewBox`, a native-resolution screen) must come out at 13 CSS px or more at 1366×768. **Exempt artwork:**
a picture that scales with the Display and whose printed labels are not what the student reads, such as
bench-scope's front panel, is marked with the `data-fw-artwork` attribute; text inside it is not held to the
floor. `tests/e2e/display-fit.spec.js` checks every Tool and Mode, and the Activities, at 1366×768: no visible
DOM or canvas text in `.fw-displays` under 12 px outside `[data-fw-artwork]`. Examples: `tools/least-squares/`
(canvas), `tools/bench-scope/panel.js` (the exemption).

In every layout a locked Task says which Task unlocks it, and each Part tab carries a progress badge ("1/3"),
filled once the Part is complete; the tab's accessible name reads it as "(1 of 3 Tasks done)".
