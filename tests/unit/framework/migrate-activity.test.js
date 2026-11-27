import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateActivity } from '../../../scripts/migrate-activity.js';
import { activityPage } from '../../../framework/v1/activity-file.js';

const MODULE = `// Activity "Demo": a header comment
// wrapped over two lines.
//
// A second paragraph.

const ALL = ['a', 'b'];
const SETUP = { x: 1 };

export default {
  id: 'demo',
  version: 1,
  title: 'Demo',
  course: 'PHY 0000',
  tool: 'stub',
  parts: [{
    id: 'p1', title: 'Part 1', mode: 'main', setup: { ...SETUP, y: 2 },
    tasks: [{ id: 't1', title: 'T1', prompt: 'Set \\\\(x\\\\)', show: ALL, condition: 'enc1:AbC', points: 1 }],
  }],
};
`;

async function withModule(source, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'migrate-'));
  try {
    const path = join(dir, 'demo.js');
    await writeFile(join(dir, 'package.json'), '{ "type": "module" }');
    await writeFile(path, source);
    return await fn(dir, path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('an Activity module is written as JSON beside it, with constants and spreads expanded and keys copied as they are', async () => {
  await withModule(MODULE, async (dir, path) => {
    await migrateActivity(path);
    const json = await readFile(join(dir, 'demo.json'), 'utf8');
    assert.equal(json, `{
  "id": "demo",
  "version": 1,
  "title": "Demo",
  "course": "PHY 0000",
  "tool": "stub",
  "notes": "Activity \\"Demo\\": a header comment wrapped over two lines.\\n\\nA second paragraph.",
  "parts": [
    {
      "id": "p1",
      "title": "Part 1",
      "mode": "main",
      "setup": {
        "x": 1,
        "y": 2
      },
      "tasks": [
        {
          "id": "t1",
          "title": "T1",
          "prompt": "Set \\\\(x\\\\)",
          "show": [
            "a",
            "b"
          ],
          "condition": "enc1:AbC",
          "points": 1
        }
      ]
    }
  ]
}
`);
  });
});

test('the page beside it is made from the Activity page template', async () => {
  await withModule(MODULE, async (dir, path) => {
    await migrateActivity(path);
    const page = await readFile(join(dir, 'demo.html'), 'utf8');
    assert.equal(page, activityPage({ title: 'Demo', tool: 'stub', file: 'demo.json' }));
  });
});

test('notes already on the Activity are kept, not replaced by the header comment', async () => {
  const source = MODULE.replace("tool: 'stub',", "tool: 'stub',\n  notes: 'Hand-written.',");
  await withModule(source, async (dir, path) => {
    await migrateActivity(path);
    assert.equal(JSON.parse(await readFile(join(dir, 'demo.json'), 'utf8')).notes, 'Hand-written.');
  });
});
