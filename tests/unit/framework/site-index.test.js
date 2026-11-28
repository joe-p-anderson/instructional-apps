// The site index (index.html) links every Activity page and, for instructors, the Activity
// editor, so the editor opens from the site like the Report Viewer (spec story 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { TOOLS } from '../../../framework/v1/tool-list.js';

const ROOT = new URL('../../../', import.meta.url);
const index = readFileSync(new URL('index.html', ROOT), 'utf8');
const links = new Set([...index.matchAll(/href="([^"]+)"/g)].map((m) => decodeURI(m[1])));

test('the site index links the Activity editor', () => {
  assert.ok(links.has('framework/v1/authoring/activity-editor.html'), [...links].join('\n'));
});

test('the site index links every Activity page', () => {
  for (const { id } of TOOLS) {
    let files;
    try { files = readdirSync(new URL(`tools/${id}/activities/`, ROOT)); } catch { continue; }
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const page = `tools/${id}/activities/${file.replace(/\.json$/, '.html')}`;
      assert.ok(links.has(page), `index.html doesn't link ${page}`);
    }
  }
});
