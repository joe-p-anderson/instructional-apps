// Bench Oscilloscope Tool (framework v1, Spec 0002): a front-panel scope modelled on the
// lab's Tektronix TBS2072B (and, from ticket 03, TDS2001C), with a source panel beside it.
//
// Setup: { skin: 'tbs2072b', gen1Wave, gen1Freq, gen1Vpp, gen1Offset } (any subset).
// State: engine.state() (see engine/engine.js and each feature module for keys and units).
// Controls: source panel 'gen1-wave', 'gen1-freq', 'gen1-vpp', 'gen1-offset'.
// Displays: 'screen' (the scope screen at native resolution; the front panel is not included).
//
// Layout: source panel in the Controls column, the front panel (inlined SVG with the screen
// canvas over it) in the Display area. Behaviour lives in the DOM-free engine; this module
// wires the panel binding, the source panel and the renderer to it.

import { controlRegistry } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { h } from '../../framework/v1/ui-kit.js';
import { createEngine } from './engine/engine.js';
import { DEFAULT_SKIN, SKIN_IDS, skinProfile } from './engine/skins.js';
import { createPanel } from './panel.js';
import { renderScreen } from './render.js';
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
.bs-panel .osc-control.bs-pressed .osc-face { transform: translateY(3px); }
.bs-panel .osc-control[data-kind="led"], .bs-panel .osc-control[data-kind="screen"] { cursor: default; }
`;

function ensureStyles(doc) {
  if (doc.getElementById('bench-scope-styles')) return;
  doc.head.append(h('style', { id: 'bench-scope-styles' }, CSS));
}

function mount(container, modeId = 'scope', setup = {}) {
  ensureStyles(container.ownerDocument);
  const skin = SKIN_IDS.includes(setup?.skin) ? setup.skin : DEFAULT_SKIN;
  const profile = skinProfile(skin);
  const engine = createEngine(profile, setup || {});
  const changes = createEmitter();
  let lastState = '';

  // One path for every State change: an engine event, then notify if the State moved.
  function dispatch(event) {
    engine.apply(event);
    draw();
    notify();
  }
  function notify() {
    const s = engine.state();
    const key = JSON.stringify(s);
    if (key === lastState) return;
    lastState = key;
    changes.emit(s);
  }

  const source = createSourcePanel({ values: engine.state(), onPatch: (patch) => dispatch({ type: 'setSource', patch }) });
  const panel = createPanel({ svgText: svgTexts[skin], model: controlMap.models[profile.model], onEvent: dispatch });
  const g = panel.canvas.getContext('2d');

  const root = h('div', { class: 'fw-tool bs-tool', 'data-tool': 'bench-scope' },
    h('aside', { class: 'fw-controls' }, source.el),
    h('div', { class: 'fw-displays' }, panel.el));
  container.append(root);

  function draw(now = performance.now()) {
    renderScreen(g, engine.acquire(now), profile);
  }

  let raf = 0;
  function loop(now) {
    draw(now);
    notify();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  draw();
  lastState = JSON.stringify(engine.state());

  return {
    state: {
      snapshot: () => engine.state(),
      describe: () => engine.describe(),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(source.controls),
    displays: [{
      id: 'screen',
      label: 'Oscilloscope screen',
      async snapshot() {
        draw();
        return panel.canvas.toDataURL('image/png');
      },
    }],
    serialize: () => engine.serialize(),
    restore(saved) {
      engine.restore(saved);
      source.sync(engine.state());
      draw();
      lastState = '';
      notify();
    },
    destroy() {
      cancelAnimationFrame(raf);
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
