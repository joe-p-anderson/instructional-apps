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
| `runner/` | Activity runner core (pure logic, no DOM). |
| `vendor.js` | Pinned CDN loaders (`loadPlotly()`). |

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
