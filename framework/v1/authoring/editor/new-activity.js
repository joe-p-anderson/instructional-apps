// A new Activity, made from the Open screen (spec stories 8-10). No DOM: the page (page.js)
// draws the form, and this module checks it and writes the files through the folder interface.
//
// slugFromTitle(title) -> id         the id offered while the title is typed ('' if none)
// newActivityProblems(folder, fields) -> { [field]: message }   {} when it can be created
//   fields: { tool, id, title, course }. The Tool is one of the Tool list
//   (framework/v1/tool-list.js); the id is a slug not yet used in that Tool's activities folder,
//   neither as a file name nor as an Activity's id; title and course are not blank.
// createActivity(folder, fields) -> path    writes tools/<tool>/activities/<id>.json (version 1,
//   no Parts yet) and <id>.html beside it, from the one Activity page template, then returns
//   the JSON's path. Throws, writing nothing, if there is a problem. A download folder
//   downloads both files.

import { serializeActivity, activityPage } from '../../activity-file.js';
import { TOOLS } from '../../tool-list.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugFromTitle(title) {
  return String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const folderOf = (tool) => `tools/${tool}/activities`;

// The ids used in a Tool's activities folder: each file's name and each Activity's own id.
async function usedIds(folder, tool) {
  let entries;
  try {
    entries = await folder.list(folderOf(tool));
  } catch (err) {
    if (err.name === 'NotFoundError' || err.name === 'TypeMismatchError') return new Set();
    throw err;
  }
  const used = new Set();
  for (const e of entries) {
    if (e.kind !== 'file') continue;
    used.add(e.name.replace(/\.[^.]*$/, ''));
    if (!e.name.endsWith('.json')) continue;
    try {
      const { id } = JSON.parse((await folder.readFile(`${folderOf(tool)}/${e.name}`)).text);
      if (typeof id === 'string') used.add(id);
    } catch { /* not valid JSON: its file name is still taken */ }
  }
  return used;
}

export async function newActivityProblems(folder, { tool, id, title, course }) {
  const problems = {};
  const known = TOOLS.some((t) => t.id === tool);
  if (!known) problems.tool = 'Choose a Tool';
  if (!id) problems.id = 'Give it an id';
  else if (!SLUG.test(id)) problems.id = 'An id is lower-case letters, digits and single hyphens, such as lab-11';
  else if (known && (await usedIds(folder, tool)).has(id)) problems.id = `That id is already used in ${folderOf(tool)}`;
  if (!String(title ?? '').trim()) problems.title = 'Give it a title';
  if (!String(course ?? '').trim()) problems.course = 'Give it a course';
  return problems;
}

export async function createActivity(folder, fields) {
  const problems = await newActivityProblems(folder, fields);
  const first = Object.values(problems)[0];
  if (first) throw new Error(first);
  const { tool, id } = fields;
  const title = fields.title.trim();
  const path = `${folderOf(tool)}/${id}.json`;
  await folder.writeFile(path, serializeActivity({ id, version: 1, title, course: fields.course.trim(), tool, parts: [] }));
  await folder.writeFile(`${folderOf(tool)}/${id}.html`, activityPage({ title, tool, file: `${id}.json` }));
  return path;
}
