// Every Activity stored as JSON (tools/*/activities/*.json) is in the saved form and has a page
// made from the template beside it, and no Activity module is left beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { serializeActivity, activityPage } from '../../../framework/v1/activity-file.js';
import { validateActivity } from '../../../framework/v1/runner/index.js';
import { decodeActivity } from '../../../framework/v1/runner/keys.js';

const TOOLS = new URL('../../../tools/', import.meta.url);
const files = readdirSync(TOOLS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/activities/`, TOOLS)))
  .flatMap((d) => readdirSync(new URL(`${d.name}/activities/`, TOOLS))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ tool: d.name, name: f.replace(/\.json$/, ''), url: new URL(`${d.name}/activities/${f}`, TOOLS) })));

test('every Activity on the site is stored as JSON', () => {
  const names = files.map((f) => `${f.tool}/${f.name}`);
  for (const name of ['oscilloscope/phase-period-amplitude', 'electrostatics/conductor-properties',
    'fourier/fourier-series', 'phasors/phasors-impedance', 'spacetime/lab10']) {
    assert.ok(names.includes(name), name);
  }
});

test('no hand-written Activity module is left in any activities folder', () => {
  const modules = readdirSync(TOOLS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/activities/`, TOOLS)))
    .flatMap((d) => readdirSync(new URL(`${d.name}/activities/`, TOOLS))
      .filter((f) => /\.m?js$/.test(f))
      .map((f) => `${d.name}/${f}`));
  assert.deepEqual(modules, []);
});

for (const file of files) {
  const where = `tools/${file.tool}/activities/${file.name}`;
  const text = readFileSync(file.url, 'utf8').replace(/\r\n/g, '\n');
  const activity = JSON.parse(text);

  test(`${where}.json is a valid Activity for its Tool, in the saved form`, () => {
    // As the runner does: encoded keys are decoded before the Activity is validated.
    assert.doesNotThrow(() => validateActivity(decodeActivity(activity)));
    assert.equal(activity.tool, file.tool);
    assert.equal(serializeActivity(activity), text);
  });

  test(`${where}.html is the Activity page template, and the old module is gone`, () => {
    const page = readFileSync(new URL(`${file.name}.html`, file.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(page, activityPage({ title: activity.title, tool: activity.tool, file: `${file.name}.json` }));
    assert.equal(existsSync(new URL(`${file.name}.js`, file.url)), false);
  });
}
