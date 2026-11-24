// Tool host (framework v1): mounts a Tool into a page frame with one tab per Mode.
//
// mountStandalone(tool, root, { setups, subtitle })
//   Standalone mode: no Activity. One tab per Mode, every Control shown and unlocked.
//   setups: optional { [modeId]: Setup } passed to each mount.
//   Returns { instances, modes, activeMode, select(modeId) } where instances[i] belongs to modes[i].
//
// The same frame/tab helpers are exported for the Activity runner UI, whose Part tabs
// look the same as Standalone Mode tabs.

import { defineTool } from './tool.js';
import { h } from './ui-kit.js';

/** Header + tab strip + panel area. Returns elements to fill. */
export function createFrame(root, { title, subtitle }) {
  document.documentElement.classList.add('fw-root');
  const tablist = h('div', { class: 'fw-tabs', role: 'tablist' });
  const panels = h('div', { class: 'fw-tabpanel-area', style: 'flex:1;min-height:0;display:flex;flex-direction:column' });
  const header = h('header', { class: 'fw-header' },
    h('div', { class: 'fw-header-titles' },
      h('h1', { class: 'fw-title' }, title),
      subtitle ? h('div', { class: 'fw-subtitle' }, subtitle) : null));
  const app = h('div', { class: 'fw-app' }, header, tablist, panels);
  root.replaceChildren(app);
  return { app, header, tablist, panels };
}

/**
 * Build tabs. tabs: [{ id, title }]. onSelect(id, index) fires after the panel is shown.
 * Returns { panels: { [id]: HTMLElement }, select(id) }.
 */
export function createTabs(frame, tabs, onSelect = () => {}) {
  const buttons = {};
  const panels = {};
  for (const t of tabs) {
    const tabId = `fw-tab-${t.id}`;
    const panelId = `fw-panel-${t.id}`;
    buttons[t.id] = h('button', { type: 'button', class: 'fw-tab', role: 'tab', id: tabId,
      'aria-controls': panelId, 'aria-selected': 'false', onclick: () => select(t.id) }, t.title);
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
  return { panels, select };
}

export function mountStandalone(tool, root, { setups = {}, subtitle = 'Standalone' } = {}) {
  defineTool(tool);
  if (!document.title) document.title = tool.title;
  const frame = createFrame(root, { title: tool.title, subtitle });
  const host = { tool, modes: tool.modes, instances: [], activeMode: null, select: null };

  const tabs = createTabs(frame, tool.modes, (id, i) => {
    host.activeMode = id;
    host.instances[i]?.resize?.();
  });

  for (const mode of tool.modes) {
    const instance = tool.mount(tabs.panels[mode.id], mode.id, setups[mode.id]);
    for (const id of instance.controls.ids()) { const c = instance.controls.get(id); c.show(); c.unlock(); }
    host.instances.push(instance);
  }
  host.select = tabs.select;
  tabs.select(tool.modes[0].id);
  return host;
}
