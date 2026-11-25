// Feature: the edge trigger settings. Owns settings.trigger. The capture itself (finding the
// crossing, Auto/Normal, Run/Stop/Single/Force) is in acquire.js.
//
// settings.trigger: { source 'ch1' | 'ch2', slope 'rising' | 'falling', level (V), mode 'auto' | 'normal' }
//
// Controls (control-map names):
//   trig-level   turn: + (clockwise) raises the level LEVEL_STEP divisions of the source channel
//                per detent, within ±divY divisions of the source's screen centre. push (TBS):
//                Set to 50%. Control value: volts.
//   trig-50      press (TDS "Set To 50%"): the level to the midpoint of the source's acquired range.
//   trig-menu    press: opens the Trigger menu: softkeys 1 Type (Edge only), 2 Source CH1/CH2,
//                3 Slope Rising/Falling, 4 Mode Auto/Normal.
//   trig-view    (TDS) hold: while it is held, the screen shows the trigger signal (the source's
//                conditioned signal, shown even if that channel is off) in place of the channels;
//                release: back to normal. Live, not saved. Control value: held (bool).
// The level is in displayed volts (after the source channel's probe and coupling, vertical.js).
// Frame: readout 'trigger' (source badge, slope, level); markers.triggerLevel { y (div), channel }
// at the level on the source's trace, and markers.triggerPoint { x (div) } at the trigger time;
// frame.trigView = true while Trig View is held.
// State: trigSource, trigSlope, trigLevel (V), trigMode.

import { acquiredRange, acquiredTrace } from './acquire.js';
import { isXY } from './display.js';
import { choiceItem, infoItem } from './menus.js';
import { clamp, oneOf, si } from './util.js';
import { shownVPerDiv } from './vertical.js';

/** Divisions (of the source channel's V/div) the level moves per detent. */
export const LEVEL_STEP = 1 / 25;

const SOURCES = ['ch1', 'ch2'];
const SLOPES = ['rising', 'falling'];
const MODES = ['auto', 'normal'];
const DEFAULTS = { source: 'ch1', slope: 'rising', level: 0, mode: 'auto' };
const SLOPE_GLYPH = { rising: '↑', falling: '↓' };

const tidy = (v) => Math.round(v * 1e9) / 1e9;
const srcCh = (settings) => settings[settings.trigger.source];
const step = (settings) => LEVEL_STEP * shownVPerDiv(srcCh(settings));
const views = new WeakMap(); // settings -> Trig View held (live, not saved)

/** The level clamped to ±divY divisions about the source channel's screen centre. */
function clampLevel(settings, profile, v) {
  const ch = srcCh(settings);
  const centre = -ch.position * shownVPerDiv(ch);
  const span = profile.screen.divY * shownVPerDiv(ch);
  return tidy(clamp(v, centre - span, centre + span));
}

function fromSaved(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    source: oneOf(s.source, SOURCES, DEFAULTS.source),
    slope: oneOf(s.slope, SLOPES, DEFAULTS.slope),
    level: typeof s.level === 'number' && Number.isFinite(s.level) ? s.level : DEFAULTS.level,
    mode: oneOf(s.mode, MODES, DEFAULTS.mode),
  };
}

function setTo50(ctx) {
  const r = acquiredRange(ctx, ctx.settings.trigger.source);
  if (r) ctx.settings.trigger.level = clampLevel(ctx.settings, ctx.profile, (r.min + r.max) / 2);
}

const field = (key) => [({ settings }) => settings.trigger[key], ({ settings, profile }, v) => {
  settings.trigger[key] = v;
  settings.trigger.level = clampLevel(settings, profile, settings.trigger.level);
}];

const menus = {
  trigger: {
    button: 'trig-menu',
    title: 'Trigger',
    items: () => [
      infoItem('Type', 'Edge'),
      choiceItem('Source', [{ value: 'ch1', text: 'CH1' }, { value: 'ch2', text: 'CH2' }], ...field('source')),
      choiceItem('Slope', [{ value: 'rising', text: 'Rising' }, { value: 'falling', text: 'Falling' }], ...field('slope')),
      choiceItem('Mode', [{ value: 'auto', text: 'Auto' }, { value: 'normal', text: 'Normal' }], ...field('mode')),
    ],
  },
};

export const trigger = {
  init(settings) { settings.trigger = { ...DEFAULTS }; views.set(settings, false); },
  restore(settings, saved, profile) {
    settings.trigger = fromSaved(saved?.trigger);
    settings.trigger.level = clampLevel(settings, profile, settings.trigger.level);
    views.set(settings, false);
  },
  menus,
  hold: { 'trig-view': ({ settings }) => { views.set(settings, true); } },
  release: { 'trig-view': ({ settings }) => { views.set(settings, false); } },
  turn: {
    'trig-level'({ settings, profile }, detents) {
      settings.trigger.level = clampLevel(settings, profile, settings.trigger.level + detents * step(settings));
    },
  },
  push: { 'trig-level': setTo50 },
  press: { 'trig-50': setTo50 },
  controls: {
    'trig-level': {
      get: ({ settings }) => settings.trigger.level,
      set({ settings, profile }, v) {
        if (typeof v === 'number' && Number.isFinite(v)) settings.trigger.level = clampLevel(settings, profile, v);
      },
      detent: ({ settings }) => Math.round(settings.trigger.level / step(settings)),
    },
    'trig-view': {
      get: ({ settings }) => views.get(settings) === true,
      set: ({ settings }, v) => { if (typeof v === 'boolean') views.set(settings, v); },
    },
  },
  state({ settings }) {
    const t = settings.trigger;
    return { trigSource: t.source, trigSlope: t.slope, trigLevel: t.level, trigMode: t.mode };
  },
  describe: () => ({
    trigSource: { label: 'Trigger source', unit: '' },
    trigSlope: { label: 'Trigger slope (rising or falling)', unit: '' },
    trigLevel: { label: 'Trigger level', unit: 'V' },
    trigMode: { label: 'Trigger mode (auto or normal)', unit: '' },
  }),
  frame(ctx, frame) {
    const { settings, profile } = ctx;
    if (isXY(settings)) return; // no trigger in XY
    const t = settings.trigger;
    const ch = srcCh(settings);
    const h = settings.horizontal;
    frame.readouts.push({ id: 'trigger', channel: t.source, text: `${SLOPE_GLYPH[t.slope]} ${si(t.level)}V` });
    frame.markers.triggerLevel = { y: t.level / shownVPerDiv(ch) + ch.position, channel: t.source };
    if (views.get(settings)) {
      const tr = acquiredTrace(ctx, t.source);
      frame.traces = tr ? { [t.source]: tr } : {};
      frame.trigView = true;
    }
    frame.markers.triggerPoint = { x: profile.screen.divX / 2 + h.position / h.sPerDiv };
  },
};
