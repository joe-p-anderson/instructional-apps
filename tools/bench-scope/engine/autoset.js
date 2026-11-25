// Feature: the Autoset button (Tek-like). Owns no settings; it rewrites the other features'
// settings through their Control hooks, so their clamping and snapping still apply.
//
//   autoset   press:
//     - turns CH1 on if no channel with a signal is displayed;
//     - per displayed channel: DC coupling, the V/div whose trace spans closest to SPAN_TARGET
//       divisions (on a log scale; the 1-2-5 steps can't always land inside 4–6), centred; if a
//       DC offset is beyond the Position range, the next larger V/div that keeps it on screen;
//     - s/div showing closest to CYCLES_TARGET cycles of the lowest-frequency displayed channel,
//       horizontal position 0;
//     - trigger on CH1 (or the only displayed channel), rising, at 50% of its range, Auto mode;
//     - acquisition running; display format YT (display.js).
//
// The signal's range and frequency are what the real scope's analysis would find: one period of
// the ideal input signal and the source's fundamental frequency (as its frequency counter would).

import { acquisition, NOISE_RMS } from './acquire.js';
import { display } from './display.js';
import { horizontal } from './horizontal.js';
import { inputSignal, source } from './source.js';
import { trigger } from './trigger.js';
import { clamp } from './util.js';
import { POSITION_LIMIT, vertical, VERTICAL_CHANNELS, VDIV_SEQUENCE } from './vertical.js';

/** Divisions the trace should span, and cycles to show (log-nearest step is chosen). */
export const SPAN_TARGET = 5;
export const CYCLES_TARGET = 2.5;

const GRID = 2048;

/** The sequence value whose `measure(value)` is log-nearest `target`. */
function nearest(seq, measure, target) {
  let best = seq[0];
  let bestErr = Infinity;
  for (const s of seq) {
    const err = Math.abs(Math.log(measure(s) / target));
    if (err < bestErr) { best = s; bestErr = err; }
  }
  return best;
}

/** { freq, min, max } of a channel's input signal, or null when it has none. */
function analyse(settings, ch) {
  const v = inputSignal(settings, ch);
  const freq = source.state({ settings })[`${ch}TrueFreq`];
  if (!v || !(freq > 0)) return null;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < GRID; k++) {
    const y = v((k + 0.37) / GRID / freq);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { freq, min, max };
}

/** Whether min..max (V), centred as far as Position allows, stays on screen with a noise margin. */
function fits(profile, vPerDiv, min, max) {
  const pos = clamp(-(max + min) / 2 / vPerDiv, -POSITION_LIMIT, POSITION_LIMIT);
  const edge = profile.screen.divY / 2;
  const m = (4 * NOISE_RMS) / vPerDiv;
  return max / vPerDiv + pos + m <= edge && min / vPerDiv + pos - m >= -edge;
}

function set(ctx,feature, control, value) { feature.controls[control].set(ctx, value); }

function autoset(ctx) {
  const { settings, profile } = ctx;
  let shown = VERTICAL_CHANNELS.filter((ch) => settings[ch].display && analyse(settings, ch));
  if (shown.length === 0) { settings.ch1.display = true; shown = analyse(settings, 'ch1') ? ['ch1'] : []; }

  for (const ch of shown) {
    // Hook for ticket 05 (CH menu coupling): DC coupling, if the setting exists.
    if ('coupling' in settings[ch]) settings[ch].coupling = 'dc';
    const { min, max } = analyse(settings, ch);
    const pp = Math.max(max - min, 1e-6);
    let i = VDIV_SEQUENCE.indexOf(nearest(VDIV_SEQUENCE, (s) => pp / s, SPAN_TARGET));
    // A large DC offset can need more Position than the knob has: step up until it fits.
    while (i < VDIV_SEQUENCE.length - 1 && !fits(profile, VDIV_SEQUENCE[i], min, max)) i++;
    set(ctx, vertical, `${ch}-scale`, VDIV_SEQUENCE[i]);
    set(ctx, vertical, `${ch}-position`, -(max + min) / 2 / VDIV_SEQUENCE[i]);
  }

  if (shown.length) {
    const fLow = Math.min(...shown.map((ch) => analyse(settings, ch).freq));
    const sPerDiv = nearest(profile.sdivSequence, (s) => s * profile.screen.divX * fLow, CYCLES_TARGET);
    set(ctx, horizontal, 'hor-scale', sPerDiv);
    set(ctx, horizontal, 'hor-position', 0);

    const src = shown.includes('ch1') ? 'ch1' : shown[0];
    const { min, max } = analyse(settings, src);
    Object.assign(settings.trigger, { source: src, slope: 'rising', mode: 'auto' });
    set(ctx, trigger, 'trig-level', (min + max) / 2);
  }

  if (acquisition.state(ctx).runState !== 'running') acquisition.press['run-stop'](ctx);
  display.reset(settings);
}

export const autosetFeature = { press: { autoset } };
