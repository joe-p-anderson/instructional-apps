// The Activity editor page (../activity-editor.html): the DOM over the editor core (core.js)
// and the folder interface (folder.js).
//
// Screens: the folder grant (#grant), the Open screen (#open), and the editor (#main: outline,
// form and problems, live Tool). One Activity is open at a time (its editor, from openActivity), for the
// file at `current`. Every change goes through commit(edit), and the page redraws from
// editor.doc; nothing on the page holds Activity data of its own.
//
// Tests replace the folder: before the page loads, set
//   window.activityEditorFolder = (folderModule) => folder   (may return a promise)
// and the page uses that folder instead of asking for one (tests/e2e/activity-editor.spec.js).
// window.activityEditor exposes { folder, editor, path } for tests and the console.

import { h } from '../../ui-kit.js';
import { openActivity } from './core.js';
import * as folderModule from './folder.js';
import { loadTool, mountLive } from './tool-info.js';
import { taskForm as drawTaskForm, tabOf, refreshTabCounts } from './task-form.js';
import { effectiveExposure } from './exposure.js';
import { slugFromTitle, newActivityProblems, createActivity } from './new-activity.js';
import { TOOLS } from '../../tool-list.js';
import { createPreviewLauncher } from './preview-launcher.js';
import { typeset } from '../../vendor.js';

const { createDirectoryFolder, createFileListFolder, findActivities } = folderModule;
const $ = (id) => document.getElementById(id);
const RECENTS = 8;

let folder = null;
let editor = null;    // the open Activity's editor
let current = null;   // its path in the folder
let sel = { kind: 'activity' };
let statusNote = null;
let focusSerial = 0;  // one undo group per visit to a field
let activities = [];  // the Open screen's list
const filters = { q: '', course: '', tool: '' };
let tool = null;      // the open Activity's Tool: { tool, conditionTypes, info } (tool-info.js)
let toolError = null; // why it couldn't be loaded
let live = null;      // the live Tool: { p, mode, setup, instance, box } (renderRight)
let liveUpdaters = []; // the form's readouts of the live State, redrawn on every change of it
let taskTab = 'prompt'; // the Task form's open tab (task-form.js), kept between Tasks
let studentView = true; // the live Tool's Student / Full toggle; Student applies on a Task

window.activityEditor = {
  get folder() { return folder; },
  get editor() { return editor; },
  get path() { return current; },
  get toolInfo() { return tool?.info; },
  get live() { return live?.instance ?? null; },
};

// ───────────────────────── Remembered: the folder handle and the recents (IndexedDB) ──

const store = (() => {
  let db;
  const open = () => (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('fw1-activity-editor', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = async (mode, fn) => {
    try {
      const tx = (await open()).transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      return await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Activity editor: IndexedDB is unavailable', err);
      return undefined;
    }
  };
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: (key, value) => run('readwrite', (s) => s.put(value, key)),
  };
})();

async function rememberRecent(path) {
  const recents = (await store.get('recents')) ?? [];
  await store.set('recents', [path, ...recents.filter((p) => p !== path)].slice(0, RECENTS));
}

// ───────────────────────── Screens ──

function show(screen) {
  $('grant').hidden = screen !== 'grant';
  $('open').hidden = screen !== 'open';
  $('main').hidden = screen !== 'main';
}

// ───────────────────────── The folder grant ──

const hasDirectoryAccess = () => typeof window.showDirectoryPicker === 'function';

async function start() {
  if (typeof window.activityEditorFolder === 'function') {
    return useFolder(await window.activityEditorFolder(folderModule));
  }
  if (!hasDirectoryAccess()) return renderGrant({});
  const handle = await store.get('folder');
  if (!handle) return renderGrant({});
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return useHandle(handle);
  renderGrant({ handle });
}

function renderGrant({ handle, error }) {
  const box = $('grant');
  const body = [h('h2', {}, 'Choose the repo folder'),
    h('p', {}, 'The editor reads and saves Activities in your checkout of this site (the folder with ', h('code', {}, 'tools'),
      ' in it). You choose it once; the editor remembers it.')];
  if (handle) {
    body.push(h('p', {}, `The browser needs your permission again to use “${handle.name}”.`),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', onclick: async () => {
          if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') useHandle(handle);
        } }, `Reconnect to ${handle.name}`),
        h('button', { type: 'button', class: 'btn', onclick: pickDirectory }, 'Choose another folder…')));
  } else if (hasDirectoryAccess()) {
    body.push(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: pickDirectory }, 'Choose folder…')));
  } else {
    const input = h('input', { type: 'file', id: 'folder-input', webkitdirectory: true, multiple: true });
    input.addEventListener('change', () => input.files.length && useFolder(createFileListFolder(input.files)));
    body.push(h('p', {}, "This browser can't save into a folder, so Save downloads the file instead; move it into the checkout by hand. Chrome and Edge save in place."),
      h('div', { class: 'row' }, h('label', { for: 'folder-input' }, 'Choose folder'), input));
  }
  if (error) body.push(h('p', { role: 'alert', class: 'sev' }, error));
  box.replaceChildren(...body);
  show('grant');
}

async function pickDirectory() {
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'activity-editor', mode: 'readwrite' });
  } catch (err) {
    if (err.name !== 'AbortError') renderGrant({ error: err.message });
    return;
  }
  if (await useHandle(handle)) await store.set('folder', handle);
}

const useHandle = (handle) => useFolder(createDirectoryFolder(handle));

async function useFolder(f) {
  try {
    await f.list('tools');
  } catch {
    renderGrant({ error: `“${f.name}” has no tools folder. Choose your checkout of this site.` });
    return false;
  }
  folder = f;
  $('folder-status').textContent = `Folder: ${f.name}${f.saves === 'download' ? ' (Save downloads)' : ''}`;
  await showOpen();
  return true;
}

// ───────────────────────── The Open screen ──

async function showOpen() {
  const box = $('open');
  box.replaceChildren(h('h2', {}, 'Open an Activity'), h('p', { class: 'muted' }, 'Reading the folder…'));
  show('open');
  activities = await findActivities(folder);
  const recents = (await store.get('recents')) ?? [];
  renderOpen(recents);
}

function renderOpen(recents) {
  const box = $('open');
  const sorted = [...activities].sort((a, b) => b.lastModified - a.lastModified);
  const options = (label, values, key) => {
    const select = h('select', { class: 't', 'aria-label': label },
      h('option', { value: '' }, `All ${label === 'Course' ? 'courses' : 'Tools'}`),
      ...[...new Set(values)].filter(Boolean).sort().map((v) => h('option', { value: v }, v)));
    select.value = filters[key];
    select.addEventListener('change', () => { filters[key] = select.value; drawRows(); });
    return select;
  };
  const search = h('input', { type: 'search', class: 't', 'aria-label': 'Search', placeholder: 'Title, id or course' });
  search.value = filters.q;
  search.addEventListener('input', () => { filters.q = search.value; drawRows(); });
  const tbody = h('tbody');
  const count = h('span', { class: 'muted' });

  function drawRows() {
    const q = filters.q.trim().toLowerCase();
    const rows = sorted.filter((a) => (!q || [a.title, a.id, a.course].some((v) => String(v).toLowerCase().includes(q)))
      && (!filters.course || a.course === filters.course) && (!filters.tool || a.tool === filters.tool));
    tbody.replaceChildren(...rows.map((a) => h('tr', { class: a.error ? 'bad' : null },
      h('td', {}, a.error ? `${a.title} (${a.error})` : h('button', { type: 'button', class: 'open', onclick: () => openPath(a.path) }, a.title)),
      h('td', { class: 'cid' }, a.id), h('td', {}, a.tool), h('td', {}, a.course), h('td', {}, String(a.version)),
      h('td', {}, modified(a.lastModified)))));
    if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: '6', class: 'muted' }, 'No Activities match.')));
    count.textContent = `${rows.length} of ${sorted.length}`;
  }

  const recent = recents.map((p) => activities.find((a) => a.path === p && !a.error)).filter(Boolean);
  const newSlot = h('div');
  const newButton = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', onclick: () => {
    if (newSlot.firstChild) return newSlot.querySelector('select')?.focus();
    newButton.setAttribute('aria-expanded', 'true');
    newSlot.append(newActivityForm(() => { newSlot.replaceChildren(); newButton.setAttribute('aria-expanded', 'false'); newButton.focus(); }));
    newSlot.querySelector('select').focus();
  } }, 'New Activity…');
  box.replaceChildren(
    h('div', { class: 'ed-open-head' }, h('h2', {}, 'Open an Activity'), newButton),
    newSlot,
    editor ? h('p', {}, h('button', { type: 'button', class: 'btn', onclick: backToEditor }, `Back to ${editor.doc.title || current}`),
      ' ', h('span', { class: 'muted' }, 'or press Escape')) : null,
    recent.length ? h('section', { 'aria-label': 'Recent' }, h('h3', { class: 'flabel' }, 'Recent'),
      h('ul', { class: 'ed-recents' }, ...recent.map((a) => h('li', {}, h('button', { type: 'button', onclick: () => openPath(a.path) },
        a.title, h('span', { class: 'sub' }, [a.course, a.tool].filter(Boolean).join(' · '))))))) : null,
    h('div', { class: 'ed-open-bar' },
      h('label', {}, 'Search', search),
      h('label', {}, 'Course', options('Course', activities.map((a) => a.course), 'course')),
      h('label', {}, 'Tool', options('Tool', activities.map((a) => a.tool), 'tool')),
      count),
    h('table', { class: 'grid ed-list' },
      h('thead', {}, h('tr', {}, ...['Title', 'Id', 'Tool', 'Course', 'Version', 'Last modified'].map((c) => h('th', { scope: 'col' }, c)))),
      tbody));
  drawRows();
  search.focus();
}

// The new-Activity form (spec story 8): a Tool from the Tool list, a title, an id (offered from
// the title until it is typed by hand) and a course. Create writes both files (new-activity.js)
// and opens the new Activity. close() removes the form.
function newActivityForm(close) {
  let idTyped = false;
  const errors = {};
  const control = (name, label, el) => {
    el.id = `new-${name}`;
    errors[name] = h('span', { class: 'sev', id: `new-${name}-error` });
    return h('div', { class: 'row' }, h('label', { for: el.id }, label), el, errors[name]);
  };
  const tool = h('select', { class: 't' }, h('option', { value: '' }, 'Choose a Tool…'),
    ...TOOLS.map((t) => h('option', { value: t.id }, t.title)));
  const title = h('input', { type: 'text', class: 't wide', autocomplete: 'off' });
  const id = h('input', { type: 'text', class: 't', autocomplete: 'off', spellcheck: 'false' });
  const courses = [...new Set(activities.map((a) => a.course).filter(Boolean))].sort();
  const course = h('input', { type: 'text', class: 't', list: 'new-courses', autocomplete: 'off' });
  title.addEventListener('input', () => { if (!idTyped) id.value = slugFromTitle(title.value); });
  id.addEventListener('input', () => { idTyped = id.value !== ''; });
  const inputs = { tool, title, id, course };

  const form = h('form', { class: 'sec ed-new', 'aria-label': 'New Activity', novalidate: true },
    h('h3', {}, 'New Activity', h('span', { class: 'sub' }, "its JSON and its page go in the Tool's activities folder")),
    h('div', { class: 'sec-body' },
      control('tool', 'Tool', tool), control('title', 'Title', title), control('id', 'Id', id), control('course', 'Course', course),
      h('datalist', { id: 'new-courses' }, ...courses.map((c) => h('option', { value: c }))),
      h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary' }, 'Create'),
        h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'))));
  form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = { tool: tool.value, id: id.value.trim(), title: title.value, course: course.value };
    const problems = await newActivityProblems(folder, fields);
    for (const [name, el] of Object.entries(inputs)) {
      errors[name].textContent = problems[name] ?? '';
      if (problems[name]) el.setAttribute('aria-describedby', errors[name].id);
      else el.removeAttribute('aria-describedby');
    }
    const first = ['tool', 'title', 'id', 'course'].find((name) => problems[name]);
    if (first) return inputs[first].focus();
    if (editor?.dirty && !confirm(`“${editor.doc.title}” has unsaved changes. Discard them and make a new Activity?`)) return;
    let path;
    try {
      path = await createActivity(folder, fields);
    } catch (err) {
      form.prepend(h('p', { role: 'alert', class: 'sev' }, `Couldn't create the Activity: ${err.message}`));
      return;
    }
    await openPath(path, { discard: true });
    if (folder.saves === 'download' && current === path) {
      const json = path.split('/').at(-1);
      statusNote = `Downloaded ${json} and ${json.replace(/\.json$/, '.html')}: move them into ${path.replace(/\/[^/]*$/, '')}`;
      refresh();
    }
  });
  return form;
}

const modified = (ms) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function backToEditor() {
  if (editor) show('main');
}

// discard: the instructor has already agreed to lose unsaved changes (a new Activity asks first).
async function openPath(path, { discard = false } = {}) {
  if (editor && path === current) return backToEditor();
  if (!discard && editor?.dirty && !confirm(`“${editor.doc.title}” has unsaved changes. Discard them and open another Activity?`)) return;
  let next;
  try {
    next = openActivity((await folder.readFile(path)).text);
  } catch (err) {
    $('open').prepend(h('p', { role: 'alert', class: 'sev' }, `Couldn't open ${path}: ${err.message}`));
    return;
  }
  editor = next;
  current = path;
  sel = { kind: 'activity' };
  statusNote = null;
  useTool(next);
  await rememberRecent(path);
  show('main');
  render();
}

// Load the open Activity's Tool and its Tool info; the page redraws when it arrives (the
// problems list gains the checks against it, the live Tool mounts).
function useTool(forEditor) {
  const id = forEditor.doc.tool;
  if (tool?.tool.id === id) return;
  destroyLive();
  tool = null;
  toolError = null;
  loadTool(id).then((loaded) => {
    if (editor !== forEditor) return;
    tool = loaded;
    render();
  }, (err) => {
    if (editor !== forEditor) return;
    toolError = `The Tool “${id}” couldn't be loaded: ${err.message}`;
    refresh();
  });
}

// ───────────────────────── Editing ──

// Apply one core edit. group merges consecutive edits (typing in one field) into one undo step.
function commit(edit, { group } = {}) {
  editor.edit(edit, { group });
  statusNote = null;
  refresh();
}

// Apply one edit that changes the form's own shape (a new Mode, a Capture, a cleared value), and
// redraw the form too.
function commitAndRender(edit) {
  editor.edit(edit);
  statusNote = null;
  render();
}

function undo() { if (editor.undo()) { statusNote = null; render(); } }
function redo() { if (editor.redo()) { statusNote = null; render(); } }

async function save() {
  if (!editor) return;
  const name = current.split('/').at(-1);
  setStatus('Saving…');
  try {
    await editor.save((text) => folder.writeFile(current, text));
    statusNote = folder.saves === 'download' ? `Downloaded ${name}: move it into ${current.replace(/\/[^/]*$/, '')}` : 'Saved';
  } catch (err) {
    statusNote = null;
    refresh();
    setStatus(`Save failed: ${err.message}`, 'error');
    return;
  }
  refresh();
}

function setStatus(text, cls = '') {
  const el = $('status');
  el.textContent = text;
  el.className = `ed-status ${cls}`;
}

// Redraw everything (after open, undo, redo or a change of selection).
function render() {
  renderForm();
  refresh();
}

// Redraw everything but the form, which is being typed in.
function refresh() {
  const { doc } = editor;
  const title = doc.title || doc.id || current;
  const act = $('act-title');
  act.hidden = false;
  act.textContent = title;
  act.setAttribute('aria-label', `Open another Activity (now: ${title})`);
  $('actions').hidden = false;
  $('undo').disabled = !editor.canUndo;
  $('redo').disabled = !editor.canRedo;
  if (editor.dirty) setStatus('Unsaved changes', 'dirty');
  else setStatus(statusNote ?? 'No unsaved changes');
  document.title = `${title}: Activity editor`;
  const problems = editor.problems(tool?.info);
  renderOutline(problems);
  renderProblems(problems);
  if (sel.kind === 'task') refreshTabCounts($('form'), problems.filter((pr) => sameSel(selOf(pr.path), sel)));
  renderRight();
  previewLauncher.refresh();
}

// ───────────────────────── Outline ──

const selOf = (path) => {
  if (path[0] !== 'parts' || typeof path[1] !== 'number') return { kind: 'activity' };
  if (path[2] !== 'tasks' || typeof path[3] !== 'number') return { kind: 'part', p: path[1] };
  return { kind: 'task', p: path[1], t: path[3] };
};
const sameSel = (a, b) => a.kind === b.kind && a.p === b.p && a.t === b.t;

function select(s) {
  if (!sameSel(s, sel)) studentView = true; // Student is the default whenever a Task is selected
  sel = s;
  render();
}

function renderOutline(problems) {
  const nav = $('outline');
  const focused = nav.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  const count = (s) => problems.filter((p) => sameSel(selOf(p.path), s)).length;
  const item = (key, cls, num, label, s) => {
    const n = count(s);
    return h('button', { type: 'button', class: `ol-item ${cls}`, 'aria-current': sameSel(sel, s) ? 'true' : 'false', 'data-key': key, onclick: () => select(s) },
      num ? h('span', { class: 'ol-num' }, num) : null, h('span', { class: 'ol-label', html: label }),
      n ? h('span', { class: 'ol-dot', title: `${n} problem${n === 1 ? '' : 's'}` }, String(n)) : null);
  };
  const { doc } = editor;
  const parts = Array.isArray(doc.parts) ? doc.parts : [];
  window.MathJax?.typesetClear?.([nav]);
  nav.replaceChildren(item('a', 'ol-activity', null, escape(doc.title || '(untitled)'), { kind: 'activity' }),
    ...parts.flatMap((part, p) => [
      item(`p${p}`, 'ol-part', `${p + 1}`, escape(part.title || part.id || '(untitled Part)'), { kind: 'part', p }),
      ...(Array.isArray(part.tasks) ? part.tasks : []).map((task, t) =>
        item(`t${p}-${t}`, 'ol-task', `${p + 1}.${t + 1}`, task.title || escape(task.id ?? ''), { kind: 'task', p, t })),
      Array.isArray(part.tasks) ? h('button', { type: 'button', class: 'ol-add task', 'data-key': `add-task-${p}`,
        'aria-label': `Add a Task to Part ${p + 1}`, onclick: () => addTask(p) }, '+ Task') : null,
    ]),
    h('button', { type: 'button', class: 'ol-add part', 'data-key': 'add-part', onclick: addPart }, '+ Part'));
  // Task titles hold \( \) math, typeset as the Task card shows it.
  if (nav.textContent.includes('\\(')) typeset([nav]);
  if (focused) nav.querySelector(`[data-key="${focused}"]`)?.focus();
}

// A new Part at the end, in the Tool's first Mode (or the last Part's, before the Tool loads),
// selected with its title ready to type over.
function addPart() {
  const parts = Array.isArray(editor.doc.parts) ? editor.doc.parts : [];
  const mode = tool?.tool.modes[0]?.id ?? parts.at(-1)?.mode ?? '';
  editor.edit({ type: 'addPart', title: `Part ${parts.length + 1}: New Part`, mode });
  statusNote = null;
  select({ kind: 'part', p: editor.doc.parts.length - 1 });
  const title = $('form').querySelector(`[data-path="parts.${sel.p}.title"]`);
  title?.focus();
  title?.select();
}

// A new Task at the end of Part p, selected on its Prompt tab with its title ready to type over.
function addTask(p) {
  editor.edit({ type: 'addTask', p, title: 'New Task' });
  statusNote = null;
  taskTab = 'prompt';
  select({ kind: 'task', p, t: editor.doc.parts[p].tasks.length - 1 });
  const title = $('form').querySelector(`[data-path="parts.${sel.p}.tasks.${sel.t}.title"]`);
  title?.focus();
  title?.select();
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ───────────────────────── Problems ──

function where(path) {
  const s = selOf(path);
  let text = s.kind === 'activity' ? 'Activity' : s.kind === 'part' ? `Part ${s.p + 1}` : `Task ${s.p + 1}.${s.t + 1}`;
  const q = path.indexOf('questions');
  if (s.kind === 'task' && typeof path[q + 1] === 'number') text += ` › Question ${path[q + 1] + 1}`;
  return text;
}

function renderProblems(problems) {
  const box = $('problems');
  box.replaceChildren(
    h('h3', {}, problems.length ? h('span', { class: 'sev', 'aria-hidden': 'true' }, '●') : h('span', { class: 'ok', 'aria-hidden': 'true' }, '✓'),
      `Problems (${problems.length})`,
      h('span', { class: 'muted' }, problems.length ? 'click one to go to its field · you can still save' : 'none')),
    h('ul', {}, ...problems.map((p) => h('li', {}, h('button', { type: 'button', onclick: () => jumpTo(p.path) },
      h('span', { class: 'where' }, where(p.path)), h('span', { style: 'flex:1' }, p.message))))));
}

// Select what owns the field at path, then focus the field: the form element whose data-path is
// the path, or the nearest one above it (form fields carry data-path="parts.0.tasks.1.points").
function jumpTo(path) {
  taskTab = tabOf(path) ?? taskTab;
  select(selOf(path));
  const form = $('form');
  for (let k = path.length; k >= 0; k--) {
    const el = form.querySelector(`[data-path="${CSS.escape(path.slice(0, k).join('.'))}"]`);
    if (!el) continue;
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    (el.matches('input,select,textarea,button') ? el : el.querySelector('input,select,textarea,button'))?.focus({ preventScroll: true });
    return;
  }
  $('outline').querySelector('[aria-current="true"]')?.focus();
}

// ───────────────────────── Forms ──

function section(title, sub, ...body) {
  return h('section', { class: 'sec' }, h('h3', {}, title, sub ? h('span', { class: 'sub' }, sub) : null), h('div', { class: 'sec-body' }, ...body));
}

// A text input or textarea bound to one field: each keystroke is an edit, one undo step per visit.
function field({ label, path, value, toEdit, textarea = false, ...attrs }) {
  const id = `f-${path}`;
  const el = h(textarea ? 'textarea' : 'input', { class: 't', id, 'data-path': path, ...(textarea ? {} : { type: 'text' }), ...attrs });
  el.value = value ?? '';
  el.addEventListener('focus', () => { focusSerial += 1; });
  el.addEventListener('input', () => commit(toEdit(el.value), { group: `${path}#${focusSerial}` }));
  return [h('label', { for: id }, label), el];
}

const versionValue = (text) => {
  const t = text.trim();
  if (t === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
};

const setActivity = (name, value) => ({ type: 'setActivityField', field: name, value });

function activityForm() {
  const { doc } = editor;
  return [
    h('h2', {}, 'Activity'), h('div', { class: 'ed-crumb' }, current),
    section('Activity', null,
      h('div', { class: 'row' }, ...field({ label: 'Title', path: 'title', value: doc.title, class: 't wide', toEdit: (v) => setActivity('title', v) })),
      h('div', { class: 'row' }, ...field({ label: 'Course', path: 'course', value: doc.course, toEdit: (v) => setActivity('course', v) })),
      h('div', { class: 'row' }, ...field({ label: 'Version', path: 'version', value: doc.version === undefined ? '' : String(doc.version),
        class: 't num', inputmode: 'numeric', toEdit: (v) => setActivity('version', versionValue(v)) }),
      h('span', { class: 'muted' }, 'you decide when it changes; it is never bumped for you')),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Tool'), h('span', { 'data-path': 'tool' }, doc.tool ?? ''),
        h('span', { class: 'muted' }, '(one Tool per Activity)')),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Id'), h('span', { class: 'idfield', 'data-path': 'id' }, h('code', {}, doc.id ?? '')))),
    section('Notes', 'not shown to students; stored unencoded',
      ...field({ label: 'Notes', path: 'notes', value: doc.notes, textarea: true, rows: '6',
        placeholder: 'Design notes for yourself. The runner ignores them.', toEdit: (v) => setActivity('notes', v) })),
  ];
}

const setPart = (p, field, value) => ({ type: 'setPartField', p, field, value });
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A Setup value as typed: empty clears it (the Tool's default applies); JSON (a number, true or
// false, a list, an object, a quoted string) is that value; anything else is text.
function setupValue(text) {
  const t = text.trim();
  if (t === '') return undefined;
  try { return JSON.parse(t); } catch { return t; }
}
const setupText = (v) => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));
const fmt = (v) => (typeof v === 'number' ? String(Number(v.toPrecision(6))) : v === undefined ? '' : JSON.stringify(v));

let captureNote = null; // said once in the Setup section after a Capture

function partForm() {
  const { doc } = editor;
  const p = sel.p;
  const part = doc.parts[p];
  const base = `parts.${p}`;
  const parts = doc.parts;
  const tasks = Array.isArray(part.tasks) ? part.tasks : [];
  const info = tool && Object.hasOwn(tool.info.modes, part.mode) ? tool.info.modes[part.mode] : null;
  const setup = isObject(part.setup) ? part.setup : {};

  const heading = h('h2', { html: escape(part.title ?? '') });
  const [titleLabel, titleInput] = field({ label: 'Title', path: `${base}.title`, value: part.title, class: 't wide', toEdit: (v) => setPart(p, 'title', v) });
  titleInput.addEventListener('input', () => { heading.innerHTML = escape(titleInput.value); });

  // The Mode picker offers only the Tool's Modes; a Mode the Tool doesn't have shows, unpickable.
  const modeId = `f-${base}.mode`;
  const modes = tool ? tool.tool.modes : [];
  const modeSel = h('select', { class: 't', id: modeId, 'data-path': `${base}.mode`, disabled: !tool },
    ...modes.map((m) => h('option', { value: m.id }, m.title)),
    modes.some((m) => m.id === part.mode) ? null
      : h('option', { value: part.mode ?? '', disabled: true }, tool ? `${part.mode} (not a Mode of the Tool)` : String(part.mode ?? '')));
  modeSel.value = part.mode ?? '';
  modeSel.addEventListener('change', () => commitAndRender(setPart(p, 'mode', modeSel.value)));

  const move = (to) => { editor.edit({ type: 'movePart', p, to }); statusNote = null; select({ kind: 'part', p: to }); };
  const remove = () => {
    if (tasks.length && !confirm(`Delete Part ${p + 1} “${stripTags(part.title ?? part.id)}” and its ${tasks.length} Task${tasks.length === 1 ? '' : 's'}? (Undo brings it back.)`)) return;
    editor.edit({ type: 'deletePart', p });
    statusNote = null;
    select(editor.doc.parts.length ? { kind: 'part', p: Math.max(0, p - 1) } : { kind: 'activity' });
  };

  const note = captureNote;
  captureNote = null;
  return [heading, h('div', { class: 'ed-crumb' }, `Part ${p + 1} of ${parts.length} · ${tasks.length} Task${tasks.length === 1 ? '' : 's'}`),
    section('Part', null,
      h('div', { class: 'row' }, titleLabel, titleInput),
      h('div', { class: 'row' }, h('label', { for: modeId }, 'Mode'), modeSel,
        h('span', { class: 'muted' }, tool ? "from the Tool's Modes" : toolError ? 'the Tool is not loaded' : 'loading the Tool…')),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Id'), h('span', { class: 'idfield', 'data-path': `${base}.id` }, h('code', {}, part.id ?? '')),
        h('span', { class: 'muted' }, 'made from the first title; retitling keeps it')),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', disabled: p === 0, onclick: () => move(p - 1) }, 'Move up'),
        h('button', { type: 'button', class: 'btn', disabled: p === parts.length - 1, onclick: () => move(p + 1) }, 'Move down'),
        h('button', { type: 'button', class: 'btn', onclick: remove }, 'Delete Part'))),
    setupSection(p, part, setup, info, note),
    section('Notes', 'not shown to students',
      ...field({ label: 'Notes', path: `${base}.notes`, value: part.notes, textarea: true, rows: '3', toEdit: (v) => setPart(p, 'notes', v) }))];
}

const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');

// The Setup: Capture from the live Tool, then one row per Setup key, per Setup option, and per
// value the Mode doesn't know (a problem, with a Remove).
function setupSection(p, part, setup, info, note) {
  const base = `parts.${p}.setup`;
  const set = (key) => (text) => ({ type: 'setSetupValue', p, key, value: setupValue(text) });
  const clear = (key, text = 'Clear') => h('button', { type: 'button', class: 'lnk', title: 'Clear: use the Tool default',
    'aria-label': `${text} ${key}`, onclick: () => commitAndRender({ type: 'setSetupValue', p, key, value: undefined }) }, text.toLowerCase());
  const rows = [];
  const keys = info?.setupKeys ?? [];
  const options = info?.setupOptions ?? [];
  if (keys.length) rows.push(h('tr', { class: 'grp' }, h('td', { colspan: '4' }, 'Setup keys (State; Capture stores these)')));
  for (const k of keys) {
    const st = info.state[k];
    const [label, input] = field({ label: [st?.label ?? k, h('div', { class: 'cid' }, k)], path: `${base}.${k}`, value: setupText(setup[k]),
      class: 't num mono', placeholder: 'Tool default', 'aria-label': `Setup ${k}`, toEdit: set(k) });
    const now = h('td', { class: 'live' });
    liveUpdaters.push(() => {
      const s = live?.p === p && live.instance ? live.instance.state.snapshot() : null;
      now.textContent = s ? `${fmt(s[k])}${st?.unit ? ` ${st.unit}` : ''}` : '';
    });
    rows.push(h('tr', {}, h('td', {}, label), h('td', {}, input), now, h('td', {}, clear(k))));
  }
  if (options.length) rows.push(h('tr', { class: 'grp' }, h('td', { colspan: '4' }, 'Setup options (typed by hand; JSON for lists and objects)')));
  for (const k of options) {
    const [label, input] = field({ label: k, path: `${base}.${k}`, value: setupText(setup[k]), class: 't wide mono', placeholder: 'Tool default',
      'aria-label': `Setup ${k}`, toEdit: set(k) });
    rows.push(h('tr', {}, h('td', {}, label), h('td', { colspan: '2' }, input), h('td', {}, clear(k))));
  }
  for (const k of Object.keys(setup).filter((key) => info ? !keys.includes(key) && !options.includes(key) : true)) {
    if (info) {
      rows.push(h('tr', { class: 'bad', 'data-path': `${base}.${k}` },
        h('td', {}, h('span', { class: 'sev' }, '⚠ '), k, h('div', { class: 'cid' }, 'not a Setup key or option of this Mode')),
        h('td', { class: 'mono', colspan: '2' }, setupText(setup[k])), h('td', {}, clear(k, 'Remove'))));
    } else {
      const [label, input] = field({ label: k, path: `${base}.${k}`, value: setupText(setup[k]), class: 't wide mono', 'aria-label': `Setup ${k}`, toEdit: set(k) });
      rows.push(h('tr', {}, h('td', {}, label), h('td', { colspan: '2' }, input), h('td', {}, clear(k))));
    }
  }
  // Capture and Reset need the live Tool mounted at this Part, which happens after the form draws.
  const mounted = () => Boolean(info && live?.p === p && live.instance);
  const captureButton = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: () => {
    if (!mounted()) return;
    captureNote = `Captured ${keys.length} Setup key${keys.length === 1 ? '' : 's'} from the live Tool`;
    commitAndRender({ type: 'captureSetup', p, setupKeys: keys, snapshot: live.instance.state.snapshot() });
  } }, '⤓ Capture from the live Tool');
  const resetButton = h('button', { type: 'button', class: 'lnk', disabled: true,
    onclick: () => { destroyLive(); renderRight(); } }, '↺ Reset the live Tool to this Setup');
  liveUpdaters.push(() => { captureButton.disabled = resetButton.disabled = !mounted(); });
  return section('Setup', 'what the student starts from',
    h('div', { class: 'row' }, captureButton,
      h('span', { class: 'muted' }, info ? `stores only ${info.title}'s Setup keys, never derived State` : 'needs the Tool and a known Mode')),
    note ? h('p', { class: 'muted', role: 'status' }, note) : null,
    h('table', { class: 'grid', 'data-path': base }, h('thead', {}, h('tr', {}, h('th', {}, 'Setup value'), h('th', {}, 'Value'), h('th', {}, 'Live Tool now'), h('th'))),
      h('tbody', {}, ...rows)),
    h('div', { class: 'row', style: 'margin-top:8px' }, resetButton));
}

// The Task form: a header with the Task's moves, then the tabs (task-form.js, tabs/). ctx is the
// TaskContext the tabs draw from (documented in task-form.js).
function taskForm() {
  const { doc } = editor;
  const { p, t } = sel;
  const part = doc.parts[p];
  const tasks = part.tasks;
  const task = tasks[t];
  const base = `parts.${p}.tasks.${t}`;
  const mode = tool && Object.hasOwn(tool.info.modes, part.mode) ? tool.info.modes[part.mode] : null;
  const heading = h('h2', { html: task.title ?? '' });
  const move = (to) => { editor.edit({ type: 'moveTask', p, t, to }); statusNote = null; select({ kind: 'task', p, t: to }); };
  const duplicate = () => { editor.edit({ type: 'duplicateTask', p, t }); statusNote = null; select({ kind: 'task', p, t: t + 1 }); };
  const remove = () => {
    if (!confirm(`Delete Task ${p + 1}.${t + 1} “${stripTags(task.title ?? task.id)}”? (Undo brings it back.)`)) return;
    editor.edit({ type: 'deleteTask', p, t });
    statusNote = null;
    select(editor.doc.parts[p].tasks.length ? { kind: 'task', p, t: Math.max(0, t - 1) } : { kind: 'part', p });
  };
  const head = [heading,
    h('div', { class: 'ed-crumb' }, `${stripTags(part.title ?? part.id)} › Task ${t + 1} of ${tasks.length}${mode ? ` · ${mode.title}` : ''}`),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', disabled: t === 0, onclick: () => move(t - 1) }, 'Move up'),
      h('button', { type: 'button', class: 'btn', disabled: t === tasks.length - 1, onclick: () => move(t + 1) }, 'Move down'),
      h('button', { type: 'button', class: 'btn', onclick: duplicate }, 'Duplicate Task'),
      h('button', { type: 'button', class: 'btn', onclick: remove }, 'Delete Task'))];
  const ctx = {
    editor, doc, p, t, part, task, base, tool, toolError, mode,
    commit, commitAndRender, field, section,
    onLive: (fn) => liveUpdaters.push(fn),
    liveInstance: () => (live?.p === p ? live.instance : null),
    exposure: () => effectiveExposure(doc, p, t, tool?.info),
    rerender: () => { renderForm(); for (const f of liveUpdaters) f(); },
    setHeading: (html) => { heading.innerHTML = html; },
  };
  const problems = editor.problems(tool?.info).filter((pr) => sameSel(selOf(pr.path), sel));
  return drawTaskForm(ctx, { problems, open: taskTab, head, choose: (id, { focusTab } = {}) => {
    taskTab = id;
    ctx.rerender();
    if (focusTab) $('form').querySelector(`[role="tab"][data-tab="${id}"]`)?.focus();
  } });
}

// The form for the selection.
const FORMS = { activity: activityForm, part: partForm, task: taskForm };

function renderForm() {
  const { doc } = editor;
  if (sel.kind !== 'activity' && !doc.parts?.[sel.p]) sel = { kind: 'activity' };
  if (sel.kind === 'task' && !doc.parts[sel.p].tasks?.[sel.t]) sel = { kind: 'part', p: sel.p };
  liveUpdaters = [];
  $('form').replaceChildren(...FORMS[sel.kind]());
}

// ───────────────────────── The live Tool ──
//
// The real Tool, mounted at the selected Part's Mode and Setup (Part 1's with the Activity
// selected). It is remounted only when the Part, its Mode or its Setup changes (or the Tool
// arrives); any other edit leaves it, and the instructor's arrangement of it, alone. Operating it
// never edits the Activity: only Capture (in the Part form) reads it into the Setup.

const livePart = () => {
  const parts = Array.isArray(editor.doc.parts) ? editor.doc.parts : [];
  if (!parts.length) return null;
  const p = sel.kind === 'activity' ? 0 : sel.p;
  return parts[p] ? { p, part: parts[p] } : null;
};

function renderRight() {
  const right = $('right');
  const target = livePart();
  const part = target?.part;
  const mode = part && tool && Object.hasOwn(tool.info.modes, part.mode) ? tool.info.modes[part.mode] : null;
  const same = live && live.editor === editor && live.tool === tool && live.p === target?.p
    && live.mode === part?.mode && live.setup === part?.setup && right.contains(live.box);
  if (!same) mountRight(right, target, mode);
  applyView();
  for (const f of liveUpdaters) f();
}

// The Student / Full view. On a Task, Student (the default) applies that Task's effective
// exposure to the live Tool, as the runner would: locked Controls locked, hidden Controls and
// layers hidden. Full, and any selection but a Task, opens every Control. It is applied in
// place (no remount), only when the states change, and never touches the Activity or the State.
function applyView() {
  if (!live?.instance) return;
  const onTask = sel.kind === 'task' && sel.p === live.p;
  const student = onTask && studentView;
  const states = {};
  const eff = student ? effectiveExposure(editor.doc, sel.p, sel.t, tool?.info) : {};
  for (const id of live.instance.controls.ids()) states[id] = eff[id]?.state ?? 'open';
  const key = JSON.stringify(states);
  if (key !== live.viewKey) {
    live.viewKey = key;
    for (const [id, state] of Object.entries(states)) {
      const c = live.instance.controls.get(id);
      if (state === 'hidden') c.hide();
      else { c.show(); if (state === 'locked') c.lock(); else c.unlock(); }
    }
  }
  for (const button of live.viewButtons) {
    button.disabled = !onTask;
    button.setAttribute('aria-pressed', String((button.dataset.view === 'student') === student));
  }
  live.viewText.textContent = !onTask ? `Part ${live.p + 1} at its Setup. Full view: every Control open (select a Task to see the student's view).`
    : student ? `Part ${live.p + 1} at its Setup. Student view at Task ${sel.p + 1}.${sel.t + 1}: locked and hidden as its exposure says.`
      : `Part ${live.p + 1} at its Setup. Full view: every Control open.`;
}

function mountRight(right, target, mode) {
  destroyLive();
  const message = (text, error) => right.replaceChildren(h('h3', { class: 'flabel' }, 'Live Tool'),
    h('p', { class: error ? 'ed-tool-error' : 'muted', role: error ? 'alert' : null }, text));
  if (!tool) return message(toolError ?? 'Loading the Tool…', Boolean(toolError));
  if (!target) return message(`Add a Part to see ${tool.tool.title} here.`);
  const { p, part } = target;
  if (!mode) return message(`Part ${p + 1}'s Mode “${part.mode}” is not a Mode of ${tool.tool.title}, so the Tool can't show it.`, true);

  const toolBox = h('div', { class: 'ed-tool' });
  const stateBody = h('tbody');
  const viewButtons = [['student', 'Student'], ['full', 'Full']].map(([v, label]) => h('button', { type: 'button', 'data-view': v,
    title: v === 'student' ? 'What the student gets at this Task: locked and hidden as its exposure says'
      : 'Every Control open, for arranging the Tool (Capture, Use current value)',
    onclick: () => { studentView = v === 'student'; applyView(); } }, label));
  const viewText = h('div', { class: 'muted' });
  const box = h('div', { class: 'ed-live' },
    h('div', { class: 'ed-live-head' }, h('h3', {}, `Live Tool · ${mode.title}`),
      h('span', { class: 'seg small', role: 'group', 'aria-label': 'Live Tool view' }, ...viewButtons)),
    viewText,
    toolBox,
    h('div', { class: 'muted' }, 'Operating the Tool never changes the Activity; Capture in the Part form stores its Setup keys.'),
    h('h4', { class: 'right-h' }, 'State now ', h('span', { class: 'muted' }, '(names for Conditions and expressions)')),
    h('div', { class: 'state-tbl' }, h('table', { class: 'grid', 'aria-label': 'State now' }, stateBody)));
  right.replaceChildren(box);
  live = { editor, tool, p, mode: part.mode, setup: part.setup, box, instance: null, unsub: null, viewButtons, viewText, viewKey: null };
  try {
    live.instance = mountLive(toolBox, tool.tool, part.mode, part.setup);
  } catch (err) {
    toolBox.replaceChildren(h('p', { class: 'ed-tool-error', role: 'alert' }, `The Tool can't start from this Setup: ${err.message}`));
    return;
  }
  const { instance } = live;
  const draw = () => {
    const s = instance.state.snapshot();
    stateBody.replaceChildren(...Object.entries(mode.state).map(([name, { label, unit }]) => h('tr', {},
      h('td', { class: 'cid' }, name), h('td', { style: 'font-size:13px' }, label), h('td', { class: 'live' }, `${fmt(s[name])}${unit ? ` ${unit}` : ''}`))));
    for (const f of liveUpdaters) f();
  };
  live.unsub = instance.state.onChange(draw);
  draw();
}

function destroyLive() {
  if (!live) return;
  const { instance, unsub } = live;
  live = null;
  unsub?.();
  try { instance?.destroy?.(); } catch (err) { console.warn('Activity editor: the live Tool failed to close', err); }
}

// ───────────────────────── Keys and buttons ──

// The Preview ▾ launcher (preview-launcher.js): the unsaved Activity in the real runner.
const previewLauncher = createPreviewLauncher({
  button: $('preview-btn'),
  pop: $('preview-pop'),
  context: () => ({ editor, sel, toolInfo: tool?.info, toolError, where }),
});

$('save').addEventListener('click', save);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('act-title').addEventListener('click', () => folder && showOpen());

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 's') {
    e.preventDefault();
    save();
  } else if (mod && key === 'o') {
    e.preventDefault();
    if (folder) showOpen();
  } else if (mod && (key === 'z' || key === 'y') && editor && !$('main').hidden) {
    e.preventDefault();
    if (key === 'y' || e.shiftKey) redo();
    else undo();
  } else if (key === 'escape' && !$('open').hidden && editor) {
    backToEditor();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (editor?.dirty) e.preventDefault();
});

start();
