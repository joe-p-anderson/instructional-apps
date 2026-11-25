// A stub Tool instance that follows the spec's Tool contract:
// State (named values with label + unit, plain snapshot), change notification,
// a Control registry (get/set/lock/unlock/show/hide) and Displays with snapshot.
export function stubTool({ state = {}, controls = [], displays = ['plot'] } = {}) {
  const values = {};
  const meta = {};
  for (const [name, def] of Object.entries(state)) {
    values[name] = def.value;
    meta[name] = { label: def.label ?? name, unit: def.unit ?? '' };
  }
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  const registry = new Map();
  for (const id of controls) {
    const c = { value: undefined, locked: false, visible: true };
    registry.set(id, {
      id,
      get: () => c.value,
      set: (v) => { c.value = v; },
      lock: () => { c.locked = true; },
      unlock: () => { c.locked = false; },
      show: () => { c.visible = true; },
      hide: () => { c.visible = false; },
      // test-only inspection
      get isLocked() { return c.locked; },
      get isVisible() { return c.visible; },
    });
  }

  return {
    state: {
      snapshot: () => ({ ...values }),
      describe: () => structuredClone(meta),
      onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    },
    controls: {
      get: (id) => registry.get(id),
      ids: () => [...registry.keys()],
    },
    displays: displays.map((id) => ({ id, snapshot: () => `data:image/png;base64,${id}` })),
    serialize: () => ({ ...values }),
    restore(saved) { Object.assign(values, saved); emit(); },
    // test-only: simulate the student moving the simulation
    setState(patch) { Object.assign(values, patch); emit(); },
  };
}
