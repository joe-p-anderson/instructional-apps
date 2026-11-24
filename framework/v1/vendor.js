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
