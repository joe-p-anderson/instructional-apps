// Spacetime diagrams Tool (framework v1, Spec 0003). Ported from the old single-file spacetime-diagrams.html (deleted).
// Two frames, K and K′ (K′ moving at v along +x; units have c = 1), drawn side by side.
//
// Mode: 'diagram'.
// Setup: { v, names: { K, Kp }, grid: { K, Kp }, showKp, objs, tool } (any subset; objs in the saved
//   diagram format, see physics.js; tool is the drawing tool selected at the start: 'select',
//   'event', 'worldline', 'rod' or 'join'). Defaults: v = 0, Earth/Ship, both grids, K′ panel
//   shown, no objects, Move tool.
// State (state.snapshot()): v (c), gamma, events, worldlines, rods (counts), diagram (the
//   normalized object list as one JSON string; see conditions.js).
// Condition types (export conditionTypes): st-event, st-worldline, st-rod (see conditions.js).
// Controls (coarse, none per object):
//   'tool-select', 'tool-event', 'tool-worldline', 'tool-rod', 'tool-join'
//       the drawing tools; get() is true for the active one, set(true) picks it. A locked or
//       hidden tool can't be picked (button, shortcut or the sidebar's + button).
//   'v' (slider with number box), 'gamma' (number box), 'flip' (button)
//   'grid-K', 'grid-Kp' (toggles), 'kp-panel' (toggle; hidden also hides the K′ diagram)
//   'primed' (toggle "x′, t′ readouts"; hidden or off hides every x′/t′ readout and input in the
//       sidebar, including an event's K′ coordinate entry, and the K′ tick numbers on the K
//       diagram, whose K′ axes stay; a rod's frame select stays)
//   'measurements' (the measurements panel of the sidebar; get() is the number of measurements)
//   'undo', 'redo', 'export-json', 'import-json' (set(json string or object) imports it),
//   'new' (back to the Setup's diagram, undoable), 'reset-view', 'save-png' (downloads the snapshot)
// Displays: 'diagram' (PNG of the visible diagrams with a header; toScreen(x, t) gives the client
//   position of a K point in the K diagram).
// serialize(): the JSON export format (with the view). restore() also clears undo and redo.
//
// Keyboard: V E W R J pick tools, Delete removes the selection, arrows nudge an event, Ctrl+Z /
// Ctrl+Y undo and redo. Keys act only on the instance that has focus or is under the pointer.

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { button, escapeHtml as esc, h, section, slider, themeVars, toggle } from '../../framework/v1/ui-kit.js';
import {
  DEFAULT_VIEW, PALETTE, VMAX, blankDiagram, byId, convert, eventK, eventsOf, exportDiagram, gamma,
  interval, isSpacelike, normalize, properTime, rodEnd, rodInfo, segmentProperTime, toFrame,
  velocityIn, worldlineCut, worldlinesOf, worldlineSegments,
} from './physics.js';
import { FRAMES, SYM, eqLine, fmt, fmtIn, parseNum } from './format.js';
import { COLOR_VARS, drawPanel, panelGeometry } from './draw.js';
import { conditionTypes, diagramState } from './conditions.js';

const CSS = `
.st-tool { grid-template-columns: 230px minmax(0, 1fr) 290px; position: relative; outline: none; }
.st-tool .fw-controls { font-size: 15px; }
/* In an Activity's side layout (README, "Panel layouts") the Task column takes 330 px, so the
   objects panel moves under the Controls and the diagram keeps the middle width. */
.fw-layout-side .fw-tabpanel:has(> .fw-part-tasks) .st-tool {
  grid-template-columns: 250px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr);
}
.fw-layout-side .fw-tabpanel:has(> .fw-part-tasks) .st-tool > .fw-controls { grid-column: 1; grid-row: 1; border-bottom: 2px solid var(--fw-border-dk); }
.fw-layout-side .fw-tabpanel:has(> .fw-part-tasks) .st-tool > .fw-displays { grid-column: 2; grid-row: 1 / span 2; }
.fw-layout-side .fw-tabpanel:has(> .fw-part-tasks) .st-tool > .st-side {
  grid-column: 1; grid-row: 2; border-left: none; border-right: 2px solid var(--fw-border-dk);
}
.st-tool .fw-section { padding: 8px 10px; }
.st-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.st-tools .fw-button { font-size: 15px; padding: 3px 6px; text-align: left; }
.st-tools .fw-button[aria-pressed="true"] { background: var(--fw-blue); color: #fff; }
.st-tools kbd { font: 12px ui-monospace, monospace; color: var(--fw-text-dim); margin-left: 4px; }
.st-tools .fw-button[aria-pressed="true"] kbd { color: inherit; }
.st-tool .fw-slider { margin-bottom: 6px; }
.st-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.st-actions { display: flex; flex-wrap: wrap; gap: 5px; }
.st-actions .fw-button { font-size: 15px; padding: 2px 7px; }
.st-gamma input { width: 72px; }
.st-tool input[type=text], .st-tool select { font-family: var(--fw-font); font-size: 14px; padding: 1px 4px;
  border: 1px solid var(--fw-border); background: var(--fw-bg); color: var(--fw-text); min-width: 0; }
.st-tool input[type=text]:disabled { color: var(--fw-text-muted); }
.st-displays { gap: 6px; position: relative; padding: 8px 10px; }
/* Two lines reserved for the tool help, so picking another tool doesn't resize (and rescale) the diagram. */
.st-status { font-size: 14px; color: var(--fw-text-dim); min-height: 2.8em; line-height: 1.4; }
.st-status button { font-size: 13px; padding: 0 6px; margin-left: 4px; }
.st-panels { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.st-panels.st-single { grid-template-columns: minmax(0, 1fr); }
.st-panel { margin: 0; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  border: 1.5px solid var(--fw-border-dk); background: var(--fw-surface); }
.st-panel[hidden] { display: none; }
.st-panel figcaption { display: flex; align-items: baseline; gap: 6px; padding: 3px 8px; font-size: 15px;
  border-bottom: 1px solid var(--fw-border); }
.st-panel figcaption .st-ax { color: var(--fw-text-dim); font-style: italic; }
.st-svgwrap { position: relative; flex: 1; min-height: 0; }
.st-svgwrap svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none;
  user-select: none; -webkit-user-select: none; }
.st-tool[data-draw=select] .st-svgwrap svg { cursor: grab; }
.st-tool[data-draw=event] .st-svgwrap svg, .st-tool[data-draw=wl] .st-svgwrap svg,
.st-tool[data-draw=rod] .st-svgwrap svg { cursor: crosshair; }
.st-tool[data-draw=connect] .st-svgwrap svg { cursor: pointer; }
.st-hint { position: absolute; left: 10px; right: 10px; bottom: 10px; text-align: center; font-size: 14px;
  color: var(--fw-text-dim); font-style: italic; pointer-events: none; background: rgba(250,248,242,.9); padding: 4px; }
.st-toast { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); background: var(--fw-text);
  color: var(--fw-surface); padding: 6px 12px; font-size: 14px; opacity: 0; transition: opacity .2s;
  pointer-events: none; max-width: calc(100% - 32px); z-index: 2; }
.st-toast.st-on { opacity: .95; }
.st-side { border-left: 2px solid var(--fw-border-dk); background: var(--fw-surface); overflow-y: auto;
  padding: 0 10px 10px; font-size: 14px; min-height: 0; }
.st-side h2 { font-size: 11px; letter-spacing: .16em; color: var(--fw-text-muted);
  text-transform: uppercase; font-weight: normal; margin: 10px 0 6px; }
.st-side button { font-family: var(--fw-font); font-size: 14px; border: 1px solid var(--fw-border-dk);
  background: none; color: var(--fw-blue); cursor: pointer; padding: 1px 6px; }
.st-side button:disabled { opacity: .45; cursor: not-allowed; }
.st-side .row, .st-side .addrow { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 4px 0; }
.st-side .row label { display: flex; gap: 4px; align-items: center; }
.st-side .empty, .st-side .note { color: var(--fw-text-dim); font-style: italic; font-size: 13px; margin: 4px 0; }
.st-side .item { border: 1px solid var(--fw-border); margin: 5px 0; background: var(--fw-bg); }
.st-side .item.open { border-color: var(--fw-blue); box-shadow: 0 0 0 1px var(--fw-blue); }
.st-side .ihead { display: flex; align-items: center; gap: 6px; padding: 4px 6px; cursor: pointer; }
.st-side .ihead .sw { width: 11px; height: 11px; flex: none; }
.st-side .ihead .kind { font-size: 11px; color: var(--fw-text-muted); text-transform: uppercase; letter-spacing: .05em; }
.st-side .ihead .sum { color: var(--fw-text-dim); font-size: 12px; margin-left: auto; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; min-width: 0; }
.st-side .x { border: none !important; font-size: 17px; line-height: 1; padding: 0 4px !important; color: var(--fw-text-muted) !important; }
.st-side .x:hover { color: var(--fw-red) !important; }
.st-side .ibody { padding: 3px 8px 8px; border-top: 1px solid var(--fw-border); }
.st-side .f { margin: 5px 0; display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
.st-side .f > label { display: flex; gap: 4px; align-items: center; }
.st-side .num { display: inline-flex; gap: 3px; align-items: center; }
.st-side .num span { font-style: italic; min-width: 14px; text-align: right; }
.st-side .num input { width: 56px; }
.st-side .grid2 { display: grid; grid-template-columns: auto 1fr; gap: 3px 6px; align-items: center; margin: 5px 0; }
.st-side .grid2 .fl { font-size: 12px; color: var(--fw-text-dim); }
.st-side .swatches { display: flex; gap: 3px; flex-wrap: wrap; margin: 5px 0; }
.st-side .swb { width: 20px; height: 20px; padding: 0 !important; border: 2px solid transparent !important; }
.st-side .swb.on { border-color: var(--fw-text) !important; box-shadow: inset 0 0 0 2px #fff; }
.st-side .ro { font-size: 13px; margin: 3px 0; }
.st-side .ro .m { font-style: italic; }
.st-side .warn { color: var(--fw-red); font-size: 12.5px; margin: 3px 0; }
.st-side .mform { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin: 5px 0; font-size: 13px; }
.st-side .mform input[type=text] { width: 48px; }
.st-side .mitem { border: 1px solid var(--fw-border); margin: 5px 0; padding: 5px 7px; font-size: 13px; position: relative; background: var(--fw-bg); }
.st-side .mitem .x { position: absolute; top: 2px; right: 3px; }
.st-side .foot { color: var(--fw-text-muted); font-size: 12px; margin-top: 12px; border-top: 1px solid var(--fw-border); padding-top: 6px; }
.st-side .fw-control[hidden] { display: none; }
/* Narrower than 1000 px, Controls + objects panel (520 px) would leave the Display under 480 px. */
@media (max-width: 999.98px) {
  .st-tool { grid-template-columns: minmax(0, 1fr); overflow-y: auto; }
  .st-tool .fw-controls, .st-side { border: none; overflow: visible; }
  .st-panels { grid-template-columns: minmax(0, 1fr); }
  .st-panel .st-svgwrap { flex: none; aspect-ratio: 1 / 1; }
}
`;

// Documents that already carry the stylesheet: one <style> per document, however many instances.
const styled = new WeakSet();
function ensureStyles(doc) {
  if (styled.has(doc)) return;
  styled.add(doc);
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);
}

const STATE_INFO = {
  v: { label: 'Velocity of K′ relative to K, v', unit: 'c' },
  gamma: { label: 'Lorentz factor γ', unit: '' },
  events: { label: 'Number of events', unit: '' },
  worldlines: { label: 'Number of worldlines', unit: '' },
  rods: { label: 'Number of rods', unit: '' },
  diagram: { label: 'Diagram', unit: '' },
};

const TOOLS = [
  { key: 'select', id: 'tool-select', name: 'Move', kbd: 'V', title: 'Move things and pan the view (V)' },
  { key: 'event', id: 'tool-event', name: 'Event', kbd: 'E', title: 'Click to add an event (E)' },
  { key: 'wl', id: 'tool-worldline', name: 'Worldline', kbd: 'W', title: 'Drag to draw a worldline (W)' },
  { key: 'rod', id: 'tool-rod', name: 'Rod', kbd: 'R', title: 'Drag sideways to lay a measuring rod (R)' },
  { key: 'connect', id: 'tool-join', name: 'Join events', kbd: 'J', title: 'Click events in order to join them (J)' },
];

const TOOLHELP = {
  select: '<b>Move:</b> drag events, rod ends, rods (changes their time) or worldlines. Drag empty space to pan; scroll or pinch to zoom.',
  event: '<b>Event:</b> click either diagram to add an event. It snaps to 0.1; hold Shift to place it freely.',
  wl: '<b>Worldline:</b> drag from a point or an event. The slope sets the velocity, capped at the speed of light.',
  rod: '<b>Rod:</b> drag sideways to lay a measuring rod along a line of simultaneity in that panel’s frame. Release near a worldline to attach the end to it.',
  connect: '<b>Join events:</b> click events in order, then press Finish (or Enter).',
};

const OPERABLE = 'input, button, select, textarea';

function mount(container, modeId = 'diagram', setup = {}) {
  const doc = container.ownerDocument;
  ensureStyles(doc);
  const start = () => normalize({ ...blankDiagram(), ...(setup || {}) });
  let S = start();
  let sel = null;            // selected object id (UI only)
  let tool = 'select';
  let connectIds = [];       // pending events for the Join tool
  let drag = null;
  let preview = null;        // drawing preview { P, type, a, b }
  let undoStack = [], redoStack = [], liveActive = false;
  let scrollToSel = false;
  let hovered = false;
  let primedOn = true;       // the 'primed' toggle
  let lastSaved = '';
  const changes = createEmitter();
  const geom = {};
  const v = () => S.v;

  // ── Layout ──
  const svgs = {}, hints = {}, figs = {}, caps = {};
  for (const P of FRAMES) {
    svgs[P] = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgs[P].setAttribute('role', 'img');
    svgs[P].setAttribute('aria-label', `Spacetime diagram in frame ${SYM[P].tag}`);
    svgs[P].dataset.frame = P;
    hints[P] = h('div', { class: 'st-hint' });
    caps[P] = h('span');
    figs[P] = h('figure', { class: 'st-panel', 'data-frame': P },
      h('figcaption', {},
        h('b', { style: `color:var(${COLOR_VARS[P]})` }, SYM[P].tag), caps[P],
        h('span', { class: 'st-ax' }, `(${SYM[P].x}, ${SYM[P].t})`)),
      h('div', { class: 'st-svgwrap' }, svgs[P], hints[P]));
  }
  const panelsEl = h('div', { class: 'st-panels' }, figs.K, figs.Kp);
  const statusEl = h('div', { class: 'st-status', role: 'status' });
  const toastEl = h('div', { class: 'st-toast', role: 'status', 'aria-live': 'polite' });
  const objectsEl = h('div');
  const measBody = h('div');
  const measEl = h('div', { class: 'st-meas' }, h('h2', {}, 'Measurements'), measBody);
  const footEl = h('div', { class: 'foot' }, 'Shortcuts: V E W R J pick tools · Delete removes the selection · arrow keys nudge an event by 0.1 (Shift: 1) · Ctrl+Z / Ctrl+Y · hold Shift while dragging to turn off snapping.');
  const side = h('aside', { class: 'st-side', 'aria-label': 'Objects and measurements' }, objectsEl, measEl, footEl);

  // ── Controls ──
  const controls = {};
  const add = (c) => { controls[c.id] = c; return c; };
  const rerender = () => render();

  const buttonControl = ({ id, name, html, title, onClick }) =>
    add(button({ id, name, label: html, title, onClick: () => onClick(), onLock: rerender, onHide: rerender }));
  // A ui-kit toggle whose value lives in the diagram (undo, restore), not in the checkbox:
  // get() reads the diagram and sync() (each render) mirrors it into the checkbox.
  function toggleControl({ id, name, html, get, set }) {
    const c = toggle({ id, name, label: html, value: get(), onChange: set, onLock: rerender, onHide: rerender });
    const input = c.el.querySelector('input');
    c.get = get;
    c.sync = () => { input.checked = get(); };
    return add(c);
  }

  const toolButtons = {};
  for (const t of TOOLS) {
    const btn = h('button', { type: 'button', class: 'fw-button', 'aria-pressed': 'false', title: t.title, 'aria-label': t.name },
      t.name, h('kbd', {}, t.kbd));
    btn.addEventListener('click', () => setTool(t.key));
    toolButtons[t.key] = btn;
    add(createControl({
      id: t.id, label: `${t.name} tool`, el: btn,
      get: () => tool === t.key,
      set: (on) => { if (on) setTool(t.key); else if (tool === t.key) setTool('select'); },
      onLock: () => { if (tool === t.key && t.key !== 'select') setTool('select'); render(); },
      onHide: () => { if (tool === t.key && t.key !== 'select') setTool('select'); render(); },
    }));
  }
  const toolControl = (key) => controls[TOOLS.find((t) => t.key === key).id];
  const toolUsable = (key) => { const c = toolControl(key); return !c.isLocked() && !c.isHidden(); };

  const vSlider = slider({ id: 'v', name: 'v/c', label: '<i>v</i>/<i>c</i>', min: -VMAX, max: VMAX, step: 0.001,
    value: S.v, reset: 0, decimals: 3, onChange: (val) => { beginLive(); setV(val); render(); } });
  const vRange = vSlider.el.querySelector('input[type=range]');
  const vNum = vSlider.el.querySelector('input[type=number]');
  vRange.title = 'Velocity of K′ relative to K, as a fraction of c';
  const endLiveSoon = () => queueMicrotask(endLive);
  vSlider.el.addEventListener('change', endLiveSoon);
  vSlider.el.addEventListener('click', endLiveSoon);
  vSlider.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') endLiveSoon(); });
  add(createControl({ id: 'v', label: 'v/c', el: vSlider.el, get: () => S.v,
    set: (val) => { const n = Number(val); if (!Number.isFinite(n)) return; checkpoint(); setV(n); render(); },
    onLock: rerender, onHide: rerender }));

  const gInput = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'gamma' });
  const gEl = h('label', { class: 'fw-select st-gamma' }, h('span', { class: 'fw-control-name', html: '<i>γ</i>' }), gInput);
  const applyGamma = (g) => {
    if (!Number.isFinite(g) || g < 1) { toast('γ must be at least 1.'); render(); return; }
    checkpoint();
    const sign = S.v < 0 ? -1 : 1;
    const nv = Math.sqrt(1 - 1 / (g * g));
    if (nv > VMAX) toast(`|v| is capped at ${VMAX}c.`);
    setV(sign * nv);
    render();
  };
  gInput.addEventListener('change', () => applyGamma(parseNum(gInput.value)));
  add(createControl({ id: 'gamma', label: 'γ', el: gEl, get: () => gamma(S.v), set: (g) => applyGamma(Number(g)), onLock: rerender, onHide: rerender }));

  buttonControl({ id: 'flip', name: 'Flip v', html: '± flip', title: 'Reverse the direction of v',
    onClick: () => { checkpoint(); setV(-S.v); render(); } });

  const gridName = { K: h('span'), Kp: h('span') };
  toggleControl({ id: 'grid-K', name: 'K grid', get: () => S.grid.K, set: (on) => { checkpoint(); S.grid.K = on; render(); } });
  toggleControl({ id: 'grid-Kp', name: 'K′ grid', get: () => S.grid.Kp, set: (on) => { checkpoint(); S.grid.Kp = on; render(); } });
  toggleControl({ id: 'kp-panel', name: 'K′ diagram', get: () => S.showKp, set: (on) => { checkpoint(); S.showKp = on; render(); } });
  toggleControl({ id: 'primed', name: 'x′, t′ readouts', html: '<i>x′</i>, <i>t′</i> readouts', get: () => primedOn, set: (on) => { primedOn = on; render(); } });
  controls['grid-K'].el.lastChild.append(' (', gridName.K, ')');
  controls['grid-Kp'].el.lastChild.append(' (', gridName.Kp, ')');

  add(createControl({ id: 'measurements', label: 'Measurements panel', el: measEl,
    get: () => S.objs.filter((o) => o.kind === 'interval' || o.kind === 'ptime').length,
    set: () => {}, onLock: rerender, onHide: rerender }));

  buttonControl({ id: 'undo', name: 'Undo', title: 'Undo (Ctrl+Z)', onClick: () => undo() });
  buttonControl({ id: 'redo', name: 'Redo', title: 'Redo (Ctrl+Y)', onClick: () => redo() });
  buttonControl({ id: 'new', name: 'New diagram', html: 'New', title: 'Clear everything (can be undone)', onClick: () => newDiagram() });
  buttonControl({ id: 'reset-view', name: 'Reset view', onClick: () => { S.view = { ...DEFAULT_VIEW }; render(); } });
  buttonControl({ id: 'export-json', name: 'Export JSON', onClick: () => exportJson() });
  buttonControl({ id: 'save-png', name: 'Save PNG', onClick: () => savePng() });

  // Import: a button that opens a file chooser; set(json) imports directly.
  let imports = 0;
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'JSON file to import' });
  const importBtn = h('button', { type: 'button', class: 'fw-button', 'aria-label': 'Import JSON' }, 'Import JSON');
  const importEl = h('span', { class: 'st-import' }, importBtn, fileInput);
  importBtn.addEventListener('click', () => { if (!controls['import-json'].isLocked()) fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (f) importText(await f.text(), f.name);
  });
  add(createControl({ id: 'import-json', label: 'Import JSON', el: importEl, get: () => imports,
    set: (value) => {
      if (typeof value === 'string') importText(value);
      else if (value && typeof value === 'object') importDiagram(value);
      else fileInput.click();
    },
    onLock: rerender, onHide: rerender }));

  const controlsCol = h('aside', { class: 'fw-controls' },
    section('Tools', h('div', { class: 'st-tools', role: 'toolbar', 'aria-label': 'Drawing tools' },
      ...TOOLS.map((t) => controls[t.id].el))),
    section('Velocity', vSlider.el, h('div', { class: 'st-row' }, gEl, controls.flip.el)),
    section('View', controls['grid-K'].el, controls['grid-Kp'].el, controls['kp-panel'].el, controls.primed.el,
      h('div', { class: 'st-actions' }, controls['reset-view'].el)),
    section('Diagram', h('div', { class: 'st-actions' },
      controls.new.el, controls.undo.el, controls.redo.el, controls['export-json'].el, importEl, controls['save-png'].el)));

  const displaysEl = h('div', { class: 'fw-displays st-displays' }, statusEl, panelsEl, toastEl);
  const root = h('div', { class: 'fw-tool st-tool', 'data-tool': 'spacetime', 'data-draw': 'select', tabindex: '-1' },
    controlsCol, displaysEl, side);
  container.append(root);

  // ── Helpers on the diagram ──
  const showPrimed = () => primedOn && !controls.primed.isHidden();
  const showKpPanel = () => S.showKp && !controls['kp-panel'].isHidden();
  const visibleFrames = () => (showKpPanel() ? FRAMES : ['K']);
  const find = (id) => byId(S, id);
  const evK = (e) => eventK(e, S.v);
  const toF = (F, p) => toFrame(F, p, S.v);
  const conv = (G, P, p) => convert(G, P, p, S.v);
  const wlList = () => worldlinesOf(S);
  const evList = () => eventsOf(S);
  function setV(val) { S.v = Math.max(-VMAX, Math.min(VMAX, val)); }

  // ── History (the view is excluded) ──
  function snapshotJson() { const { view, ...rest } = S; return JSON.stringify(rest); }
  function checkpoint() { undoStack.push(snapshotJson()); if (undoStack.length > 300) undoStack.shift(); redoStack = []; }
  function beginLive() { if (!liveActive) { checkpoint(); liveActive = true; } }
  function endLive() { liveActive = false; }
  function restoreJson(json) {
    const o = JSON.parse(json);
    o.view = S.view;
    S = normalize(o);
    if (sel != null && !find(sel)) sel = null;
    connectIds = connectIds.filter((id) => find(id));
    render();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshotJson()); restoreJson(undoStack.pop()); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshotJson()); restoreJson(redoStack.pop()); }

  // ── Object creation ──
  function nextColor() { const c = PALETTE[S.colorIdx % PALETTE.length]; S.colorIdx++; return c; }
  function nextLabel(kind) {
    if (kind === 'event') {
      const used = new Set(evList().map((e) => e.label));
      for (let r = 0; ; r++) for (let i = 0; i < 26; i++) { const l = String.fromCharCode(65 + i) + (r || ''); if (!used.has(l)) return l; }
    }
    const pre = kind === 'wl' ? 'W' : 'R';
    const used = new Set(S.objs.map((o) => o.label));
    for (let n = 1; ; n++) if (!used.has(pre + n)) return pre + n;
  }
  function addObj(o) { o.id = S.nextId++; S.objs.push(o); sel = o.id; scrollToSel = true; return o; }
  const newEvent = (home, x, t) => addObj({ kind: 'event', home, x, t, color: nextColor(), label: nextLabel('event'), showCoords: false, cone: false });
  const newParamWl = (frame, u, x0) => addObj({ kind: 'wl', mode: 'param', frame, u, x0, color: nextColor(), label: nextLabel('wl'), showEq: false });
  const newRod = (frame, T, x1, x2) => addObj({ kind: 'rod', frame, T, ends: [{ x: x1, wl: null }, { x: x2, wl: null }], color: nextColor(), label: nextLabel('rod'), showEq: false });
  const kindName = (o) => (o.kind === 'event' ? 'event' : o.kind === 'rod' ? 'rod' : o.kind === 'wl' ? 'worldline' : o.kind === 'interval' ? 'interval' : 'proper time');

  function deleteObj(id) {
    const o = find(id);
    if (!o) return;
    checkpoint();
    const del = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const x of S.objs) {
        if (del.has(x.id)) continue;
        if ((x.kind === 'wl' && x.mode === 'chain' && x.ids.some((i) => del.has(i))) || (x.kind === 'interval' && (del.has(x.a) || del.has(x.b))) || (x.kind === 'ptime' && del.has(x.wl))) { del.add(x.id); changed = true; }
      }
    }
    let detached = 0;
    for (const r of S.objs) {
      if (r.kind === 'rod' && !del.has(r.id)) r.ends.forEach((e, i) => { if (e.wl != null && del.has(e.wl)) { e.x = toF(r.frame, rodEnd(r, i, S).pt)[0]; e.wl = null; detached++; } });
    }
    S.objs = S.objs.filter((x) => !del.has(x.id));
    if (del.has(sel)) sel = null;
    connectIds = connectIds.filter((i) => !del.has(i));
    const extra = del.size - 1;
    let msg = `Deleted ${o.label || kindName(o)}`;
    if (extra) msg += ` and ${extra} object${extra > 1 ? 's' : ''} that depended on it`;
    if (detached) msg += `; ${detached} rod end${detached > 1 ? 's' : ''} detached`;
    toast(msg + '. Ctrl+Z to undo.');
    render();
  }

  function newDiagram() {
    checkpoint();
    const view = S.view;
    S = start();
    S.view = view;
    sel = null; connectIds = [];
    toast('Started a new diagram. Ctrl+Z brings the old one back.');
    render();
  }

  // ── JSON import/export, PNG ──
  function importDiagram(o) {
    checkpoint();
    S = normalize(o);
    sel = null; connectIds = [];
    imports += 1;
    render();
  }
  function importText(text, name = 'the file') {
    let o;
    try { o = JSON.parse(text); } catch { toast('That file isn’t a spacetime diagram JSON file.'); return; }
    importDiagram(o);
    toast(`Imported ${name}. Ctrl+Z to undo.`);
  }
  function download(href, filename) {
    const a = h('a', { href, download: filename, hidden: true });
    root.append(a);
    a.click();
    a.remove();
  }
  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportDiagram(S), null, 2)], { type: 'application/json' }));
    download(url, 'spacetime-diagram.json');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function savePng() {
    try { download(await snapshotPng(), 'spacetime-diagram.png'); }
    catch { toast('Could not create the image in this browser.'); }
  }

  /** PNG data URL of the visible diagrams (no selection or preview), each under a header line. */
  async function snapshotPng() {
    const frames = visibleFrames();
    const size = (P) => {
      const w = svgs[P].clientWidth, hh = svgs[P].clientHeight;
      return w && hh ? { w, h: hh } : { w: 480, h: 480 };
    };
    const g = frames.map(size);
    const rK = svgs.K.getBoundingClientRect(), rKp = svgs.Kp.getBoundingClientRect();
    const stacked = frames.length > 1 && rKp.height > 0 && rKp.top > rK.bottom - 1;
    const scale = 2, gap = 16, head = 32;
    const W = stacked ? Math.max(...g.map((a) => a.w)) + 2 * gap : g.reduce((s, a) => s + a.w, 0) + (g.length + 1) * gap;
    const H = stacked ? g.reduce((s, a) => s + a.h + head, 0) + 2 * gap : Math.max(...g.map((a) => a.h)) + head + gap;
    const colors = themeVars(root, COLOR_VARS);
    const ink = themeVars(root, { paper: '--fw-paper', text: '--fw-text', frame: '--fw-border-dk' });
    const c = doc.createElement('canvas');
    c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = ink.paper;
    ctx.fillRect(0, 0, W, H);
    let x = gap, y = 0;
    for (let i = 0; i < frames.length; i++) {
      const P = frames[i], { w, h: hh } = g[i];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">${drawPanel(P, S, w, hh, { primed: showPrimed(), colors })}</svg>`;
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.fillStyle = ink.text;
      ctx.font = '600 15px Georgia, serif';
      ctx.fillText(`${SYM[P].tag} · ${S.names[P]}${i === frames.length - 1 ? `   (v = ${fmt(S.v, 3)}c, γ = ${fmt(gamma(S.v), 3)})` : ''}`, x, y + 21);
      ctx.drawImage(img, x, y + head, w, hh);
      ctx.strokeStyle = ink.frame;
      ctx.strokeRect(x + 0.5, y + head + 0.5, w - 1, hh - 1);
      if (stacked) y += hh + head + gap; else x += w + gap;
    }
    return c.toDataURL('image/png');
  }

  // ── Sidebar ──
  const fname = (F) => `${esc(S.names[F])} (${SYM[F].tag})`;
  const numIn = (id, k, val, label, dis = false) => `<label class="num"><span>${label}</span><input type="text" inputmode="decimal" aria-label="${esc(stripTags(label))}" data-id="${id}" data-k="${k}" data-fk="${id}:${k}" value="${esc(fmtIn(val))}" ${dis ? 'disabled' : ''}></label>`;
  const chk = (id, k, on, label) => `<label><input type="checkbox" data-id="${id}" data-k="${k}" data-fk="${id}:${k}" ${on ? 'checked' : ''}> ${label}</label>`;
  const frameSel = (id, k, val) => `<select data-id="${id}" data-k="${k}" data-fk="${id}:${k}" data-val="${val}">${FRAMES.map((F) => `<option value="${F}">${fname(F)}</option>`).join('')}</select>`;
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }

  function summary(o, primed) {
    if (o.kind === 'event') {
      if (!primed && o.home === 'Kp') { const p = evK(o); return `K: (${fmt(p[0])}, ${fmt(p[1])})`; }
      return `${SYM[o.home].tag}: (${fmt(o.x)}, ${fmt(o.t)})`;
    }
    if (o.kind === 'wl') {
      if (o.mode === 'param') { const sg = worldlineSegments(o, S)[0]; return eqLine(primed ? o.frame : 'K', sg.p, sg.d, S.v); }
      return o.ids.map((i) => find(i)?.label || '?').join(' → ');
    }
    if (o.kind === 'rod') {
      if (!primed && o.frame === 'Kp') return '';
      const i = rodInfo(o, S);
      return `${SYM[o.frame].t} = ${fmt(o.T)}, L = ${fmt(i.LF)}`;
    }
    return '';
  }

  function itemHtml(o, primed) {
    const open = o.id === sel, id = o.id;
    let hh = `<div class="item${open ? ' open' : ''}" data-item="${id}"><div class="ihead" data-act="sel" data-id="${id}"><span class="sw" style="background:${o.color}"></span><b>${esc(o.label || '(no label)')}</b><span class="kind">${kindName(o)}</span><span class="sum">${esc(summary(o, primed))}</span><button class="x" data-act="del" data-id="${id}" aria-label="Delete ${esc(o.label || kindName(o))}" title="Delete">×</button></div>`;
    if (!open) return hh + '</div>';
    hh += `<div class="ibody"><div class="f"><label>Label <input type="text" data-id="${id}" data-k="label" data-fk="${id}:label" value="${esc(o.label)}" style="width:100px"></label></div>`;
    hh += `<div class="swatches">${PALETTE.map((c) => `<button class="swb${c === o.color ? ' on' : ''}" style="background:${c}" data-act="color" data-id="${id}" data-color="${c}" aria-label="Colour ${c}" title="Colour"></button>`).join('')}</div>`;
    if (o.kind === 'event') {
      const pK = evK(o), pKp = toF('Kp', pK);
      hh += `<div class="f"><label>Fixed in ${frameSel(id, 'home', o.home)}</label></div>`;
      hh += `<div class="grid2"><span class="fl">${fname('K')}</span><span>${numIn(id, 'xK', pK[0], 'x')} ${numIn(id, 'tK', pK[1], 't')}</span>`;
      if (primed) hh += `<span class="fl">${fname('Kp')}</span><span>${numIn(id, 'xKp', pKp[0], 'x′')} ${numIn(id, 'tKp', pKp[1], 't′')}</span>`;
      hh += '</div>';
      hh += `<div class="f">${chk(id, 'showCoords', o.showCoords, 'Show coordinates')} ${chk(id, 'cone', o.cone, 'Light cone')}</div>`;
      hh += '<div class="note">“Fixed in” is the frame whose coordinates stay put when you change <i>v</i>.</div>';
    } else if (o.kind === 'wl' && o.mode === 'param') {
      const sg = worldlineSegments(o, S)[0];
      const F = o.frame;
      hh += `<div class="f"><label>Defined in ${frameSel(id, 'frame', F)}</label></div>`;
      if (primed || F === 'K') {
        hh += `<div class="f">${numIn(id, 'u', o.u, 'u')} ${numIn(id, 'x0', o.x0, SYM[F].x + '₀')}</div>`;
        hh += `<div class="note">${SYM[F].x} = u${SYM[F].t} + ${SYM[F].x}₀, with |u| ≤ 1.</div>`;
        hh += `<div class="f">Through point <label class="num"><span>${SYM[F].x}</span><input type="text" aria-label="${SYM[F].x} of point" data-keep data-fk="${id}:thx" inputmode="decimal"></label><label class="num"><span>${SYM[F].t}</span><input type="text" aria-label="${SYM[F].t} of point" data-keep data-fk="${id}:tht" inputmode="decimal"></label><button data-act="through" data-id="${id}">Apply</button></div>`;
      }
      for (const P of primed ? FRAMES : ['K']) hh += `<div class="ro">${fname(P)}: <span class="m">${esc(eqLine(P, sg.p, sg.d, S.v))}</span>, velocity ${fmt(velocityIn(P, sg.d, S.v))}c</div>`;
      hh += `<div class="f">${chk(id, 'showEq', o.showEq, 'Show equation on diagram')}</div>`;
    } else if (o.kind === 'wl') {
      const segs = worldlineSegments(o, S);
      hh += `<div class="ro">Events: ${o.ids.map((i) => esc(find(i)?.label || '?')).join(' → ')}</div>`;
      let tau = 0;
      segs.forEach((sg) => {
        const bad = isSpacelike(sg.d);
        tau += segmentProperTime(sg.d);
        hh += `<div class="ro"><b>${esc(sg.a.label)}→${esc(sg.b.label)}</b>: <span class="m">${esc(eqLine('K', sg.p, sg.d, S.v))}</span>${primed ? ` | <span class="m">${esc(eqLine('Kp', sg.p, sg.d, S.v))}</span>` : ''}${bad ? '' : `, Δτ = ${fmt(segmentProperTime(sg.d))}`}</div>`;
        if (bad) hh += `<div class="warn">${esc(sg.a.label)}→${esc(sg.b.label)} is spacelike, so nothing can travel it. Move an event, or use a rod for a spacelike line.</div>`;
      });
      if (segs.length > 1 || !o.extend) hh += `<div class="ro">Total proper time <span class="m">Δτ</span> = <b>${fmt(tau)}</b></div>`;
      hh += `<div class="f">${segs.length === 1 ? chk(id, 'extend', o.extend, 'Extend past the events') + ' ' : ''}${chk(id, 'showEq', o.showEq, 'Show equation on diagram')}</div>`;
    } else if (o.kind === 'rod') {
      const info = rodInfo(o, S), F = o.frame;
      const coords = primed || F === 'K';
      hh += `<div class="f"><label>Simultaneous in ${frameSel(id, 'frame', F)}</label> ${coords ? numIn(id, 'T', o.T, SYM[F].t + ' =') : ''}</div>`;
      [0, 1].forEach((i) => {
        const end = o.ends[i], E = i ? info.B : info.A;
        const xF = toF(F, E.pt)[0];
        hh += `<div class="f">End ${i + 1}: <select aria-label="End ${i + 1}" data-id="${id}" data-k="end${i}" data-fk="${id}:end${i}" data-val="${end.wl == null ? 'free' : end.wl}"><option value="free">free</option>${wlList().map((w) => `<option value="${w.id}">on ${esc(w.label || 'worldline')}</option>`).join('')}</select> ${coords ? numIn(id, 'ex' + i, xF, SYM[F].x, end.wl != null) : ''}</div>`;
        if (end.wl != null && !E.ok) hh += `<div class="warn">${esc(E.wl.label)} doesn’t reach ${coords ? `${SYM[F].t} = ${fmt(o.T)}` : 'the rod'}, so this end uses its free position.</div>`;
      });
      if (coords) hh += `<div class="ro">Length in ${fname(F)}: <b>L = ${fmt(info.LF)}</b></div>`;
      if (info.parallel) {
        const p = info.parallel;
        hh += `<div class="ro">Ends move at ${fmt(p.u.K)}c in ${fname('K')}${primed ? `, ${fmt(p.u.Kp)}c in ${fname('Kp')}` : ''}.</div>`;
        hh += `<div class="ro">Proper length (rest frame of the ends): <b><span class="m">L</span>₀ = ${fmt(p.L0)}</b></div>`;
        hh += `<div class="ro">Measured in ${fname('K')}: ${fmt(p.L.K)}${primed ? `; in ${fname('Kp')}: ${fmt(p.L.Kp)}` : ''}</div>`;
      } else if (info.nonparallel) hh += '<div class="note">The two end worldlines move at different velocities, so the rod has no single rest frame or proper length.</div>';
      else hh += '<div class="note">Attach both ends to worldlines that move together to see the proper length.</div>';
      hh += `<div class="f">${chk(id, 'showEq', o.showEq, 'Show equation and length on diagram')}</div>`;
    }
    return hh + '</div></div>';
  }

  function measureHtml(m, primed) {
    let hh = `<div class="mitem" data-item="${m.id}"><button class="x" data-act="del" data-id="${m.id}" aria-label="Delete measurement" title="Delete">×</button>`;
    if (m.kind === 'interval') {
      const a = find(m.a), b = find(m.b);
      const iv = interval(evK(a), evK(b), S.v);
      hh += `<b>Interval ${esc(a.label)} → ${esc(b.label)}</b>`;
      hh += `<div class="ro">${fname('K')}: <span class="m">Δx</span> = ${fmt(iv.dK[0])}, <span class="m">Δt</span> = ${fmt(iv.dK[1])}</div>`;
      if (primed) hh += `<div class="ro">${fname('Kp')}: <span class="m">Δx′</span> = ${fmt(iv.dKp[0])}, <span class="m">Δt′</span> = ${fmt(iv.dKp[1])}</div>`;
      hh += `<div class="ro"><span class="m">s</span>² = Δt² − Δx² = <b>${fmt(iv.s2)}</b> (the same in both frames)</div>`;
      if (iv.kind === 'lightlike') hh += '<div class="ro">Lightlike: only a light signal could connect them.</div>';
      else if (iv.kind === 'timelike') hh += `<div class="ro">Timelike: proper time between them <span class="m">Δτ</span> = ${fmt(iv.tau)}</div>`;
      else hh += `<div class="ro">Spacelike: proper distance = ${fmt(iv.distance)}. No signal can connect them.</div>`;
    } else {
      const w = find(m.wl);
      const r = properTime(w, S, m.frame, m.t1, m.t2);
      const T = SYM[m.frame].t;
      const coords = primed || m.frame === 'K';
      hh += `<b>Proper time on ${esc(w.label || 'worldline')}</b><div class="mform"><span>in ${frameSel(m.id, 'frame', m.frame)}</span> ${coords ? `${numIn(m.id, 't1', m.t1, T + '₁')} ${numIn(m.id, 't2', m.t2, T + '₂')}` : ''}</div>`;
      hh += `<div class="ro">${coords ? `Coordinate time ${fmt(Math.abs(m.t2 - m.t1))}, p` : 'P'}roper time <b><span class="m">Δτ</span> = ${fmt(r.tau)}</b></div>`;
      if (r.partial) hh += '<div class="warn">The worldline covers only part of this time range, so Δτ counts only that part.</div>';
      if (r.spacelike) hh += '<div class="warn">Part of this worldline is spacelike and adds no proper time.</div>';
    }
    return hh + '</div>';
  }

  function renderSidebar() {
    const primed = showPrimed();
    const ev = evList(), wl = wlList();
    let hh = `<h2>Frames</h2><div class="row"><label>K <input type="text" aria-label="Name of frame K" data-id="frames" data-k="nameK" data-fk="frames:nameK" value="${esc(S.names.K)}" style="width:90px"></label><label>K′ <input type="text" aria-label="Name of frame K′" data-id="frames" data-k="nameKp" data-fk="frames:nameKp" value="${esc(S.names.Kp)}" style="width:90px"></label></div>`;
    hh += `<div class="note">K′ moves at <i>v</i> = ${fmt(S.v, 3)}c relative to K; <i>γ</i> = ${fmt(gamma(S.v), 3)}. Units have c = 1.</div>`;
    const addBtn = (key, act, label) => {
      const c = toolControl(key);
      return c.isHidden() ? '' : `<button data-act="${act}" ${c.isLocked() ? 'disabled' : ''}>${label}</button>`;
    };
    hh += `<h2>Objects</h2><div class="addrow">${addBtn('event', 'add-event', '+ Event')}${addBtn('wl', 'add-wl', '+ Worldline')}${addBtn('rod', 'add-rod', '+ Rod')}</div>`;
    const items = S.objs.filter((o) => o.kind === 'event' || o.kind === 'wl' || o.kind === 'rod');
    if (!items.length) hh += '<p class="empty">Nothing yet. Use the drawing tools, or the buttons here.</p>';
    for (const o of items) hh += itemHtml(o, primed);
    morphInto(objectsEl, hh);

    const evOpts = ev.map((e) => `<option value="${e.id}">${esc(e.label || 'event')}</option>`).join('');
    let mh = `<div class="mform">Interval <select aria-label="Interval from" data-role="mA" data-keep>${evOpts}</select> → <select aria-label="Interval to" data-role="mB" data-keep>${evOpts}</select><button data-act="add-interval" ${ev.length < 2 ? 'disabled' : ''}>Add</button></div>`;
    mh += `<div class="mform">Proper time on <select aria-label="Worldline for proper time" data-role="mW" data-keep>${wl.map((w) => `<option value="${w.id}">${esc(w.label || 'worldline')}</option>`).join('')}</select><button data-act="add-ptime" ${wl.length ? '' : 'disabled'}>Add</button></div>`;
    for (const m of S.objs) if (m.kind === 'interval' || m.kind === 'ptime') mh += measureHtml(m, primed);
    morphInto(measBody, mh);
    if (controls.measurements.isLocked()) for (const n of measEl.querySelectorAll(OPERABLE)) n.disabled = true;

    const mA = side.querySelector('[data-role=mA]'), mB = side.querySelector('[data-role=mB]');
    if (mA && mB && mB.options.length > 1 && mA.value === mB.value && doc.activeElement !== mB) mB.selectedIndex = (mA.selectedIndex + 1) % mB.options.length;
    if (scrollToSel && sel != null) {
      const it = side.querySelector(`[data-item="${sel}"]`);
      if (it) it.scrollIntoView({ block: 'nearest' });
      scrollToSel = false;
    }
  }
  function morphInto(el, html) {
    const tpl = doc.createElement('div');
    tpl.innerHTML = html;
    const keepSel = {};
    el.querySelectorAll('select[data-keep]').forEach((s) => { keepSel[s.dataset.role] = s.value; });
    morph(el, tpl);
    el.querySelectorAll('select[data-val]').forEach((s) => { if (doc.activeElement !== s) s.value = s.dataset.val; });
    el.querySelectorAll('select[data-keep]').forEach((s) => {
      const k = keepSel[s.dataset.role];
      if (k != null && [...s.options].some((o) => o.value === k)) s.value = k;
    });
  }
  // Update a's children to match b's, keeping focused inputs (and their typing) in place.
  function morph(a, b) {
    const bn = [...b.childNodes];
    for (let i = 0; i < bn.length; i++) {
      const nb = bn[i], na = a.childNodes[i];
      if (!na) { a.appendChild(nb.cloneNode(true)); continue; }
      if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName || (na.nodeType === 1 && (na.getAttribute('data-item') !== nb.getAttribute('data-item') || na.getAttribute('data-fk') !== nb.getAttribute('data-fk')))) { a.replaceChild(nb.cloneNode(true), na); continue; }
      if (na.nodeType === 3) { if (na.data !== nb.data) na.data = nb.data; continue; }
      if (na.nodeType !== 1) continue;
      for (const at of [...na.attributes]) if (!nb.hasAttribute(at.name) && at.name !== 'value') na.removeAttribute(at.name);
      for (const at of [...nb.attributes]) if (na.getAttribute(at.name) !== at.value) na.setAttribute(at.name, at.value);
      if (na.tagName === 'INPUT' && !na.hasAttribute('data-keep')) {
        if (na.type === 'checkbox') na.checked = nb.hasAttribute('checked');
        else if (doc.activeElement !== na) na.value = nb.getAttribute('value') ?? '';
      }
      if (na.tagName === 'BUTTON' || na.tagName === 'INPUT' || na.tagName === 'SELECT') na.disabled = nb.hasAttribute('disabled');
      morph(na, nb);
    }
    while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
  }

  // ── Sidebar events ──
  side.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act, id = el.dataset.id != null ? +el.dataset.id : null;
    if (act === 'sel') { sel = sel === id ? null : id; render(); }
    else if (act === 'del') { ev.stopPropagation(); deleteObj(id); }
    else if (act === 'color') { checkpoint(); find(id).color = el.dataset.color; render(); }
    else if (act === 'add-event') { if (!toolUsable('event')) return; checkpoint(); newEvent('K', Math.round(S.view.cx), Math.round(S.view.ct)); render(); }
    else if (act === 'add-wl') { if (!toolUsable('wl')) return; checkpoint(); newParamWl('K', 0.5, Math.round(S.view.cx - 4)); render(); }
    else if (act === 'add-rod') { if (!toolUsable('rod')) return; checkpoint(); const T = Math.round(S.view.ct); newRod('K', T, Math.round(S.view.cx) - 1, Math.round(S.view.cx) + 2); render(); }
    else if (act === 'add-interval') {
      const a = +side.querySelector('[data-role=mA]').value, b = +side.querySelector('[data-role=mB]').value;
      if (a === b) { toast('Pick two different events.'); return; }
      checkpoint(); S.objs.push({ id: S.nextId++, kind: 'interval', a, b }); render();
    } else if (act === 'add-ptime') {
      const w = +side.querySelector('[data-role=mW]').value;
      checkpoint();
      const t1 = Math.round(S.view.ct - 3), t2 = t1 + 5;
      S.objs.push({ id: S.nextId++, kind: 'ptime', wl: w, frame: 'K', t1, t2 });
      render();
    } else if (act === 'through') {
      const o = find(id);
      const x = parseNum(side.querySelector(`[data-fk="${id}:thx"]`).value), t = parseNum(side.querySelector(`[data-fk="${id}:tht"]`).value);
      if (!Number.isFinite(x) || !Number.isFinite(t)) { toast('Enter both coordinates of the point.'); return; }
      checkpoint(); o.x0 = x - o.u * t; render();
    }
  });
  side.addEventListener('change', (ev) => {
    const el = ev.target, k = el.dataset.k;
    if (!k) return;
    if (el.dataset.id === 'frames') {
      checkpoint();
      const val = el.value.trim().slice(0, 40);
      if (k === 'nameK') S.names.K = val || 'Earth'; else S.names.Kp = val || 'Ship';
      render();
      return;
    }
    const o = find(+el.dataset.id);
    if (!o) return;
    if (el.type === 'checkbox') { checkpoint(); o[k] = el.checked; render(); return; }
    if (k === 'label') { checkpoint(); o.label = el.value.trim().slice(0, 40); render(); return; }
    if (k === 'home') { checkpoint(); const q = toF(el.value, evK(o)); o.home = el.value; o.x = q[0]; o.t = q[1]; render(); return; }
    if (k === 'frame' && o.kind === 'wl') {
      checkpoint();
      const sg = worldlineSegments(o, S)[0];
      const q = toF(el.value, sg.p), e = toF(el.value, sg.d);
      o.frame = el.value; o.u = e[0] / e[1]; o.x0 = q[0] - o.u * q[1];
      render();
      return;
    }
    if (k === 'frame' && o.kind === 'rod') {
      checkpoint();
      const info = rodInfo(o, S), G = el.value;
      const a = toF(G, info.A.pt), b = toF(G, info.B.pt);
      o.frame = G; o.T = (a[1] + b[1]) / 2; o.ends[0].x = a[0]; o.ends[1].x = b[0];
      render();
      return;
    }
    if (k === 'frame' && o.kind === 'ptime') { checkpoint(); o.frame = el.value; render(); return; }
    if (k === 'end0' || k === 'end1') {
      checkpoint();
      const i = +k[3];
      o.ends[i].x = toF(o.frame, rodEnd(o, i, S).pt)[0];
      o.ends[i].wl = el.value === 'free' ? null : +el.value;
      if (o.ends[i].wl != null && !rodEnd(o, i, S).ok) toast('That worldline doesn’t cross the rod’s time line.');
      render();
      return;
    }
    const n = parseNum(el.value);
    if (!Number.isFinite(n)) { toast('Enter a number, e.g. 0.6, -2 or 3/5.'); render(); return; }
    checkpoint();
    if (o.kind === 'event' && ['xK', 'tK', 'xKp', 'tKp'].includes(k)) {
      const F = k.endsWith('Kp') ? 'Kp' : 'K';
      const p = toF(F, evK(o));
      if (k[0] === 'x') p[0] = n; else p[1] = n;
      const q = conv(F, o.home, p);
      o.x = q[0]; o.t = q[1];
    } else if (k === 'u') {
      if (Math.abs(n) > 1) toast('A worldline can’t be faster than light, so u is capped at ±1.');
      o.u = Math.max(-1, Math.min(1, n));
    } else if (k === 'x0') o.x0 = n;
    else if (k === 'T') o.T = n;
    else if (k === 'ex0' || k === 'ex1') o.ends[+k[2]].x = n;
    else if (k === 't1' || k === 't2') o[k] = n;
    render();
  });

  // ── Tools ──
  function setTool(t) {
    if (t !== 'select' && !toolUsable(t)) return;
    if (tool === 'connect' && t !== 'connect') connectIds = [];
    tool = t;
    preview = null;
    root.dataset.draw = t;
    render();
  }

  // ── Pointer interaction ──
  const pointers = new Map();
  function ptOf(P, ev) {
    const r = svgs[P].getBoundingClientRect(), g = freshGeom(P);
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    return { px, py, x: S.view.cx + (px - g.w / 2) / g.s, t: S.view.ct - (py - g.h / 2) / g.s };
  }
  const snap = (val, free) => (free ? val : Math.round(val * 10) / 10);
  function toPx(P, p) { const g = geom[P]; return [g.w / 2 + (p[0] - S.view.cx) * g.s, g.h / 2 - (p[1] - S.view.ct) * g.s]; }
  function nearestEvent(P, px, py, r = 12) {
    let best = null, bd = r;
    for (const e of evList()) {
      const q = toF(P, evK(e));
      const [x, y] = toPx(P, q);
      const d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = { e, q }; }
    }
    return best;
  }
  function nearestCut(P, F, T, px, py, r = 12) {
    let best = null, bd = r;
    for (const w of wlList()) {
      const c = worldlineCut(w, S, F, T);
      if (!c) continue;
      const [x, y] = toPx(P, toF(P, c.pt));
      const d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  const svgListeners = [];
  for (const P of FRAMES) {
    const svg = svgs[P];
    const on = (type, fn, opts) => { svg.addEventListener(type, fn, opts); svgListeners.push([svg, type, fn, opts]); };
    on('pointerdown', (ev) => {
      if (ev.button > 0 || !geom[P]) return;
      root.focus({ preventScroll: true });
      svg.setPointerCapture?.(ev.pointerId);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        drag = { type: 'pinch', P, dist: Math.hypot(a.x - b.x, a.y - b.y), span: S.view.span, mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
        preview = null;
        return;
      }
      const tgt = ev.target.closest('[data-id]');
      const id = tgt ? +tgt.dataset.id : null, role = tgt ? tgt.dataset.role : null;
      const pt = ptOf(P, ev);
      drag = { P, type: 'pan', sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, moved: false, id, pt0: pt };
      if (tool === 'select' || tool === 'event') {
        // The Event tool marks events on worldlines too (Lab 10's E, F and B lie on them), so a
        // press on a worldline adds an event there instead of picking up the worldline.
        if (id != null && !(tool === 'event' && role === 'wl')) {
          sel = id; scrollToSel = true;
          const o = find(id);
          if (role === 'event') drag.type = 'event';
          else if (role === 'rodend') { drag.type = 'rodend'; drag.i = +tgt.dataset.i; }
          else if (role === 'rod') drag.type = 'rodT';
          else if (role === 'wl' && o.mode === 'param') { drag.type = 'wlshift'; drag.x00 = o.x0; drag.f0 = conv(P, o.frame, [pt.x, pt.t]); }
          else drag.type = 'none';
        } else drag.type = tool === 'event' ? 'addEvent' : 'pan';
      } else if (tool === 'wl') {
        const ne = nearestEvent(P, pt.px, pt.py);
        const a = ne ? ne.q : [snap(pt.x, ev.shiftKey), snap(pt.t, ev.shiftKey)];
        drag.type = 'drawWl';
        preview = { P, type: 'wl', a, b: a };
      } else if (tool === 'rod') {
        const a = [snap(pt.x, ev.shiftKey), snap(pt.t, ev.shiftKey)];
        drag.type = 'drawRod';
        preview = { P, type: 'rod', a, b: a };
      } else if (tool === 'connect') { drag.type = 'none'; if (role === 'event') connectClick(id); }
      render();
    });
    on('pointermove', (ev) => {
      if (!pointers.has(ev.pointerId) || !drag) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const g = geom[P];
      if (drag.type === 'pinch') {
        if (pointers.size < 2) return;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
        const r = svg.getBoundingClientRect();
        const mx = mid[0] - r.left, my = mid[1] - r.top;
        const s0 = g.s;
        const wx = S.view.cx + (mx - g.w / 2) / s0, wt = S.view.ct - (my - g.h / 2) / s0;
        S.view.span = Math.max(0.5, Math.min(400, drag.span * drag.dist / d));
        const s1 = Math.min(g.w, g.h) / S.view.span;
        const pmx = drag.mid[0] - r.left, pmy = drag.mid[1] - r.top;
        S.view.cx = wx - (mx - g.w / 2) / s1 - (mx - pmx) / s1;
        S.view.ct = wt + (my - g.h / 2) / s1 + (my - pmy) / s1;
        drag.mid = mid;
        render();
        return;
      }
      if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const pt = ptOf(P, ev), free = ev.shiftKey;
      const o = drag.id != null ? find(drag.id) : null;
      switch (drag.type) {
        case 'pan': case 'addEvent':
          S.view.cx -= (ev.clientX - drag.lx) / g.s; S.view.ct += (ev.clientY - drag.ly) / g.s; drag.type = 'pan'; break;
        case 'event': { beginLive(); const q = conv(P, o.home, [snap(pt.x, free), snap(pt.t, free)]); o.x = q[0]; o.t = q[1]; break; }
        case 'rodend': {
          beginLive();
          const end = o.ends[drag.i];
          if (end.wl != null) { end.wl = null; toast('Rod end detached from its worldline.'); }
          end.x = snap(conv(P, o.frame, [pt.x, pt.t])[0], free);
          break;
        }
        case 'rodT': { beginLive(); o.T = snap(conv(P, o.frame, [pt.x, pt.t])[1], free); break; }
        case 'wlshift': { beginLive(); const f1 = conv(P, o.frame, [pt.x, pt.t]); o.x0 = snap(drag.x00 + (f1[0] - drag.f0[0]) - o.u * (f1[1] - drag.f0[1]), free); break; }
        case 'drawWl': { const ne = nearestEvent(P, pt.px, pt.py); preview.b = ne ? ne.q : [snap(pt.x, free), snap(pt.t, free)]; break; }
        case 'drawRod': preview.b = [snap(pt.x, free), preview.a[1]]; break;
        default: break;
      }
      drag.lx = ev.clientX; drag.ly = ev.clientY;
      render();
    });
    const up = (ev, cancel) => {
      if (!pointers.has(ev.pointerId)) return;
      pointers.delete(ev.pointerId);
      if (!drag) return;
      if (drag.type === 'pinch') { if (pointers.size === 0) drag = null; else drag = { type: 'none' }; return; }
      const d = drag;
      drag = null;
      endLive();
      if (cancel) { preview = null; render(); return; }
      if (d.type === 'pan' && !d.moved && d.id == null) sel = null;
      if (d.type === 'addEvent' && !d.moved) { checkpoint(); newEvent(P, snap(d.pt0.x, ev.shiftKey), snap(d.pt0.t, ev.shiftKey)); }
      if (d.type === 'drawWl') {
        const a = preview.a, b = preview.b;
        preview = null;
        const dx = b[0] - a[0], dt = b[1] - a[1];
        if (Math.hypot(dx, dt) < 0.05) toast('Drag to draw a worldline: its slope sets the velocity.');
        else {
          let u = Math.abs(dt) < 1e-9 ? Math.sign(dx) : dx / dt;
          if (Math.abs(u) > 1) { u = Math.sign(u); toast('Capped at the speed of light. Use the Rod tool for a spacelike line.'); }
          checkpoint();
          newParamWl(P, u, a[0] - u * a[1]);
        }
      }
      if (d.type === 'drawRod') {
        const a = preview.a, b = preview.b;
        preview = null;
        if (Math.abs(b[0] - a[0]) < 0.05) toast('Drag sideways to lay a rod along a line of simultaneity.');
        else {
          checkpoint();
          const r = newRod(P, a[1], a[0], b[0]);
          const att = [];
          [a, b].forEach((p, i) => {
            const [px, py] = toPx(P, p);
            const w = nearestCut(P, P, a[1], px, py);
            if (w) { r.ends[i].wl = w.id; att.push(w.label || 'a worldline'); }
          });
          if (att.length) toast(`Rod end${att.length > 1 ? 's' : ''} attached to ${att.join(' and ')}.`);
        }
      }
      render();
    };
    on('pointerup', (ev) => up(ev, false));
    on('pointercancel', (ev) => up(ev, true));
    on('wheel', (ev) => {
      ev.preventDefault();
      const g = geom[P];
      if (!g) return;
      const pt = ptOf(P, ev);
      S.view.span = Math.max(0.5, Math.min(400, S.view.span * Math.exp(ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015))));
      const s1 = Math.min(g.w, g.h) / S.view.span;
      S.view.cx = pt.x - (pt.px - g.w / 2) / s1;
      S.view.ct = pt.t + (pt.py - g.h / 2) / s1;
      render();
    }, { passive: false });
  }
  function connectClick(id) {
    if (connectIds[connectIds.length - 1] === id) return;
    if (connectIds.length) {
      const last = find(connectIds[connectIds.length - 1]);
      const a = evK(last), b = evK(find(id));
      if (isSpacelike([b[0] - a[0], b[1] - a[1]])) {
        toast(`${last.label} → ${find(id).label} is spacelike, so no worldline can join them. Use a rod instead.`);
        return;
      }
    }
    connectIds.push(id);
  }
  function finishConnect() {
    if (connectIds.length < 2) { toast('Click at least two events.'); return; }
    checkpoint();
    addObj({ kind: 'wl', mode: 'chain', ids: connectIds.slice(), extend: false, color: nextColor(), label: nextLabel('wl'), showEq: false });
    connectIds = [];
    render();
  }

  // ── Keyboard: only for this instance (focus inside it, or the pointer over it) ──
  const onEnter = () => { hovered = true; };
  const onLeave = () => { hovered = false; };
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  function onKeyDown(ev) {
    const inside = root.contains(ev.target);
    const unfocused = ev.target === doc.body || ev.target === doc.documentElement;
    if (!inside && !(hovered && unfocused)) return;
    const inField = ev.target.closest && ev.target.closest('input,select,textarea');
    if (ev.ctrlKey || ev.metaKey) {
      if (inField) return;
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { if (!controls.undo.isLocked()) undo(); ev.preventDefault(); }
      else if (k === 'y' || (k === 'z' && ev.shiftKey)) { if (!controls.redo.isLocked()) redo(); ev.preventDefault(); }
      return;
    }
    if (inField) { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur(); return; }
    if (ev.target.closest && ev.target.closest('button') && (ev.key === 'Enter' || ev.key === ' ')) return;
    const map = { v: 'select', e: 'event', w: 'wl', r: 'rod', j: 'connect' };
    const key = ev.key.toLowerCase();
    if (map[key] && !ev.altKey) { setTool(map[key]); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { if (sel != null) { deleteObj(sel); ev.preventDefault(); } return; }
    if (ev.key === 'Escape') { if (connectIds.length) connectIds = []; else sel = null; render(); return; }
    if (ev.key === 'Enter' && tool === 'connect') { finishConnect(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (arrows[ev.key] && sel != null) {
      const o = find(sel);
      if (o && o.kind === 'event') {
        ev.preventDefault();
        checkpoint();
        const st = ev.shiftKey ? 1 : 0.1;
        o.x = +(o.x + arrows[ev.key][0] * st).toFixed(6);
        o.t = +(o.t + arrows[ev.key][1] * st).toFixed(6);
        render();
      }
    }
  }
  doc.addEventListener('keydown', onKeyDown);

  // ── Status, toast ──
  let lastStatus = '';
  function renderStatus() {
    let hh = TOOLHELP[tool];
    if (tool === 'connect') hh += ` <span>${connectIds.length ? connectIds.map((i) => esc(find(i)?.label || '?')).join(' → ') : '(no events picked yet)'}</span> <button type="button" class="fw-button" data-sact="finish" ${connectIds.length < 2 ? 'disabled' : ''}>Finish</button> <button type="button" class="fw-button" data-sact="cancel" ${connectIds.length ? '' : 'disabled'}>Clear</button>`;
    if (hh !== lastStatus) { statusEl.innerHTML = hh; lastStatus = hh; }
  }
  statusEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sact]');
    if (!b) return;
    if (b.dataset.sact === 'finish') finishConnect(); else { connectIds = []; render(); }
  });
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('st-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('st-on'), 3800);
  }

  // ── State and render ──
  function getState() {
    const count = (kind) => S.objs.filter((o) => o.kind === kind).length;
    return { v: S.v, gamma: gamma(S.v), events: count('event'), worldlines: count('wl'), rods: count('rod'),
      diagram: diagramState(S) };
  }
  function notify(force = false) {
    const saved = JSON.stringify(S);
    if (!force && saved === lastSaved) return;
    lastSaved = saved;
    changes.emit(getState());
  }

  let raf = 0;
  let destroyed = false;
  function render() {
    notify();
    if (!raf && !destroyed) raf = requestAnimationFrame(() => { raf = 0; if (!destroyed) doRender(); });
  }
  function drawSvg(P) {
    const svg = svgs[P];
    const w = svg.clientWidth, hh = svg.clientHeight;
    if (!w || !hh) { delete geom[P]; return; }
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    svg.innerHTML = drawPanel(P, S, w, hh, { sel, connectIds, tool, preview, primed: showPrimed(), colors: themeVars(root, COLOR_VARS) });
    geom[P] = panelGeometry(S.view, w, hh);
  }
  // Panel P's geometry for its current size: redrawn now if the panel was resized since the last
  // render (whose redraw waits for the next animation frame), so a click or toScreen() never
  // maps through a stale scale. undefined while the panel is not laid out.
  function freshGeom(P) {
    const g = geom[P], svg = svgs[P];
    if (!g || Math.abs(g.w - svg.clientWidth) >= 1 || Math.abs(g.h - svg.clientHeight) >= 1) drawSvg(P);
    return geom[P];
  }
  function doRender() {
    const single = !showKpPanel();
    figs.Kp.hidden = single;
    panelsEl.classList.toggle('st-single', single);
    visibleFrames().forEach(drawSvg);
    renderSidebar();
    renderStatus();
    const setIf = (el, val) => { if (doc.activeElement !== el) el.value = val; };
    setIf(vRange, String(S.v));
    setIf(vNum, S.v.toFixed(3));
    setIf(gInput, fmtIn(gamma(S.v)));
    for (const id of ['grid-K', 'grid-Kp', 'kp-panel', 'primed']) controls[id].sync();
    for (const F of FRAMES) { caps[F].textContent = S.names[F]; gridName[F].textContent = S.names[F]; }
    for (const t of TOOLS) toolButtons[t.key].setAttribute('aria-pressed', String(tool === t.key));
    // Lock disables the buttons (control.js); undo and redo are also disabled when there is nothing to do.
    controls.undo.el.disabled = controls.undo.isLocked() || !undoStack.length;
    controls.redo.el.disabled = controls.redo.isLocked() || !redoStack.length;
    const empty = !S.objs.length;
    for (const P of FRAMES) {
      hints[P].hidden = !empty;
      hints[P].textContent = tool === 'event' ? 'Click to add an event' : 'Pick the Event tool (E), then click here to add an event';
    }
  }
  const resizeObserver = new ResizeObserver(() => render());
  resizeObserver.observe(panelsEl);
  // The Setup's starting drawing tool, named as its Control id without 'tool-'.
  if (setup?.tool != null) {
    const t = TOOLS.find((x) => x.id === `tool-${setup.tool}`);
    if (!t) throw new Error(`Unknown spacetime Setup tool "${setup.tool}" (use ${TOOLS.map((x) => x.id.slice(5)).join(', ')}).`);
    tool = t.key;
    root.dataset.draw = t.key;
  }
  render();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [{
      id: 'diagram',
      label: 'Spacetime diagrams',
      snapshot: snapshotPng,
      toScreen(x, t) {
        if (!freshGeom('K')) return null;
        const r = svgs.K.getBoundingClientRect();
        const [px, py] = toPx('K', [x, t]);
        return { x: r.left + px, y: r.top + py };
      },
    }],
    serialize: () => exportDiagram(S),
    restore(saved) {
      S = normalize(saved);
      undoStack = []; redoStack = []; liveActive = false;
      sel = null; connectIds = []; drag = null; preview = null;
      notify(true);
      render();
    },
    resize: () => render(),
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      resizeObserver.disconnect();
      doc.removeEventListener('keydown', onKeyDown);
      for (const [el, type, fn, opts] of svgListeners) el.removeEventListener(type, fn, opts);
      changes.clear();
      root.remove();
    },
  };
}

// The Condition types an Activity on this Tool registers (st-event, st-worldline, st-rod).
export { conditionTypes };

export default defineTool({
  id: 'spacetime',
  title: 'Spacetime Diagrams',
  modes: [{ id: 'diagram', title: 'Spacetime diagram' }],
  mount,
});
