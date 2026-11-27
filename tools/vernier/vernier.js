// Vernier caliper Tool (framework v1): practise reading a 0.05 mm vernier caliper.
// Ported from vernier-trainer/vernier-trainer.html.
//
// Setup: { type, seed, zoom } (any subset). type: 'od' | 'id' | 'depth' | 'random' (default 'od');
//   seed: integer (default: a fresh random seed); zoom: 'whole' | 'scale' (default 'whole').
// State (state.snapshot()):
//   inputs    type, seed, zoom, draw (how many readings have been drawn from the seed)
//   reading   pick (measurement type drawn), reading (mm), mainMark (mm), vernierLine, matchMark (mm)
//   progress  answered, correct, attempts, streak
// Controls: selects 'type', 'zoom'; text input 'reading'; buttons 'check', 'reveal', 'next'.
// Displays: 'caliper' (the caliper SVG).
//
// The maths (seeded readings, breakdown, judging) lives in reading.js.

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { button, escapeHtml, h, metric, section, select, themeVars } from '../../framework/v1/ui-kit.js';
import { RANGES, drawReading, judge } from './reading.js';

// The Inkscape drawing, loaded once and cloned per instance.
const TEMPLATE = new DOMParser()
  .parseFromString(await (await fetch(new URL('./caliper.svg', import.meta.url))).text(), 'image/svg+xml')
  .documentElement;

const SVGNS = 'http://www.w3.org/2000/svg';
// Everything below is in the drawing's layer1 coordinates (mm).
const LAYER_DX = 145.21533, LAYER_DY = 86.96979; // layer1 -> root viewBox
const SLIDER_X0 = 0.27750375;   // translate of the slider and depth rod when the jaws are closed
const MAIN_ZERO = -119.55432;   // x of the main-scale 0 mark (= vernier 0 when closed)
const PITCH = 1.95;             // vernier line spacing: 20 divisions over 39 mm
const BEAM_END = 67.158401;     // right end of the beam, where the depth rod emerges
const OD_FACE = -127;           // fixed lower jaw face
const ID_FACE = -128.29567;     // fixed upper jaw outer face

const TYPES = [
  { value: 'od', label: 'Outside' },
  { value: 'id', label: 'Inside' },
  { value: 'depth', label: 'Depth' },
  { value: 'random', label: 'Random' },
];
const ZOOMS = [{ value: 'whole', label: 'Whole caliper' }, { value: 'scale', label: 'Scale close-up' }];
const NAMES = { od: 'outside width of the block', id: 'inside width of the tube', depth: 'depth of the hole' };
const DEFAULTS = { type: 'od', zoom: 'whole' };

const STATE_INFO = {
  type: { label: 'Measurement type', unit: '' },
  seed: { label: 'Seed', unit: '' },
  zoom: { label: 'Zoom', unit: '' },
  draw: { label: 'Readings drawn', unit: '' },
  pick: { label: 'Measurement', unit: '' },
  reading: { label: 'Reading', unit: 'mm' },
  mainMark: { label: 'Main-scale mark', unit: 'mm' },
  vernierLine: { label: 'Matching vernier line', unit: '' },
  matchMark: { label: 'Matching main-scale line', unit: 'mm' },
  answered: { label: 'Answered', unit: '' },
  correct: { label: 'Correct', unit: '' },
  attempts: { label: 'Attempts', unit: '' },
  streak: { label: 'Streak', unit: '' },
};

// Colours of the measured objects; the marks and feedback use theme colours (themeVars).
const C = { wood: '#d8b77a', hatch: '#e3c99a', hatchLine: '#9a7a45', edge: '#5a4626' };

const fmt = (v) => v.toFixed(2);
const isOneOf = (list, v) => list.some((o) => o.value === v);
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Clone the drawing with every id prefixed, so several instances can share a page. */
function cloneDrawing(prefix) {
  const svg = document.importNode(TEMPLATE, true);
  for (const node of [svg, ...svg.querySelectorAll('[id]')]) if (node.id) node.id = prefix + node.id;
  for (const node of svg.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (attr.value.includes('url(#')) attr.value = attr.value.replaceAll('url(#', `url(#${prefix}`);
      if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#')) {
        node.setAttribute(attr.name, `#${prefix}${attr.value.slice(1)}`);
      }
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg;
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function mount(container, modeId = 'caliper', setup = {}) {
  const start = { ...DEFAULTS, ...(setup || {}) };
  const s = {
    type: isOneOf(TYPES, start.type) ? start.type : DEFAULTS.type,
    seed: Number.isInteger(start.seed) ? start.seed : randomSeed(),
    zoom: isOneOf(ZOOMS, start.zoom) ? start.zoom : DEFAULTS.zoom,
    draw: 0,
    answered: false,
    outcome: null, // 'correct' | 'wrong' | 'revealed' once answered
    entered: null, // the value checked, mm
    correct: 0,
    attempts: 0,
    streak: 0,
  };
  let reading = drawReading(s);
  let message = ''; // a rejected answer's format message (not part of the State)
  const changes = createEmitter();

  // ── Display: the caliper drawing, per instance ──
  const prefix = `vernier-${Math.random().toString(36).slice(2, 10)}-`;
  const svg = cloneDrawing(prefix);
  svg.setAttribute('style', 'display:block;width:100%;height:100%');
  const byId = (id) => svg.querySelector(`[id="${prefix}${id}"]`);
  const layer = byId('layer1');
  const slider = byId('g477');
  const rod = byId('depth-rod');

  // Hatch pattern for sectioned parts; objects sit under the caliper, highlights on top.
  const defs = el('defs', {}, null);
  svg.insertBefore(defs, svg.firstChild);
  const hatchId = `${prefix}hatch`;
  const hatch = el('pattern', { id: hatchId, width: 1.6, height: 1.6, patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 1.6, height: 1.6, fill: C.hatch }, hatch);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 1.6, stroke: C.hatchLine, 'stroke-width': 0.35 }, hatch);
  const objects = el('g', { id: `${prefix}object` });
  layer.insertBefore(objects, rod);
  const marks = el('g', { id: `${prefix}marks` }, layer);

  // ── Controls ──
  const typeSelect = select({ id: 'type', name: 'Measurement', options: TYPES, value: s.type,
    onChange: (v) => { s.type = v; nextReading(); } });
  const zoomSelect = select({ id: 'zoom', name: 'Zoom', options: ZOOMS, value: s.zoom,
    onChange: (v) => { s.zoom = v; updateView(true); emit(); } });

  const input = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'e.g. 23.45',
    'aria-label': 'Reading (mm)', class: 'fw-number', style: 'width:7em;text-align:left' });
  const readingBox = h('label', { style: 'display:flex;align-items:center;gap:6px' },
    h('span', { class: 'fw-control-name' }, 'Reading', h('span', { class: 'fw-unit' }, ' mm')), input);
  const readingCtl = createControl({ id: 'reading', label: 'Reading (mm)', el: readingBox,
    get: () => input.value, set: (v) => { input.value = String(v ?? ''); }, onLock: refreshEnabled });

  // Lock disables a button (ui-kit); refreshEnabled also disables Check and Show answer once answered.
  const checkBtn = button({ id: 'check', name: 'Check', onClick: () => check(), onLock: refreshEnabled });
  const revealBtn = button({ id: 'reveal', name: 'Show answer', onClick: () => reveal(), onLock: refreshEnabled });
  const nextBtn = button({ id: 'next', name: 'Next', onClick: () => nextReading(), onLock: refreshEnabled });

  const form = h('form', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px',
    onsubmit: (e) => { e.preventDefault(); check(); } },
  readingBox, checkBtn.el, revealBtn.el, nextBtn.el);

  const counters = {
    correct: metric({ name: 'Correct' }),
    attempts: metric({ name: 'Attempts' }),
    streak: metric({ name: 'Streak' }),
  };
  const task = h('p', { style: 'margin:0 0 8px;font-size:17px' });
  const feedback = h('div', { role: 'status', 'aria-label': 'Feedback', 'aria-live': 'polite',
    style: 'margin-top:10px;min-height:1.5em;font-size:16px;font-variant-numeric:tabular-nums' });

  const root = h('div', { class: 'fw-tool', 'data-tool': 'vernier' },
    h('aside', { class: 'fw-controls' },
      section('Setup', typeSelect.el, zoomSelect.el),
      section('Score', ...Object.values(counters).map((m) => m.el)),
      section('How to read it',
        h('div', { class: 'fw-hint' }, 'Each vernier division is worth 0.05 mm. The main-scale reading is the '
          + 'last millimetre mark at or to the left of the vernier 0. Then find the one vernier line that lines '
          + 'up exactly with a main-scale mark; multiply its division number by 0.05 mm and add.'))),
    h('div', { class: 'fw-displays' },
      task,
      h('div', { class: 'fw-display', style: 'background:var(--fw-paper);padding:6px' }, svg),
      form,
      feedback));
  container.append(root);

  const controls = { type: typeSelect, zoom: zoomSelect, reading: readingCtl,
    check: checkBtn, reveal: revealBtn, next: nextBtn };

  // ── Drawing ──
  const theme = () => themeVars(root, { main: '--fw-blue', match: '--fw-orange', good: '--fw-green',
    bad: '--fw-red', surface: '--fw-surface', paper: '--fw-paper' });

  function drawCaliper() {
    const t = `translate(${SLIDER_X0 + reading.mm})`;
    slider.setAttribute('transform', t);
    rod.setAttribute('transform', t);

    objects.replaceChildren();
    const stroke = { stroke: C.edge, 'stroke-width': 0.3 };
    const r = reading.mm;
    if (reading.pick === 'od') {
      el('rect', { x: OD_FACE, y: -42, width: r, height: 28, fill: C.wood, ...stroke }, objects);
    } else if (reading.pick === 'id') {
      const w = 6, y = -87.6, ht = 16.5;
      el('rect', { x: ID_FACE - w, y, width: w, height: ht, fill: `url(#${hatchId})`, ...stroke }, objects);
      el('rect', { x: ID_FACE + r, y, width: w, height: ht, fill: `url(#${hatchId})`, ...stroke }, objects);
    } else {
      const x0 = BEAM_END, x1 = BEAM_END + r, x2 = BEAM_END + r + 10;
      el('path', { d: `M ${x0},-76 H ${x2} V -40 H ${x0} V -56.19 H ${x1} V -60.19 H ${x0} Z`,
        fill: `url(#${hatchId})`, ...stroke }, objects);
    }

    marks.replaceChildren();
    if (!s.answered) return;
    const { main: mainCol, match: matchCol } = theme();
    const line = (x, y1, y2, color) => el('line', { x1: x, x2: x, y1, y2, stroke: color, 'stroke-width': 0.42,
      'stroke-linecap': 'round' }, marks);
    line(MAIN_ZERO + reading.main, -58.2, -53.8, mainCol);
    line(MAIN_ZERO + reading.match, -58.2, -53.8, matchCol);
    line(MAIN_ZERO + reading.mm + PITCH * reading.line, -55.0, -52.6, matchCol);
  }

  // Two fixed zoom levels, tweened.
  function targetBox() {
    if (s.zoom === 'scale') return [MAIN_ZERO + reading.mm - 5, -61.6, 49, 12.9];
    const right = reading.pick === 'depth' ? BEAM_END + RANGES.depth[1] + 14 : 70;
    const top = reading.pick === 'id' ? -89 : -88;
    return [-147, top, right + 147, 83];
  }
  let box = null;
  let raf = 0;
  const applyBox = (b) => svg.setAttribute('viewBox', `${b[0] + LAYER_DX} ${b[1] + LAYER_DY} ${b[2]} ${b[3]}`);
  function updateView(animate) {
    const to = targetBox();
    cancelAnimationFrame(raf);
    if (!animate || !box || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      box = to;
      applyBox(to);
      return;
    }
    const from = box.slice();
    const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / 260);
      const e = u * (2 - u);
      box = from.map((f, i) => f + (to[i] - f) * e);
      applyBox(box);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function breakdownHtml() {
    const { main, line, match, mm } = reading;
    const T = theme();
    const swatch = (color) => `<span style="display:inline-block;width:0.9em;height:0.25em;vertical-align:middle;`
      + `margin-right:4px;background:${color}"></span>`;
    return `<div class="vernier-breakdown" style="margin-top:6px;padding:8px 10px;border-left:3px solid `
      + `${T.main};background:${T.surface}">`
      + `${swatch(T.main)}Main scale: last mark at or before vernier 0 is <b>${main} mm</b><br>`
      + `${swatch(T.match)}Vernier line <b>${line}</b> lines up (with the ${match} mm mark): `
      + `${line} &times; 0.05 = <b>${fmt(line * 0.05)} mm</b><br>`
      + `Reading: ${main} + ${fmt(line * 0.05)} = <b>${fmt(mm)} mm</b></div>`;
  }

  function feedbackHtml() {
    const T = theme();
    const good = `color:${T.good};font-weight:bold`;
    const bad = `color:${T.bad};font-weight:bold`;
    if (s.outcome === 'correct') return `<span style="${good}">Correct: ${fmt(reading.mm)} mm.</span>`;
    if (s.outcome === 'wrong') {
      return `<span style="${bad}">Not quite. You entered ${fmt(s.entered)} mm.</span>${breakdownHtml()}`;
    }
    if (s.outcome === 'revealed') return `<span style="font-weight:bold">Answer shown.</span>${breakdownHtml()}`;
    return message ? `<span style="${bad}">${escapeHtml(message)}</span>` : '';
  }

  function refreshEnabled() {
    input.disabled = readingCtl.isLocked() || s.answered;
    checkBtn.el.disabled = checkBtn.isLocked() || s.answered;
    revealBtn.el.disabled = revealBtn.isLocked() || s.answered;
  }

  function render() {
    drawCaliper();
    task.textContent = `Read the ${NAMES[reading.pick]}.`;
    feedback.innerHTML = feedbackHtml();
    for (const k of Object.keys(counters)) counters[k].update(s[k]);
    // Mirror the selects without firing their onChange.
    zoomSelect.el.querySelector('select').value = s.zoom;
    typeSelect.el.querySelector('select').value = s.type;
    refreshEnabled();
  }

  function getState() {
    return {
      type: s.type, seed: s.seed, zoom: s.zoom, draw: s.draw,
      pick: reading.pick, reading: reading.mm,
      mainMark: reading.main, vernierLine: reading.line, matchMark: reading.match,
      answered: s.answered, correct: s.correct, attempts: s.attempts, streak: s.streak,
    };
  }
  const emit = () => changes.emit(getState());

  // ── Practice loop ──
  function finish(outcome, entered = null) {
    s.answered = true;
    s.outcome = outcome;
    s.entered = entered;
    s.attempts += 1;
    if (outcome === 'correct') { s.correct += 1; s.streak += 1; } else s.streak = 0;
    message = '';
    render();
    if (!nextBtn.el.disabled && root.contains(document.activeElement)) nextBtn.el.focus({ preventScroll: true });
    emit();
  }

  function check() {
    if (s.answered || checkBtn.isLocked()) return;
    const result = judge(input.value, reading.twentieths);
    if (result.status === 'invalid') {
      message = result.message;
      feedback.innerHTML = feedbackHtml();
      return;
    }
    finish(result.status, result.value);
  }

  function reveal() {
    if (s.answered || revealBtn.isLocked()) return;
    finish('revealed');
  }

  function nextReading() {
    s.draw += 1;
    s.answered = false;
    s.outcome = null;
    s.entered = null;
    s.zoom = 'whole';
    message = '';
    input.value = '';
    reading = drawReading(s);
    render();
    updateView(false);
    emit();
  }

  render();
  updateView(false);

  // ── PNG snapshot: render the SVG as it is now to a canvas ──
  async function snapshot() {
    const copy = svg.cloneNode(true);
    const [, , w, ht] = svg.getAttribute('viewBox').split(' ').map(Number);
    const width = 1200;
    const height = Math.round((width * ht) / w);
    copy.setAttribute('width', width);
    copy.setAttribute('height', height);
    copy.removeAttribute('style');
    const text = new XMLSerializer().serializeToString(copy);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = theme().paper;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [{ id: 'caliper', label: 'Vernier caliper', snapshot }],
    serialize: () => ({
      type: s.type, seed: s.seed, draw: s.draw, zoom: s.zoom,
      correct: s.correct, attempts: s.attempts, streak: s.streak,
      answered: s.answered, outcome: s.outcome, entered: s.entered,
    }),
    restore(saved = {}) {
      if (isOneOf(TYPES, saved.type)) s.type = saved.type;
      if (Number.isInteger(saved.seed)) s.seed = saved.seed;
      if (Number.isInteger(saved.draw) && saved.draw >= 0) s.draw = saved.draw;
      if (isOneOf(ZOOMS, saved.zoom)) s.zoom = saved.zoom;
      s.correct = count(saved.correct);
      s.attempts = count(saved.attempts);
      s.streak = count(saved.streak);
      const outcome = ['correct', 'wrong', 'revealed'].includes(saved.outcome) ? saved.outcome : null;
      s.answered = Boolean(saved.answered && outcome);
      s.outcome = s.answered ? outcome : null;
      s.entered = s.outcome === 'wrong' && Number.isFinite(saved.entered) ? saved.entered : null;
      if (s.outcome === 'wrong' && s.entered === null) s.outcome = 'revealed';
      message = '';
      input.value = '';
      reading = drawReading(s);
      render();
      updateView(false);
      emit();
    },
    destroy() {
      cancelAnimationFrame(raf);
      changes.clear();
      root.remove();
    },
  };
}

export default defineTool({
  id: 'vernier',
  title: 'Vernier Caliper',
  modes: [{ id: 'caliper', title: 'Vernier caliper', setupKeys: ['type', 'seed', 'zoom'] }],
  // The scale numerals are part of the caliper drawing, which scales with the Display: they reach
  // 13 px at a Display about 1000 px wide (about 7 px at the default 480).
  minDisplayWidth: 1000,
  mount,
});
