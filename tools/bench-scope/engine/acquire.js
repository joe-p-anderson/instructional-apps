// Acquisition: sample the input signals across the screen and map them to screen
// coordinates (graticule divisions). Pure, no DOM.
//
// For now the scope is ideally triggered: the trigger point (t = 0, each generator's rising
// mean crossing) sits at the screen centre plus the horizontal position. Ticket 04 replaces
// this with the edge trigger, Auto/Normal, Run/Stop and noise.

import { inputSignal } from './source.js';

export const CHANNELS = ['ch1'];

/**
 * The acquisition part of a frame: { status, timebase, traces }.
 *   timebase  { sPerDiv, t0 }: the time (s) at x = 0, so t = t0 + x · sPerDiv
 *   traces    { [channel]: { x[], y[], vPerDiv, position } } in divisions: x from 0 (left
 *             edge) to divX, y from the centre line (up positive), so volts = (y − position) · vPerDiv
 */
export function acquireTraces({ settings, profile }) {
  const { divX } = profile.screen;
  const n = profile.recordLength;
  const { sPerDiv, position: hpos } = settings.horizontal;
  const t0 = -(divX / 2) * sPerDiv - hpos;
  const x = Array.from({ length: n }, (_, i) => (i * divX) / (n - 1));

  const traces = {};
  for (const ch of CHANNELS) {
    const v = inputSignal(settings, ch);
    if (!v) continue;
    const { vPerDiv, position } = settings[ch];
    traces[ch] = { x, y: x.map((xi) => v(t0 + xi * sPerDiv) / vPerDiv + position), vPerDiv, position };
  }
  return { status: 'triggered', timebase: { sPerDiv, t0 }, traces };
}
