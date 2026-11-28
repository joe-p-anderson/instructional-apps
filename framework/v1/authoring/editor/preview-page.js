// The preview page (../preview.html): mounts the plan the editor handed over (preview.js) in
// the real runner.
//
// The editor keeps each launched plan in window.activityEditorPreviews[run] and opens
// preview.html?run=<run> in its pane (an iframe: the plan is read from window.parent) or a new
// tab (window.opener). The page imports the Tool module itself, with its registered Condition
// types, and mounts the Activity with:
//   - storage: an in-memory Storage, pre-seeded with a name so there is no name gate. Autosave,
//     Start over and sign-out act on it alone, so nothing reaches localStorage;
//   - the preview Activity id (<id>~preview) from the plan;
//   - [PREVIEW_START]: the chosen Task, the Tasks before it counting as passed.
// A reload (Start over) reads the same plan again. window.activityHost is the mounted host.

import { mountActivity } from '../../activity-ui.js';
import { PREVIEW_START } from '../../runner/preview.js';

export const PREVIEW_NAME = 'Instructor preview';

const app = document.getElementById('app');
const fail = (text) => {
  const p = document.createElement('p');
  p.className = 'pv-message';
  p.setAttribute('role', 'alert');
  p.textContent = text;
  app.replaceChildren(p);
};

// A Storage-like object that keeps everything in this page's memory.
function memoryStorage(seed = {}) {
  const items = new Map(Object.entries(seed));
  return {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => { items.set(k, String(v)); },
    removeItem: (k) => { items.delete(k); },
  };
}

function handedPlan() {
  const run = new URLSearchParams(location.search).get('run');
  const sources = [window.opener, window.parent !== window ? window.parent : null];
  for (const source of sources) {
    try {
      const plan = source?.activityEditorPreviews?.[run];
      if (plan) return structuredClone(plan);
    } catch { /* closed, or not the editor */ }
  }
  return null;
}

const plan = handedPlan();
if (!plan) {
  fail('Nothing to preview: open the preview from the Activity editor.');
} else {
  const id = plan.activity.tool;
  try {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`"${id}" is not a Tool id`);
    const module = await import(new URL(`../../../../tools/${id}/${id}.js`, import.meta.url).href);
    document.title = `Preview: ${plan.activity.title.replace(/<[^>]*>/g, '')}`;
    window.activityHost = mountActivity(module.default, plan.activity, app, {
      conditionTypes: module.conditionTypes,
      storage: memoryStorage({ 'fw1:name': JSON.stringify(PREVIEW_NAME) }),
      [PREVIEW_START]: plan.start,
    });
  } catch (err) {
    fail(`The preview couldn't start: ${err.message}`);
    throw err;
  }
}
