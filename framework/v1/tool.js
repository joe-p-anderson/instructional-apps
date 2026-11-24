// The Tool contract (framework v1). Pure JS, no DOM: safe to import from Node.
//
// A Tool module default-exports a Tool definition:
//
//   {
//     id: 'oscilloscope',                       // stable, used in Activities and storage keys
//     title: 'Oscilloscope',
//     modes: [{ id: 'dual-trace', title: 'Dual-trace scope' }],
//     mount(container, modeId, setup) -> ToolInstance
//   }
//
// mount() takes a DOM container, a Mode id and a Setup (plain object of starting values,
// Tool-specific; may be partial or omitted) and returns an instance. A Tool keeps no global
// state: a page may mount the same Tool many times (one instance per Part).
//
// ToolInstance:
//   stateInfo                     { [name]: { label, unit } }    static description of the State
//   getState()                    { [name]: number|boolean|string }  plain snapshot, safe to JSON
//   onChange(fn) -> unsubscribe   fn(snapshot) fires whenever the State changes
//   controls                      { [controlId]: Control }  registry, keyed by Control id
//   displays                      { [displayId]: Display }
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

/** Throw if `tool` does not look like a v1 Tool definition. Returns the tool. */
export function defineTool(tool) {
  const problems = [];
  if (!tool || typeof tool !== 'object') throw new TypeError('Tool definition must be an object');
  if (typeof tool.id !== 'string' || !tool.id) problems.push('id');
  if (typeof tool.title !== 'string') problems.push('title');
  if (!Array.isArray(tool.modes) || tool.modes.length === 0) problems.push('modes');
  else tool.modes.forEach((m, i) => { if (!m || typeof m.id !== 'string') problems.push(`modes[${i}].id`); });
  if (typeof tool.mount !== 'function') problems.push('mount');
  if (problems.length) throw new TypeError(`Invalid Tool definition: bad ${problems.join(', ')}`);
  return tool;
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
