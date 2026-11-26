// Tool host (framework v1): mounts a Tool into a page frame with one tab per Mode.
//
// mountStandalone(tool, root, { setups, storage })
//   Standalone mode: no Activity. One tab per Mode, every Control shown and unlocked.
//   The header shows the Tool's title only; its ⋯ menu holds Copy share link and Print.
//   setups: optional { [modeId]: Setup } passed to each mount.
//   storage: Storage-like object for autosave (default localStorage; null disables it).
//   Each Mode's State autosaves on every change and restores on load (persistence.js).
//   A `#s=` share link in the URL restores that Mode's State and opens its tab.
//   Returns { instances, modes, activeMode, select(modeId), shareLink() } where instances[i]
//   belongs to modes[i].
//
// The same frame/tab helpers are exported for the Activity runner UI, whose Part tabs
// look the same as Standalone Mode tabs.

import { defineTool, LAYOUTS } from './tool.js';
import { h, menuButton } from './ui-kit.js';
import { browserStorage, standaloneStore, shareHash, readShareHash } from './persistence.js';

/**
 * Single-row header + panel area, laid out by the Tool's panel layout (tool.js): .fw-app gets
 * the class fw-layout-<layout> and theme.css does the rest.
 * The header row holds, in order: the title, the course in dim text (optional), the tablist,
 * and the actions cluster, which ends with the ⋯ menu (ui-kit menuButton). The tablist wraps
 * onto more lines when its tabs don't fit; the title and actions never wrap.
 * Returns { app, header, tablist, panels, actions, addAction(el), menu }:
 *   addAction(el) puts el in the actions cluster, after earlier ones and before the ⋯ menu;
 *   menu.add({ id, label, onSelect }) adds a ⋯ menu item.
 */
export function createFrame(root, { title, course, layout = LAYOUTS[0] }) {
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
  root.replaceChildren(app);
  const addAction = (el) => { actions.insertBefore(el, menu.el); return el; };
  return { app, header, tablist, panels, actions, addAction, menu };
}

/** The ⋯ menu's Print item, shared by Standalone mode and the Activity runner. */
export function printItem() {
  return { id: 'print', label: 'Print', onSelect: () => window.print() };
}

/**
 * Build tabs. tabs: [{ id, title }]. onSelect(id, index) fires after the panel is shown.
 * Returns { panels: { [id]: HTMLElement }, buttons: { [id]: HTMLButtonElement }, select(id) }.
 */
export function createTabs(frame, tabs, onSelect = () => {}) {
  const buttons = {};
  const panels = {};
  for (const t of tabs) {
    const tabId = `fw-tab-${t.id}`;
    const panelId = `fw-panel-${t.id}`;
    buttons[t.id] = h('button', { type: 'button', class: 'fw-tab', role: 'tab', id: tabId,
      'aria-controls': panelId, 'aria-selected': 'false', onclick: () => select(t.id) },
      h('span', { class: 'fw-tab-title' }, t.title));
    panels[t.id] = h('section', { class: 'fw-tabpanel', role: 'tabpanel', id: panelId,
      'aria-labelledby': tabId, hidden: true });
    frame.tablist.append(buttons[t.id]);
    frame.panels.append(panels[t.id]);
  }
  function select(id) {
    if (!panels[id]) return;
    for (const t of tabs) {
      const on = t.id === id;
      buttons[t.id].setAttribute('aria-selected', String(on));
      panels[t.id].hidden = !on;
    }
    onSelect(id, tabs.findIndex((t) => t.id === id));
  }
  return { panels, buttons, select };
}

export function mountStandalone(definition, root, { setups = {}, storage = browserStorage() } = {}) {
  const tool = defineTool(definition);
  if (!document.title) document.title = tool.title;
  const frame = createFrame(root, { title: tool.title, layout: tool.layout });
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
    instance.state.onChange(() => store.save(instance.serialize()));
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
