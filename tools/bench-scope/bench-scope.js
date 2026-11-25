// Bench Oscilloscope Tool (framework v1, Spec 0002): a front-panel scope modelled on the
// lab's Tektronix TBS2072B or TDS2001C (the skin), with a source panel beside it.
//
// Setup: { skin: 'tbs2072b' | 'tds2001c', gen1Wave, ..., ch2Source, ch2Fc, ..., gen2Phase } (any subset; source keys in engine/source.js).
// State: engine.state() (see engine/engine.js and each feature module for keys and units).
// Controls: 'skin' (the skin switcher, a select), source panel 'gen1-*', 'ch2-source', 'ch2-fc', 'ch2-f0', 'ch2-q', 'gen2-*' (see source-panel.js), and every
//   element of the front panel's control map by its name ('ch1-scale', 'ch1-menu', 'softkey-3',
//   and inert ones such as 'utility' or 'ch1-input'; see panel.js for get/set and engine feature modules for values),
//   and the cursors 'cursor-1', 'cursor-2' (value: position in s from the trigger point or V,
//   null while cursors are off; see engine/cursors.js). A locked cursor ignores the multipurpose
//   knob; a hidden one is not drawn.
// Displays: 'screen' (the scope screen at native resolution; the front panel is not included).
//
// Layout: source panel in the Controls column, the front panel (inlined SVG with the screen
// canvas over it) in the Display area. Behaviour lives in the DOM-free engine; this module
// wires the panel binding, the source panel and the renderer to it.
// Captures: only the animation-frame loop acquires (one capture per frame while running or with
// Single armed; the loop stops while the scope is stopped). Input events and snapshots redraw the
// last capture (engine.frame()), so they never take an armed Single or a pending Force Trig.
//
// Switching skin (the 'skin' Control, or restore() of a save from the other skin) swaps the
// engine for one on the new profile (engine.js switchSkin) and the panel for the new SVG; the
// panel Controls are rebuilt, keeping the lock and hide state of controls both models have.

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { h } from '../../framework/v1/ui-kit.js';
import { DEFAULT_SKIN, SKIN_IDS, skinProfile } from './engine/skins.js';
import { createEngine, switchSkin } from './engine/engine.js';
import { createPanel } from './panel.js';
import { renderScreen } from './render.js';
import { createSkinSwitcher } from './skin-switcher.js';
import { createSourcePanel } from './source-panel.js';

const here = (path) => new URL(path, import.meta.url);
const controlMap = await (await fetch(here('./panels/controls.json'))).json();
const svgTexts = Object.fromEntries(await Promise.all(SKIN_IDS.map(async (id) => {
  const profile = skinProfile(id);
  return [id, await (await fetch(here(`./panels/${profile.panel}`))).text()];
})));

const CSS = `
.bs-tool .fw-displays { overflow: auto; }
.bs-panel { position: relative; width: 100%; line-height: 0; }
.bs-panel-svg { width: 100%; height: auto; display: block; user-select: none; }
.bs-screen { position: absolute; image-rendering: pixelated; pointer-events: none; }
.bs-panel .osc-control { cursor: pointer; }
.bs-panel .osc-control[data-active="false"] { cursor: not-allowed; opacity: .45; }
.bs-panel .osc-control[data-active="true"]:hover .osc-face { filter: brightness(1.08); }
.bs-panel .osc-control.bs-pressed .osc-face { transform: translateY(3px); filter: brightness(.85); }
.bs-panel .osc-control:focus { outline: none; }
.bs-panel .osc-control:focus-visible .osc-face { stroke: #2a7de1; stroke-width: 6px; }
.bs-panel .osc-control.bs-locked { cursor: not-allowed; }
.bs-panel .osc-control.bs-disabled .osc-face { filter: grayscale(1) brightness(.8); opacity: .6; }
.bs-panel .osc-control.bs-locked .osc-face { filter: grayscale(1) brightness(.7); }
.bs-panel .osc-control.bs-locked:hover .osc-face { filter: grayscale(1) brightness(.7); }
.bs-panel .osc-control[data-kind="knob"] { touch-action: none; }
.bs-panel .osc-control[data-kind="led"], .bs-panel .osc-control[data-kind="screen"] { cursor: default; }
.bs-panel .osc-control.bs-lit .osc-led { fill: #39e05c; stroke: #1c8a33; }
`;

function ensureStyles(doc) {
  if (doc.getElementById('bench-scope-styles')) return;
  doc.head.append(h('style', { id: 'bench-scope-styles' }, CSS));
}

function mount(container, modeId = 'scope', setup = {}) {
  ensureStyles(container.ownerDocument);
  const skin = SKIN_IDS.includes(setup?.skin) ? setup.skin : DEFAULT_SKIN;
  let profile = skinProfile(skin);
  let engine = createEngine(profile, setup || {});
  const changes = createEmitter();
  let lastState = '';

  // One path for every State change: an engine event, a redraw of the last capture (an event
  // never captures, so e.g. a knob turn can't take an armed Single), then notify if the State
  // moved. The loop restarts if the event left the scope running (Run/Stop, Single).
  function dispatch(event) {
    if (event?.type === 'turn' && event.control === 'mp-knob' && engine.mpFunction()) {
      if (cursorControls[engine.state().cursorSelected - 1]?.isLocked()) return;
    }
    engine.apply(event);
    panel.sync();
    redraw();
    notify();
    startLoop();
  }
  function notify() {
    const s = engine.state();
    const key = JSON.stringify(s);
    if (key === lastState) return;
    lastState = key;
    changes.emit(s);
  }

  // The cursors, as Controls (they are on the screen, not the panel).
  const cursorControls = ['cursor-1', 'cursor-2'].map((id, i) => createControl({
    id,
    label: `Cursor ${i + 1}`,
    get: () => engine.value(id),
    set: (value) => dispatch({ type: 'set', control: id, value }),
    onHide: () => redraw(),
  }));

  const source = createSourcePanel({ values: engine.state(), onPatch: (patch) => dispatch({ type: 'setSource', patch }) });
  const switcher = createSkinSwitcher({ value: skin, onSwitch: (id) => setSkin(id) });
  const makePanel = () => createPanel({
    svgText: svgTexts[profile.id], model: controlMap.models[profile.model], onEvent: dispatch, values: engine,
  });
  let panel = makePanel();
  let g = panel.canvas.getContext('2d');

  const displaysEl = h('div', { class: 'fw-displays' }, panel.el);
  const root = h('div', { class: 'fw-tool bs-tool', 'data-tool': 'bench-scope' },
    h('aside', { class: 'fw-controls' }, switcher.el, source.el),
    displaysEl);
  container.append(root);

  /** Put the instance on another skin: new engine (from `saved`, or carrying the settings over) and panel. */
  function reskin(id, saved) {
    profile = skinProfile(id);
    if (saved) {
      engine = createEngine(profile);
      engine.restore(saved);
    } else {
      engine = switchSkin(engine, profile);
    }
    const old = new Map(panel.controls.map((c) => [c.id, c]));
    panel.destroy();
    panel = makePanel();
    for (const c of panel.controls) {
      if (old.get(c.id)?.isLocked()) c.lock();
      if (old.get(c.id)?.isHidden()) c.hide();
    }
    displaysEl.append(panel.el);
    g = panel.canvas.getContext('2d');
    switcher.sync(id);
  }

  function setSkin(id) {
    if (!SKIN_IDS.includes(id) || id === profile.id) return;
    reskin(id);
    source.sync(engine.state());
    panel.sync();
    capture();
    notify();
  }

  function render(frame) {
    if (frame.cursors) {
      const hidden = new Set(cursorControls.filter((c) => c.isHidden()).map((c) => c.id));
      frame.cursors.lines = frame.cursors.lines.filter((l) => !hidden.has(l.id));
    }
    renderScreen(g, frame, profile);
  }
  /** Redraw the last capture with the current settings (input events, snapshots): no capture. */
  const redraw = () => render(engine.frame());
  /**
   * Take a capture now: only for an engine that has none yet (mount, a new skin, restore), whose
   * run state is fresh. Otherwise only the animation-frame loop captures.
   */
  function capture() {
    render(engine.acquire(performance.now()));
    startLoop();
  }

  // The animation-frame loop: one capture per frame while running (or Single is armed); it stops
  // while the scope is stopped and startLoop() restarts it after an event.
  let raf = 0;
  function loop(now) {
    raf = 0;
    render(engine.acquire(now));
    notify();
    startLoop();
  }
  function startLoop() {
    if (!raf && engine.state().runState !== 'stopped') raf = requestAnimationFrame(loop);
  }
  capture();
  lastState = JSON.stringify(engine.state());

  const registry = () => controlRegistry([switcher.control, ...Object.values(source.controls), ...panel.controls, ...cursorControls]);

  return {
    state: {
      snapshot: () => engine.state(),
      describe: () => engine.describe(),
      onChange: (fn) => changes.on(fn),
    },
    controls: {
      get: (id) => registry().get(id),
      ids: () => registry().ids(),
    },
    displays: [{
      id: 'screen',
      label: 'Oscilloscope screen',
      async snapshot() {
        redraw();
        return panel.canvas.toDataURL('image/png');
      },
    }],
    serialize: () => engine.serialize(),
    restore(saved) {
      const savedSkin = saved?.skin;
      if (SKIN_IDS.includes(savedSkin) && savedSkin !== profile.id) reskin(savedSkin, saved);
      else engine.restore(saved);
      source.sync(engine.state());
      panel.sync();
      capture(); // restore resets the run state: the restored engine has no capture yet
      lastState = '';
      notify();
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = -1; // startLoop() never schedules again
      changes.clear();
      panel.destroy();
      root.remove();
    },
  };
}

export default defineTool({
  id: 'bench-scope',
  title: 'Bench Oscilloscope',
  modes: [{ id: 'scope', title: 'Oscilloscope' }],
  mount,
});
