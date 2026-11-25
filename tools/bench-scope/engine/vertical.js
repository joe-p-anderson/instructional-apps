// Feature: vertical settings per channel. Owns settings.ch1 and settings.ch2 (ticket 05 adds
// coupling, probe, BW limit and invert).
//
// settings.ch1, settings.ch2: { display (bool), vPerDiv (V/div at the probe tip), position (divisions) }
//
// Controls (control-map names, N = 1 or 2):
//   chN-scale     turn: + (clockwise) steps V/div down the 1-2-5 sequence, 2 mV .. 5 V, clamped.
//                 Control value: V/div (set snaps to the nearest step).
//   chN-position  turn: moves the trace POSITION_STEP divisions per detent, ±POSITION_LIMIT;
//                 push recentres. Control value: divisions.
//   chN-menu      press: toggles the channel's display (ticket 05 adds the CH menu).
//                 Control value: display on (bool).
// State: chNDisplay, chNVPerDiv (V/div), chNPosition (div). CH1 starts on, CH2 off.

import { clamp, clampNumber, si } from './util.js';

export const VERTICAL_CHANNELS = ['ch1', 'ch2'];

/** Volts per division, smallest first. */
export const VDIV_SEQUENCE = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];

/** Divisions the trace moves per Position detent, and the Position range (± divisions). */
export const POSITION_STEP = 0.1;
export const POSITION_LIMIT = 5;

const DEFAULTS = {
  ch1: { display: true, vPerDiv: 1, position: 0 },
  ch2: { display: false, vPerDiv: 1, position: 0 },
};

const MAX_STEPS = Math.round(POSITION_LIMIT / POSITION_STEP);
const positionSteps = (p) => clamp(Math.round(p / POSITION_STEP), -MAX_STEPS, MAX_STEPS);
/** A position on the POSITION_STEP grid, clamped, without float residue (0.3, not 0.30000000000000004). */
const snapPosition = (p) => Number((positionSteps(p) * POSITION_STEP).toFixed(6));

/** The sequence value nearest `v` on a log scale, or `fallback` if `v` is not a positive number. */
function snapVPerDiv(v, fallback) {
  if (!(typeof v === 'number' && v > 0 && Number.isFinite(v))) return fallback;
  let best = VDIV_SEQUENCE[0];
  for (const s of VDIV_SEQUENCE) if (Math.abs(Math.log(s / v)) < Math.abs(Math.log(best / v))) best = s;
  return best;
}

function channelSettings(saved, defaults) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    display: typeof s.display === 'boolean' ? s.display : defaults.display,
    vPerDiv: snapVPerDiv(s.vPerDiv, defaults.vPerDiv),
    position: snapPosition(clampNumber(s.position, -POSITION_LIMIT, POSITION_LIMIT, defaults.position)),
  };
}

const scaleIndex = (ch) => VDIV_SEQUENCE.indexOf(ch.vPerDiv);

const turn = {};
const push = {};
const press = {};
const controls = {};
for (const name of VERTICAL_CHANNELS) {
  const ch = (settings) => settings[name];
  turn[`${name}-scale`] = ({ settings }, detents) => {
    const i = clamp(scaleIndex(ch(settings)) - Math.trunc(detents), 0, VDIV_SEQUENCE.length - 1);
    ch(settings).vPerDiv = VDIV_SEQUENCE[i];
  };
  turn[`${name}-position`] = ({ settings }, detents) => {
    ch(settings).position = snapPosition(ch(settings).position + Math.trunc(detents) * POSITION_STEP);
  };
  push[`${name}-position`] = ({ settings }) => { ch(settings).position = 0; };
  press[`${name}-menu`] = ({ settings }) => { ch(settings).display = !ch(settings).display; };

  controls[`${name}-scale`] = {
    get: ({ settings }) => ch(settings).vPerDiv,
    set: ({ settings }, v) => { ch(settings).vPerDiv = snapVPerDiv(v, ch(settings).vPerDiv); },
    detent: ({ settings }) => -scaleIndex(ch(settings)),
  };
  controls[`${name}-position`] = {
    get: ({ settings }) => ch(settings).position,
    set: ({ settings }, v) => {
      ch(settings).position = snapPosition(clampNumber(v, -POSITION_LIMIT, POSITION_LIMIT, ch(settings).position));
    },
    detent: ({ settings }) => positionSteps(ch(settings).position),
  };
  controls[`${name}-menu`] = {
    get: ({ settings }) => ch(settings).display,
    set: ({ settings }, v) => { if (typeof v === 'boolean') ch(settings).display = v; },
  };
}

/**
 * A displayed channel's trace in screen divisions, or null if the channel is off or unwired.
 * `v` is the input signal v(t) in volts, `times` the sample times for the shared `x`. Samples
 * clip at the top and bottom of the graticule (±divY/2), as the ADC would; `clipped` says
 * whether any did.
 */
export function channelTrace(settings, profile, name, v, x, times) {
  const ch = settings[name];
  if (!ch.display || !v) return null;
  const edge = profile.screen.divY / 2;
  let clipped = false;
  const y = times.map((t) => {
    const yi = v(t) / ch.vPerDiv + ch.position;
    if (yi > edge || yi < -edge) clipped = true;
    return clamp(yi, -edge, edge);
  });
  return { x, y, vPerDiv: ch.vPerDiv, position: ch.position, clipped };
}

export const vertical = {
  init(settings) {
    for (const name of VERTICAL_CHANNELS) settings[name] = { ...DEFAULTS[name] };
  },
  restore(settings, saved) {
    for (const name of VERTICAL_CHANNELS) settings[name] = channelSettings(saved?.[name], DEFAULTS[name]);
  },
  turn,
  push,
  press,
  controls,
  state({ settings }) {
    const out = {};
    for (const name of VERTICAL_CHANNELS) {
      const ch = settings[name];
      out[`${name}Display`] = ch.display;
      out[`${name}VPerDiv`] = ch.vPerDiv;
      out[`${name}Position`] = ch.position;
    }
    return out;
  },
  describe() {
    const out = {};
    for (const name of VERTICAL_CHANNELS) {
      const n = name.toUpperCase();
      out[`${name}Display`] = { label: `${n} display on`, unit: '' };
      out[`${name}VPerDiv`] = { label: `${n} vertical scale`, unit: 'V/div' };
      out[`${name}Position`] = { label: `${n} vertical position`, unit: 'div' };
    }
    return out;
  },
  frame({ settings }, frame) {
    for (const name of VERTICAL_CHANNELS) {
      const ch = settings[name];
      if (ch.display) frame.readouts.push({ id: `${name}-scale`, channel: name, text: `${si(ch.vPerDiv)}V` });
    }
  },
};
