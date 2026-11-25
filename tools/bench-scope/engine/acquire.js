// Acquisition: capture the input signals across the screen (with noise), place the edge trigger,
// and run the Run/Stop, Single and Force Trig state. Pure, no DOM.
//
// A capture at time `now` (ms) looks for a trigger crossing at or after now/1000 s of signal
// time. Triggered: the crossing sits at the screen centre plus the horizontal position.
// No crossing: Auto (or Force Trig) captures at an arbitrary phase (now/1000 s), so successive
// captures drift; Normal and an armed Single wait and keep showing the last capture.
//
// Signals: each channel's conditioned signal (vertical.js channelSignal: coupling, probe, invert),
// so captures and the trigger work in displayed volts.
//
// Noise: NOISE_RMS volts of Gaussian noise per sample at the input (times the probe setting,
// none with GND coupling; TRIGGER_NOISE_RMS on the trigger comparator), from a
// PRNG seeded by (settings.acquisition.seed, now). The same seed, events and `now` values give
// identical frames; acquire(0) twice gives the same frame.
//
// BW limit: a gentle zero-phase low-pass on each captured record (signal plus noise), the
// BW_LIMIT_KERNEL binomial FIR over neighbouring samples (renormalised at the record ends). It
// leaves the noise at about 0.44 of its rms, rounds ideal edges over a few samples and barely
// touches a sine with tens of samples per cycle. (The real 20 MHz limit is far above these
// signals; the model scales it to the record so its effect on the noise is visible.)
//
// Run state (not saved; restore resets it to running):
//   run-stop    press: running ⇄ stopped (from an armed Single: running)
//   single      press: arm one capture ('single'); after it the scope is 'stopped'
//   force-trig  press: the next capture happens even without a trigger crossing
//
// settings.acquisition: { seed (integer) }. Setup key: seed.
// State: runState 'running' | 'stopped' | 'single', traceStable (bool).
//
// XY format (display.js): no trigger and no time base. Each capture free-runs from now/1000 s
// for XY_CYCLES periods of the slower channel's fundamental (XY_SAMPLES points), so a figure is
// always complete and slightly different frequencies make it turn slowly, as on the bench.
// Run/Stop and Single work as in YT (a stopped XY display holds its figure).

import { isXY } from './display.js';
import { source } from './source.js';
import { clamp } from './util.js';
import { channelSignal, channelTrace, scaledTrace, shownVPerDiv, VERTICAL_CHANNELS } from './vertical.js';

export const CHANNELS = VERTICAL_CHANNELS;

/** Noise at each input, volts rms. */
export const NOISE_RMS = 0.008;
/** Noise on the trigger comparator, volts rms (band-limited: less than on the samples). */
export const TRIGGER_NOISE_RMS = 0.002;
/** The BW limit filter: binomial weights C(8, k) / 256 over the 9 samples centred on each one. */
export const BW_LIMIT_KERNEL = [1, 8, 28, 56, 70, 56, 28, 8, 1].map((w) => w / 256);
/** The rms of white noise after the BW limit filter, relative to before (about 0.44). */
const BW_LIMIT_NOISE = Math.sqrt(BW_LIMIT_KERNEL.reduce((s, w) => s + w * w, 0));
const DEFAULT_SEED = 1;
const GRID = 2048; // points per period when searching for crossings
/** XY capture: periods of the slower channel, and points per capture. */
export const XY_CYCLES = 4;
export const XY_SAMPLES = 1000;

// Live acquisition state per engine, keyed by its settings object: not part of serialize().
const lives = new WeakMap();
const freshLive = () => ({ run: 'running', force: false, last: null, lastXY: null, lastNow: 0, status: 'waiting' });
function liveOf(settings) {
  if (!lives.has(settings)) lives.set(settings, freshLive());
  return lives.get(settings);
}

// --- seeded noise ---------------------------------------------------------------------------

function mix(h, n) {
  h = Math.imul(h ^ (n | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return h ^ (h >>> 16);
}

/** A PRNG of standard normal values for one capture and stream. */
function gaussians(seed, now, stream) {
  const k = Math.round(now * 1000); // µs
  let a = mix(mix(mix(mix(0x9e3779b9, seed), k % 0x100000000), Math.floor(k / 0x100000000)), stream) >>> 0;
  const uniform = () => { // mulberry32
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}

// --- the trigger ----------------------------------------------------------------------------

/** The source channel's fundamental frequency (Hz), from the source's ground truth. */
function sourceFreq(settings, ch) {
  const s = source.state({ settings });
  return s[`${ch}TrueFreq`] ?? s.ch1TrueFreq;
}

/** Ideal min and max of the periodic signal v over one period P. */
function range(v, P) {
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < GRID; k++) {
    const y = v((P * (k + 0.37)) / GRID);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

/** The first `slope` crossing of `level` by the periodic signal v at or after time `from`, or null. */
function nextCrossing(v, P, level, slope, from) {
  if (!(P > 0 && Number.isFinite(P))) return null;
  const sign = slope === 'falling' ? -1 : 1;
  const above = (t) => sign * (v(t) - level) >= 0;
  let best = null;
  let prevT = (P * (0.37 - 1)) / GRID;
  let prev = above(prevT);
  for (let k = 0; k <= GRID; k++) {
    const t = (P * (k + 0.37)) / GRID;
    const cur = above(t);
    if (cur && !prev) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (above(m)) hi = m; else lo = m; }
      const c = ((hi % P) + P) % P;
      const abs = c + Math.ceil((from - c) / P) * P;
      if (best === null || abs < best) best = abs;
    }
    prevT = t;
    prev = cur;
  }
  return best;
}

/** Whether the trigger settings give a valid crossing on the ideal source signal (noise margin). */
function validCrossing(settings) {
  const { source: ch, level } = settings.trigger;
  const v = channelSignal(settings, ch);
  const f = sourceFreq(settings, ch);
  if (!v || !(f > 0)) return false;
  const { min, max } = range(v, 1 / f);
  const margin = 3 * NOISE_RMS * noiseFactor(settings[ch]);
  return level > min + margin && level < max - margin;
}

/** A channel's noise at the input relative to NOISE_RMS, in displayed volts. */
const inputNoise = (ch) => (ch.coupling === 'gnd' ? 0 : ch.probe);

/** A channel's noise on the captured record (after any BW limit) relative to NOISE_RMS. */
const noiseFactor = (ch) => inputNoise(ch) * (ch.bwLimit ? BW_LIMIT_NOISE : 1);

/** The record `v` through the BW limit filter (zero-phase; the kernel renormalised at the ends). */
function bwLimit(v) {
  const half = (BW_LIMIT_KERNEL.length - 1) / 2;
  return v.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j < 0 || j >= v.length) continue;
      sum += BW_LIMIT_KERNEL[k + half] * v[j];
      weight += BW_LIMIT_KERNEL[k + half];
    }
    return sum / weight;
  });
}

/** One channel's noisy record at the sample times `times` (BW limited if the channel says so). */
function record(settings, ch, v, times, g) {
  const rms = NOISE_RMS * inputNoise(settings[ch]);
  const raw = times.map((t) => v(t) + rms * g());
  return settings[ch].bwLimit ? bwLimit(raw) : raw;
}

// --- capture --------------------------------------------------------------------------------

function sampleX(profile) {
  const n = profile.recordLength;
  return Array.from({ length: n }, (_, i) => (i * profile.screen.divX) / (n - 1));
}

/** Noisy volts per wired channel at the sample times starting at t0. */
function captureVolts(settings, profile, t0, sPerDiv, now) {
  const x = sampleX(profile);
  const volts = {};
  CHANNELS.forEach((ch, idx) => {
    const v = channelSignal(settings, ch);
    if (!v) return;
    const g = gaussians(settings.acquisition.seed, now, idx + 1);
    volts[ch] = record(settings, ch, v, x.map((xi) => t0 + xi * sPerDiv), g);
  });
  return volts;
}

/** Draw a stored capture with the current vertical settings. */
function show(settings, profile, cap, status) {
  const x = sampleX(profile);
  const traces = {};
  if (cap) {
    const idx = x.map((_, i) => i);
    for (const ch of CHANNELS) {
      const vs = cap.volts[ch];
      const trace = vs && channelTrace(settings, profile, ch, (i) => vs[i], x, idx);
      if (trace) traces[ch] = trace;
    }
  }
  const { sPerDiv, position } = settings.horizontal;
  const timebase = cap ? { sPerDiv: cap.sPerDiv, t0: cap.t0 } : { sPerDiv, t0: -(profile.screen.divX / 2) * sPerDiv - position };
  return { status, timebase, traces };
}

/**
 * The acquisition part of a frame: { status, timebase, traces }.
 *   status    'triggered' | 'auto' (free-running) | 'waiting' | 'stopped'
 *   timebase  { sPerDiv, t0 }: the time (s) at x = 0, so t = t0 + x · sPerDiv
 *   traces    { [channel]: { x[], y[], vPerDiv, position, clipped } } in divisions: x from 0 (left
 *             edge) to divX, y from the centre line (up positive), so volts = (y − position) · vPerDiv;
 *             clipped at the screen edges (see vertical.js). Channels that are off are absent.
 */
export function acquireTraces(ctx, now = 0) {
  const out = capture(ctx, now);
  liveOf(ctx.settings).status = out.status;
  return out;
}

/**
 * The acquisition part of a frame without capturing: the last capture (traces or XY figure) drawn
 * with the current settings, and the status it had ('stopped' if the scope was stopped since).
 * Single and Force Trig stay pending. For redrawing after an input event.
 */
export function heldTraces({ settings, profile }) {
  const live = liveOf(settings);
  const status = live.run === 'stopped' ? 'stopped' : live.status;
  return isXY(settings) ? xyView(settings, profile, live, status) : show(settings, profile, live.last, status);
}

/** The `now` (ms) of the last capture. */
export const lastCaptureNow = ({ settings }) => liveOf(settings).lastNow;

function capture({ settings, profile }, now) {
  const live = liveOf(settings);
  live.lastNow = now;
  if (isXY(settings)) return acquireXY(settings, profile, live, now);
  if (live.run === 'stopped') return show(settings, profile, live.last, 'stopped');

  const { sPerDiv, position } = settings.horizontal;
  const trig = settings.trigger;
  const from = now / 1000;
  const v = channelSignal(settings, trig.source);
  const level = trig.level + TRIGGER_NOISE_RMS * gaussians(settings.acquisition.seed, now, 0)();
  const crossing = v ? nextCrossing(v, 1 / sourceFreq(settings, trig.source), level, trig.slope, from) : null;

  let t0;
  if (crossing !== null) t0 = crossing - (profile.screen.divX / 2) * sPerDiv - position;
  else if (live.force || (trig.mode === 'auto' && live.run === 'running')) t0 = from;
  else return show(settings, profile, live.last, 'waiting');

  const forced = crossing === null && live.force;
  live.force = false;
  live.last = { t0, sPerDiv, volts: captureVolts(settings, profile, t0, sPerDiv, now), triggered: crossing !== null };
  let status = crossing !== null || forced ? 'triggered' : 'auto';
  if (live.run === 'single') { live.run = 'stopped'; status = 'stopped'; }
  return show(settings, profile, live.last, status);
}

// --- XY ---------------------------------------------------------------------------------------

/** Noisy CH1 and CH2 volts over XY_CYCLES periods of the slower channel from now/1000 s, or null. */
function captureXY(settings, now) {
  const v1 = channelSignal(settings, 'ch1');
  const v2 = channelSignal(settings, 'ch2');
  if (!v1 || !v2) return null;
  const s = source.state({ settings });
  const f = Math.min(...[s.ch1TrueFreq, s.ch2TrueFreq].filter((fi) => fi > 0));
  const span = Number.isFinite(f) ? XY_CYCLES / f : 1e-3;
  const t0 = now / 1000;
  const out = {};
  for (const [idx, ch, v] of [[1, 'ch1', v1], [2, 'ch2', v2]]) {
    const g = gaussians(settings.acquisition.seed, now, idx);
    const times = Array.from({ length: XY_SAMPLES }, (_, i) => t0 + (i * span) / (XY_SAMPLES - 1));
    out[ch] = record(settings, ch, v, times, g);
  }
  return out;
}

/** CH1 against CH2 in divisions, clipped to the screen. */
function xyTrace(settings, profile, cap) {
  const { divX, divY } = profile.screen;
  let clipped = false;
  const fit = (v, lo, hi) => { if (v < lo || v > hi) clipped = true; return clamp(v, lo, hi); };
  const [c1, c2] = [settings.ch1, settings.ch2];
  const x = cap.ch1.map((v) => fit(divX / 2 + v / shownVPerDiv(c1) + c1.position, 0, divX));
  const y = cap.ch2.map((v) => fit(v / shownVPerDiv(c2) + c2.position, -divY / 2, divY / 2));
  return { x, y, clipped };
}

function acquireXY(settings, profile, live, now) {
  let status = 'stopped';
  if (live.run !== 'stopped') {
    live.lastXY = captureXY(settings, now);
    status = 'auto';
    if (live.run === 'single') live.run = 'stopped';
  }
  return xyView(settings, profile, live, status);
}

/** The XY part of a frame from the last XY capture. */
function xyView(settings, profile, live, status) {
  const { sPerDiv, position } = settings.horizontal;
  const out = { status, timebase: { sPerDiv, t0: -(profile.screen.divX / 2) * sPerDiv - position }, traces: {} };
  if (live.lastXY) out.xy = xyTrace(settings, profile, live.lastXY);
  return out;
}

/** A channel's volts in the last capture (or a fresh one at the last `now`), or null if unwired. */
function acquiredVolts(ctx, ch) {
  const { settings, profile } = ctx;
  const live = liveOf(settings);
  let vs = live.last?.volts[ch];
  if (!vs) {
    const { sPerDiv, position } = settings.horizontal;
    vs = captureVolts(settings, profile, -(profile.screen.divX / 2) * sPerDiv - position, sPerDiv, live.lastNow)[ch];
  }
  return vs ?? null;
}

/** Min and max volts of a channel in the last capture (or a fresh one at the last `now`). */
export function acquiredRange(ctx, ch) {
  const vs = acquiredVolts(ctx, ch);
  if (!vs) return null;
  return { min: Math.min(...vs), max: Math.max(...vs) };
}

/** A channel's last capture as a trace at its scale, even if the channel is off (Trig View). */
export function acquiredTrace(ctx, ch) {
  const vs = acquiredVolts(ctx, ch);
  if (!vs) return null;
  const x = sampleX(ctx.profile);
  return scaledTrace(ctx.settings[ch], ctx.profile, (i) => vs[i], x, x.map((_, i) => i));
}

/** The s/div of the last capture (the current setting if nothing has been captured yet). */
export function acquiredSPerDiv({ settings }) {
  return liveOf(settings).last?.sPerDiv ?? settings.horizontal.sPerDiv;
}

function seedFrom(v, fallback) { return Number.isInteger(v) ? v : fallback; }

/** Feature: the acquisition settings (noise seed) and the Run/Stop, Single and Force Trig buttons. */
export const acquisition = {
  init(settings, setup) {
    settings.acquisition = { seed: seedFrom(setup?.seed, DEFAULT_SEED) };
    lives.set(settings, freshLive());
  },
  restore(settings, saved) {
    settings.acquisition = { seed: seedFrom(saved?.acquisition?.seed, DEFAULT_SEED) };
    lives.set(settings, freshLive());
  },
  press: {
    'run-stop'({ settings }) {
      const live = liveOf(settings);
      live.run = live.run === 'running' ? 'stopped' : 'running';
    },
    single({ settings }) { liveOf(settings).run = 'single'; },
    'force-trig'({ settings }) {
      const live = liveOf(settings);
      if (live.run !== 'stopped') live.force = true;
    },
  },
  state({ settings }) {
    const live = liveOf(settings);
    const stable = live.run === 'stopped' && live.last ? live.last.triggered : live.run !== 'stopped' && validCrossing(settings);
    return { runState: live.run, traceStable: stable };
  },
  describe: () => ({
    runState: { label: 'Acquisition run state (running, stopped or single)', unit: '' },
    traceStable: { label: 'Trace stable (triggered, not free-running)', unit: '' },
  }),
};
