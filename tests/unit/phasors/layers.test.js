import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from '../runner/stub-tool.js';
import { LAYERS } from '../../../tools/phasors/layers.js';

// The revealable layers are Controls, so a Task's `hide` list hides one until the next Task's
// `show` brings it back. The stub stands in for the Tool (Mode modules need a DOM).

// (tests/e2e/phasors-circuit.spec.js checks that each Mode registers every one of its LAYERS ids.)

for (const [mode, layers] of Object.entries(LAYERS)) {
  test(`${mode} Mode: each compute Task hides its layer and the next Task shows it`, () => {
    // Task k hides layer k (answered by "k"); Task k + 1 shows it again.
    const tasks = layers.map((layer, k) => ({
      id: `t${k}`, title: `Compute ${layer}`, prompt: `Compute ${layer}.`,
      ...(k > 0 ? { show: [layers[k - 1]] } : {}),
      hide: [layer],
      questions: [{ id: 'q', kind: 'numeric', prompt: 'Value', answer: k, tol: 0.1, points: 1 }],
      points: 0,
    }));
    tasks.push({ id: 'done', title: 'Look', prompt: 'Look.', show: [layers[layers.length - 1]], points: 0,
      questions: [{ id: 'q', kind: 'text', prompt: 'Why?', points: 1 }] });
    const activity = { id: 'layers', version: 1, title: 'Layers', tool: 'phasors',
      parts: [{ id: 'p', title: 'Part 1', mode, setup: {}, tasks }] };
    const tool = stubTool({ state: { mode: { value: mode } }, controls: layers });
    const runner = createRunner(activity, { tools: { p: tool } });
    runner.start('Ada');
    const visible = (id) => tool.controls.get(id).isVisible;

    for (let k = 0; k < layers.length; k += 1) {
      assert.equal(visible(layers[k]), false, `${layers[k]} hidden while Task ${k} asks for it`);
      if (k > 0) assert.equal(visible(layers[k - 1]), true, `${layers[k - 1]} shown after its Task`);
      assert.equal(runner.submit('p', `t${k}`, { q: String(k) }).passed, true);
    }
    for (const id of layers) assert.equal(visible(id), true, `${id} shown at the end`);
  });
}
