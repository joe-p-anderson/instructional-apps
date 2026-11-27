// Every Activity stored as JSON (tools/*/activities/*.json) is in the saved form and has a page
// made from the template beside it, and no Activity module is left beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { serializeActivity, activityPage } from '../../../framework/v1/activity-file.js';
import { validateActivity } from '../../../framework/v1/runner/index.js';

const TOOLS = new URL('../../../tools/', import.meta.url);
const files = readdirSync(TOOLS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/activities/`, TOOLS)))
  .flatMap((d) => readdirSync(new URL(`${d.name}/activities/`, TOOLS))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ tool: d.name, name: f.replace(/\.json$/, ''), url: new URL(`${d.name}/activities/${f}`, TOOLS) })));

test('the oscilloscope Activity is stored as JSON', () => {
  assert.ok(files.some((f) => f.tool === 'oscilloscope' && f.name === 'phase-period-amplitude'));
});

for (const file of files) {
  const where = `tools/${file.tool}/activities/${file.name}`;
  const text = readFileSync(file.url, 'utf8').replace(/\r\n/g, '\n');
  const activity = JSON.parse(text);

  test(`${where}.json is a valid Activity for its Tool, in the saved form`, () => {
    assert.doesNotThrow(() => validateActivity(activity));
    assert.equal(activity.tool, file.tool);
    assert.equal(serializeActivity(activity), text);
  });

  test(`${where}.html is the Activity page template, and the old module is gone`, () => {
    const page = readFileSync(new URL(`${file.name}.html`, file.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(page, activityPage({ title: activity.title, tool: activity.tool, file: `${file.name}.json` }));
    assert.equal(existsSync(new URL(`${file.name}.js`, file.url)), false);
  });
}
