// One-off migration (ADR 0004): turn a hand-written Activity module into an Activity file.
//
//   node scripts/migrate-activity.js tools/<tool>/activities/<name>.js [more modules...]
//
// For each module it imports the default export and writes, beside it:
//   <name>.json  the Activity in its saved form (serializeActivity, framework/v1/activity-file.js):
//                constants and spreads come out expanded, enc1: strings are copied as they are;
//   <name>.html  the Activity page, made from the one template (activityPage), so the URL,
//                and with it the Run's storage key, is unchanged.
// The module's leading // comment becomes the Activity's notes (wrapped lines joined, blank
// comment lines kept as paragraph breaks) unless the Activity already has notes. Check the notes
// by hand afterwards: drop anything stale (such as "pure data, Node tests import it") and move
// Part- or Task-specific remarks into that Part's or Task's notes. The script fails on anything
// JSON cannot hold, such as a function Condition. It leaves the old module in place: delete it
// once the page, the unit test and the e2e checks have moved over.
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serializeActivity, activityPage } from '../framework/v1/activity-file.js';

export function headerComment(source) {
  const lines = [];
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*\/\/ ?(.*)$/);
    if (!m) break;
    lines.push(m[1].trimEnd());
  }
  const paragraphs = [];
  let current = [];
  for (const line of [...lines, '']) {
    if (line) current.push(line);
    else if (current.length) { paragraphs.push(current.join(' ')); current = []; }
  }
  return paragraphs.join('\n\n');
}

export async function migrateActivity(modulePath) {
  const path = resolve(modulePath);
  const source = await readFile(path, 'utf8');
  const { default: activity } = await import(pathToFileURL(path).href);
  if (!activity || typeof activity !== 'object') throw new Error(`${modulePath}: no Activity as its default export`);

  const notes = headerComment(source);
  // serializeActivity puts notes in its place in the key order.
  const withNotes = activity.notes === undefined && notes ? { ...activity, notes } : activity;

  const name = basename(path).replace(/\.m?js$/, '');
  const jsonPath = join(dirname(path), `${name}.json`);
  const pagePath = join(dirname(path), `${name}.html`);
  await writeFile(jsonPath, serializeActivity(withNotes));
  await writeFile(pagePath, activityPage({ title: activity.title, tool: activity.tool, file: `${name}.json` }));
  return { jsonPath, pagePath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('Usage: node scripts/migrate-activity.js tools/<tool>/activities/<name>.js [...]');
    process.exit(1);
  }
  for (const p of paths) {
    const { jsonPath, pagePath } = await migrateActivity(p);
    console.log(`${p}\n  -> ${jsonPath}\n  -> ${pagePath}`);
  }
}
