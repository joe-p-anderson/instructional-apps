// Phasors Tool: the time Controls every Mode shares, so the ids, ranges and State entries are the
// same in the Sum and Circuit Modes.
//
// Controls (ids):
//   'omega'   log slider, rad/s, OMEGA_MIN to OMEGA_MAX, with a read-only f = ω/2π readout
//             (a status named "f")
//   'play'    play/pause button: get() is whether it is playing, set(true|false) plays or pauses.
//             Play advances t so that one period takes PERIOD_SECONDS of real time whatever ω is,
//             looping t modulo one period. Locking it pauses it.
//   't'       the t-scrubber: get() is t in s, in [0, T]; set(t) takes any time and wraps it into
//             one period. On screen it is a slider over ωt in degrees ("ωt (°)"), with a t readout.
//   'cursor'  the time cursor: a 1-D kit handle named "Time cursor" over the time plot; its value
//             is ωt in degrees, 0 to 360 (the same instant as 't').
//   Moving the scrubber or the cursor pauses play. Changing ω keeps ωt, so the cursor stays put
//   on a time axis that scales with the period.
//
// timeControls({ omega, onChange }) returns:
//   controls        { omega, play, t, cursor }, to spread into the Mode's controlRegistry
//   frequencyEl     the 'Frequency' section (ω slider and f readout)
//   timeEl          the 'Time' section (play button, scrubber, t readout)
//   cursorEl        the cursor's handle element: put it in a .fw-handle-layer over the time plot
//   attachCursor(toScreen, fromScreen)  toScreen(t s) -> client { x, y } | null and
//                   fromScreen(clientX, clientY) -> t s, from the time plot's frame
//   place()         reposition the cursor after the time plot redraws
//   omega(), t(), period(), playing()
//   state()         { omega, f, t, playing }, for the Mode's State (TIME_STATE_INFO describes it)
//   serialize()     { omega, t }
//   restore(saved)  pauses, then sets each saved field it can (non-numbers ignored, ω clamped,
//                   t wrapped), without calling onChange: the Mode reports once afterwards
//   destroy()       cancels play; after it nothing calls onChange
// onChange() runs after any change to ω, t or playing.

import { createControl } from '../../framework/v1/control.js';
import { h, handle, metric, section, slider } from '../../framework/v1/ui-kit.js';
import { num, timeUnit } from './format.js';

export const OMEGA_MIN = 100; // rad/s
export const OMEGA_MAX = 1e6; // rad/s
export const PERIOD_SECONDS = 4; // real seconds per period while playing
export const TIME_DEFAULTS = { omega: 1000 };

export const TIME_STATE_INFO = {
  omega: { label: 'Angular frequency ω', unit: 'rad/s' },
  f: { label: 'Frequency f = ω/2π', unit: 'Hz' },
  t: { label: 'Time t', unit: 's' },
  playing: { label: 'Playing', unit: '' },
};

const finite = (v) => v !== null && v !== '' && Number.isFinite(Number(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEG = 180 / Math.PI;

export function timeControls({ omega: start = TIME_DEFAULTS.omega, onChange = () => {} } = {}) {
  let phase = 0; // ωt in degrees, [0, 360]: the one source of truth for t
  let frame = null; // play's animation frame, per instance
  let last = null;
  let destroyed = false;
  let quiet = false; // set while a Control is set from here, so its onChange does not echo
  const report = () => { if (!destroyed) onChange(); };

  // ── Frequency ──
  const fReadout = metric({ name: 'f', label: 'f = ω/2π' });
  const omegaCtl = slider({ id: 'omega', name: 'ω', unit: 'rad/s', min: OMEGA_MIN, max: OMEGA_MAX,
    log: true, decimals: 0, value: finite(start) ? clamp(Number(start), OMEGA_MIN, OMEGA_MAX) : TIME_DEFAULTS.omega,
    reset: TIME_DEFAULTS.omega, onChange: () => { showTime(); if (!quiet) report(); } });
  const omega = () => omegaCtl.get();
  const period = () => (2 * Math.PI) / omega();
  const t = () => phase / DEG / omega();

  // ── Time ──
  const tReadout = metric({ name: 't', label: 't' });
  const scrub = slider({ id: 'scrub', name: 'ωt', unit: '°', min: 0, max: 360, step: 1, decimals: 0,
    value: 0, reset: 0, onChange: (v) => { if (!quiet) { pause(); setPhase(v); } } });
  const tCtl = createControl({ id: 't', label: 't', el: scrub.el, get: t,
    set: (v) => { if (!finite(v)) return; pause(); setPhase(wrapPhase(Number(v) * omega() * DEG)); } });

  let cursorScreen = null; let cursorFrom = null;
  const cursor = handle({ id: 'cursor', name: 'Time cursor', min: 0, max: 360, step: 5, coarse: 45,
    value: 0, decimals: 0,
    format: (v) => `t = ${timeText(v / DEG / omega())}, ωt = ${num(v, 0)}°`,
    toScreen: (v) => cursorScreen?.(v / DEG / omega()) ?? null,
    fromScreen: (cx, cy) => (cursorFrom ? cursorFrom(cx, cy) * omega() * DEG : phase),
    onChange: (v) => { pause(); setPhase(v); } });

  function timeText(s) {
    const { unit, scale } = timeUnit(period());
    return `${num(s * scale, 3)} ${unit}`;
  }
  function showTime() {
    fReadout.update(`${num(omega() / (2 * Math.PI), 1)} Hz`);
    tReadout.update(timeText(t()));
    cursor.update(phase);
  }
  const wrapPhase = (p) => ((p % 360) + 360) % 360;

  function setPhase(p, notify = true) {
    phase = clamp(p, 0, 360);
    quiet = true;
    try { if (Math.abs(scrub.get() - phase) > 1e-9) scrub.set(phase); } finally { quiet = false; }
    showTime();
    if (notify) report();
  }

  // ── Play ──
  const playBtn = h('button', { type: 'button', class: 'fw-button', 'aria-label': 'Play', 'aria-pressed': 'false' });
  const playing = () => frame !== null;
  function renderPlay() {
    playBtn.setAttribute('aria-pressed', String(playing()));
    playBtn.textContent = playing() ? '❚❚ Pause' : '▶ Play';
  }
  function tick(ts) {
    frame = requestAnimationFrame(tick);
    const dt = last == null ? 0 : Math.min((ts - last) / 1000, 0.1);
    last = ts;
    if (dt > 0) setPhase(wrapPhase(phase + (dt * 360) / PERIOD_SECONDS));
  }
  function play() {
    if (destroyed || playing() || playCtl.isLocked()) return;
    last = null;
    frame = requestAnimationFrame(tick);
    renderPlay();
    report();
  }
  function stop() {
    if (!playing()) return false;
    cancelAnimationFrame(frame);
    frame = null;
    renderPlay();
    return true;
  }
  function pause() { if (stop()) report(); }
  const setPlaying = (on) => (on ? play() : pause());
  playBtn.addEventListener('click', () => setPlaying(!playing()));
  const playCtl = createControl({ id: 'play', label: 'Play', el: playBtn, get: playing, set: setPlaying,
    onLock: (locked) => { if (locked) pause(); } });
  renderPlay();
  showTime();

  return {
    controls: { omega: omegaCtl, play: playCtl, t: tCtl, cursor },
    frequencyEl: section('Frequency', omegaCtl.el, fReadout.el),
    timeEl: section('Time', playBtn, scrub.el, tReadout.el),
    cursorEl: cursor.el,
    attachCursor(toScreen, fromScreen) { cursorScreen = toScreen; cursorFrom = fromScreen; },
    place: () => cursor.place(),
    omega, t, period, playing,
    state: () => ({ omega: omega(), f: omega() / (2 * Math.PI), t: t(), playing: playing() }),
    serialize: () => ({ omega: omega(), t: t() }),
    restore(saved = {}) {
      stop();
      quiet = true;
      try { if (finite(saved?.omega)) omegaCtl.set(saved.omega); } finally { quiet = false; }
      if (finite(saved?.t)) setPhase(wrapPhase(Number(saved.t) * omega() * DEG), false);
      showTime();
    },
    destroy() {
      destroyed = true;
      stop();
      cursor.destroy?.();
    },
  };
}
