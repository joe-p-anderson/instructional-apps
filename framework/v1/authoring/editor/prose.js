// A prose field: Task prompts, Hint texts, Question prompts and choice texts. Needs a DOM.
//
// proseField(ctx, { label, path, value, toEdit, rows? }) -> node
//   ctx is the TaskContext (task-form.js); path is the full data-path; toEdit(text) -> edit.
//   Each keystroke is an edit, one undo group per visit, and the text is stored exactly as typed.
//
// The field is a source box (the textarea, named by `label`), a live preview beside it (a region
// named "<label> preview") and a formatting-help hover (a button "Formatting help for <label>",
// opened by hover or focus and closed by Escape). The preview renders the text as the Activity
// runner's Task card does (activity-ui.js): the same element and class for the kind of prose,
// picked from the path, then typeset with MathJax (vendor.js typeset) once it is attached.
//   …prompt                    → div.fw-task-prompt
//   …hint.text                 → div.fw-task-hint, "Hint:" first, as revealed
//   …questions.N.prompt        → div.fw-question-prompt
//   …choices.N.text            → span.fw-choice > span
// Hint texts arrive decoded: the editor core decodes on open and re-encodes on save.

import { h } from '../../ui-kit.js';
import { typeset } from '../../vendor.js';

const TIP_HTML = `<b>Prompts are HTML.</b> Tags in use:<table>
  <tr><td><code>&lt;sub&gt;</code></td><td>subscript: <code>V&lt;sub&gt;R&lt;/sub&gt;</code> → V<sub>R</sub></td></tr>
  <tr><td><code>&lt;sup&gt;</code></td><td>superscript: <code>10&lt;sup&gt;-6&lt;/sup&gt;</code> → 10<sup>-6</sup></td></tr>
  <tr><td><code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;em&gt;</code></td><td><b>bold</b>, <i>italic</i>, <em>emphasis</em></td></tr>
  <tr><td><code>&lt;br&gt;</code></td><td>line break</td></tr></table>
  Unicode works too (V₀, φ₂, ω, µ, °).<br><b>Math</b> goes in <code>\\( … \\)</code>, typeset by MathJax:
  <code>\\(\\omega_0 = 1/\\sqrt{LC}\\)</code>. Display math: <code>\\[ … \\]</code>.`;

let tipSerial = 0;

function infoHover(label) {
  const id = `prose-tip-${++tipSerial}`;
  const tip = h('span', { class: 'tip', role: 'tooltip', id, html: TIP_HTML });
  const info = h('span', { class: 'info', tabindex: '0', role: 'button', 'aria-label': `Formatting help for ${label}`,
    'aria-describedby': id }, 'i', tip);
  // Escape closes the tip until focus leaves or the pointer comes back (WCAG 1.4.13, dismissible).
  info.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !info.hasAttribute('data-dismissed')) { e.preventDefault(); e.stopPropagation(); info.setAttribute('data-dismissed', ''); }
  });
  const reset = () => info.removeAttribute('data-dismissed');
  info.addEventListener('blur', reset);
  info.addEventListener('mouseenter', reset);
  return info;
}

function kindOf(path) {
  if (/(^|\.)hint\.text$/.test(path)) return 'hint';
  if (/(^|\.)choices\.\d+\.text$/.test(path)) return 'choice';
  if (/(^|\.)questions\.\d+\.prompt$/.test(path)) return 'question';
  return 'prompt';
}

// The text as the Task card renders it.
function rendered(kind, text) {
  if (kind === 'hint') return h('div', { class: 'fw-task-hint', html: `<strong>Hint:</strong> ${text}` });
  if (kind === 'question') return h('div', { class: 'fw-question-prompt', html: text });
  if (kind === 'choice') return h('span', { class: 'fw-choice' }, h('span', { html: text }));
  return h('div', { class: 'fw-task-prompt', html: text });
}

// Typeset once attached: MathJax measures the page, and a detached element gives NaN sizes.
function typesetWhenAttached(el, tries = 60) {
  requestAnimationFrame(() => {
    if (el.isConnected) typeset([el]);
    else if (tries > 0) typesetWhenAttached(el, tries - 1);
  });
}

export function proseField(ctx, { label, path, value, toEdit, rows = '4' }) {
  const kind = kindOf(path);
  const out = h('div', { class: 'prose-out', role: 'region', 'aria-label': `${label} preview`, 'aria-live': 'off' });
  const draw = (text) => {
    window.MathJax?.typesetClear?.([out]);
    if (!text) { out.replaceChildren(h('span', { class: 'muted' }, '(empty)')); return; }
    const card = rendered(kind, text);
    out.replaceChildren(card);
    typesetWhenAttached(card);
  };
  const [labelEl, source] = ctx.field({ label, path, value, toEdit, textarea: true, rows, class: 't mono', spellcheck: 'false' });
  let timer;
  source.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => draw(source.value), 150); });
  draw(value ?? '');
  return h('div', { class: `prose-field${kind === 'choice' ? ' compact' : ''}` },
    h('div', { class: 'prose-head' }, labelEl, infoHover(label), h('span', { class: 'muted' }, 'source on the left, what the student sees on the right')),
    h('div', { class: `prose${kind === 'choice' ? ' compact' : ''}` }, source, out));
}
