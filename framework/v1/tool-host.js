// Tool host (framework v1): mounts a Tool into a page frame with one tab per Mode.
//
// mountStandalone(tool, root, { setups, storage })
//   Standalone mode: no Activity. One tab per Mode, every Control shown and unlocked.
//   The header shows the Tool's title only; its ⋯ menu holds Copy share link and Print.
//   setups: optional { [modeId]: Setup } passed to each mount.
//   storage: Storage-like object for autosave (default localStorage; null disables it).
//   Each Mode's State autosaves on every change and restores on load (persistence.js); the
//   header shows the save status (saveStatus).
//   A `#s=` share link in the URL restores that Mode's State and opens its tab.
//   Returns { instances, modes, activeMode, select(modeId), shareLink() } where instances[i]
//   belongs to modes[i].
//
// The same frame/tab helpers are exported for the Activity runner UI, whose Part tabs
// look the same as Standalone Mode tabs.

import { defineTool, DEFAULT_MIN_DISPLAY_WIDTH, LAYOUTS } from './tool.js';
import { h, menuButton } from './ui-kit.js';
import { browserStorage, standaloneStore, shareHash, readShareHash } from './persistence.js';

/**
 * Single-row header + panel area, laid out by the Tool's panel layout (tool.js): .fw-app gets
 * the class fw-layout-<layout> and theme.css does the rest.
 * The header row holds, in order: the title, the course in dim text (optional), the tablist,
 * and the actions cluster, which ends with the ⋯ menu (ui-kit menuButton). The tablist wraps
 * onto more lines when its tabs don't fit; the title and actions never wrap.
 * Returns { app, header, tablist, panels, actions, addAction(el), menu, updateForm(), onFormChange(fn) }:
 *   addAction(el) puts el in the actions cluster, after earlier ones and before the ⋯ menu;
 *   menu.add({ id, label, onSelect }) adds a ⋯ menu item.
 *
 * tasks: true when the panels hold Task columns (the Activity runner). In the `side` layout the
 * frame then decides which form the Tasks take and marks it on .fw-app as data-side-form:
 * "column" (the 330 px Tasks column) or "drawer" (the Task drawer), the latter whenever the
 * Tasks column would leave the shown Display narrower than minDisplayWidth. It is recomputed
 * when the panel area resizes and on updateForm() (call it after showing another panel), and
 * onFormChange(fn) hears fn(form) on each switch. Nothing is remounted: theme.css restyles.
 *
 * The frame fills the window. maxDisplayWidth (optional, CSS px) caps the Display's width in
 * every layout, as --fw-display-max on .fw-app; past it theme.css centres the Display in its region.
 */
export function createFrame(root, { title, course, layout = LAYOUTS[0], minDisplayWidth = DEFAULT_MIN_DISPLAY_WIDTH, maxDisplayWidth, tasks = false }) {
  document.documentElement.classList.add('fw-root');
  const tablist = h('div', { class: 'fw-tabs', role: 'tablist' });
  const panels = h('div', { class: 'fw-tabpanel-area', style: 'flex:1;min-height:0;display:flex;flex-direction:column' });
  const menu = menuButton();
  const actions = h('div', { class: 'fw-header-actions' }, menu.el);
  const header = h('header', { class: 'fw-header' },
    h('div', { class: 'fw-header-titles' },
      h('h1', { class: 'fw-title' }, title),
      course ? h('span', { class: 'fw-course' }, course) : null),
    tablist,
    actions);
  const app = h('div', { class: `fw-app fw-layout-${layout}` }, header, panels);
  if (maxDisplayWidth !== undefined) app.style.setProperty('--fw-display-max', `${maxDisplayWidth}px`);
  root.replaceChildren(app);

  const listeners = new Set();
  const addAction = (el) => { actions.insertBefore(el, menu.el); return el; };
  const frame = { app, header, tablist, panels, actions, addAction, menu, updateForm() {}, onFormChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)) };
  if (layout !== 'side' || !tasks) return frame;

  app.dataset.sideForm = 'column';
  frame.updateForm = () => {
    const shown = panels.querySelector(':scope > .fw-tabpanel:not([hidden]) .fw-displays');
    const width = shown?.getBoundingClientRect().width ?? 0;
    if (!width) return; // nothing laid out yet (name gate, hidden panels)
    // The Display's width with the Tasks column shown: in drawer form the Tool spans the
    // column's width as well, and the Display is the Tool's flexible part.
    const column = parseFloat(getComputedStyle(app).getPropertyValue('--fw-tasks-column')) || 0;
    const withColumn = app.dataset.sideForm === 'drawer' ? width - column : width;
    const form = withColumn < minDisplayWidth ? 'drawer' : 'column';
    if (form === app.dataset.sideForm) return;
    app.dataset.sideForm = form;
    for (const fn of [...listeners]) fn(form);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => frame.updateForm()).observe(panels);
  return frame;
}

/**
 * The save status in the header's actions cluster, shared by Standalone mode and the Activity
 * runner. saveStatus(frame, { warning }) returns report(ok): pass it each store.save() result
 * (persistence.js). The status is a note named "Save status".
 *   ok: "Saved hh:mm" in muted text. Not a live region, so autosaves aren't announced.
 *   not ok: `warning` (default "Not saved: download your Report", the Activity's; Standalone
 *   passes "Not saved: copy the share link to keep your Setup") in the miss colour
 *   (data-state="failed"). The first failure is announced through an assertive live region;
 *   later ones are not.
 */
export function saveStatus(frame, { warning = 'Not saved: download your Report' } = {}) {
  const el = frame.addAction(h('span', { class: 'fw-save-status', role: 'note', 'aria-label': 'Save status' }));
  const alert = frame.addAction(h('span', { class: 'fw-sr-only', 'aria-live': 'assertive' }));
  return (ok) => {
    if (ok) {
      const now = new Date();
      el.textContent = `Saved ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      delete el.dataset.state;
      return;
    }
    el.textContent = warning;
    el.dataset.state = 'failed';
    if (!alert.textContent) alert.textContent = warning;
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** The ⋯ menu's Print item, shared by Standalone mode and the Activity runner. */
export function printItem() {
  return { id: 'print', label: 'Print', onSelect: () => window.print() };
}

/**
 * Build tabs. tabs: [{ id, title }]. onSelect(id, index) fires after the panel is shown.
 * Returns { panels: { [id]: HTMLElement }, buttons: { [id]: HTMLButtonElement }, select(id), fit() }.
 *
 * collapse: true (the Activity's Part tabs) collapses the tabs when their full titles don't fit
 * on one line of the header row: the tablist gets data-collapsed and every inactive tab shows
 * only its number (1, 2, …) while the active tab keeps its full title. The full title stays in
 * the tab, visually hidden, so the accessible name doesn't change; it is also the tab's title
 * tooltip while collapsed. The fit is measured with the full titles and re-checked on select,
 * when the header's width changes, and when anything inside the tablist changes (progress
 * badges, typeset math); call fit() after other changes. Tabs that fit look as before.
 */
export function createTabs(frame, tabs, onSelect = () => {}, { collapse = false } = {}) {
  const buttons = {};
  const panels = {};
  const { tablist } = frame;
  tabs.forEach((t, i) => {
    const tabId = `fw-tab-${t.id}`;
    const panelId = `fw-panel-${t.id}`;
    buttons[t.id] = h('button', { type: 'button', class: 'fw-tab', role: 'tab', id: tabId,
      'aria-controls': panelId, 'aria-selected': 'false', onclick: () => select(t.id) },
      h('span', { class: 'fw-tab-title' }, t.title),
      collapse ? h('span', { class: 'fw-tab-number', 'aria-hidden': 'true' }, String(i + 1)) : null);
    panels[t.id] = h('section', { class: 'fw-tabpanel', role: 'tabpanel', id: panelId,
      'aria-labelledby': tabId, hidden: true });
    tablist.append(buttons[t.id]);
    frame.panels.append(panels[t.id]);
  });
  function select(id) {
    if (!panels[id]) return;
    for (const t of tabs) {
      const on = t.id === id;
      buttons[t.id].setAttribute('aria-selected', String(on));
      panels[t.id].hidden = !on;
    }
    fit();
    onSelect(id, tabs.findIndex((t) => t.id === id));
  }

  // Collapse when the full titles would wrap onto a second line or overflow the tablist.
  function fit() {
    if (!collapse || tabs.length < 2 || !tablist.offsetParent) return; // hidden: re-fit when shown
    setCollapsed(false);
    const bottoms = Object.values(buttons).map((b) => Math.round(b.getBoundingClientRect().bottom));
    const fits = Math.max(...bottoms) - Math.min(...bottoms) <= 1 && tablist.scrollWidth <= tablist.clientWidth + 1;
    setCollapsed(!fits);
  }
  function setCollapsed(on) {
    if (on) tablist.dataset.collapsed = 'true';
    else delete tablist.dataset.collapsed;
    for (const t of tabs) {
      if (on) buttons[t.id].title = buttons[t.id].querySelector('.fw-tab-title').textContent;
      else buttons[t.id].removeAttribute('title');
    }
  }
  if (collapse) {
    // Only the header's width matters (collapsing changes the tablist's own size, so it isn't watched).
    let width = 0;
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(([entry]) => {
        if (entry.contentRect.width === width) return;
        width = entry.contentRect.width;
        fit();
      }).observe(frame.header);
    }
    new MutationObserver(fit).observe(tablist, { childList: true, characterData: true, subtree: true });
    document.fonts?.ready.then(fit);
  }
  return { panels, buttons, select, fit };
}

export function mountStandalone(definition, root, { setups = {}, storage } = {}) {
  const tool = defineTool(definition);
  if (!document.title) document.title = tool.title;
  const frame = createFrame(root, { title: tool.title, layout: tool.layout, maxDisplayWidth: tool.maxDisplayWidth });
  // storage: null turns autosave (and its status) off; left out, it is localStorage, and a
  // browser without one gets the "Not saved" warning.
  const report = storage === null ? () => {}
    : saveStatus(frame, { warning: 'Not saved: copy the share link to keep your Setup' });
  if (storage === undefined) storage = browserStorage();
  const host = { tool, modes: tool.modes, instances: [], activeMode: null, select: null, shareLink };

  // A share link wins over autosave, once: the hash is then cleared so a reload shows
  // the student's own autosaved work rather than the link again.
  const shared = readShareHash(location.hash);
  if (shared) history.replaceState(null, '', location.pathname + location.search);

  const tabs = createTabs(frame, tool.modes, (id, i) => {
    host.activeMode = id;
    host.instances[i]?.resize?.();
  });

  for (const mode of tool.modes) {
    const instance = tool.mount(tabs.panels[mode.id], mode.id, setups[mode.id]);
    for (const id of instance.controls.ids()) { const c = instance.controls.get(id); c.show(); c.unlock(); }
    const store = standaloneStore(tool.id, mode.id, storage);
    const fromLink = shared?.mode === mode.id;
    const saved = fromLink ? shared.state : store.load();
    if (saved) { try { instance.restore(saved); } catch { /* unusable save: keep the Setup */ } }
    if (fromLink) store.save(instance.serialize());
    instance.state.onChange(() => report(store.save(instance.serialize())));
    host.instances.push(instance);
  }
  frame.menu.add(shareItem(frame, shareLink));
  frame.menu.add(printItem());
  host.select = tabs.select;
  tabs.select(tool.modes.some((m) => m.id === shared?.mode) ? shared.mode : tool.modes[0].id);
  return host;

  /** URL reproducing the active Mode's State. */
  function shareLink() {
    const i = tool.modes.findIndex((m) => m.id === host.activeMode);
    return location.origin + location.pathname + location.search
      + shareHash({ mode: host.activeMode, state: host.instances[i].serialize() });
  }
}

/**
 * The ⋯ menu's "Copy share link" item: copies the link and says "Link copied" in the header for a
 * few seconds. Where the clipboard is refused (no permission, not a secure context) the link is
 * offered in a prompt to copy by hand.
 */
function shareItem(frame, shareLink) {
  const status = frame.addAction(h('span', { class: 'fw-share-status', role: 'status' }));
  let timer;
  return { id: 'share', label: 'Copy share link', onSelect: async () => {
    const link = shareLink();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Copy this share link:', link);
      return;
    }
    status.textContent = 'Link copied';
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ''; }, 4000);
  } };
}
