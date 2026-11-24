// Base implementation of the Control interface (see tool.js).
//
// createControl({ id, label, el, get, set, onLock, onHide })
//   el      optional root element. If given, lock disables every input/button/select inside it
//           and hide sets el.hidden. Omit it for Controls that live inside a Display.
//   get     () => value
//   set     (value) => void, applies the value like a student action would
//   onLock  optional (locked: boolean) => void, extra work on lock/unlock (e.g. redraw a marker)
//   onHide  optional (hidden: boolean) => void, extra work on hide/show

/** Wrap Controls (array or { id: Control }) as the contract's registry: { get(id), ids() }. */
export function controlRegistry(controls) {
  const map = new Map((Array.isArray(controls) ? controls : Object.values(controls)).map((c) => [c.id, c]));
  return { get: (id) => map.get(id), ids: () => [...map.keys()] };
}

const OPERABLE ='input, button, select, textarea';

export function createControl({ id, label = id, el = null, get, set, onLock, onHide }) {
  let locked = false;
  let hidden = false;

  if (el) {
    el.classList.add('fw-control');
    el.dataset.controlId = id;
  }

  function applyLock() {
    if (el) {
      el.classList.toggle('fw-locked', locked);
      for (const node of el.querySelectorAll(OPERABLE)) node.disabled = locked;
    }
    onLock?.(locked);
  }

  function applyHide() {
    if (el) el.hidden = hidden;
    onHide?.(hidden);
  }

  return {
    id,
    label,
    el,
    get,
    set,
    lock() { if (!locked) { locked = true; applyLock(); } },
    unlock() { if (locked) { locked = false; applyLock(); } },
    isLocked: () => locked,
    hide() { if (!hidden) { hidden = true; applyHide(); } },
    show() { if (hidden) { hidden = false; applyHide(); } },
    isHidden: () => hidden,
  };
}
