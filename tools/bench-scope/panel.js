// Panel binding: the thin DOM layer between a skin's front-panel SVG and the engine.
// Prototype: the "Oscilloscope panels: control test" artifact (wheel turns, click pushes).
//
// createPanel({ svgText, model, onEvent }) -> { el, svg, canvas, controlEl(name), destroy() }
//   svgText   the skin's SVG source (../panels/<skin>.svg), inlined
//   model     the skin's entry in controls.json (controls[] with the screen rectangle)
//   onEvent   (event) => void, called with engine events: { type: 'turn', control, detents },
//             { type: 'push', control }, { type: 'press', control }, { type: 'softkey', n }
//
// The screen canvas is laid over the control map's screen rectangle in percentages of the
// viewBox, so it follows the SVG's size with no resize handling, at the native pixel size
// with pixelated scaling. Inactive controls (data-active="false") ignore input and keep the
// "not available in this simulation" tooltip the generator writes.
//
// Ticket 02 extends this: drag and arrow-key turns, knob rotation drawn from the engine's
// value, and registering every element as a Control (lock/hide).

const PRESS_MS = 120;

export function createPanel({ svgText, model, onEvent }) {
  const el = document.createElement('div');
  el.className = 'bs-panel';
  el.innerHTML = svgText;
  const svg = el.querySelector('svg');
  svg.classList.add('bs-panel-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${model.model ?? svg.dataset.model} front panel`);

  const [, , vbW, vbH] = model.viewBox;
  const screen = model.controls.find((c) => c.kind === 'screen');
  const canvas = document.createElement('canvas');
  canvas.className = 'bs-screen';
  [canvas.width, canvas.height] = screen.pixels;
  Object.assign(canvas.style, {
    left: `${(screen.x / vbW) * 100}%`,
    top: `${(screen.y / vbH) * 100}%`,
    width: `${(screen.w / vbW) * 100}%`,
    height: `${(screen.h / vbH) * 100}%`,
  });
  el.append(canvas);

  const timers = new Set();
  function flashPressed(node) {
    node.classList.add('bs-pressed');
    const t = setTimeout(() => { node.classList.remove('bs-pressed'); timers.delete(t); }, PRESS_MS);
    timers.add(t);
  }

  const controlEl = (name) => svg.querySelector(`.osc-control[data-control="${CSS.escape(name)}"]`);
  const isActive = (node) => node.dataset.active === 'true';

  function onWheel(e) {
    const node = e.target.closest?.('.osc-control[data-kind="knob"]');
    if (!node) return;
    e.preventDefault();
    if (!isActive(node)) return;
    onEvent({ type: 'turn', control: node.dataset.control, detents: e.deltaY < 0 ? 1 : -1 });
  }

  function onClick(e) {
    const node = e.target.closest?.('.osc-control');
    if (!node || !isActive(node)) return;
    const { control, kind } = node.dataset;
    if (kind === 'knob') {
      if (node.dataset.push) onEvent({ type: 'push', control });
    } else if (kind === 'softkey') {
      flashPressed(node);
      onEvent({ type: 'softkey', n: Number(control.replace('softkey-', '')) });
    } else if (kind === 'button') {
      flashPressed(node);
      onEvent({ type: 'press', control });
    }
  }

  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('click', onClick);

  return {
    el,
    svg,
    canvas,
    controlEl,
    destroy() {
      for (const t of timers) clearTimeout(t);
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('click', onClick);
      el.remove();
    },
  };
}
