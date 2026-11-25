// Feature: the Measure menu and its automatic readouts. Owns settings.measure.
//
// Readouts are computed from what the scope acquired (the last capture, at the current vertical
// scale, quantised to the ADC's ADC_PER_DIV levels per division), never from the ideal signal:
//   - a channel that clips anywhere on screen makes all its readouts invalid ('?');
//   - a channel that is off (or unwired) has no data: invalid;
//   - a trace smaller than MIN_SPAN_DIV divisions pk-pk gives no timing readouts (invalid), and
//     the amplitude readouts get coarse from the quantisation (a badly scaled trace reads poorly);
//   - frequency and period need two rising edges on screen, rise time one full edge.
// Types (TYPES): freq, period, pkpk, amplitude (histogram high − low), mean and rms (over whole
// cycles when two rising edges are on screen, else the whole record), rise (10–90 %), and the
// CH1→CH2 pair types delay (CH2 rising edge − nearest CH1 rising edge, s) and phase
// (−360 · delay / CH1 period, degrees; + = CH2 leads, so a low-pass at fc = f reads about −45°).
// Edges are crossings of the mid level (halfway between min and max) with 10 % hysteresis.
// Readouts update at most every UPDATE_MS of capture time (as on the real scope), and at once
// when a setting changes.
//
// settings.measure: { slots: [{ source 'ch1' | 'ch2', type 'none' | TYPES id }] (MAX_READOUTS
//   of them on every skin; the TBS uses 6, the TDS the first 5), pick: { source, type } (the TBS Add selection) }.
// Pair types always have source 'ch1' (meaning CH1→CH2).
//
// Menus (button 'measure'), following each skin's style:
//   TBS2072B  1 Source CH1/CH2, 2 Type (the multipurpose knob turns it too while the menu shows;
//             mpFunction 'Measure type'), 3 Add (to the first free slot; no duplicates),
//             4 Remove Last, 5 Remove All. Readouts on screen as 'measure-1'.. (render.js slots).
//   TDS2001C  softkeys 1..5 are the five slots, each box showing its readout ("CH1 Freq" and the
//             value, or "None"); pressing one opens that slot: 1 Source, 2 Type (None, Freq, ...),
//             5 Back. Readouts show only in the Measure menu, as on the TDS2000C.
// Which TDS slot is open is live menu state: not saved, reset by restore and a press of Measure.
//
// State: measureCount, and for k = 1..MAX_READOUTS (the active readouts in slot order; null
// past measureCount): measureKSource ('ch1' | 'ch2' | 'ch1-ch2'), measureKType, measureKValue
// (Hz, s, V or degrees; null when invalid), measureKValid.

import { acquiredSPerDiv, acquiredTrace } from './acquire.js';
import { choiceItem, menuShown } from './menus.js';
import { oneOf, si } from './util.js';

/** ADC levels per vertical division (8 bits over about 10 divisions). */
export const ADC_PER_DIV = 25;
/** Smallest pk-pk (divisions) that gives timing readouts. */
export const MIN_SPAN_DIV = 0.4;
/** Readouts refresh at most this often (ms of capture time). */
export const UPDATE_MS = 250;
/** The most readouts any skin shows. */
export const MAX_READOUTS = 6;

export const TYPES = [
  { id: 'freq', text: 'Freq', unit: 'Hz' },
  { id: 'period', text: 'Period', unit: 's' },
  { id: 'pkpk', text: 'Pk-Pk', unit: 'V' },
  { id: 'amplitude', text: 'Ampl', unit: 'V' },
  { id: 'mean', text: 'Mean', unit: 'V' },
  { id: 'rms', text: 'RMS', unit: 'V' },
  { id: 'rise', text: 'Rise', unit: 's' },
  { id: 'delay', text: 'Delay', unit: 's', pair: true },
  { id: 'phase', text: 'Phase', unit: '°', pair: true },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
const TYPE_IDS = TYPES.map((t) => t.id);
const SOURCES = ['ch1', 'ch2'];
const SOURCE_OPTIONS = [{ value: 'ch1', text: 'CH1' }, { value: 'ch2', text: 'CH2' }];
const TYPE_OPTIONS = TYPES.map((t) => ({ value: t.id, text: t.text }));
const SLOTS = { tbs2072b: 6, tds2001c: 5 };
const slotCount = (profile) => SLOTS[profile.id] ?? 5;

const pages = new WeakMap(); // settings -> TDS slot open in the menu (index) or null
const caches = new WeakMap(); // settings -> { key, now, results }

// --- the measurements -----------------------------------------------------------------------

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Times (s) where v crosses `level` upward, with hysteresis h, interpolated. */
function risingCrossings(v, dt, level, h) {
  const out = [];
  let low = false;
  let lastBelow = -1;
  for (let i = 0; i < v.length; i++) {
    if (v[i] < level) lastBelow = i;
    if (v[i] < level - h) low = true;
    else if (low && v[i] > level + h) {
      low = false;
      const j = lastBelow;
      if (j >= 0 && j + 1 < v.length) out.push((j + (level - v[j]) / (v[j + 1] - v[j])) * dt);
    }
  }
  return out;
}

/** High and low levels by histogram (the most common value in each half), as Tek's Amplitude. */
function levels(v, min, max) {
  const BINS = 50;
  const w = (max - min) / BINS || 1;
  const counts = new Array(BINS).fill(0);
  for (const y of v) counts[Math.min(BINS - 1, Math.floor((y - min) / w))] += 1;
  const peak = (from, to) => {
    let best = from;
    for (let i = from; i < to; i++) if (counts[i] > counts[best]) best = i;
    return min + (best + 0.5) * w;
  };
  return { low: peak(0, BINS / 2), high: peak(BINS / 2, BINS) };
}

/** 10–90 % rise times of every full rising edge (s). */
function riseTimes(v, dt, low, high) {
  const l10 = low + 0.1 * (high - low);
  const l90 = low + 0.9 * (high - low);
  const out = [];
  let armed = false;
  let t10 = null;
  for (let i = 1; i < v.length; i++) {
    if (v[i] < l10) { armed = true; t10 = null; continue; }
    if (armed && t10 === null && v[i - 1] < l10) t10 = (i - 1 + (l10 - v[i - 1]) / (v[i] - v[i - 1])) * dt;
    if (armed && t10 !== null && v[i] >= l90 && v[i - 1] < l90) {
      out.push((i - 1 + (l90 - v[i - 1]) / (v[i] - v[i - 1])) * dt - t10);
      armed = false;
      t10 = null;
    }
  }
  return out;
}

/** Everything one channel's readouts need, or null if there is no usable trace. */
function analyse(tr, sPerDiv, divX) {
  const dt = (sPerDiv * divX) / (tr.x.length - 1);
  const v = tr.y.map((y) => (Math.round(y * ADC_PER_DIV) / ADC_PER_DIV - tr.position) * tr.vPerDiv);
  let min = Infinity;
  let max = -Infinity;
  for (const y of v) { if (y < min) min = y; if (y > max) max = y; }
  const pkpk = max - min;
  const timing = pkpk / tr.vPerDiv >= MIN_SPAN_DIV;
  const rises = timing ? risingCrossings(v, dt, (min + max) / 2, 0.1 * pkpk) : [];
  const period = rises.length >= 2 ? (rises[rises.length - 1] - rises[0]) / (rises.length - 1) : null;
  const cyc = rises.length >= 2 ? v.slice(Math.ceil(rises[0] / dt), Math.floor(rises[rises.length - 1] / dt) + 1) : v;
  const { low, high } = levels(v, min, max);
  const rise = timing ? riseTimes(v, dt, low, high) : [];
  return {
    clipped: tr.clipped,
    rises,
    values: {
      freq: period ? 1 / period : null,
      period,
      pkpk,
      amplitude: high - low,
      mean: avg(cyc),
      rms: Math.sqrt(avg(cyc.map((y) => y * y))),
      rise: rise.length ? avg(rise) : null,
    },
  };
}

/** CH2 edge minus the nearest CH1 edge, averaged (s), and the CH1 period. */
function delayOf(a1, a2) {
  const T = a1.values.period;
  if (!T || !a2.rises.length) return null;
  const d = a1.rises.map((t1) => {
    let best = null;
    for (const t2 of a2.rises) if (best === null || Math.abs(t2 - t1) < Math.abs(best)) best = t2 - t1;
    return best - T * Math.round(best / T);
  });
  return avg(d);
}

/** [{ source, type, value, valid }] for the active slots, from the last capture. */
function compute(ctx) {
  const { settings, profile } = ctx;
  const sPerDiv = acquiredSPerDiv(ctx);
  const chan = {};
  for (const ch of SOURCES) {
    const tr = settings[ch].display ? acquiredTrace(ctx, ch) : null;
    chan[ch] = tr ? analyse(tr, sPerDiv, profile.screen.divX) : null;
  }
  return settings.measure.slots.filter((s) => s.type !== 'none').map(({ source, type }) => {
    let value = null;
    if (TYPE[type].pair) {
      const [a1, a2] = [chan.ch1, chan.ch2];
      if (a1 && a2 && !a1.clipped && !a2.clipped) {
        const d = delayOf(a1, a2);
        if (d !== null) value = type === 'delay' ? d : -360 * d / a1.values.period;
      }
    } else {
      const a = chan[source];
      if (a && !a.clipped) value = a.values[type];
    }
    const valid = value !== null && Number.isFinite(value);
    return { source: TYPE[type].pair ? 'ch1-ch2' : source, type, value: valid ? value : null, valid };
  });
}

/** The readouts, recomputed when a setting changed or UPDATE_MS after the last update. */
function results(ctx, now) {
  const key = JSON.stringify(ctx.settings);
  const c = caches.get(ctx.settings);
  const due = now !== undefined && c && (now - c.now >= UPDATE_MS || now < c.now);
  if (c && c.key === key && !due) return c.results;
  const r = compute(ctx);
  caches.set(ctx.settings, { key, now: now ?? c?.now ?? 0, results: r });
  return r;
}

// --- text -----------------------------------------------------------------------------------

const valueText = (r) => {
  if (!r.valid) return '?';
  const { unit } = TYPE[r.type];
  return unit === '°' ? `${r.value.toFixed(1)}°` : `${si(r.value)}${unit}`;
};
const nameText = (r) => (TYPE[r.type].pair ? `${TYPE[r.type].text} 1→2` : TYPE[r.type].text);
const sourceText = (r) => (r.source === 'ch1-ch2' ? 'CH1' : r.source.toUpperCase());

// --- settings -------------------------------------------------------------------------------

const none = () => ({ source: 'ch1', type: 'none' });

function slotFrom(s) {
  if (!s || typeof s !== 'object' || !TYPE_IDS.includes(s.type)) return none();
  return { source: TYPE[s.type].pair ? 'ch1' : oneOf(s.source, SOURCES, 'ch1'), type: s.type };
}

function fromSaved(saved, profile) {
  // Always MAX_READOUTS slots (so settings are the same on every skin); a skin that shows fewer
  // gets its readouts packed into the slots it has, and the rest cleared.
  const n = slotCount(profile);
  let slots = Array.isArray(saved?.slots) ? saved.slots.slice(0, MAX_READOUTS).map(slotFrom) : [];
  if (slots.slice(n).some((s) => s.type !== 'none')) slots = slots.filter((s) => s.type !== 'none').slice(0, n);
  slots = slots.slice(0, n);
  while (slots.length < MAX_READOUTS) slots.push(none());
  const pick = { source: oneOf(saved?.pick?.source, SOURCES, 'ch1'), type: oneOf(saved?.pick?.type, TYPE_IDS, 'freq') };
  return { slots, pick };
}

const same = (a, b) => a.type === b.type && (TYPE[a.type].pair || a.source === b.source);

function add({ settings, profile }) {
  const m = settings.measure;
  const want = slotFrom(m.pick);
  if (m.slots.some((s) => s.type !== 'none' && same(s, want))) return;
  const i = m.slots.slice(0, slotCount(profile)).findIndex((s) => s.type === 'none');
  if (i >= 0) m.slots[i] = want;
}

function removeLast({ settings }) {
  const { slots } = settings.measure;
  for (let i = slots.length - 1; i >= 0; i--) if (slots[i].type !== 'none') { slots[i] = none(); return; }
}

function stepType(settings, detents) {
  const { pick } = settings.measure;
  const n = TYPE_IDS.length;
  pick.type = TYPE_IDS[(((TYPE_IDS.indexOf(pick.type) + detents) % n) + n) % n];
}

// --- menus ----------------------------------------------------------------------------------

const pickField = (key) => [({ settings }) => settings.measure.pick[key], ({ settings }, v) => { settings.measure.pick[key] = v; }];

function tbsItems(ctx) {
  const m = ctx.settings.measure;
  const count = m.slots.filter((s) => s.type !== 'none').length;
  return [
    choiceItem('Source', SOURCE_OPTIONS, ...pickField('source')),
    choiceItem('Type', TYPE_OPTIONS, ...pickField('type')),
    { label: 'Add', value: `${count}/${slotCount(ctx.profile)}`, select: add },
    { label: 'Remove Last', value: '', select: removeLast },
    { label: 'Remove All', value: '', select: ({ settings }) => { settings.measure.slots = settings.measure.slots.map(none); } },
  ];
}

function tdsSlotItems(k) {
  const slot = ({ settings }) => settings.measure.slots[k];
  return [
    choiceItem('Source', SOURCE_OPTIONS, (c) => slot(c).source, (c, v) => { if (!TYPE[slot(c).type]?.pair) slot(c).source = v; }),
    choiceItem('Type', [{ value: 'none', text: 'None' }, ...TYPE_OPTIONS], (c) => slot(c).type, (c, v) => {
      Object.assign(slot(c), { type: v, source: TYPE[v]?.pair ? 'ch1' : slot(c).source });
    }),
    null,
    null,
    { label: 'Back', value: '', select: ({ settings }) => { pages.set(settings, null); } },
  ];
}

function tdsItems(ctx) {
  const page = pages.get(ctx.settings) ?? null;
  if (page !== null) return tdsSlotItems(page);
  const shown = results(ctx);
  let next = 0;
  return ctx.settings.measure.slots.slice(0, slotCount(ctx.profile)).map((s, k) => {
    const open = { select: ({ settings }) => { pages.set(settings, k); } };
    if (s.type === 'none') return { label: `Meas ${k + 1}`, value: 'None', ...open };
    const r = shown[next++];
    return { label: `${sourceText(r)} ${nameText(r)}`, value: valueText(r), ...open };
  });
}

const menus = {
  measure: {
    button: 'measure',
    title: (ctx) => {
      const page = pages.get(ctx.settings) ?? null;
      return ctx.profile.id === 'tds2001c' && page !== null ? `Measure ${page + 1}` : 'Measure';
    },
    items: (ctx) => (ctx.profile.id === 'tds2001c' ? tdsItems(ctx) : tbsItems(ctx)),
    onButton({ settings }) { pages.set(settings, null); return true; },
  },
};

const usesKnob = (ctx) => ctx.profile.id !== 'tds2001c' && menuShown(ctx.settings) === 'measure';

export const measure = {
  init(settings, setup, profile) {
    settings.measure = fromSaved(null, profile);
    pages.set(settings, null);
    caches.delete(settings);
  },
  restore(settings, saved, profile) {
    settings.measure = fromSaved(saved?.measure, profile);
    pages.set(settings, null);
    caches.delete(settings);
  },
  menus,
  turn: {
    'mp-knob'(ctx, detents) { if (usesKnob(ctx)) stepType(ctx.settings, detents); },
  },
  mpFunction: (ctx) => (usesKnob(ctx) ? 'Measure type' : null),
  state(ctx) {
    const r = results(ctx);
    const out = { measureCount: r.length };
    for (let k = 1; k <= MAX_READOUTS; k++) {
      const m = r[k - 1];
      out[`measure${k}Source`] = m?.source ?? null;
      out[`measure${k}Type`] = m?.type ?? null;
      out[`measure${k}Value`] = m?.value ?? null;
      out[`measure${k}Valid`] = m ? m.valid : null;
    }
    return out;
  },
  describe() {
    const out = { measureCount: { label: 'Number of Measure readouts shown', unit: '' } };
    for (let k = 1; k <= MAX_READOUTS; k++) {
      out[`measure${k}Source`] = { label: `Measure readout ${k} source (ch1, ch2 or ch1-ch2)`, unit: '' };
      out[`measure${k}Type`] = { label: `Measure readout ${k} type (${TYPE_IDS.join(', ')})`, unit: '' };
      out[`measure${k}Value`] = { label: `Measure readout ${k} value (Hz, s, V or degrees by type; null if invalid)`, unit: '' };
      out[`measure${k}Valid`] = { label: `Measure readout ${k} valid`, unit: '' };
    }
    return out;
  },
  frame(ctx, frame) {
    const r = results(ctx, frame.now);
    if (ctx.profile.id === 'tds2001c') return; // shown in the Measure menu
    r.forEach((m, i) => {
      frame.readouts.push({ id: `measure-${i + 1}`, channel: m.source === 'ch1-ch2' ? 'ch1' : m.source, text: `${nameText(m)} ${valueText(m)}` });
    });
  },
};
