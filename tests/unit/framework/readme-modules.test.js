// framework/v1/README.md is the framework's map: every module under framework/v1 is named in it,
// so a new module can't land undocumented. A folder's index.js is covered by its folder's row
// (`runner/`). The vendored libraries in vendor/ are loaded through vendor.js and aren't listed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAMEWORK = fileURLToPath(new URL('../../../framework/v1/', import.meta.url));
const readme = readFileSync(join(FRAMEWORK, 'README.md'), 'utf8');

function modules(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'vendor' ? [] : modules(path);
    return d.name.endsWith('.js') ? [relative(FRAMEWORK, path).split(sep).join('/')] : [];
  });
}

test('the framework README names every framework module', () => {
  const missing = modules(FRAMEWORK).filter((rel) => {
    const name = rel.split('/').at(-1);
    if (name === 'index.js') return !readme.includes(`\`${rel.slice(0, -'index.js'.length)}\``);
    return !readme.includes(name);
  });
  assert.deepEqual(missing, [], `add a row to framework/v1/README.md for: ${missing.join(', ')}`);
});
