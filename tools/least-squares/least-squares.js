// Least-squares Tool (framework v1): linearize a physical model, fit a straight line by dragging
// its (m, b) handle on the parameter plane, and judge the fit by looking first.
// Ported from the old least-squares/index.html. The maths lives in fit.js.
//
// Mode: 'fit'.
// Setup: { dataset, seed, xT, yT, view, locked, m, b } (any subset). dataset is one of
//   pendulum | freefall | light | ohm; xT/yT one of id | sq | sqrt | inv | inv2 | ln;
//   view coarse | fine; m and b an optional starting line (else drawn from the seed).
// State (state.snapshot(), each with a label and unit in describe()):
//   inputs   dataset, seed, xT, yT, view, locked, m, b
//   results  SSE, SST, ratio (SSE/SST), R2 (0 when worse than flat), hits (of n), mOLS, bOLS,
//            m0 (through-origin OLS slope), linear, and when linear the implied quantities
//            (g | R | A, B) from the least-squares line; edited, checked.
// Controls: selects 'dataset', 'y-transform', 'x-transform', 'view'; buttons 'new-data',
//   'reset-data', 'optimize', 'copy-csv'; toggles 'show-residuals', 'edit-points',
//   'through-origin'; 'check' (the "Check your …" reveal); custom 'line' (the (m, b) handle,
//   value { m, b }) and 'points' (the draggable data points, value: array of raw y). Each is
//   also a kit handle (focusable, arrow keys), not registered: '(m, b) handle' and 'Data point N'.
// Displays: 'scatter' (toScreen(X, Y) in plotted units), 'residuals', 'plane' (toScreen(m, b)).

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { button, h, handle, metric, section, select, themeVars, toggle } from '../../framework/v1/ui-kit.js';
import { typeset } from '../../framework/v1/vendor.js';
import {
  DATASETS, DATASET_IDS, PI, TF, TF_ORDER, axisLabel, bestLine, coarseRange, ellPoint, feasible,
  feasibleM0, fineRange, fitMeasures, fmt, fmtTick, fmtUnit, generate, hits, interpret, lineUnits, niceStep,
  startLine, stats, tfSym, toCsv, transformPoints,
} from './fit.js';

const DEFAULTS = { dataset: 'pendulum', seed: 0, xT: 'id', yT: 'id', view: 'coarse', locked: false };
const QUANTITY_LABELS = { g: 'Implied g', R: 'Implied R', A: 'Implied A', B: 'Implied B (background)' };
const R2_LEVELS = [0, 0.5, 0.75, 0.9, 0.95, 0.99, 0.999];
const OUTER = [2, 4, 8]; // SSE as a multiple of SST, beyond the R² = 0 ring
const MARGIN = { l: 64, r: 14, t: 12, b: 46 };

const STYLE = `
/* The Display never scrolls inside itself (framework README): the Graph and the parameter plane
   take whatever height is left, and secondary text sits in collapsed notes (.ls-more). */
.ls-displays { flex: 1; min-height: 0; display: grid; gap: 12px;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px); grid-template-rows: minmax(0, 1fr); }
.ls-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; }
.ls-col[hidden] { display: none; }
.ls-col > .ls-col { flex: none; }
.ls-displays .fw-display { flex: none; }
.ls-displays .fw-display.ls-grow { flex: 1 1 0; min-height: 120px; }
.ls-canvas { display: block; width: 100%; }
.ls-grow > .ls-canvas { height: 100%; }
.ls-residuals { height: 150px; }
.ls-plane { touch-action: none; cursor: crosshair; }
.ls-more { font-size: 13px; color: var(--fw-text-dim); line-height: 1.4;
  border-left: 3px solid var(--fw-border); padding-left: 8px; }
.ls-more > summary { cursor: pointer; font-style: italic; }
.ls-more > summary:focus-visible { outline: 2px solid var(--fw-blue); outline-offset: 2px; }
.ls-more[open] > summary { margin-bottom: 4px; }
.ls-scatter.ls-editing { cursor: ns-resize; touch-action: none; }
.ls-caption { font-size: 13px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--fw-text-muted); }
.ls-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 4px 12px; }
.ls-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ls-row .fw-toggle, .ls-row .fw-select { margin-bottom: 0; }
.ls-story { font-size: 15px; line-height: 1.45; margin-bottom: 8px; }
.ls-check { margin-top: 8px; padding: 6px 8px; border: 1px solid var(--fw-border); background: var(--fw-bg); font-size: 15px; }
.ls-check p { margin: 0 0 4px; }
.ls-check .ls-big { font-weight: bold; color: var(--fw-blue); }
.ls-fit { padding: 8px 10px; border: 1.5px solid var(--fw-border-dk); background: var(--fw-surface); }
.ls-eq { font-size: 16px; margin-bottom: 4px; }
.ls-pass { font-size: 14px; color: var(--fw-text-dim); }
.ls-pass.ls-all { color: var(--fw-green); font-weight: bold; }
.ls-bar { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 2px 8px; align-items: center; margin-top: 6px; }
.ls-bar b { font-size: 13px; }
.ls-track { height: 12px; background: var(--fw-grid); }
.ls-fill { height: 100%; }
.ls-r2-why { font-size: 13px; color: var(--fw-red); min-height: 1.2em; }
.ls-r2-off .fw-metric-value { text-decoration: line-through; opacity: 0.5; }
.ls-status { font-size: 13px; font-style: italic; color: var(--fw-text-dim); }
.ls-select-full select { flex: 1; min-width: 0; }
`;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function mount(container, modeId = 'fit', setup = {}) {
  const start = { ...DEFAULTS, ...(setup || {}) };
  if (!DATASETS[start.dataset]) start.dataset = DEFAULTS.dataset;
  const changes = createEmitter();

  // ── working state ──
  const st = {
    ds: start.dataset, seed: 0, raw: [], orig: [], xT: 'id', yT: 'id', m: 0, b: 0,
    locked: false, view: 'coarse', checked: false, revealed: false, ghosts: [],
    rangeC: null, rangeF: null, showRes: false, edit: false, anim: 0,
    scRange: null, dragPt: -1, dragPlane: false,
  };
  const D = () => DATASETS[st.ds];
  const points = () => transformPoints(st.raw, st.xT, st.yT);
  const range = () => (st.view === 'fine' ? st.rangeF : st.rangeC);
  const edited = () => st.raw.some((p, i) => p.y !== st.orig[i].y);

  // ── Controls ──
  const silently = (control, v) => { control.el.querySelector('select, input').value = String(v); };
  const ctl = {};
  ctl.dataset = select({ id: 'dataset', name: 'Dataset',
    options: DATASET_IDS.map((k) => ({ value: k, label: DATASETS[k].name })), value: st.ds,
    onChange: (v) => { setDataset(v, 0); commit(); } });
  ctl.dataset.el.classList.add('ls-select-full');
  const tfOptions = (v) => TF_ORDER.map((k) => ({ value: k, label: tfSym(k, v.sym) }));
  ctl['y-transform'] = select({ id: 'y-transform', name: 'y-axis', options: tfOptions(D().y), value: 'id',
    onChange: (v) => { st.yT = v; freshPlane(); commit(); } });
  ctl['x-transform'] = select({ id: 'x-transform', name: 'x-axis', options: tfOptions(D().x), value: 'id',
    onChange: (v) => { st.xT = v; freshPlane(); commit(); } });
  ctl.view = select({ id: 'view', name: 'View', options: [{ value: 'coarse', label: 'Coarse' }, { value: 'fine', label: 'Fine' }],
    value: 'coarse', onChange: (v) => { stopAnim(); setView(v); commit(); } });

  ctl['new-data'] = button({ id: 'new-data', name: 'New data', onClick: () => {
    // keep the handle and the window so students can see the minimum move between samples
    if (st.revealed) {
      const S = stats(points());
      st.ghosts.push({ m: S.mS, b: S.bS, m0: S.m0 });
      if (st.ghosts.length > 15) st.ghosts.shift();
    }
    loadData(st.seed + 1);
    commit();
  } });
  ctl['reset-data'] = button({ id: 'reset-data', name: 'Reset data', onClick: () => {
    st.raw = st.orig.map((p) => ({ ...p }));
    commit();
  } });
  ctl.optimize = button({ id: 'optimize', name: 'Optimize', onClick: optimize });
  const copyStatus = h('span', { class: 'ls-status', role: 'status' });
  ctl['copy-csv'] = button({ id: 'copy-csv', name: 'Copy CSV', onClick: copyCsv });

  ctl['show-residuals'] = toggle({ id: 'show-residuals', name: 'Show residuals', label: 'Residuals',
    onChange: (v) => { st.showRes = v; residualWrap.hidden = !v; commit(); } });
  ctl['edit-points'] = toggle({ id: 'edit-points', name: 'Edit points', label: 'Edit points (drag up/down)',
    onChange: (v) => { st.edit = v; scatterCv.classList.toggle('ls-editing', v); commit(); } });
  ctl['through-origin'] = toggle({ id: 'through-origin', name: 'Through origin (b = 0)',
    label: 'Through origin (<i>b</i> = 0)', onChange: (v) => { setLocked(v); commit(); } });

  const checkBtn = h('button', { type: 'button', class: 'fw-button', 'aria-expanded': 'false' });
  const checkPanel = h('div', { class: 'ls-check', hidden: true, 'aria-live': 'polite' });
  checkBtn.addEventListener('click', () => { st.checked = !st.checked; commit(); });
  ctl.check = createControl({ id: 'check', label: 'Check', el: checkBtn,
    get: () => st.checked, set: (v) => { st.checked = Boolean(v); commit(); } });

  ctl.line = createControl({ id: 'line', label: '(m, b) handle',
    get: () => ({ m: st.m, b: st.b }),
    set: (v) => {
      if (!v || !Number.isFinite(v.m)) return;
      stopAnim();
      st.m = v.m; st.b = Number.isFinite(v.b) ? v.b : st.b;
      clampHandle();
      commit();
    },
    onLock: (locked) => { if (locked) planeHandle.lock(); else planeHandle.unlock(); redraw(); },
    onHide: (hidden) => { if (hidden) planeHandle.hide(); else planeHandle.show(); redraw(); } });
  ctl.points = createControl({ id: 'points', label: 'Data points',
    get: () => st.raw.map((p) => p.y),
    set: (ys) => { applyYs(ys); commit(); },
    onLock: () => redraw(), onHide: () => redraw() });

  // ── layout ──
  const story = h('div', { class: 'ls-story' });
  const scatterCv = h('canvas', { class: 'ls-canvas ls-scatter', role: 'img', 'aria-label': 'Scatter plot with error bars and your line' });
  const residualCv = h('canvas', { class: 'ls-canvas ls-residuals', role: 'img', 'aria-label': 'Residuals' });
  const planeCv = h('canvas', { class: 'ls-canvas ls-plane', role: 'img', 'aria-label': 'Parameter plane: drag to choose m and b' });

  // ── kit handles over the plots: the (m, b) point and, in edit mode, each data point ──
  // The plot windows change with the data, axes and view, so each handle's value is its place
  // within the current window (0 to 1 on each axis): an arrow key moves it 1% of the window,
  // Shift+arrow 10%. Its accessible text gives the real values.
  const scatterLayer = h('div', { class: 'fw-handle-layer' });
  const planeLayer = h('div', { class: 'fw-handle-layer' });
  const unitText = (u) => (u ? ` ${u}` : '');
  const frac = (v, lo, hi) => (hi > lo ? (v - lo) / (hi - lo) : 0);
  const lerp = (t, lo, hi) => lo + t * (hi - lo);
  const local = (cv, cx, cy) => { const r = cv.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  const unit01 = (name) => ({ name, min: 0, max: 1, step: 0.01, coarse: 0.1 });

  const planeHandle = handle({ id: 'line-handle', name: '(m, b) handle', x: unit01('m'), y: unit01('b'),
    value: { x: 0, y: 0 },
    format: () => {
      const u = lineUnits(st.ds, st.xT, st.yT);
      return `m = ${fmt(st.m, 4)}${unitText(u.m)}, b = ${fmt(st.b, 4)}${unitText(u.b)}`;
    },
    toScreen: ({ x, y }) => {
      const f = frames.plane, R = range();
      if (!f || !R) return null;
      const r = planeCv.getBoundingClientRect();
      return { x: r.left + f.X(lerp(x, R.m0, R.m1)), y: r.top + f.Y(lerp(y, R.b0, R.b1)) };
    },
    fromScreen: (cx, cy) => {
      const f = frames.plane, R = range();
      if (!f || !R) return null;
      const [px, py] = local(planeCv, cx, cy);
      return { x: frac(f.ix(px), R.m0, R.m1), y: frac(f.iy(py), R.b0, R.b1) };
    },
    onChange: ({ x, y }) => {
      const R = range();
      stopAnim();
      st.m = lerp(x, R.m0, R.m1);
      st.b = st.locked ? 0 : lerp(y, R.b0, R.b1);
      commit();
    } });
  planeLayer.append(planeHandle.el);

  let pointHandles = [];
  function pointHandle(i) {
    const yr = () => frames.scatterRange.yr;
    const ph = handle({ id: `point-${i + 1}`, name: `Data point ${i + 1}`, ...unit01(`Data point ${i + 1}`), value: 0,
      format: () => {
        const d = D();
        return `${d.y.sym} = ${fmt(st.raw[i]?.y ?? 0, 4)}${unitText(fmtUnit(d.y.unit))}`;
      },
      toScreen: (v) => {
        const f = frames.scatter, p = points()[i];
        if (!f || !p) return null;
        const r = scatterCv.getBoundingClientRect();
        return { x: r.left + f.X(p.X), y: r.top + f.Y(lerp(v, ...yr())) };
      },
      fromScreen: (cx, cy) => {
        const f = frames.scatter;
        if (!f) return null;
        return frac(f.iy(local(scatterCv, cx, cy)[1]), ...yr());
      },
      onChange: (v) => {
        const raw = TF[st.yT].inv(lerp(v, ...yr()));
        const ys = st.raw.map((p) => p.y);
        ys[i] = Number.isFinite(raw) ? raw : 0;
        applyYs(ys);
        commit();
      } });
    // While a point is dragged the scatter window stays put, so the point follows the pointer.
    ph.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || ph.isLocked() || ph.isHidden()) return;
      stopAnim();
      st.dragPt = i; st.scRange = scatterRange(points());
    });
    const end = () => { if (st.dragPt === i) { st.dragPt = -1; st.scRange = null; redraw(); } };
    ph.el.addEventListener('pointerup', end);
    ph.el.addEventListener('pointercancel', end);
    return ph;
  }

  /** Bring the handles in step with the State and the plots just drawn. */
  function syncHandles() {
    const R = range();
    if (R) planeHandle.update({ x: frac(st.m, R.m0, R.m1), y: frac(st.b, R.b0, R.b1) });
    if (pointHandles.length !== st.raw.length) {
      for (const ph of pointHandles) { ph.destroy(); ph.el.remove(); }
      pointHandles = st.raw.map((p, i) => pointHandle(i));
      scatterLayer.append(...pointHandles.map((ph) => ph.el));
    }
    const editing = st.edit && !ctl.points.isHidden();
    const pts = points();
    pointHandles.forEach((ph, i) => {
      if (editing) ph.show(); else ph.hide();
      if (ctl.points.isLocked()) ph.lock(); else ph.unlock();
      if (frames.scatterRange && pts[i]) ph.update(frac(pts[i].Y, ...frames.scatterRange.yr));
    });
  }

  const residualWrap = h('div', { class: 'ls-col', hidden: true },
    h('div', { class: 'ls-caption' }, 'Residuals  y − (m x + b)'),
    h('div', { class: 'fw-display' }, residualCv),
    h('details', { class: 'ls-more' },
      h('summary', {}, 'Reading the residuals'),
      h('div', { class: 'ls-legend' },
        h('div', { html: '<b>Random scatter about 0</b>: the straight line describes the data.' }),
        h('div', { html: '<b>A curve or trend</b>: wrong model or wrong axes. The line is systematically off.' }),
        h('div', { html: '<b>One far-off point</b>: an outlier. Check that measurement before trusting the fit.' }))));

  const out = {
    eq: h('div', { class: 'ls-eq' }),
    pass: h('div', { class: 'ls-pass', role: 'status', 'aria-label': 'Error bars hit' }),
    m: metric({ name: 'm', label: '<i>m</i>' }),
    b: metric({ name: 'b', label: '<i>b</i>' }),
    ratio: metric({ name: 'SSE / SST', label: 'SSE / SST' }),
    R2: metric({ name: 'R²', label: 'R²' }),
    why: h('div', { class: 'ls-r2-why' }),
  };
  const bar = (name) => {
    const fill = h('div', { class: 'ls-fill' }), cap = h('span', { class: 'ls-status', style: 'grid-column:2' });
    return { fill, cap, el: h('div', { class: 'ls-bar' }, h('b', {}, name), h('div', { class: 'ls-track' }, fill), cap) };
  };
  const bars = { SST: bar('SST'), SSE: bar('SSE') };
  bars.SST.fill.style.background = 'var(--fw-text-muted)';
  bars.SSE.fill.style.background = 'var(--fw-orange)';

  const root = h('div', { class: 'fw-tool', 'data-tool': 'least-squares' },
    h('style', {}, STYLE),
    h('aside', { class: 'fw-controls' },
      section('Experiment', ctl.dataset.el, h('div', { class: 'ls-row' }, ctl['new-data'].el, ctl['copy-csv'].el, copyStatus)),
      section('Model', story, ctl.check.el, checkPanel),
      section('Axes', ctl['y-transform'].el, ctl['x-transform'].el),
      section('Parameter space', ctl.view.el, ctl.optimize.el, ctl['through-origin'].el),
      section('Show', ctl['show-residuals'].el, ctl['edit-points'].el, ctl['reset-data'].el)),
    h('div', { class: 'fw-displays ls-displays' },
      h('div', { class: 'ls-col' },
        h('div', { class: 'ls-caption' }, 'Graph'),
        h('div', { class: 'fw-display ls-grow', style: 'position:relative' }, scatterCv, scatterLayer),
        residualWrap,
        h('details', { class: 'ls-more' },
          h('summary', {}, 'How the line is fitted'),
          'This is unweighted least squares: error bars are drawn, but every point counts equally in the fit.')),
      h('div', { class: 'ls-col' },
        h('div', { class: 'ls-caption' }, 'Parameter space'),
        h('div', { class: 'fw-display ls-grow', style: 'position:relative' }, planeCv, planeLayer),
        h('details', { class: 'ls-more' },
          h('summary', {}, 'Reading the parameter plane'),
          h('span', { html: 'Each point here is a line. Drag to choose the slope <i>m</i> and intercept <i>b</i>. '
            + 'Rings are contours of equal error, labeled by R². The least-squares line sits at the bottom of the bowl. '
            + '<b>Fine</b> zooms in near the bottom. The green patch is every line that passes through all the error bars.' })),
        h('div', { class: 'ls-fit' },
          h('div', { class: 'ls-caption' }, 'Fit'),
          out.eq, out.m.el, out.b.el, out.pass, bars.SST.el, bars.SSE.el, out.ratio.el, out.R2.el, out.why,
          h('details', { class: 'ls-more' },
            h('summary', {}, 'What R² tells you'),
            h('span', { html: 'R² is the fraction of the variation in y that the line accounts for. It does <b>not</b> tell you '
              + 'whether the model is right, and it is not an uncertainty on <i>m</i>. Look at the graph and the residuals first.' }))))));
  container.append(root);

  // ── operations (no emit; commit() publishes) ──
  function stopAnim() { cancelAnimationFrame(st.anim); st.anim = 0; }

  function loadData(seed) {
    st.seed = seed;
    st.raw = generate(st.ds, seed);
    st.orig = st.raw.map((p) => ({ ...p }));
  }

  function applyYs(ys) {
    if (!Array.isArray(ys) || ys.length !== st.raw.length) return;
    ys.forEach((y, i) => {
      const floor = 1e-3 * st.orig[i].y; // keep every reading positive so ln, √ and 1/u stay defined
      if (Number.isFinite(y)) st.raw[i].y = Math.max(y, floor);
    });
  }

  function setDataset(key, seed) {
    if (!DATASETS[key]) return;
    st.ds = key; st.xT = 'id'; st.yT = 'id'; st.checked = false;
    silently(ctl.dataset, key);
    loadData(seed);
    for (const [id, v] of [['x-transform', D().x], ['y-transform', D().y]]) {
      ctl[id].el.querySelectorAll('option').forEach((o, i) => { o.textContent = tfSym(TF_ORDER[i], v.sym); });
      silently(ctl[id], 'id');
    }
    story.innerHTML = D().story;
    typeset([story]);
    checkBtn.textContent = D().checkLabel;
    freshPlane();
  }

  /** Full reset of the plane: new experiment or new axes. */
  function freshPlane() {
    stopAnim();
    st.revealed = false; st.ghosts = [];
    const S = stats(points());
    st.rangeC = coarseRange(S);
    ({ m: st.m, b: st.b } = startLine(st.ds, st.seed, st.xT, st.yT, st.locked, S, st.rangeC));
    setView('coarse');
  }

  function setView(v) {
    st.view = v === 'fine' ? 'fine' : 'coarse';
    silently(ctl.view, st.view);
    if (st.view === 'fine') { const pts = points(); st.rangeF = fineRange(stats(pts), pts, st.locked, st.rangeC); }
    clampHandle();
  }

  function setLocked(v) {
    stopAnim();
    st.locked = Boolean(v);
    ctl['through-origin'].el.querySelector('input').checked = st.locked;
    if (st.locked) st.b = 0;
    setView(st.view); // the fine window re-centres on the constrained minimum
  }

  function clampHandle() {
    const R = range();
    st.m = clamp(st.m, R.m0, R.m1);
    st.b = st.locked ? 0 : clamp(st.b, R.b0, R.b1);
  }

  function optimize() {
    const to = bestLine(stats(points()), st.locked), from = { m: st.m, b: st.b };
    stopAnim();
    const finish = () => { st.m = to.m; st.b = to.b; st.anim = 0; st.revealed = true; commit(); };
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      let u = Math.min(1, (now - t0) / dur);
      u = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      if (u >= 1) { finish(); return; }
      st.m = from.m + (to.m - from.m) * u; st.b = from.b + (to.b - from.b) * u;
      st.anim = requestAnimationFrame(step);
      commit();
    };
    st.anim = requestAnimationFrame(step);
  }

  async function copyCsv() {
    const text = toCsv(st.ds, st.raw);
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = 'Copied!'; }
    catch {
      const ta = h('textarea', { 'aria-label': 'CSV data' });
      ta.value = text; root.append(ta); ta.select();
      copyStatus.textContent = document.execCommand?.('copy') ? 'Copied!' : 'Copy failed';
      ta.remove();
    }
    setTimeout(() => { copyStatus.textContent = ''; }, 1400);
  }

  // ── State ──
  function getState() {
    const pts = points(), S = stats(pts), f = fitMeasures(S, pts, st.m, st.b);
    const best = bestLine(S, st.locked), r = interpret(st.ds, st.xT, st.yT, best.m, best.b);
    const s = {
      dataset: st.ds, seed: st.seed, xT: st.xT, yT: st.yT, view: st.view, locked: st.locked,
      m: st.m, b: st.b, SSE: f.SSE, SST: f.SST, ratio: f.ratio, R2: f.R2, hits: f.hits, n: f.n,
      mOLS: S.mS, bOLS: S.bS, m0: S.m0, linear: r !== null, edited: edited(), checked: st.checked,
    };
    if (r) for (const [name, v] of r.values) s[name] = v;
    return s;
  }

  function describe() {
    const u = lineUnits(st.ds, st.xT, st.yT);
    const info = {
      dataset: { label: 'Dataset', unit: '' }, seed: { label: 'Data seed', unit: '' },
      xT: { label: 'x-axis transform', unit: '' }, yT: { label: 'y-axis transform', unit: '' },
      view: { label: 'Parameter-plane view', unit: '' }, locked: { label: 'Through origin (b = 0)', unit: '' },
      m: { label: 'Slope m', unit: u.m }, b: { label: 'Intercept b', unit: u.b },
      SSE: { label: 'SSE Σ(y − ŷ)²', unit: u.sse }, SST: { label: 'SST Σ(y − ȳ)²', unit: u.sse },
      ratio: { label: 'SSE / SST', unit: '' }, R2: { label: 'R² (0 when worse than flat)', unit: '' },
      hits: { label: 'Error bars hit', unit: '' }, n: { label: 'Number of points', unit: '' },
      mOLS: { label: 'Least-squares slope', unit: u.m }, bOLS: { label: 'Least-squares intercept', unit: u.b },
      m0: { label: 'Least-squares slope through the origin', unit: u.m },
      linear: { label: 'Axes linearize the model', unit: '' },
      edited: { label: 'Data points edited', unit: '' }, checked: { label: 'Check revealed', unit: '' },
    };
    for (const [name, , unit] of D().model.truth) info[name] = { label: QUANTITY_LABELS[name] ?? name, unit };
    return info;
  }

  function serialize() {
    const saved = { dataset: st.ds, seed: st.seed, xT: st.xT, yT: st.yT, view: st.view, locked: st.locked,
      m: st.m, b: st.b, checked: st.checked, showResiduals: st.showRes, editPoints: st.edit };
    if (edited()) saved.ys = st.raw.map((p) => p.y);
    return saved;
  }

  /** Apply a Setup or a saved State without emitting. The saved line goes on after the axes. */
  function apply(s) {
    setDataset(DATASETS[s.dataset] ? s.dataset : st.ds, Number.isInteger(s.seed) && s.seed >= 0 ? s.seed : 0);
    if (s.ys) applyYs(s.ys);
    st.xT = TF[s.xT] ? s.xT : 'id'; silently(ctl['x-transform'], st.xT);
    st.yT = TF[s.yT] ? s.yT : 'id'; silently(ctl['y-transform'], st.yT);
    st.locked = Boolean(s.locked);
    ctl['through-origin'].el.querySelector('input').checked = st.locked;
    freshPlane();
    setView(s.view);
    if (Number.isFinite(s.m)) st.m = s.m;
    if (Number.isFinite(s.b)) st.b = s.b;
    clampHandle();
    st.checked = Boolean(s.checked);
    if (typeof s.showResiduals === 'boolean') {
      st.showRes = s.showResiduals; residualWrap.hidden = !st.showRes;
      ctl['show-residuals'].el.querySelector('input').checked = st.showRes;
    }
    if (typeof s.editPoints === 'boolean') {
      st.edit = s.editPoints; scatterCv.classList.toggle('ls-editing', st.edit);
      ctl['edit-points'].el.querySelector('input').checked = st.edit;
    }
  }

  function commit() {
    const s = getState();
    updateReadouts(s);
    redraw();
    changes.emit(s);
  }

  // ── readouts ──
  function updateReadouts(s) {
    const d = D(), u = lineUnits(st.ds, st.xT, st.yT);
    out.eq.innerHTML = `${tfSym(st.yT, d.y.sym)} = <i>m</i> · ${tfSym(st.xT, d.x.sym)} + <i>b</i>`;
    out.m.update(`${fmt(s.m, 4)} ${u.m}`);
    out.b.update(`${fmt(s.b, 4)} ${u.b}${st.locked ? '  (locked)' : ''}`);
    out.pass.textContent = `Your line passes through ${s.hits} of ${s.n} error bars.`;
    out.pass.classList.toggle('ls-all', s.hits === s.n);
    const scale = Math.max(s.SST, s.SSE);
    bars.SST.fill.style.width = `${100 * s.SST / scale}%`;
    bars.SST.cap.textContent = `Σ(y − ȳ)² = ${fmt(s.SST)} ${u.sse} · total spread of y about its mean`;
    bars.SSE.fill.style.width = `${100 * s.SSE / scale}%`;
    bars.SSE.cap.textContent = `Σ(y − ŷ)² = ${fmt(s.SSE)} ${u.sse} · left over after your line`;
    out.ratio.update(fmt(s.ratio));
    out.R2.update(s.R2.toFixed(3));
    out.R2.el.classList.toggle('ls-r2-off', s.ratio > 1);
    out.why.textContent = s.ratio > 1 ? 'This line is worse than a flat line at ȳ, so R² is pinned at 0.' : '';

    checkBtn.setAttribute('aria-expanded', String(st.checked));
    checkPanel.hidden = !st.checked;
    if (st.checked) {
      const best = { m: s.locked ? s.m0 : s.mOLS, b: s.locked ? 0 : s.bOLS };
      const r = interpret(st.ds, st.xT, st.yT, best.m, best.b);
      if (!r) {
        checkPanel.innerHTML = '<p>These axes are not a straight-line form of the model, so no slope here has a clean '
          + 'physical meaning. Expect curvature in the residuals. Try other axes.</p>';
      } else {
        const fitLbl = st.locked ? 'Least-squares fit through the origin' : 'Least-squares fit';
        checkPanel.replaceChildren(
          h('p', {}, `In this plot, slope = ${r.slope}, intercept = ${r.intercept}.`),
          h('p', { class: 'ls-big' }, r.values.map(([n, v, unit]) => `${n} = ${Number.isFinite(v) ? v.toPrecision(4).replace(/-/g, '−') : '—'} ${unit}`).join(', ')),
          h('p', { class: 'ls-status' }, `${fitLbl}. The data were generated with ${r.truth.map(([n, v, unit]) => `${n} = ${v} ${unit}`).join(', ')}.`));
      }
    }
  }

  // ── drawing ──
  const colors = () => themeVars(root, { accent: '--fw-blue', ink: '--fw-text', muted: '--fw-text-dim',
    faint: '--fw-text-muted', grid: '--fw-grid', axis: '--fw-border-dk', ok: '--fw-green', bad: '--fw-red',
    res: '--fw-orange', panel: '--fw-surface', font: '--fw-font', size: '--fw-plot-font-size' });

  // Canvases are drawn at their box size, or at a fallback size while hidden (for snapshots).
  function prep(cv, fallbackH) {
    const r = cv.getBoundingClientRect(), dpr = globalThis.devicePixelRatio || 1;
    const W = r.width || 640, H = r.height || fallbackH;
    const w = Math.round(W * dpr), hgt = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H);
    return { ctx, W, H, laidOut: r.width > 0 };
  }

  let C = null;
  function frame(ctx, W, H, xr, yr, xl, yl, m = MARGIN) {
    const L = m.l, R = W - m.r, T = m.t, B = H - m.b;
    const X = (v) => L + (v - xr[0]) / (xr[1] - xr[0]) * (R - L);
    const Y = (v) => B - (v - yr[0]) / (yr[1] - yr[0]) * (B - T);
    const ix = (px) => xr[0] + (px - L) / (R - L) * (xr[1] - xr[0]);
    const iy = (py) => yr[0] + (B - py) / (B - T) * (yr[1] - yr[0]);
    const xs = niceStep(xr[1] - xr[0], Math.max(3, (R - L) / 90));
    const ys = niceStep(yr[1] - yr[0], Math.max(3, (B - T) / 55));
    ctx.lineWidth = 1;
    ctx.font = `${C.size} ${C.font}`;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let v = Math.ceil(xr[0] / xs) * xs; v <= xr[1] + xs * 1e-9; v += xs) {
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke();
      ctx.fillText(fmtTick(v, xs), X(v), B + 6);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + ys * 1e-9; v += ys) {
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke();
      ctx.fillText(fmtTick(v, ys), L - 6, Y(v));
    }
    ctx.strokeStyle = C.axis;
    if (xr[0] < 0 && xr[1] > 0) { ctx.beginPath(); ctx.moveTo(X(0), T); ctx.lineTo(X(0), B); ctx.stroke(); }
    if (yr[0] < 0 && yr[1] > 0) { ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(R, Y(0)); ctx.stroke(); }
    ctx.strokeRect(L, T, R - L, B - T);
    ctx.fillStyle = C.ink; ctx.font = `15px ${C.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(xl, (L + R) / 2, H - 4);
    ctx.save(); ctx.translate(14, (T + B) / 2); ctx.rotate(-PI / 2);
    ctx.textBaseline = 'middle'; ctx.fillText(yl, 0, 0); ctx.restore();
    return { X, Y, ix, iy, L, R, T, B };
  }
  function clip(ctx, f) { ctx.save(); ctx.beginPath(); ctx.rect(f.L, f.T, f.R - f.L, f.B - f.T); ctx.clip(); }
  function errBar(ctx, f, x, y, sy) {
    const c = 4;
    ctx.beginPath();
    ctx.moveTo(f.X(x), f.Y(y - sy)); ctx.lineTo(f.X(x), f.Y(y + sy));
    ctx.moveTo(f.X(x) - c, f.Y(y - sy)); ctx.lineTo(f.X(x) + c, f.Y(y - sy));
    ctx.moveTo(f.X(x) - c, f.Y(y + sy)); ctx.lineTo(f.X(x) + c, f.Y(y + sy));
    ctx.stroke();
  }
  function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * PI); ctx.fill(); }

  function scatterRange(pts) {
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0; // always include the origin so the intercept is visible
    for (const p of pts) {
      x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X);
      y0 = Math.min(y0, p.Y - p.sY); y1 = Math.max(y1, p.Y + p.sY);
    }
    const px = 0.06 * (x1 - x0), py = 0.08 * (y1 - y0);
    return { xr: [x0 < 0 ? x0 - px : 0, x1 > 0 ? x1 + px : 0], yr: [y0 < 0 ? y0 - py : 0, y1 > 0 ? y1 + py : 0] };
  }

  const frames = { scatter: null, plane: null, scatterRange: null };
  function drawScatter(pts) {
    const { ctx, W, H, laidOut } = prep(scatterCv, 380);
    const rg = st.scRange ?? scatterRange(pts);
    const f = frame(ctx, W, H, rg.xr, rg.yr, axisLabel(st.xT, D().x), axisLabel(st.yT, D().y));
    frames.scatter = laidOut ? f : null;
    frames.scatterRange = rg;
    clip(ctx, f);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(f.L, f.Y(st.m * rg.xr[0] + st.b)); ctx.lineTo(f.R, f.Y(st.m * rg.xr[1] + st.b)); ctx.stroke();
    if (st.showRes) {
      ctx.strokeStyle = C.res; ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
      for (const p of pts) { ctx.beginPath(); ctx.moveTo(f.X(p.X), f.Y(p.Y)); ctx.lineTo(f.X(p.X), f.Y(st.m * p.X + st.b)); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // in fine view, bars the line misses turn red
    ctx.lineWidth = 1.5;
    for (const p of pts) {
      ctx.strokeStyle = st.view === 'fine' && !hits(p, st.m, st.b) ? C.bad : C.muted;
      errBar(ctx, f, p.X, p.Y, p.sY);
    }
    const editing = st.edit && !ctl.points.isLocked() && !ctl.points.isHidden();
    pts.forEach((p, i) => dot(ctx, f.X(p.X), f.Y(p.Y), editing ? (i === st.dragPt ? 6.5 : 5) : 4,
      i === st.dragPt ? C.accent : C.ink));
    ctx.restore();
  }

  function drawResid(pts) {
    const { ctx, W, H } = prep(residualCv, 170);
    const rg = st.scRange ?? scatterRange(pts);
    const r = pts.map((p) => p.Y - st.m * p.X - st.b);
    let hh = 0; pts.forEach((p, i) => { hh = Math.max(hh, Math.abs(r[i]) + p.sY); });
    hh = (hh || 1) * 1.15;
    const u = lineUnits(st.ds, st.xT, st.yT).b;
    const yl = st.yT === 'ln' ? 'residual' : `residual (${u || '—'})`;
    const f = frame(ctx, W, H, rg.xr, [-hh, hh], axisLabel(st.xT, D().x), yl);
    clip(ctx, f);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(f.L, f.Y(0)); ctx.lineTo(f.R, f.Y(0)); ctx.stroke(); ctx.setLineDash([]);
    pts.forEach((p, i) => {
      ctx.strokeStyle = st.view === 'fine' && Math.abs(r[i]) > p.sY ? C.bad : C.muted;
      errBar(ctx, f, p.X, r[i], p.sY);
    });
    pts.forEach((p, i) => dot(ctx, f.X(p.X), f.Y(r[i]), 4, C.res));
    ctx.restore();
  }

  function marker(ctx, f, m, b, shape, text) {
    const x = f.X(m), y = f.Y(b);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'ring') ctx.arc(x, y, 9, 0, 2 * PI); else ctx.rect(x - 8, y - 8, 16, 16);
    ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
    ctx.stroke();
    if (text) {
      ctx.font = `bold ${C.size} ${C.font}`; ctx.fillStyle = C.accent;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 13, y - 10);
    }
  }

  function drawPlane(S, pts) {
    const { ctx, W, H, laidOut } = prep(planeCv, 300);
    const R = range(), u = lineUnits(st.ds, st.xT, st.yT);
    const f = frame(ctx, W, H, [R.m0, R.m1], [R.b0, R.b1],
      `slope m${u.m ? ` (${u.m})` : ''}`, `intercept b${u.b ? ` (${u.b})` : ''}`, { l: 64, r: 10, t: 10, b: 46 });
    frames.plane = laidOut ? f : null;
    clip(ctx, f);

    if (st.locked) {
      ctx.strokeStyle = C.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(f.L, f.Y(0)); ctx.lineTo(f.R, f.Y(0)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // every line that passes through all the error bars
    ctx.fillStyle = ctx.strokeStyle = C.ok;
    if (st.locked) {
      const iv = feasibleM0(pts);
      if (iv) {
        ctx.lineWidth = 7; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(f.X(iv[0]), f.Y(0)); ctx.lineTo(f.X(iv[1]), f.Y(0)); ctx.stroke();
      }
    } else {
      const poly = feasible(pts, st.rangeC);
      if (poly.length) {
        ctx.beginPath(); poly.forEach(([m, b], i) => (i ? ctx.lineTo(f.X(m), f.Y(b)) : ctx.moveTo(f.X(m), f.Y(b))));
        ctx.closePath(); ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    const ring = (dL, style) => {
      const ps = [];
      for (let i = 0; i <= 180; i++) { const [m, b] = ellPoint(S, dL, i / 180 * 2 * PI); ps.push([f.X(m), f.Y(b)]); }
      ctx.strokeStyle = style.color; ctx.lineWidth = style.w; ctx.setLineDash(style.dash || []);
      ctx.beginPath(); ps.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
      return ps;
    };
    const placed = [];
    const label = (ps, text, color) => {
      const inside = ps.filter(([x, y]) => x > f.L + 20 && x < f.R - 20 && y > f.T + 10 && y < f.B - 10);
      if (!inside.length || !text) return;
      const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
      if (Math.max(...xs) - Math.min(...xs) < 40 && Math.max(...ys) - Math.min(...ys) < 40) return;
      const [x, y] = inside.reduce((a, p) => (p[1] < a[1] ? p : a));
      ctx.font = `${C.size} ${C.font}`;
      const w = ctx.measureText(text).width + 6;
      if (placed.some((q) => Math.abs(q[0] - x) < (q[2] + w) / 2 + 2 && Math.abs(q[1] - y) < 16)) return;
      placed.push([x, y, w]);
      ctx.fillStyle = C.panel; ctx.fillRect(x - w / 2, y - 8, w, 16);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
    };
    if (st.view === 'fine') {
      // evenly spaced rings near the bottom, spaced by the error-bar scale Σσ²; labels get enough digits to differ
      const { D: Dsc, base } = st.rangeF;
      const dig = Math.max(2, Math.min(6, Math.ceil(-Math.log10(0.75 * Dsc / S.SST)) + 1));
      for (const q of [0.25, 1, 2.25, 4, 6.25, 9, 16, 25]) {
        const dL = base + Dsc * q, r2 = 1 - (S.SSEmin + dL) / S.SST;
        label(ring(dL, { color: C.axis, w: 1 }), r2 > 0 ? `R² = ${r2.toFixed(dig)}` : '', C.muted);
      }
    } else {
      for (const k of OUTER) ring(k * S.SST - S.SSEmin, { color: C.grid, w: 1 });
      for (const r2 of R2_LEVELS) {
        const dL = S.SST * (1 - r2) - S.SSEmin;
        if (dL <= 0) continue;
        const ps = ring(dL, r2 === 0 ? { color: C.muted, w: 1.5, dash: [5, 4] } : { color: C.axis, w: 1 });
        label(ps, `R² = ${r2}`, r2 === 0 ? C.ink : C.muted);
      }
    }

    // previous minima (from earlier "New data" draws), then the current ones once revealed
    ctx.globalAlpha = 0.35;
    for (const g of st.ghosts) marker(ctx, f, st.locked ? g.m0 : g.m, st.locked ? 0 : g.b, st.locked ? 'sq' : 'ring', '');
    ctx.globalAlpha = 1;
    if (st.revealed) {
      marker(ctx, f, S.mS, S.bS, 'ring', 'OLS');
      if (st.locked) marker(ctx, f, S.m0, 0, 'sq', 'best with b = 0');
    }
    if (!ctl.line.isHidden()) {
      dot(ctx, f.X(st.m), f.Y(st.b), 9, C.panel);
      dot(ctx, f.X(st.m), f.Y(st.b), 7, ctl.line.isLocked() ? C.faint : C.accent);
    }
    ctx.restore();
  }

  function drawAll() {
    C = colors();
    const pts = points(), S = stats(pts);
    drawScatter(pts);
    if (st.showRes) drawResid(pts);
    drawPlane(S, pts);
    syncHandles();
  }
  let queued = 0;
  function redraw() {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; drawAll(); });
  }

  // ── pointer interaction (per instance, on this instance's canvases) ──
  function planeTo(e) {
    const r = planeCv.getBoundingClientRect(), R = range(), f = frames.plane;
    st.m = clamp(f.ix(e.clientX - r.left), R.m0, R.m1);
    st.b = st.locked ? 0 : clamp(f.iy(e.clientY - r.top), R.b0, R.b1);
    commit();
  }
  function onPlaneDown(e) {
    if (!frames.plane || ctl.line.isLocked() || ctl.line.isHidden()) return;
    stopAnim();
    st.dragPlane = true; planeCv.setPointerCapture?.(e.pointerId); planeTo(e);
  }
  function onPlaneMove(e) { if (st.dragPlane) planeTo(e); }
  function onPlaneUp() { st.dragPlane = false; }
  planeCv.addEventListener('pointerdown', onPlaneDown);
  planeCv.addEventListener('pointermove', onPlaneMove);
  planeCv.addEventListener('pointerup', onPlaneUp);
  planeCv.addEventListener('pointercancel', onPlaneUp);

  // edit mode: each data point is a kit handle (pointHandle), dragged up and down or moved with
  // the arrow keys; a press elsewhere on the plane above jumps the (m, b) point there.

  const resizeObserver = new ResizeObserver(() => redraw());
  resizeObserver.observe(root);

  // Display contract: client position of a plot point, or null until laid out.
  const screenOf = (cv, key) => (x, y) => {
    const f = frames[key];
    if (!f) return null;
    const r = cv.getBoundingClientRect();
    if (Math.abs(r.width - cv.width / (globalThis.devicePixelRatio || 1)) > 1) return null;
    return { x: r.left + f.X(x), y: r.top + f.Y(y) };
  };
  const snap = (cv) => async () => { drawAll(); return cv.toDataURL('image/png'); };

  // ── start ──
  apply({ ...start, m: setup?.m, b: setup?.b });
  updateReadouts(getState());
  drawAll();

  return {
    state: { snapshot: getState, describe, onChange: (fn) => changes.on(fn) },
    controls: controlRegistry(ctl),
    displays: [
      { id: 'scatter', label: 'Graph with error bars and line', snapshot: snap(scatterCv), toScreen: screenOf(scatterCv, 'scatter') },
      { id: 'residuals', label: 'Residuals', snapshot: async () => {
        C = colors(); drawResid(points()); return residualCv.toDataURL('image/png');
      } },
      { id: 'plane', label: 'Parameter plane', snapshot: snap(planeCv), toScreen: screenOf(planeCv, 'plane') },
    ],
    serialize,
    restore(saved = {}) { apply(saved || {}); commit(); },
    resize: () => drawAll(),
    destroy() {
      stopAnim();
      cancelAnimationFrame(queued);
      resizeObserver.disconnect();
      planeCv.removeEventListener('pointerdown', onPlaneDown);
      planeHandle.destroy();
      for (const ph of pointHandles) ph.destroy();
      changes.clear();
      root.remove();
    },
  };
}

export default defineTool({
  id: 'least-squares',
  title: 'Least Squares Fitting',
  modes: [{ id: 'fit', title: 'Fit' }],
  // The Graph column sits beside a 360 px Fit panel: below this the scatter plot is too narrow
  // to read (about 180 px at the default 480).
  minDisplayWidth: 760,
  mount,
});
