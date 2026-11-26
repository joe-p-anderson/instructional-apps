// Panel binding: the thin DOM layer between a skin's front-panel SVG and the engine.
// Prototype: the "Oscilloscope panels: control test" artifact.
//
// createPanel({ svgText, model, onEvent, values }) -> { el, svg, canvas, controls, controlEl(name), sync(), destroy() }
//   svgText   the skin's SVG source (../panels/<skin>.svg), inlined
//   model     the skin's entry in controls.json (controls[] with the screen rectangle)
//   onEvent   (event) => void, called with engine events: { type: 'turn', control, detents },
//             { type: 'push', control }, { type: 'press', control }, { type: 'softkey', n },
//             { type: 'set', control, value }, and { type: 'hold' | 'release', control } when a
//             button goes down / comes up (Trig View acts while held)
//   values    { value(control), detent(control), disabled(control), mpFunction() }: the engine (see engine.js,
//             "Control values")
//
// Input. Knobs are the UI kit's knob (framework ui-kit.js): the wheel turns one detent per notch
// (small trackpad deltas add up to one), a vertical drag turns continuously (up = clockwise), the
// arrow keys turn a focused knob (Up/Right clockwise), and a click without a drag, or Enter/Space,
// pushes it.
// Buttons and softkeys: click or Enter/Space presses, shown pressed while held. Buttons also send
// hold on pointerdown / keydown and release on pointerup (anywhere) / keyup.
// Knob rotation is drawn from values.detent() on sync(), never accumulated here; call sync()
// after every engine change.
//
// Controls: every element in the control map is a Control (framework control.js), id = its
// control-map name. For an active knob, button or softkey, get() is the engine value (values.value), or for
// controls no feature gives a value: the knob's detent count, or the button's press count.
// set(v) sends { type: 'set' } for valued controls, otherwise turns the knob to detent v or
// presses the button once. A locked control ignores all input, is greyed with a "(locked)"
// tooltip and aria-disabled; a hidden one gets visibility: hidden, so the panel keeps its layout.
// Disabled: a control the engine disables for now (values.disabled, e.g. the time base in XY)
// gets data-disabled="true" and class bs-disabled (dimmed) on sync(); the engine drops its events.
// LEDs: the multipurpose-knob LEDs (mp-led-*, TDS) are lit (data-lit="true", class bs-lit) on
// sync() while values.mpFunction() is non-null.
// Inactive controls (data-active="false"), LEDs, input connectors, terminals and ports are
// Controls too, so an Activity can lock or hide them, but inert: they ignore input, keep the
// "not available in this simulation" tooltip the generator writes (inactive ones stay greyed),
// get() is an LED's lit state or null, and set() does nothing. The screen is the Display, not a Control.

import { createControl } from '../../framework/v1/control.js';
import { knob } from '../../framework/v1/ui-kit.js';

const PRESS_MS = 120;
const CONTROL_KINDS = new Set(['knob', 'button', 'softkey']);

const isActivateKey = (key) => key === 'Enter' || key === ' ';

export function createPanel({ svgText, model, onEvent, values }) {
  const el = document.createElement('div');
  el.className = 'bs-panel';
  el.innerHTML = svgText;
  const svg = el.querySelector('svg');
  svg.classList.add('bs-panel-svg');
  // Exempt artwork: the front panel's printed labels scale with the Display, so they are not held
  // to the 13 px Display text floor. The screen canvas (a sibling) is.
  svg.setAttribute('data-fw-artwork', '');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', `${model.model ?? svg.dataset.model} front panel`);

  const [, , vbW, vbH] = model.viewBox;
  el.style.setProperty('--bs-aspect', String(vbW / vbH)); // the CSS fits the panel to the Display by it
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

  const controlEl = (name) => svg.querySelector(`.osc-control[data-control="${CSS.escape(name)}"]`);

  // ---- Controls --------------------------------------------------------------------------
  const byName = new Map(); // control name -> { ctl, node, kind }
  const presses = new Map();

  function press(node) {
    const { control, kind } = node.dataset;
    presses.set(control, (presses.get(control) ?? 0) + 1);
    if (kind === 'softkey') onEvent({ type: 'softkey', n: Number(control.replace('softkey-', '')) });
    else onEvent({ type: 'press', control });
  }

  const lockedTitle = (node, tooltip) => (locked) => {
    node.classList.toggle('bs-locked', locked);
    node.setAttribute('aria-disabled', String(locked));
    const title = node.querySelector(':scope > title');
    if (title) title.textContent = locked ? `${tooltip} (locked)` : tooltip;
  };

  for (const entry of model.controls) {
    if (entry.kind === 'screen') continue; // the screen is the Display, not a Control
    const node = controlEl(entry.control);
    if (!node) continue;
    const name = entry.control;
    if (!entry.active || !CONTROL_KINDS.has(entry.kind)) {
      // Inactive controls, LEDs, inputs and terminals: Controls an Activity can lock or hide,
      // but inert (get() is an LED's lit state, else null; set() does nothing).
      const tooltip = node.querySelector(':scope > title')?.textContent ?? entry.label ?? name;
      const ctl = createControl({
        id: name,
        label: entry.label || name,
        get: () => (entry.kind === 'led' ? node.dataset.lit === 'true' : null),
        set: () => {},
        onLock: lockedTitle(node, tooltip),
        onHide: (hidden) => { node.style.visibility = hidden ? 'hidden' : ''; },
      });
      byName.set(name, { ctl, node, kind: entry.kind, passive: true });
      continue;
    }
    const label = entry.label || (entry.kind === 'softkey' ? `Softkey ${name.replace('softkey-', '')}` : name);
    const title = node.querySelector(':scope > title');
    const tooltip = title?.textContent ?? label;
    const hasValue = () => values.value(name) !== undefined;
    if (entry.kind === 'knob') {
      const ctl = knob({
        id: name,
        name: label,
        el: node,
        get: () => (hasValue() ? values.value(name) : values.detent(name)),
        set: (v) => {
          if (hasValue()) onEvent({ type: 'set', control: name, value: v });
          else {
            const detents = Math.trunc(Number(v) - values.detent(name));
            if (detents) onEvent({ type: 'turn', control: name, detents });
          }
        },
        onTurn: (detents) => onEvent({ type: 'turn', control: name, detents }),
        onPush: () => { if (node.dataset.push) onEvent({ type: 'push', control: name }); },
        onLock: lockedTitle(node, tooltip),
        onHide: (hidden) => { node.style.visibility = hidden ? 'hidden' : ''; },
      });
      byName.set(name, { ctl, node, kind: entry.kind });
      continue;
    }
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', label);

    const ctl = createControl({
      id: name,
      label,
      get: () => (hasValue() ? values.value(name) : (presses.get(name) ?? 0)),
      set: (v) => {
        if (hasValue()) onEvent({ type: 'set', control: name, value: v });
        else press(node);
      },
      onLock: lockedTitle(node, tooltip),
      onHide: (hidden) => {
        node.style.visibility = hidden ? 'hidden' : '';
        node.setAttribute('tabindex', hidden ? '-1' : '0');
      },
    });
    byName.set(name, { ctl, node, kind: entry.kind });
  }

  /** The operable Control under an event target, or null (inactive, locked, hidden or none). */
  function operable(target, kind) {
    const node = target?.closest?.('.osc-control');
    const c = node && byName.get(node.dataset.control);
    if (!c || c.passive || c.ctl.isLocked() || c.ctl.isHidden()) return null;
    if (kind && c.kind !== kind) return null;
    return c;
  }

  // ---- Pressed state ----------------------------------------------------------------------
  const timers = new Set();
  function releaseLater(node) {
    const t = setTimeout(() => { node.classList.remove('bs-pressed'); timers.delete(t); }, PRESS_MS);
    timers.add(t);
  }
  function flashPressed(node) {
    node.classList.add('bs-pressed');
    releaseLater(node);
  }

  // ---- Hold / release (buttons) -------------------------------------------------------------
  let held = null; // control name of the button held down
  function hold(c) {
    if (c.kind !== 'button' || held) return;
    held = c.node.dataset.control;
    onEvent({ type: 'hold', control: held });
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
  }
  function release() {
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    window.removeEventListener('blur', release);
    if (!held) return;
    const control = held;
    held = null;
    onEvent({ type: 'release', control });
  }

  // ---- Input (buttons and softkeys; each knob handles its own) ------------------------------
  function onPointerDown(e) {
    if (e.button !== 0) return;
    const c = operable(e.target);
    if (!c || c.kind === 'knob') return;
    c.node.classList.add('bs-pressed');
    hold(c);
  }
  function onPointerUp() {
    for (const { node } of byName.values()) if (node.classList.contains('bs-pressed')) releaseLater(node);
  }

  function onClick(e) {
    const c = operable(e.target);
    if (!c || c.kind === 'knob') return; // a knob pushes itself (a click without a drag)
    press(c.node);
  }

  function onKeyDown(e) {
    const c = operable(e.target);
    if (!c || c.kind === 'knob') return;
    if (isActivateKey(e.key)) {
      e.preventDefault();
      flashPressed(c.node);
      if (!e.repeat) hold(c);
      press(c.node);
    }
  }
  function onKeyUp(e) {
    if (isActivateKey(e.key) && held) release();
  }

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('click', onClick);
  svg.addEventListener('keydown', onKeyDown);
  svg.addEventListener('keyup', onKeyUp);

  const mpLeds = [...svg.querySelectorAll('.osc-control[data-kind="led"][data-control^="mp-led"]')];

  /** Redraw every knob's rotation (and accessible value) and the knob LEDs from the engine. */
  function sync() {
    const lit = String(Boolean(values.mpFunction?.()));
    for (const led of mpLeds) {
      led.dataset.lit = lit;
      led.classList.toggle('bs-lit', lit === 'true');
    }
    for (const [name, { ctl, node, kind, passive }] of byName) {
      if (passive) continue;
      const off = Boolean(values.disabled?.(name));
      if (node.dataset.disabled !== String(off)) {
        node.dataset.disabled = String(off);
        node.classList.toggle('bs-disabled', off);
      }
      if (kind !== 'knob') continue;
      const rot = node.querySelector('.osc-knob-rot');
      const angle = values.detent(name) * Number(node.dataset.detent || 15);
      if (rot && rot.dataset.angle !== String(angle)) {
        rot.dataset.angle = String(angle);
        rot.setAttribute('transform', `rotate(${angle} ${node.dataset.cx} ${node.dataset.cy})`);
      }
      ctl.refresh();
    }
  }
  sync();

  return {
    el,
    svg,
    canvas,
    controls: [...byName.values()].map((c) => c.ctl),
    controlEl,
    sync,
    destroy() {
      for (const t of timers) clearTimeout(t);
      svg.removeEventListener('pointerdown', onPointerDown);
      for (const { ctl, kind } of byName.values()) if (kind === 'knob') ctl.destroy();
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointercancel', onPointerUp);
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('keydown', onKeyDown);
      svg.removeEventListener('keyup', onKeyUp);
      release();
      el.remove();
    },
  };
}
