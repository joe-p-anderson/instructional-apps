// The Tool list (framework/v1/tool-list.js) names every Tool on the site, with the title of its
// Standalone page, so the Activity editor and the cross-Tool e2e checks share one list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { TOOLS } from '../../../framework/v1/tool-list.js';

const ROOT = new URL('../../../tools/', import.meta.url);

test('the Tool list names every Tool folder, by id, in id order', () => {
  const folders = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/${d.name}.js`, ROOT)))
    .map((d) => d.name)
    .sort();
  assert.deepEqual(TOOLS.map((t) => t.id), folders);
});

test("each Tool's title is its Standalone page's title", () => {
  for (const { id, title } of TOOLS) {
    const html = readFileSync(new URL(`${id}/index.html`, ROOT), 'utf8');
    assert.equal(title, html.match(/<title>([^<]*)<\/title>/)[1], id);
  }
});
