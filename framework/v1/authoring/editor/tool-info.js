// The editor's side of the Tool: loading a Tool module, learning its Tool info, and mounting it
// live. Needs a DOM (Tools draw), so the page uses it and the core never does.
//
// loadTool(toolId) -> Promise<{ tool, conditionTypes, info }>
//   Imports tools/<id>/<id>.js from this site (every Tool follows that naming; there is no Tool
//   registry). conditionTypes is the module's named export when it has one (spacetime), for the
//   Condition builder and preview. info is the Tool info core.js describes:
//     { modes: { [modeId]: { title, setupKeys, setupOptions, controls: [{ id, label }],
//       state: { [name]: { label, unit } } } } }
//   Mode ids, titles, Setup keys and Setup options come from tool.modes without mounting; the
//   Controls and State are learned by mounting each Mode once, with no Setup, in an off-screen
//   container (sized, since plots need a laid-out box), then destroying it. Cached per Tool id,
//   so each Tool is loaded and measured once per page. Rejects for an id that is not a plain
//   Tool name or whose module fails to load.
//
// mountLive(container, tool, modeId, setup) -> instance
//   The live Tool: tool.mount into container at that Mode and Setup, with every Control shown
//   and unlocked (the Full view). The caller destroys it (instance.destroy?.()) before the next.

const loaded = new Map();

export function loadTool(toolId) {
  if (typeof toolId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(toolId)) {
    return Promise.reject(new Error(`"${toolId}" is not a Tool id`));
  }
  if (!loaded.has(toolId)) {
    const url = new URL(`../../../../tools/${toolId}/${toolId}.js`, import.meta.url);
    const loading = import(url.href).then((module) => {
      const tool = module.default;
      return { tool, conditionTypes: module.conditionTypes, info: measure(tool) };
    });
    loading.catch(() => loaded.delete(toolId)); // a failed load may be retried
    loaded.set(toolId, loading);
  }
  return loaded.get(toolId);
}

function measure(tool) {
  const modes = {};
  for (const mode of tool.modes) {
    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position: fixed; left: -12000px; top: 0; width: 1200px; height: 700px; visibility: hidden';
    document.body.append(container);
    let instance;
    try {
      instance = tool.mount(container, mode.id);
      const describe = instance.state.describe();
      modes[mode.id] = {
        title: mode.title,
        setupKeys: [...(mode.setupKeys ?? [])],
        setupOptions: [...(mode.setupOptions ?? [])],
        controls: instance.controls.ids().map((id) => ({ id, label: instance.controls.get(id).label ?? id })),
        state: Object.fromEntries(Object.entries(describe).map(([name, d]) => [name, { label: d?.label ?? name, unit: d?.unit ?? '' }])),
      };
    } finally {
      instance?.destroy?.();
      container.remove();
    }
  }
  return { modes };
}

export function mountLive(container, tool, modeId, setup) {
  const instance = tool.mount(container, modeId, structuredClone(setup ?? {}));
  for (const id of instance.controls.ids()) {
    const c = instance.controls.get(id);
    c.show();
    c.unlock();
  }
  return instance;
}
