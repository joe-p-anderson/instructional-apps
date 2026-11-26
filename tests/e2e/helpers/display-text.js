// Display text sizes, for the 13 px floor (theme token --fw-plot-font-size). Reads the size every
// visible piece of text inside the visible Display area (.fw-displays) is shown at, in CSS px:
// HTML and SVG text (Plotly included) from the DOM, canvas text from a record of fillText /
// strokeText calls. Text inside an element marked `data-fw-artwork` (exempt artwork, such as
// bench-scope's front panel) is skipped.
//
// Call installCanvasTextRecorder(page) before page.goto(); then `await displayTexts(page)`
// returns [{ text, px, where }] for what is on screen now.

export const installCanvasTextRecorder = (page) => page.addInitScript(() => {
  // Per canvas, the text drawn since it was last cleared or resized: what it shows now.
  const drawn = new WeakMap();
  window.__fwCanvasText = drawn;
  const reset = (canvas) => drawn.set(canvas, []);
  for (const prop of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, prop);
    Object.defineProperty(HTMLCanvasElement.prototype, prop, {
      ...d,
      set(v) { reset(this); d.set.call(this, v); },
    });
  }
  const P = CanvasRenderingContext2D.prototype;
  const clearRect = P.clearRect;
  P.clearRect = function (x, y, w, h) {
    // A clear of the whole canvas, in its current transform, starts a new picture.
    const t = this.getTransform();
    const s = Math.hypot(t.a, t.b) || 1;
    if (x * s + t.e <= 0 && y * s + t.f <= 0 && w * s >= this.canvas.width && h * s >= this.canvas.height) {
      reset(this.canvas);
    }
    return clearRect.call(this, x, y, w, h);
  };
  for (const name of ['fillText', 'strokeText']) {
    const draw = P[name];
    P[name] = function (text, ...rest) {
      const m = /(\d*\.?\d+)px/.exec(this.font);
      if (m && String(text).trim()) {
        const t = this.getTransform();
        // Font size in canvas pixels; scaled to CSS px when measured.
        const px = Number(m[1]) * Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
        if (!drawn.has(this.canvas)) reset(this.canvas);
        drawn.get(this.canvas).push({ text: String(text), px });
      }
      return draw.call(this, text, ...rest);
    };
  }
});

export const displayTexts = (page) => page.evaluate(() => {
  const out = [];
  const root = [...document.querySelectorAll('.fw-displays')].find((e) => e.checkVisibility());
  if (!root) throw new Error('no visible .fw-displays');
  const exempt = (el) => el.closest('[data-fw-artwork]');
  const visible = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '');

  // DOM text: every element with a non-blank text node of its own.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.data.trim();
    const el = n.parentElement;
    if (!text || !el || exempt(el) || !visible(el)) continue;
    if (el.closest('script, style, title, desc, defs, mask, clipPath')) continue;
    let px = parseFloat(getComputedStyle(el).fontSize);
    if (el instanceof SVGElement && el.getScreenCTM) {
      const m = el.getScreenCTM();
      if (m) px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    }
    out.push({ text: text.slice(0, 40), px: Math.round(px * 10) / 10, where: label(el) });
  }

  // Canvas text.
  for (const c of root.querySelectorAll('canvas')) {
    if (exempt(c) || !visible(c) || !c.width) continue;
    const scale = c.getBoundingClientRect().width / c.width;
    for (const t of window.__fwCanvasText?.get(c) ?? []) {
      out.push({ text: t.text.slice(0, 40), px: Math.round(t.px * scale * 10) / 10, where: `canvas${c.id ? `#${c.id}` : ''}` });
    }
  }
  return out;
});
