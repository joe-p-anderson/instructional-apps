// Third-party libraries, vendored at pinned versions in ./vendor/ (no build, no install,
// no network needed). Licences: Plotly (MIT), MathJax (Apache-2.0).

export const PLOTLY_URL = new URL('./vendor/plotly-2.26.0.min.js', import.meta.url).href;

const pending = new Map();

/** Load a classic script once per page; resolves when it has run. */
export function loadScript(src) {
  if (!pending.has(src)) {
    pending.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => { pending.delete(src); reject(new Error(`Failed to load ${src}`)); };
      document.head.append(el);
    }));
  }
  return pending.get(src);
}

/** Resolves to the Plotly global, loading it if the page hasn't already. */
export async function loadPlotly() {
  if (!globalThis.Plotly) await loadScript(PLOTLY_URL);
  return globalThis.Plotly;
}

// tex-svg is self-contained (no separate font files), unlike tex-chtml.
export const MATHJAX_URL = new URL('./vendor/mathjax-3.2.2-tex-svg.js', import.meta.url).href;

/** Resolves to the MathJax global (inline math \( \), display math \[ \]), loading it once. */
export async function loadMathJax() {
  if (!globalThis.MathJax?.typesetPromise) {
    globalThis.MathJax ??= {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea'] },
      startup: { typeset: false },
    };
    await loadScript(MATHJAX_URL);
    await globalThis.MathJax.startup.promise;
  }
  return globalThis.MathJax;
}

let typesetting = Promise.resolve();

/** Typeset math inside the given elements. Calls are queued, as MathJax requires. */
export function typeset(elements) {
  typesetting = typesetting
    .then(loadMathJax)
    .then((MathJax) => MathJax.typesetPromise(elements))
    .catch((err) => console.warn('MathJax typesetting failed:', err));
  return typesetting;
}
