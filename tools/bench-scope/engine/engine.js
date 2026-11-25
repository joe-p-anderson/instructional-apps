// The bench-scope engine (Spec 0002): all scope behaviour, DOM-free, testable in Node.
//
//   const engine = createEngine(skinProfile('tbs2072b'), setup)
//
// Input events (every Control action becomes one of these; unknown controls are ignored):
//   engine.turn(control, detents)     knob turned (+ clockwise), control = control-map name
//   engine.push(control)              knob pushed
//   engine.press(control)             button pressed
//   engine.softkey(n)                 softkey n (1-based) pressed
//   engine.setSource(patch)           source panel, e.g. { gen1Freq: 2000 } (see source.js)
//   engine.apply({ type, ... })       the same, as one event object:
//     { type: 'turn', control, detents } | { type: 'push', control } | { type: 'press', control }
//     | { type: 'softkey', n } | { type: 'setSource', patch }
//     | { type: 'set', control, value }   a Control's set(value), e.g. ch1-scale to 0.5 V/div
//     | { type: 'hold', control } | { type: 'release', control }   a button went down / came up
//       (the panel sends these around each press; only hold-to-act buttons such as Trig View use them)
//
// Control values (what the panel's Controls get/set and how knobs are drawn):
//   engine.value(control)             the control's value, or undefined if no feature gives one
//   engine.detent(control)            integer knob position: rotation = detent · the knob's detent
//                                     angle. From the feature's value if it has one, otherwise the
//                                     net detents turned so far (not saved).
//   engine.mpFunction()               what the multipurpose knob does now (a short label, e.g.
//                                     'Cursor 1'), or null; the TDS lights its knob LEDs when non-null
//
// Output:
//   engine.acquire(now) -> frame      now in ms (e.g. performance.now()); see FRAME below. Each
//                                     call is one capture (acquire.js): it advances Single and
//                                     Force Trig, and its noise is seeded by (seed, now)
//   engine.state()                    flat published State { [key]: number|boolean|string }
//   engine.describe()                 { [key]: { label, unit } } for every State key
//   engine.serialize()                JSON-able settings; engine.restore(saved) puts them back
//   engine.profile                    the skin profile it was created with
//
// FRAME:
//   { now, skin, status ('triggered'|'auto'|'waiting'|'stopped'),
//     screen: { width, height, divX, divY },
//     timebase: { sPerDiv, t0 },                     t = t0 + x · sPerDiv
//     traces: { ch1: { x[], y[], vPerDiv, position } }   divisions; x 0..divX, y up from centre
//     readouts: [{ id, text, channel? }],            the renderer places them by id
//     menu: null | { id, title, items: [{ label, value, options } | null] }   (menus.js)
//     cursors: null | { ... },  trigView: true while Trig View is held (traces = the trigger signal),
//     markers: { triggerLevel: { y, channel }, triggerPoint: { x } } }   divisions, see trigger.js
//
// Behaviour is split into feature modules (FEATURES below), each owning one part of the
// settings. A feature is an object with any of:
//   init(settings, setup, profile)      write its defaults (and Setup values) into settings
//   restore(settings, saved, profile)   the same from a serialize() result (clamp, ignore junk)
//   setSource(settings, patch)          apply the source-panel keys it owns
//   turn / push / press: { [control]: (ctx, arg) => void }   input handlers by control name
//   softkey(ctx, n)                     softkey handler
//   state(ctx) -> {}, describe(ctx) -> {}   its part of the published State
//   frame(ctx, frame)                   add readouts, menu, markers... to an acquired frame
//   controls: { [control]: { get(ctx), set(ctx, value), detent?(ctx) } }   Control values; give
//                                       detent() for a knob whose rotation follows its value
//   mpFunction(ctx) -> string|null      the multipurpose knob's current function, if this feature owns it
//   menus: { [id]: menu }               softkey menus it adds (see menus.js); softkeys go to the
//                                       menu on screen, so a feature rarely needs softkey()
//   hold / release: { [control]: (ctx) => void }   a button went down / came up (Trig View)
// where ctx = { settings, profile }. Add a feature by writing a module and listing it in
// SETTINGS_FEATURES below (its menus come with it).

import { acquireTraces, acquisition } from './acquire.js';
import { autosetFeature } from './autoset.js';
import { display } from './display.js';
import { horizontal } from './horizontal.js';
import { measure } from './measure.js';
import { menuSystem } from './menus.js';
import { source } from './source.js';
import { trigger } from './trigger.js';
import { vertical } from './vertical.js';

const SETTINGS_FEATURES = [
  source,
  vertical,
  horizontal,
  trigger,
  acquisition,
  display,
  measure,
  autosetFeature, // last: it sets the features above through their Control hooks
];
// Plus the softkey menus those features define (each feature's `menus` hook, see menus.js).
const FEATURES = [...SETTINGS_FEATURES, menuSystem(SETTINGS_FEATURES)];

const SERIAL_VERSION = 1;

export function createEngine(profile, setup = {}) {
  const ctx = { profile, settings: {} };
  for (const f of FEATURES) f.init?.(ctx.settings, setup || {}, profile);
  const spins = new Map(); // net detents per knob, for knobs whose rotation no feature gives

  const controlHook = (control) => {
    for (const f of FEATURES) if (f.controls?.[control]) return f.controls[control];
    return null;
  };

  function apply(event) {
    if (!event || typeof event !== 'object') return;
    const { type } = event;
    if (type === 'setSource') {
      for (const f of FEATURES) f.setSource?.(ctx.settings, event.patch);
    } else if (type === 'softkey') {
      for (const f of FEATURES) f.softkey?.(ctx, event.n);
    } else if (type === 'turn' || type === 'push' || type === 'press' || type === 'hold' || type === 'release') {
      const arg = type === 'turn' ? Math.trunc(Number(event.detents) || 0) : undefined;
      if (type === 'turn') spins.set(event.control, (spins.get(event.control) ?? 0) + arg);
      for (const f of FEATURES) f[type]?.[event.control]?.(ctx, arg);
    } else if (type === 'set') {
      controlHook(event.control)?.set?.(ctx, event.value);
    }
  }

  return {
    profile,
    apply,
    turn: (control, detents) => apply({ type: 'turn', control, detents }),
    push: (control) => apply({ type: 'push', control }),
    press: (control) => apply({ type: 'press', control }),
    softkey: (n) => apply({ type: 'softkey', n }),
    setSource: (patch) => apply({ type: 'setSource', patch }),

    value: (control) => controlHook(control)?.get?.(ctx),
    detent(control) {
      const hook = controlHook(control);
      return hook?.detent ? hook.detent(ctx) : (spins.get(control) ?? 0);
    },

    mpFunction() {
      for (const f of FEATURES) { const fn = f.mpFunction?.(ctx); if (fn) return fn; }
      return null;
    },

    acquire(now = 0) {
      const { width, height, divX, divY } = profile.screen;
      const frame = {
        now,
        skin: profile.id,
        screen: { width, height, divX, divY },
        ...acquireTraces(ctx, now),
        readouts: [],
        menu: null,
        cursors: null,
        markers: {},
      };
      for (const f of FEATURES) f.frame?.(ctx, frame);
      return frame;
    },

    state() {
      const out = { skin: profile.id };
      for (const f of FEATURES) Object.assign(out, f.state?.(ctx));
      return out;
    },

    describe() {
      const out = { skin: { label: 'Oscilloscope model', unit: '' } };
      for (const f of FEATURES) Object.assign(out, f.describe?.(ctx));
      return structuredClone(out);
    },

    serialize() {
      return { v: SERIAL_VERSION, skin: profile.id, ...structuredClone(ctx.settings) };
    },

    restore(saved) {
      const s = saved && typeof saved === 'object' ? saved : {};
      for (const f of FEATURES) (f.restore ?? f.init)?.(ctx.settings, s, profile);
    },
  };
}

/**
 * A new engine on another skin, carrying over `engine`'s settings: everything both models
 * support is kept, values are clamped to the new profile's ranges (each feature's restore),
 * and menu state resets (features keep it out of restore).
 */
export function switchSkin(engine, profile) {
  const next = createEngine(profile);
  next.restore(engine.serialize());
  return next;
}
