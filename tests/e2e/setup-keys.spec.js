import { test, expect } from '@playwright/test';

// The Tool contract's Setup keys (framework/v1/tool.js): every Mode of every Tool declares the
// State names its mount accepts as a Setup, and each one is a name in that Mode's State. Tools
// need a DOM to mount, so this mounts each Tool and Mode in the browser.

const TOOLS = ['bench-scope', 'electrostatics', 'fourier', 'least-squares', 'oscilloscope', 'phasors', 'spacetime', 'vernier'];

for (const id of TOOLS) {
  test(`${id}: every Mode declares Setup keys that are names in its State`, async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/blank.html');
    const modes = await page.evaluate(async (id) => {
      const { default: tool } = await import(`/tools/${id}/${id}.js`);
      const out = [];
      for (const mode of tool.modes) {
        const container = document.createElement('div');
        container.style.cssText = 'width: 1200px; height: 700px';
        document.body.append(container);
        const instance = tool.mount(container, mode.id);
        out.push({ id: mode.id, setupKeys: mode.setupKeys ?? null, state: Object.keys(instance.state.snapshot()) });
        instance.destroy?.();
        container.remove();
      }
      return out;
    }, id);
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) {
      expect(mode.setupKeys, `${id} / ${mode.id} declares its Setup keys`).not.toBeNull();
      expect(mode.setupKeys.length, `${id} / ${mode.id} has Setup keys`).toBeGreaterThan(0);
      const unknown = mode.setupKeys.filter((k) => !mode.state.includes(k));
      expect(unknown, `${id} / ${mode.id}: Setup keys not in its State`).toEqual([]);
    }
  });
}
