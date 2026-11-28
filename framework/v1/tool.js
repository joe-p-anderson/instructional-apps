// The Tool contract (framework v1). Pure JS, no DOM: safe to import from Node.
//
// A Tool module default-exports a Tool definition:
//
//   {
//     id: 'oscilloscope',                       // stable, used in Activities and storage keys
//     title: 'Oscilloscope',
//     modes: [{ id: 'dual-trace', title: 'Dual-trace scope',
//               setupKeys: ['ch1Freq', 'ch1Amp'],      // see "Setup keys" below
//               setupOptions: ['seed'] }],             // optional, see below
//     layout: 'side',                           // optional panel layout, see below
//     minDisplayWidth: 480,                     // optional, CSS px, see below
//     maxDisplayWidth: 1100,                    // optional, CSS px, see below
//     mount(container, modeId, setup) -> ToolInstance
//   }
//
// setupKeys (on each modes entry) are the Mode's Setup keys: the State names its mount accepts
// as a Setup, as a list of distinct strings. Declared on the definition so they can be read
// without mounting the Tool (the Activity editor's Capture stores only these). Each one must be
// a name in that Mode's State (checked for every Tool by tests/e2e/setup-keys.spec.js).
// defineTool accepts a Mode without them, but every shipped Tool declares them on every Mode.
// setupOptions (optional, on each modes entry) are the other Setup values the Mode's mount reads:
// ones that are NOT State (a noise seed, a starting drawing tool, an extra sidebar table), as a
// list of distinct strings, none of them also a Setup key. The editor's Capture stores only the
// Setup keys and leaves Setup options as they are; options are typed by hand. A Setup value in
// neither list is unknown to the Mode. The contract test also checks that every Setup value an
// existing Activity uses is one or the other.
// layout (optional, one of LAYOUTS, default the first) is the Tool's panel layout, fixed per
// Tool. What each layout looks like: framework/v1/README.md, "Panel layouts".
// minDisplayWidth (optional, a positive number of CSS pixels, default 480) is the narrowest the
// Display may get in the `side` layout: in an Activity, when the Tasks column would leave the
// Display narrower, the Tasks move into the Task drawer. The other layouts ignore it.
// maxDisplayWidth (optional, a positive number of CSS pixels, at least minDisplayWidth; unset
// means unlimited) is the widest the Display gets, in every layout: past it the Display centres
// in its region. Declare one where a drawing degrades when stretched.
//
// mount() takes a DOM container, a Mode id and a Setup (plain object of starting values,
// Tool-specific; may be partial or omitted) and returns an instance. A Tool keeps no global
// state: a page may mount the same Tool many times (one instance per Part).
//
// ToolInstance:
//   state.snapshot()              { [name]: number|boolean|string }  plain snapshot, safe to JSON
//   state.describe()              { [name]: { label, unit } }  description of each State value
//   state.onChange(fn) -> unsub   fn(snapshot) fires whenever the State changes
//   controls.get(id) -> Control   registry keyed by Control id (see controlRegistry in control.js)
//   controls.ids() -> string[]
//   displays                      Display[]
//   serialize()                   JSON-able object that restore() accepts
//   restore(saved)                put the instance back into a serialized State (fires onChange)
//   resize()        (optional)    re-layout after the container became visible or changed size
//   destroy()       (optional)    remove listeners and DOM
//
// Control (standard ones come from ui-kit.js; custom ones such as a draggable marker
// inside a Display just implement the same shape, e.g. via createControl in control.js):
//   id, label
//   get()                         current value
//   set(value)                    set the value as if the student did (State updates, onChange fires)
//   lock() / unlock() / isLocked()   locked: visible but not operable by the student
//   hide() / show() / isHidden()     hidden: not shown at all
//
// Display:
//   id, label
//   snapshot() -> Promise<string> PNG data URL of what the Display currently shows
//   toScreen(x, y) (optional)     viewport (client) pixel position of the plot point (x, y) in
//                                 the Display's data units, or null until the Display is laid
//                                 out at its box size. Lets tests and authors aim at markers.

/** The panel layouts a Tool may declare; the first is the default. */
export const LAYOUTS = ['side', 'strip', 'banner'];

/**
 * Throw if `tool` does not look like a v1 Tool definition. Returns a copy with its layout
 * defaulted; `tool` itself is left unchanged.
 */
export function defineTool(tool) {
  const problems = [];
  if (!tool || typeof tool !== 'object') throw new TypeError('Tool definition must be an object');
  if (typeof tool.id !== 'string' || !tool.id) problems.push('id');
  if (typeof tool.title !== 'string') problems.push('title');
  if (!Array.isArray(tool.modes) || tool.modes.length === 0) problems.push('modes');
  else tool.modes.forEach((m, i) => {
    if (!m || typeof m.id !== 'string') problems.push(`modes[${i}].id`);
    else {
      const keysOk = m.setupKeys === undefined || isNameList(m.setupKeys);
      const optionsOk = m.setupOptions === undefined || isNameList(m.setupOptions);
      if (!keysOk) problems.push(`modes[${i}].setupKeys (a list of distinct State names)`);
      if (!optionsOk) problems.push(`modes[${i}].setupOptions (a list of distinct names)`);
      if (keysOk && optionsOk && m.setupKeys && m.setupOptions) {
        const both = m.setupKeys.filter((k) => m.setupOptions.includes(k));
        if (both.length) problems.push(`modes[${i}] (${both.join(', ')} both a Setup key and a Setup option)`);
      }
    }
  });
  if (typeof tool.mount !== 'function') problems.push('mount');
  const layout = tool.layout === undefined ? LAYOUTS[0] : tool.layout;
  if (!LAYOUTS.includes(layout)) problems.push(`layout (one of ${LAYOUTS.join(', ')})`);
  const minDisplayWidth = tool.minDisplayWidth === undefined ? DEFAULT_MIN_DISPLAY_WIDTH : tool.minDisplayWidth;
  if (!isPositiveNumber(minDisplayWidth)) problems.push('minDisplayWidth (a positive number of CSS pixels)');
  const { maxDisplayWidth } = tool;
  if (maxDisplayWidth !== undefined && !(isPositiveNumber(maxDisplayWidth) && maxDisplayWidth >= minDisplayWidth)) {
    problems.push('maxDisplayWidth (a positive number of CSS pixels, at least minDisplayWidth)');
  }
  if (problems.length) throw new TypeError(`Invalid Tool definition: bad ${problems.join(', ')}`);
  return { ...tool, layout, minDisplayWidth };
}

/**
 * The modes entries for a Tool built from Mode modules (each exporting id, title, setupKeys
 * and optionally setupOptions, beside its own mount): `modes: modesOf(MODES)`.
 */
export function modesOf(modules) {
  return modules.map(({ id, title, setupKeys, setupOptions }) => ({ id, title, setupKeys, setupOptions }));
}

/** The minimum Display width a Tool gets when it declares none, in CSS pixels. */
export const DEFAULT_MIN_DISPLAY_WIDTH = 480;

function isNameList(keys) {
  return Array.isArray(keys)
    && keys.every((k) => typeof k === 'string' && k !== '')
    && new Set(keys).size === keys.length;
}

function isPositiveNumber(x) {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

/** Minimal listener set used by Tools for onChange. */
export function createEmitter() {
  const listeners = new Set();
  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(value) {
      for (const fn of [...listeners]) fn(value);
    },
    clear() {
      listeners.clear();
    },
  };
}
