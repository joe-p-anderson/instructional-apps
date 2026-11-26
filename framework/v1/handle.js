// UI kit: the draggable handle and the rotary knob Controls (re-exported by ui-kit.js).
//
// handle(): a point the student drags, or moves with the keyboard, over a Display.
//   1-D  handle({ id, name, unit, min, max, step, coarse, value, decimals, reversed, format,
//                 toScreen, fromScreen, el, onChange, onLock, onHide })
//        role="slider" named `name`, aria-valuenow/min/max and aria-valuetext ("2.0 V").
//        Arrow Up/Right add `step`, Down/Left subtract it (`reversed: true` swaps them, for a
//        value that grows leftwards or downwards on screen); Shift+arrow moves `coarse`
//        (default 10 steps); Home/End go to min/max.
//   2-D  handle({ id, name, x: { name, unit, min, max, step, coarse, decimals, reversed },
//                 y: { ... }, value: { x, y }, format, toScreen, fromScreen, el, onChange, ... })
//        A focusable role="group" named `name`, described by a live text naming both
//        coordinates ("x = 5.0 m, y = 5.0 m"). Left/Right move x, Up/Down move y (Up adds,
//        unless that axis is `reversed`); Shift moves the axis' `coarse`.
//   The value is a number (1-D) or { x, y } (2-D), clamped to the bounds.
//
//   The Tool supplies the mapping between value and screen, in client pixels (like a Display's
//   toScreen):
//     toScreen(value)        -> { x, y } client position, or null while not laid out. Optional:
//                               with it the kit positions `el` over that point (its parent must
//                               be positioned; place() re-reads it, e.g. after a resize).
//     fromScreen(cx, cy)     -> value at a client position, for pointer drags (the kit clamps it).
//                               Without it the handle moves only by keyboard and set().
//   el: optional existing element to make the handle (e.g. an SVG <circle> the Tool draws and
//   positions itself; then omit toScreen). By default the kit makes a round .fw-handle <div>.
//   Pointer drags use pointer events with pointer capture and touch-action: none. A locked or
//   hidden handle ignores keys and pointer; set() still applies a value and calls onChange.
//   update(value) shows a value without calling onChange (the Tool's State moved it by other
//   means, e.g. a slider for the same quantity).
//
// knob(): bench-scope's rotary pattern.
//   knob({ id, name, label, el, get, set, onTurn, onPush, valueText, detentAngle, onLock, onHide })
//   role="slider" named `name`, focusable. The arrow keys turn it one detent (Up/Right clockwise),
//   Enter/Space push it, the wheel turns one detent per notch (small trackpad deltas add up), a
//   vertical drag turns it continuously (up = clockwise) and a click without a drag pushes it.
//   onTurn(detents) is called with the signed detent count; onPush() (optional) on a push.
//   By default the knob counts its own detents: get() is that count and set(n) turns to detent n.
//   A Tool whose knob shows an engine value passes get/set (and valueText) and calls refresh()
//   after the value changes, which redraws aria-valuetext (and the default knob's rotation).
//   el: optional existing element (e.g. a front-panel SVG <g>); the Tool then draws its rotation.
//   By default the kit makes a .fw-knob, rotated `detentAngle` degrees (default 15) per detent.
//   A locked knob gets aria-disabled and ignores all input; a hidden one leaves the tab order.

import { createControl } from './control.js';

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Round away binary noise from repeated steps (0.1 + 0.2), keeping 12 significant digits. */
const tidy = (v) => Number(v.toPrecision(12));

function axisOf(a = {}, fallbackName) {
  const { min = 0, max = 1 } = a;
  const step = a.step ?? (max - min) / 100;
  return {
    name: a.name ?? fallbackName, unit: a.unit ?? '', min, max, step,
    coarse: a.coarse ?? step * 10, decimals: a.decimals ?? 2, reversed: Boolean(a.reversed),
  };
}

const withUnit = (text, unit) => (unit ? `${text} ${unit}` : text);
const ARROWS = { ArrowUp: ['y', 1], ArrowRight: ['x', 1], ArrowDown: ['y', -1], ArrowLeft: ['x', -1] };

export function handle(opts) {
  const { id, name = id, toScreen, fromScreen, onChange = () => {}, onLock, onHide } = opts;
  const twoD = Boolean(opts.x || opts.y);
  const axes = twoD
    ? { x: axisOf(opts.x, 'x'), y: axisOf(opts.y, 'y') }
    : { v: axisOf(opts, name) };

  const clampValue = (v) => (twoD
    ? { x: clamp(Number(v?.x ?? current.x), axes.x.min, axes.x.max),
      y: clamp(Number(v?.y ?? current.y), axes.y.min, axes.y.max) }
    : clamp(Number(v), axes.v.min, axes.v.max));
  const valid = (v) => (twoD ? Number.isFinite(v.x) && Number.isFinite(v.y) : Number.isFinite(v));
  const copy = (v) => (twoD ? { ...v } : v);

  let current = twoD ? { x: axes.x.min, y: axes.y.min } : axes.v.min;
  current = clampValue(opts.value ?? current);

  const format = opts.format ?? ((v) => (twoD
    ? ['x', 'y'].map((k) => `${axes[k].name} = ${withUnit(v[k].toFixed(axes[k].decimals), axes[k].unit)}`).join(', ')
    : withUnit(v.toFixed(axes.v.decimals), axes.v.unit)));

  const owned = !opts.el;
  const el = opts.el ?? document.createElement('div');
  if (owned) el.className = 'fw-handle';
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', name);
  el.style.touchAction = 'none';
  let live = null;
  if (twoD) {
    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', '2-D handle');
    live = document.createElement('span');
    live.className = 'fw-sr-only';
    live.id = `fw-handle-${id}-${Math.random().toString(36).slice(2, 8)}`;
    live.setAttribute('aria-live', 'polite');
    el.append(live);
    el.setAttribute('aria-describedby', live.id);
  } else {
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', String(axes.v.min));
    el.setAttribute('aria-valuemax', String(axes.v.max));
    el.setAttribute('aria-orientation', 'vertical');
  }
  if (owned && !el.title) el.title = fromScreen ? `${name}: drag, or use the arrow keys` : name;

  function render() {
    const text = format(current);
    if (twoD) live.textContent = text;
    else {
      el.setAttribute('aria-valuenow', String(current));
      el.setAttribute('aria-valuetext', text);
    }
    place();
  }

  /** Position the kit's element over toScreen(value); a Tool-supplied el is the Tool's to place. */
  function place() {
    if (!owned || !toScreen || !el.parentElement) return;
    const at = toScreen(copy(current));
    if (!at) { el.style.visibility = 'hidden'; return; }
    const box = el.parentElement.getBoundingClientRect();
    const parent = getComputedStyle(el.parentElement);
    el.style.visibility = '';
    el.style.left = `${at.x - box.left - parseFloat(parent.borderLeftWidth || 0)}px`;
    el.style.top = `${at.y - box.top - parseFloat(parent.borderTopWidth || 0)}px`;
  }

  function apply(v, notify) {
    const next = clampValue(v);
    if (!valid(next)) return;
    current = next;
    render();
    if (notify) onChange(copy(current));
  }

  const ctl = createControl({
    id,
    label: name,
    el,
    get: () => copy(current),
    set: (v) => apply(v, true),
    onLock: (locked) => {
      el.setAttribute('aria-disabled', String(locked));
      onLock?.(locked);
    },
    onHide: (hidden) => {
      el.setAttribute('tabindex', hidden ? '-1' : '0');
      if (!owned) el.style.visibility = hidden ? 'hidden' : '';
      onHide?.(hidden);
    },
  });
  const inert = () => ctl.isLocked() || ctl.isHidden();

  function onKeyDown(e) {
    if (inert()) return;
    if (!twoD && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      apply(e.key === 'Home' ? axes.v.min : axes.v.max, true);
      return;
    }
    const arrow = ARROWS[e.key];
    if (!arrow) return;
    e.preventDefault();
    const [key, sign] = arrow;
    const a = twoD ? axes[key] : axes.v;
    const by = sign * (a.reversed ? -1 : 1) * (e.shiftKey ? a.coarse : a.step);
    if (twoD) apply({ ...current, [key]: tidy(current[key] + by) }, true);
    else apply(tidy(current + by), true);
  }

  let dragId = null;
  function onPointerDown(e) {
    if (e.button !== 0 || inert() || !fromScreen) return;
    e.preventDefault(); // no text selection, native drag or scrolling
    e.stopPropagation();
    el.focus({ preventScroll: true });
    dragId = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (e.pointerId !== dragId || inert()) return;
    e.preventDefault();
    apply(fromScreen(e.clientX, e.clientY), true);
  }
  function onPointerUp(e) {
    if (e.pointerId !== dragId) return;
    dragId = null;
    el.releasePointerCapture?.(e.pointerId);
  }

  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  render();

  return Object.assign(ctl, {
    place,
    update: (v) => apply(v, false),
    destroy() {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    },
  });
}

const DRAG_PX = 8; // CSS pixels of vertical drag per detent
const DRAG_SLOP = 3; // a pointer that moves less than this is a click (push)
const WHEEL_NOTCH = 40; // |deltaY| (pixels) worth one detent; a mouse notch is ~100
const KEY_TURNS = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
const isActivateKey = (key) => key === 'Enter' || key === ' ';

export function knob({ id, name = id, label, el: given, get, set, onTurn = () => {}, onPush,
  valueText, detentAngle = 15, onLock, onHide }) {
  let count = 0;
  const owned = !given;
  let el = given;
  let dial = null;
  if (owned) {
    dial = document.createElement('span');
    dial.className = 'fw-knob-dial';
    const caption = document.createElement('span');
    caption.className = 'fw-control-name';
    if (label) caption.innerHTML = label; else caption.textContent = name;
    el = document.createElement('div');
    el.className = 'fw-knob';
    el.append(dial, caption);
  }
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', name);
  el.style.touchAction = 'none';

  const value = () => (get ? get() : count);
  function turn(detents) {
    if (!detents) return;
    if (!get) count += detents;
    onTurn(detents);
    refresh();
  }
  const push = () => onPush?.();

  function refresh() {
    el.setAttribute('aria-valuetext', String(valueText ? valueText() : value()));
    if (dial) dial.style.transform = `rotate(${count * detentAngle}deg)`;
  }

  const ctl = createControl({
    id,
    label: name,
    el: owned ? el : null,
    get: value,
    set: set ?? ((v) => turn(Math.trunc(Number(v) - count))),
    onLock: (locked) => {
      el.setAttribute('aria-disabled', String(locked));
      onLock?.(locked);
    },
    onHide: (hidden) => {
      el.setAttribute('tabindex', hidden ? '-1' : '0');
      onHide?.(hidden);
    },
  });
  const inert = () => ctl.isLocked() || ctl.isHidden();

  let wheelAcc = 0;
  function onWheel(e) {
    e.preventDefault();
    if (inert()) return;
    const dy = e.deltaMode === 1 ? e.deltaY * WHEEL_NOTCH : e.deltaY; // lines -> pixels
    if (Math.abs(dy) >= WHEEL_NOTCH) {
      wheelAcc = 0;
      turn(dy < 0 ? 1 : -1);
      return;
    }
    wheelAcc += dy;
    if (Math.abs(wheelAcc) >= WHEEL_NOTCH) {
      turn(wheelAcc < 0 ? 1 : -1);
      wheelAcc = 0;
    }
  }

  let drag = null; // { pointerId, x0, y0, sent, moved }
  function onPointerDown(e) {
    if (e.button !== 0 || inert()) return;
    e.preventDefault(); // no text selection or native drag
    el.focus({ preventScroll: true });
    drag = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, sent: 0, moved: false };
    el.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = drag.y0 - e.clientY;
    if (Math.abs(dy) > DRAG_SLOP || Math.abs(e.clientX - drag.x0) > DRAG_SLOP) drag.moved = true;
    const detents = Math.trunc(dy / DRAG_PX);
    if (detents !== drag.sent && !inert()) turn(detents - drag.sent);
    drag.sent = detents;
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { moved } = drag;
    drag = null;
    el.releasePointerCapture?.(e.pointerId);
    if (!moved && e.type === 'pointerup' && !inert()) push();
  }
  function onKeyDown(e) {
    if (inert()) return;
    if (e.key in KEY_TURNS) {
      e.preventDefault();
      turn(KEY_TURNS[e.key]);
    } else if (isActivateKey(e.key)) {
      e.preventDefault();
      push();
    }
  }

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('keydown', onKeyDown);
  refresh();

  return Object.assign(ctl, {
    el,
    refresh,
    destroy() {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('keydown', onKeyDown);
    },
  });
}
