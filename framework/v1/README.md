# Framework v1

Static ES modules and CSS, served as-is (no build, no install). Breaking changes go to `framework/v2/` (ADR 0003). Vocabulary follows `GLOSSARY.md`; design in `docs/specs/0001-framework-v1.md`.

| Module | What it is |
| --- | --- |
| `tool.js` | **The Tool contract** (documented in its header comment), `defineTool()` validator, `createEmitter()`. No DOM, so it can be imported from Node. |
| `control.js` | `createControl()`: base implementation of the Control interface (lock/unlock, show/hide). Use it for custom Controls such as draggable markers. |
| `ui-kit.js` | Standard Controls: `slider` (with number box and reset), `toggle`, `select`, `button`; plus `metric` readout, `section`, `h()` element helper. |
| `theme.css` | The v1 cream-and-serif theme and layout classes (`.fw-*`). |
| `tool-host.js` | `mountStandalone(tool, root)`: Standalone mode, one tab per Mode, every Control unlocked, State autosaved per Tool and Mode, `#s=` share link. Also exports `createFrame`/`createTabs` for the Activity runner UI. |
| `persistence.js` | Autosave (`createStore(key, storage)`, `standaloneKey(toolId, modeId)`) and `#s=` share links (`shareHash`/`readShareHash`). No DOM. |
| `runner/` | Activity runner core (pure logic, no DOM). `await runner.report()` assembles the sealed Report so far, also in Node (fixtures). |
| `report.js` | **The Report format**: schema (header comment), `sealReport`/`verifyReport`/`checksumOf` (keyed SHA-256 over canonical JSON), `readReport(text)`, `reportFilename`, `createFingerprint`, `REPORT_FORMAT_VERSION`, `FRAMEWORK_VERSION`. No DOM. |
| `activity-ui.js` | Activity runner UI: `mountActivity(tool, activity, root)`, a thin DOM layer over the core (name gate, Part tabs each with its own Tool instance, Task cards with Submit/feedback/Hint, per-Part progress, Download Report). |
| `vendor.js` | Loaders for the vendored, pinned libraries in `vendor/` (`loadPlotly()`, `loadMathJax()`, `typeset(elements)`). |

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
  displays: [{ id, label, snapshot() }],  // snapshot(): Promise<PNG data URL>

  serialize(), restore(saved),
  resize?(), destroy?(),
}
```

Tools keep no global state; mount the same Tool as many times as needed. Example: `tools/oscilloscope/`.
