// Feature: the time base. Owns settings.horizontal.
//
// settings.horizontal: { sPerDiv (s/div, one of profile.sdivSequence),
//                        position (s: the trigger point's offset from the screen centre, + right) }
//
// Controls (control-map names):
//   hor-scale     turn: + (clockwise) steps s/div down the skin's sequence (faster), clamped at
//                 its ends. Control value: s/div (set snaps to the nearest step).
//   hor-position  turn: moves the trigger point POSITION_STEP divisions per detent (at the current
//                 s/div), kept within the screen; push (TBS) recentres. Control value: seconds.
//   set-to-zero   press (TDS button): recentres, like the TBS push.
// When s/div changes, the position keeps its time and is clamped to the new screen.
// State: hScale (s/div), hPosition (s).

import { clamp, clampNumber, si } from './util.js';

/** Divisions the trigger point moves per Position detent. */
export const POSITION_STEP = 0.2;

const DEFAULT_SPERDIV = 250e-6; // snapped to the skin's sequence (200 µs on the TBS)

/** The sequence value nearest `v` on a log scale, or `fallback` if `v` is not a positive number. */
function snap(seq, v, fallback) {
  if (!(typeof v === 'number' && v > 0 && Number.isFinite(v))) return fallback;
  let best = seq[0];
  for (const s of seq) if (Math.abs(Math.log(s / v)) < Math.abs(Math.log(best / v))) best = s;
  return best;
}

/** The position (s) clamped so the trigger point stays on screen, without float residue. */
function clampPosition(h, profile, p) {
  const lim = (profile.screen.divX / 2) * h.sPerDiv;
  return Number(clamp(p, -lim, lim).toPrecision(6));
}

const step = (h) => POSITION_STEP * h.sPerDiv;
const recentre = ({ settings }) => { settings.horizontal.position = 0; };

function fromSaved(saved, profile) {
  const seq = profile.sdivSequence;
  const s = saved && typeof saved === 'object' ? saved : {};
  const h = { sPerDiv: snap(seq, s.sPerDiv, snap(seq, DEFAULT_SPERDIV)), position: 0 };
  h.position = clampPosition(h, profile, clampNumber(s.position, -Infinity, Infinity, 0));
  return h;
}

export const horizontal = {
  init(settings, setup, profile) { settings.horizontal = fromSaved({}, profile); },
  restore(settings, saved, profile) { settings.horizontal = fromSaved(saved?.horizontal, profile); },
  turn: {
    'hor-scale'({ settings, profile }, detents) {
      const h = settings.horizontal;
      const seq = profile.sdivSequence;
      h.sPerDiv = seq[clamp(seq.indexOf(h.sPerDiv) - detents, 0, seq.length - 1)];
      h.position = clampPosition(h, profile, h.position);
    },
    'hor-position'({ settings, profile }, detents) {
      const h = settings.horizontal;
      h.position = clampPosition(h, profile, h.position + detents * step(h));
    },
  },
  push: { 'hor-position': recentre },
  press: { 'set-to-zero': recentre },
  controls: {
    'hor-scale': {
      get: ({ settings }) => settings.horizontal.sPerDiv,
      set({ settings, profile }, v) {
        const h = settings.horizontal;
        h.sPerDiv = snap(profile.sdivSequence, v, h.sPerDiv);
        h.position = clampPosition(h, profile, h.position);
      },
      detent: ({ settings, profile }) => -profile.sdivSequence.indexOf(settings.horizontal.sPerDiv),
    },
    'hor-position': {
      get: ({ settings }) => settings.horizontal.position,
      set({ settings, profile }, v) {
        const h = settings.horizontal;
        h.position = clampPosition(h, profile, clampNumber(v, -Infinity, Infinity, h.position));
      },
      detent: ({ settings }) => Math.round(settings.horizontal.position / step(settings.horizontal)),
    },
  },
  state: ({ settings }) => ({ hScale: settings.horizontal.sPerDiv, hPosition: settings.horizontal.position }),
  describe: () => ({
    hScale: { label: 'Horizontal scale', unit: 's/div' },
    hPosition: { label: 'Horizontal position (trigger point from screen centre)', unit: 's' },
  }),
  frame({ settings }, frame) {
    frame.readouts.push({ id: 'timebase', text: `M ${si(settings.horizontal.sPerDiv)}s` });
  },
};
