// The Activity editor page (../activity-editor.html): the DOM over the editor core (core.js)
// and the folder interface (folder.js).
//
// Screens: the folder grant (#grant), the Open screen (#open), and the editor (#main: outline,
// form and problems, live Tool). One editor session (openActivity) is open at a time, for the
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
import { slugFromTitle, newActivityProblems, createActivity } from './new-activity.js';
import { TOOLS } from '../../tool-list.js';

const { createDirectoryFolder, createFileListFolder, findActivities } = folderModule;
const $ = (id) => document.getElementById(id);
const RECENTS = 8;

let folder = null;
let editor = null;    // the open Activity's editor session
let current = null;   // its path in the folder
let sel = { kind: 'activity' };
let statusNote = null;
let focusSerial = 0;  // one undo group per visit to a field
let activities = [];  // the Open screen's list
const filters = { q: '', course: '', tool: '' };

window.activityEditor = {
  get folder() { return folder; },
  get editor() { return editor; },
  get path() { return current; },
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
  await rememberRecent(path);
  show('main');
  render();
}

// ───────────────────────── Editing ──

// Apply one core edit. group merges consecutive edits (typing in one field) into one undo step.
function commit(edit, { group } = {}) {
  editor.edit(edit, { group });
  statusNote = null;
  refresh();
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
  const problems = editor.problems();
  renderOutline(problems);
  renderProblems(problems);
  renderRight();
}

// ───────────────────────── Outline ──

const selOf = (path) => {
  if (path[0] !== 'parts' || typeof path[1] !== 'number') return { kind: 'activity' };
  if (path[2] !== 'tasks' || typeof path[3] !== 'number') return { kind: 'part', p: path[1] };
  return { kind: 'task', p: path[1], t: path[3] };
};
const sameSel = (a, b) => a.kind === b.kind && a.p === b.p && a.t === b.t;

function select(s) {
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
  nav.replaceChildren(item('a', 'ol-activity', null, escape(doc.title || '(untitled)'), { kind: 'activity' }),
    ...parts.flatMap((part, p) => [
      item(`p${p}`, 'ol-part', `${p + 1}`, escape(part.title || part.id || '(untitled Part)'), { kind: 'part', p }),
      ...(Array.isArray(part.tasks) ? part.tasks : []).map((task, t) =>
        item(`t${p}-${t}`, 'ol-task', `${p + 1}.${t + 1}`, task.title || escape(task.id ?? ''), { kind: 'task', p, t })),
    ]));
  if (focused) nav.querySelector(`[data-key="${focused}"]`)?.focus();
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

function partForm() {
  const part = editor.doc.parts[sel.p];
  return [h('h2', { html: escape(part.title ?? '') }), h('div', { class: 'ed-crumb' }, `Part ${sel.p + 1}`),
    section('Part', null,
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Id'), h('span', { class: 'idfield', 'data-path': `parts.${sel.p}.id` }, h('code', {}, part.id ?? ''))),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Mode'), h('span', { 'data-path': `parts.${sel.p}.mode` }, part.mode ?? '')),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Tasks'), h('span', {}, String(part.tasks?.length ?? 0))))];
}

function taskForm() {
  const task = editor.doc.parts[sel.p].tasks[sel.t];
  const base = `parts.${sel.p}.tasks.${sel.t}`;
  return [h('h2', { html: task.title ?? '' }), h('div', { class: 'ed-crumb' }, `Task ${sel.p + 1}.${sel.t + 1}`),
    section('Task', null,
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Id'), h('span', { class: 'idfield', 'data-path': `${base}.id` }, h('code', {}, task.id ?? ''))),
      h('div', { class: 'row' }, h('span', { class: 'flabel' }, 'Points'), h('span', { 'data-path': `${base}.points` }, String(task.points ?? ''))))];
}

// The form for the selection. Tickets that add Part and Task editing replace partForm and taskForm.
const FORMS = { activity: activityForm, part: partForm, task: taskForm };

function renderForm() {
  const { doc } = editor;
  if (sel.kind !== 'activity' && !doc.parts?.[sel.p]) sel = { kind: 'activity' };
  if (sel.kind === 'task' && !doc.parts[sel.p].tasks?.[sel.t]) sel = { kind: 'part', p: sel.p };
  $('form').replaceChildren(...FORMS[sel.kind]());
}

function renderRight() {
  $('right').replaceChildren(h('h3', { class: 'flabel' }, 'Live Tool'), h('p', { class: 'muted' }, 'The Tool for the selected Part shows here.'));
}

// ───────────────────────── Keys and buttons ──

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
