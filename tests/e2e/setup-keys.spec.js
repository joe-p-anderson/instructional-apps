import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Tool contract's Setup keys and Setup options (framework/v1/tool.js): every Mode of every
// Tool declares the State names its mount accepts as a Setup, and each one is a name in that
// Mode's State; its Setup options (the non-State Setup values) are not. Every Setup value an
// existing Activity uses is one or the other. Tools need a DOM to mount, so this runs in the
// browser.

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
        out.push({
          id: mode.id,
          setupKeys: mode.setupKeys ?? null,
          setupOptions: mode.setupOptions ?? null,
          state: Object.keys(instance.state.snapshot()),
        });
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
      const optionsInState = (mode.setupOptions ?? []).filter((k) => mode.state.includes(k));
      expect(optionsInState, `${id} / ${mode.id}: Setup options that are State (make them Setup keys)`).toEqual([]);
    }
  });
}

// Every Activity in the repo (a JSON file in a Tool's activities folder).
const TOOLS_DIR = fileURLToPath(new URL('../../tools', import.meta.url));
const ACTIVITIES = readdirSync(TOOLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(TOOLS_DIR, d.name, 'activities')))
  .flatMap((d) => readdirSync(join(TOOLS_DIR, d.name, 'activities'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => `/tools/${d.name}/activities/${f}`));

test('the Activities are found', () => {
  expect(ACTIVITIES.length).toBeGreaterThanOrEqual(5);
});

for (const url of ACTIVITIES) {
  test(`${url}: every Setup value is a Setup key or a Setup option of its Mode`, async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/blank.html');
    const parts = await page.evaluate(async (url) => {
      const activity = await (await fetch(url)).json();
      const { default: tool } = await import(`/tools/${activity.tool}/${activity.tool}.js`);
      return activity.parts.map((part) => {
        const mode = tool.modes.find((m) => m.id === (part.mode ?? tool.modes[0].id));
        return {
          part: part.id,
          setup: Object.keys(part.setup ?? {}),
          known: [...(mode?.setupKeys ?? []), ...(mode?.setupOptions ?? [])],
        };
      });
    }, url);
    for (const { part, setup, known } of parts) {
      expect(setup.filter((k) => !known.includes(k)), `${url} / ${part}: Setup values the Mode doesn't declare`).toEqual([]);
    }
  });
}
