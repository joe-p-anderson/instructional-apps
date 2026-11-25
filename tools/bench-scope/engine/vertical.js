// Feature: vertical settings per channel and the CH menus. Owns settings.ch1 and settings.ch2.
//
// settings.ch1, settings.ch2: { display (bool), vPerDiv (knob V/div at the BNC, i.e. at the
//   probe tip with a 1× probe), position (divisions), coupling 'dc' | 'ac' | 'gnd', probe 1 | 10,
//   bwLimit (bool), invert (bool) }
//
// A channel's signal chain (channelSignal): coupling (AC removes the mean, GND is 0 V), then the
// probe factor (the scope multiplies by its probe setting, so 10× with the generator wired
// straight in reads ten times high), then invert. Everything the scope shows in volts (traces,
// trigger level, measurements) is after this chain: the displayed V/div is probe · vPerDiv
// (shownVPerDiv), so the trace on screen does not move when the probe setting changes. The
// trigger sees the same conditioned signal. BW limit lowers the noise (acquire.js).
//
// Controls (control-map names, N = 1 or 2):
//   chN-scale     turn: + (clockwise) steps V/div down the 1-2-5 sequence, 2 mV .. 5 V, clamped.
//                 Control value: V/div (set snaps to the nearest step).
//   chN-position  turn: moves the trace POSITION_STEP divisions per detent, ±POSITION_LIMIT;
//                 push recentres. Control value: divisions.
//   chN-menu      press: opens the CH menu (turning the channel on if it was off); pressed while
//                 that menu is on screen, turns the channel off. Control value: display on (bool).
// CH menu softkeys: 1 Coupling DC/AC/GND, 2 BW Limit Off/On, 3 Probe 1X/10X, 4 Invert Off/On.
// State: chNDisplay, chNVPerDiv (knob V/div at the BNC), chNPosition (div), chNCoupling,
// chNProbe, chNBwLimit, chNInvert. CH1 starts on, CH2 off; both DC, 1×, full bandwidth, upright.
// Readout chN-scale: the displayed V/div, then ' ~' for AC, ' ⏚' for GND, ' B' for BW limit.

import { choiceItem, toggleItem } from './menus.js';
import { inputSignal, source } from './source.js';
import { clamp, clampNumber, oneOf, si } from './util.js';

export const VERTICAL_CHANNELS = ['ch1', 'ch2'];

/** Volts per division, smallest first. */
export const VDIV_SEQUENCE = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];

/** Divisions the trace moves per Position detent, and the Position range (± divisions). */
export const POSITION_STEP = 0.1;
export const POSITION_LIMIT = 5;

export const COUPLINGS = ['dc', 'ac', 'gnd'];
export const PROBES = [1, 10];

const CHAIN = { coupling: 'dc', probe: 1, bwLimit: false, invert: false };
const DEFAULTS = {
  ch1: { display: true, vPerDiv: 1, position: 0, ...CHAIN },
  ch2: { display: false, vPerDiv: 1, position: 0, ...CHAIN },
};
const MEAN_POINTS = 1024; // samples per period for the AC-coupling mean

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
    coupling: oneOf(s.coupling, COUPLINGS, defaults.coupling),
    probe: oneOf(s.probe, PROBES, defaults.probe),
    bwLimit: typeof s.bwLimit === 'boolean' ? s.bwLimit : defaults.bwLimit,
    invert: typeof s.invert === 'boolean' ? s.invert : defaults.invert,
  };
}

const scaleIndex = (ch) => VDIV_SEQUENCE.indexOf(ch.vPerDiv);

const turn = {};
const push = {};
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

/** The V/div the scope shows for a channel (probe · knob V/div): the scale of its trace in volts. */
export const shownVPerDiv = (ch) => ch.vPerDiv * ch.probe;

/**
 * A channel's conditioned signal v(t) in displayed volts (coupling, probe, invert; no noise), or
 * null if nothing is wired to it. Call once per capture: AC coupling samples a period for the mean.
 */
export function channelSignal(settings, name) {
  const v = inputSignal(settings, name);
  if (!v) return null;
  const ch = settings[name];
  const k = ch.probe * (ch.invert ? -1 : 1);
  if (ch.coupling === 'gnd') return () => 0;
  if (ch.coupling === 'dc') return (t) => k * v(t);
  const f = source.state({ settings })[`${name}TrueFreq`];
  let m = 0;
  if (f > 0) {
    for (let i = 0; i < MEAN_POINTS; i++) m += v(i / (MEAN_POINTS * f));
    m /= MEAN_POINTS;
  }
  return (t) => k * (v(t) - m);
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
  return scaledTrace(ch, profile, v, x, times);
}

/** `v` (displayed volts) drawn at a channel's scale and position, whether or not it is displayed. */
export function scaledTrace(ch, profile, v, x, times) {
  const vPerDiv = shownVPerDiv(ch);
  const edge = profile.screen.divY / 2;
  let clipped = false;
  const y = times.map((t) => {
    const yi = v(t) / vPerDiv + ch.position;
    if (yi > edge || yi < -edge) clipped = true;
    return clamp(yi, -edge, edge);
  });
  return { x, y, vPerDiv, position: ch.position, clipped };
}

const COUPLING_MARK = { dc: '', ac: ' ~', gnd: ' ⏚' };

// The CH menus (menus.js): the menu button opens it; pressed again while it is on screen, the
// channel turns off (and the menu closes), as on both Tek models.
const menus = {};
for (const name of VERTICAL_CHANNELS) {
  const field = (key) => [({ settings }) => settings[name][key], ({ settings }, v) => { settings[name][key] = v; }];
  menus[name] = {
    button: `${name}-menu`,
    title: name.toUpperCase(),
    onButton({ settings }, showing) {
      if (showing && settings[name].display) {
        settings[name].display = false;
        return false;
      }
      settings[name].display = true;
      return true;
    },
    items: () => [
      choiceItem('Coupling', [{ value: 'dc', text: 'DC' }, { value: 'ac', text: 'AC' }, { value: 'gnd', text: 'GND' }], ...field('coupling')),
      toggleItem('BW Limit', ...field('bwLimit')),
      choiceItem('Probe', [{ value: 1, text: '1X' }, { value: 10, text: '10X' }], ...field('probe')),
      toggleItem('Invert', ...field('invert')),
    ],
  };
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
  controls,
  menus,
  state({ settings }) {
    const out = {};
    for (const name of VERTICAL_CHANNELS) {
      const ch = settings[name];
      out[`${name}Display`] = ch.display;
      out[`${name}VPerDiv`] = ch.vPerDiv;
      out[`${name}Position`] = ch.position;
      out[`${name}Coupling`] = ch.coupling;
      out[`${name}Probe`] = ch.probe;
      out[`${name}BwLimit`] = ch.bwLimit;
      out[`${name}Invert`] = ch.invert;
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
      out[`${name}Coupling`] = { label: `${n} coupling (dc, ac or gnd)`, unit: '' };
      out[`${name}Probe`] = { label: `${n} probe attenuation setting`, unit: '×' };
      out[`${name}BwLimit`] = { label: `${n} bandwidth limit on`, unit: '' };
      out[`${name}Invert`] = { label: `${n} inverted`, unit: '' };
    }
    return out;
  },
  frame({ settings }, frame) {
    for (const name of VERTICAL_CHANNELS) {
      const ch = settings[name];
      if (!ch.display) continue;
      const marks = `${COUPLING_MARK[ch.coupling]}${ch.bwLimit ? ' B' : ''}`;
      frame.readouts.push({ id: `${name}-scale`, channel: name, text: `${si(shownVPerDiv(ch))}V${marks}` });
    }
  },
};
