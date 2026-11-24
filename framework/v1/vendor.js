// Third-party libraries, loaded from pinned CDN versions (no build, no install).

export const PLOTLY_URL = 'https://cdn.plot.ly/plotly-2.26.0.min.js';

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

export const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js';

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
