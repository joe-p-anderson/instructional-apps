# Framework v1

Static ES modules and CSS, served as-is (no build, no install). Breaking changes go to `framework/v2/` (ADR 0003). Vocabulary follows `GLOSSARY.md`; design in `docs/specs/0001-framework-v1.md`.

| Module | What it is |
| --- | --- |
| `tool.js` | **The Tool contract** (documented in its header comment), `defineTool()` validator, `createEmitter()`. No DOM, so it can be imported from Node. |
| `control.js` | `createControl()`: base implementation of the Control interface (lock/unlock, show/hide). Use it for custom Controls such as draggable markers. |
| `ui-kit.js` | Standard Controls: `slider` (with number box and reset; `log: true` for a logarithmic scale), `toggle`, `select`, `button`; plus `metric` readout, `section`, `h()` element helper. |
| `theme.css` | The v1 Refined Cream theme (cream and serif, WCAG AA text contrast) and layout classes (`.fw-*`). Self-hosts Libre Baskerville from `vendor/libre-baskerville/` (SIL OFL, `OFL.txt` there). Exposes plot tokens `--fw-plot-*` (background, grid, axis, text, ink, muted, trace-1..3, font, font-size). |
| `plot-theme.js` | `plotTheme(el?)`: the `--fw-plot-*` tokens as `{ background, grid, axis, text, ink, muted, traces, font: { family, size } }`, so a Tool's plots follow the theme instead of hard-coding a palette. Call it at mount; it throws, naming the token, if `theme.css` is not loaded. |
| `tool-host.js` | `mountStandalone(tool, root)`: Standalone mode, one tab per Mode, every Control unlocked, State autosaved per Tool and Mode, `#s=` share link. Also exports `createFrame`/`createTabs` for the Activity runner UI. |
| `persistence.js` | Autosave (`standaloneStore(toolId, modeId)`, `runStore(activityId)`, `createStore(key, storage)`, `browserStorage()`) and `#s=` share links (`shareHash`/`readShareHash`). No DOM. |
| `runner/` | Activity runner core (pure logic, no DOM). `await runner.report()` assembles the sealed Report so far, also in Node (fixtures); `runner.save()`/`restore()` carry the Run, including unsubmitted Question drafts (`runner.draft()`). `runner/questions.js`: `questionKinds`, the one table of Question kinds (validation and judging). `runner/scoring.js`: the scoring rules (`scoreActivity`, `earnedFromResults`). `runner/keys.js`: encoded answer keys (`encodeKey`/`decodeKey`); the runner and scoring decode them, and an encoded Hint text is decoded only when the Hint is revealed. |
| `report.js` | **The Report format**: schema (header comment), `sealReport`/`verifyReport`/`checksumOf` (keyed SHA-256 over canonical JSON), `readReport(text)`, `reportFilename`, `createFingerprint`, `REPORT_FORMAT_VERSION`, `FRAMEWORK_VERSION`. No DOM. |
| `authoring/encode-keys.html` | Authoring helper: paste a Condition, Question key or Hint text (JS expression), copy the `enc1:` string into the Activity in its place. Also exposes `encodeKey()`/`decodeKey()` in the console. Deters casual cheating only (ADR 0001). |
| `activity-ui.js` | Activity runner UI: `mountActivity(tool, activity, root)`, a thin DOM layer over the core (name gate, Part tabs each with its own Tool instance, Task cards with Submit/feedback/Hint, per-Part progress, Download Report, Start over). A reload restores the Run, including Question answers and the last miss feedback. |
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

## Tool contract in brief

```js
// A Tool module default-exports:
{ id, title, modes: [{ id, title }], mount(container, modeId, setup) }   // mount -> instance

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
