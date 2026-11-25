// Feature: the cursors. Owns settings.cursors.
//
// settings.cursors: { mode 'off' | 'time' | 'amplitude', source 'ch1' | 'ch2' (amplitude cursors),
//                     time: [x1, x2] (divisions from the screen centre, ±divX/2, so both skins save alike),
//                     amplitude: [y1, y2] (divisions up from the screen centre, ±divY/2) }
// Positions are screen positions, as on the real scopes: changing s/div or V/div changes what
// the cursors read, not where they are.
//
// Controls:
//   cursors   press: opens the Cursor menu: 1 Type Off/Time/Amplitude, 2 Source CH1/CH2,
//             3 Cursor 1, 4 Cursor 2 (selects which cursor the multipurpose knob moves).
//   mp-knob   turn: moves the selected cursor STEP divisions per detent (FINE_STEP with Fine on),
//             within the screen. push (TBS "select"): selects the other cursor.
//   fine      press (TBS): toggles Fine. Control value: bool.
//   cursor-1, cursor-2   (Tool Controls, not on the panel) the cursor's position in the current
//             mode's units: seconds from the trigger point (time) or volts on the source
//             (amplitude); null when cursors are off.
// Which cursor is selected is live (not saved): restore and a skin switch select Cursor 1.
// In XY (settings.display.format 'xy', display.js) the cursors are disabled, as on the real
// models: the knob and menu ignore input, nothing is drawn and the Δ values are null.
// mpFunction: 'Cursor 1' / 'Cursor 2' while cursors are on (the TDS lights its knob LEDs).
// Frame: frame.cursors = null | { mode, selected, channel?, lines: [{ id: 'cursor-1', axis: 'x' | 'y', pos }] }
// (divisions in trace coordinates: x from the left edge, y up from the centre), readouts 'cursor-dt' and 'cursor-inv' (time) or 'cursor-dv' (amplitude).
// State: cursorMode, cursorSource, cursorSelected (1 | 2), cursorFine, cursor1, cursor2 (s or V),
// cursorDt (s), cursorInvDt (Hz), cursorDv (V); null where they don't apply.

import { choiceItem } from './menus.js';
import { clamp, clampNumber, oneOf, si } from './util.js';
import { shownVPerDiv } from './vertical.js';

/** Divisions the selected cursor moves per multipurpose-knob detent, and with Fine on. */
export const STEP = 0.1;
export const FINE_STEP = 0.02;

const MODES = ['off', 'time', 'amplitude'];
const SOURCES = ['ch1', 'ch2'];
const lives = new WeakMap(); // settings -> { selected: 0 | 1 }

const tidy = (v) => Math.round(v * 1e6) / 1e6;
const liveOf = (settings) => {
  if (!lives.has(settings)) lives.set(settings, { selected: 0 });
  return lives.get(settings);
};
const isXY = (settings) => settings.display?.format === 'xy';
/** The cursor mode in effect: off whenever the display is XY. */
const activeMode = (settings) => (isXY(settings) ? 'off' : settings.cursors.mode);

const defaults = (profile) => ({
  mode: 'off',
  source: 'ch1',
  fine: false,
  time: [-2, 2],
  amplitude: [2, -2],
});

function limits(profile, axis) {
  return axis === 'time' ? [-profile.screen.divX / 2, profile.screen.divX / 2] : [-profile.screen.divY / 2, profile.screen.divY / 2];
}

function fromSaved(saved, profile) {
  const d = defaults(profile);
  const s = saved && typeof saved === 'object' ? saved : {};
  const pair = (axis) => {
    const [lo, hi] = limits(profile, axis);
    const a = Array.isArray(s[axis]) ? s[axis] : [];
    return d[axis].map((v, i) => tidy(clampNumber(a[i], lo, hi, v)));
  };
  return {
    mode: oneOf(s.mode, MODES, d.mode),
    source: oneOf(s.source, SOURCES, d.source),
    fine: typeof s.fine === 'boolean' ? s.fine : d.fine,
    time: pair('time'),
    amplitude: pair('amplitude'),
  };
}

/** Seconds from the trigger point at screen position x (divisions). */
const timeAt = ({ horizontal }, x) => x * horizontal.sPerDiv - horizontal.position;
/** Volts on the source channel at screen position y (divisions). */
const voltsAt = (settings, y) => {
  const ch = settings[settings.cursors.source];
  return (y - ch.position) * shownVPerDiv(ch);
};

/** The cursor readings: positions and Δ values in s / V / Hz, null where they don't apply. */
function readings(settings, profile) {
  const c = settings.cursors;
  const out = { cursor1: null, cursor2: null, cursorDt: null, cursorInvDt: null, cursorDv: null };
  const mode = activeMode(settings);
  if (mode === 'time') {
    const [t1, t2] = c.time.map((x) => Number(timeAt(settings, x).toPrecision(9)));
    const dt = Math.abs(c.time[1] - c.time[0]) * settings.horizontal.sPerDiv;
    Object.assign(out, { cursor1: t1, cursor2: t2, cursorDt: dt, cursorInvDt: dt > 0 ? 1 / dt : null });
  } else if (mode === 'amplitude') {
    const [v1, v2] = c.amplitude.map((y) => voltsAt(settings, y));
    Object.assign(out, { cursor1: v1, cursor2: v2, cursorDv: Math.abs(c.amplitude[1] - c.amplitude[0]) * shownVPerDiv(settings[c.source]) });
  }
  return out;
}

/** Move cursor i (0 | 1) of the current mode to screen position p (divisions), within the screen. */
function place(settings, profile, i, p) {
  const axis = settings.cursors.mode;
  const [lo, hi] = limits(profile, axis);
  settings.cursors[axis][i] = tidy(clamp(p, lo, hi));
}

/** The Control for cursor i: its position in the mode's units (s from the trigger point, or V). */
function cursorControl(i) {
  return {
    get: ({ settings, profile }) => readings(settings, profile)[`cursor${i + 1}`],
    set({ settings, profile }, v) {
      if (!(typeof v === 'number' && Number.isFinite(v)) || activeMode(settings) === 'off') return;
      if (settings.cursors.mode === 'time') {
        const h = settings.horizontal;
        place(settings, profile, i, (v + h.position) / h.sPerDiv);
      } else {
        const ch = settings[settings.cursors.source];
        place(settings, profile, i, v / shownVPerDiv(ch) + ch.position);
      }
    },
  };
}

function selectItem(i) {
  return ({ settings, profile }) => {
    const selected = liveOf(settings).selected === i;
    const value = readings(settings, profile)[`cursor${i + 1}`];
    const unit = settings.cursors.mode === 'time' ? 's' : 'V';
    return {
      label: `${selected ? '>' : ''}Cursor ${i + 1}`,
      value: value === null ? '' : `${si(value)}${unit}`,
      select: (c) => { liveOf(c.settings).selected = i; },
    };
  };
}

const menus = {
  cursor: {
    button: 'cursors',
    title: 'Cursor',
    onButton: ({ settings }) => !isXY(settings),
    items: () => [
      choiceItem('Type', [{ value: 'off', text: 'Off' }, { value: 'time', text: 'Time' }, { value: 'amplitude', text: 'Amplitude' }],
        ({ settings }) => settings.cursors.mode, ({ settings }, v) => { settings.cursors.mode = v; }),
      choiceItem('Source', [{ value: 'ch1', text: 'CH1' }, { value: 'ch2', text: 'CH2' }],
        ({ settings }) => settings.cursors.source, ({ settings }, v) => { settings.cursors.source = v; }),
      selectItem(0),
      selectItem(1),
    ],
  },
};

export const cursors = {
  menus,
  turn: {
    'mp-knob'({ settings, profile }, detents) {
      if (activeMode(settings) === 'off') return;
      const c = settings.cursors;
      const i = liveOf(settings).selected;
      place(settings, profile, i, c[c.mode][i] + detents * (c.fine ? FINE_STEP : STEP));
    },
  },
  push: {
    'mp-knob'({ settings }) {
      if (activeMode(settings) === 'off') return;
      const live = liveOf(settings);
      live.selected = 1 - live.selected;
    },
  },
  press: {
    fine({ settings }) { settings.cursors.fine = !settings.cursors.fine; },
  },
  controls: {
    'cursor-1': cursorControl(0),
    'cursor-2': cursorControl(1),
    fine: {
      get: ({ settings }) => settings.cursors.fine,
      set: ({ settings }, v) => { if (typeof v === 'boolean') settings.cursors.fine = v; },
    },
  },
  mpFunction({ settings }) {
    return activeMode(settings) === 'off' ? null : `Cursor ${liveOf(settings).selected + 1}`;
  },
  frame({ settings, profile }, frame) {
    const mode = activeMode(settings);
    if (mode === 'off') return;
    const c = settings.cursors;
    const r = readings(settings, profile);
    const axis = mode === 'time' ? 'x' : 'y';
    frame.cursors = {
      mode,
      selected: liveOf(settings).selected + 1,
      ...(mode === 'amplitude' ? { channel: c.source } : {}),
      // Time cursors in trace coordinates (x from the left edge), amplitude ones as stored.
      lines: c[mode].map((p, i) => ({ id: `cursor-${i + 1}`, axis, pos: axis === 'x' ? tidy(p + profile.screen.divX / 2) : p })),
    };
    if (mode === 'time') {
      frame.readouts.push({ id: 'cursor-dt', text: `Δt ${si(r.cursorDt)}s` });
      frame.readouts.push({ id: 'cursor-inv', text: r.cursorInvDt ? `1/Δt ${si(r.cursorInvDt)}Hz` : '1/Δt ---' });
    } else {
      frame.readouts.push({ id: 'cursor-dv', text: `ΔV ${si(r.cursorDv)}V` });
    }
  },
  init(settings, setup, profile) {
    settings.cursors = defaults(profile);
    lives.set(settings, { selected: 0 });
  },
  restore(settings, saved, profile) {
    settings.cursors = fromSaved(saved?.cursors, profile);
    lives.set(settings, { selected: 0 });
  },
  state({ settings, profile }) {
    const c = settings.cursors;
    return {
      cursorMode: c.mode,
      cursorSource: c.source,
      cursorSelected: liveOf(settings).selected + 1,
      cursorFine: c.fine,
      ...readings(settings, profile),
    };
  },
  describe: () => ({
    cursorMode: { label: 'Cursor type (off, time or amplitude)', unit: '' },
    cursorSource: { label: 'Amplitude cursor source', unit: '' },
    cursorSelected: { label: 'Cursor the multipurpose knob moves', unit: '' },
    cursorFine: { label: 'Fine (slow multipurpose knob)', unit: '' },
    cursor1: { label: 'Cursor 1 position (time from trigger, or volts)', unit: 's or V' },
    cursor2: { label: 'Cursor 2 position (time from trigger, or volts)', unit: 's or V' },
    cursorDt: { label: 'Cursor Δt', unit: 's' },
    cursorInvDt: { label: 'Cursor 1/Δt', unit: 'Hz' },
    cursorDv: { label: 'Cursor ΔV', unit: 'V' },
  }),
};
