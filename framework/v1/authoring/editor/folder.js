// Folder access for the Activity editor: the instructor's checkout of this repo, behind one
// small interface so tests can swap in a folder held in memory.
//
// A folder is
//   {
//     name,                     the folder's name, for the header
//     saves,                    'folder' (writeFile writes into the checkout) or 'download'
//     list(path)                -> [{ name, kind: 'file' | 'directory' }], sorted by name
//     readFile(path)            -> { text, lastModified }   (lastModified in ms since 1970)
//     writeFile(path, text)     creates the file (and its folders) if it is missing
//   }
// Paths are relative to the folder, with '/' separators and no leading slash ('' is the
// folder itself). A missing file or folder rejects with a NotFoundError.
//
// Implementations:
//   createDirectoryFolder(handle)   Chrome and Edge: a File System Access directory handle
//                                   (from showDirectoryPicker, or the origin-private file system)
//   createFileListFolder(files)     the fallback elsewhere: the files of an <input webkitdirectory>;
//                                   writeFile downloads the file instead
//   createMemoryFolder(files)       tests: { [path]: text | { text, lastModified } }
//
// findActivities(folder) is the Open screen's scan: every tools/*/activities/*.json, with only
// its header fields. No DOM is touched until a file-list folder downloads.

const notFound = (path) => new DOMException(`"${path}" was not found in the folder.`, 'NotFoundError');
const split = (path) => path.split('/').filter(Boolean);
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function createDirectoryFolder(root) {
  const dir = async (segments, create = false) => {
    let handle = root;
    for (const seg of segments) handle = await handle.getDirectoryHandle(seg, { create });
    return handle;
  };
  const fileHandle = async (path, create = false) => {
    const segments = split(path);
    const parent = await dir(segments.slice(0, -1), create);
    return parent.getFileHandle(segments.at(-1), { create });
  };
  return {
    name: root.name,
    saves: 'folder',
    handle: root,
    async list(path) {
      const out = [];
      for await (const [name, handle] of (await dir(split(path))).entries()) out.push({ name, kind: handle.kind });
      return out.sort(byName);
    },
    async readFile(path) {
      const file = await (await fileHandle(path)).getFile();
      return { text: await file.text(), lastModified: file.lastModified };
    },
    async writeFile(path, text) {
      const writable = await (await fileHandle(path, true)).createWritable();
      await writable.write(text);
      await writable.close();
    },
  };
}

// A folder over a Map of path -> read() (the shared part of the memory and file-list folders).
function pathFolder(entries, { name, saves, write, now = Date.now }) {
  return {
    name,
    saves,
    async list(path) {
      const prefix = split(path);
      const kids = new Map();
      for (const p of entries.keys()) {
        const segs = split(p);
        if (segs.length <= prefix.length || prefix.some((s, i) => segs[i] !== s)) continue;
        kids.set(segs[prefix.length], segs.length === prefix.length + 1 ? 'file' : 'directory');
      }
      if (!kids.size && prefix.length) throw notFound(path);
      return [...kids].map(([n, kind]) => ({ name: n, kind })).sort(byName);
    },
    async readFile(path) {
      const read = entries.get(split(path).join('/'));
      if (!read) throw notFound(path);
      return read();
    },
    async writeFile(path, text) {
      const key = split(path).join('/');
      await write(key, text);
      const lastModified = now();
      entries.set(key, async () => ({ text, lastModified }));
    },
  };
}

export function createMemoryFolder(files = {}, { name = 'memory' } = {}) {
  const entries = new Map();
  let clock = 0;
  for (const [path, file] of Object.entries(files)) {
    const { text, lastModified = 0 } = typeof file === 'string' ? { text: file } : file;
    clock = Math.max(clock, lastModified);
    entries.set(split(path).join('/'), async () => ({ text, lastModified }));
  }
  // A write always moves lastModified forward, even within one millisecond.
  const now = () => (clock = Math.max(clock + 1, Date.now()));
  return pathFolder(entries, { name, saves: 'folder', write: async () => {}, now });
}

// files: the File objects of an <input type="file" webkitdirectory>, whose webkitRelativePath
// starts with the chosen folder's name.
export function createFileListFolder(files, { download = downloadText } = {}) {
  const entries = new Map();
  let name = '';
  for (const file of files) {
    const [root, ...rest] = split(file.webkitRelativePath || file.name);
    name ||= root;
    if (rest.length) entries.set(rest.join('/'), async () => ({ text: await file.text(), lastModified: file.lastModified }));
  }
  return pathFolder(entries, { name, saves: 'download', write: async (path, text) => download(split(path).at(-1), text) });
}

export function downloadText(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Every Activity file in the folder: [{ path, id, title, course, tool, version, lastModified,
// error? }], by path. A file that isn't valid JSON is listed by its name with an error.
export async function findActivities(folder) {
  const found = [];
  for (const toolDir of await folder.list('tools')) {
    if (toolDir.kind !== 'directory') continue;
    const dir = `tools/${toolDir.name}/activities`;
    let files;
    try {
      files = await folder.list(dir);
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'TypeMismatchError') continue;
      throw err;
    }
    for (const f of files) {
      if (f.kind !== 'file' || !f.name.endsWith('.json')) continue;
      const path = `${dir}/${f.name}`;
      const { text, lastModified } = await folder.readFile(path);
      let a;
      try {
        a = JSON.parse(text);
      } catch {
        found.push({ path, id: '', title: f.name, course: '', tool: toolDir.name, version: '', lastModified, error: 'not valid JSON' });
        continue;
      }
      const field = (k) => (typeof a?.[k] === 'string' || typeof a?.[k] === 'number' ? a[k] : '');
      found.push({ path, id: field('id'), title: field('title') || f.name, course: field('course'), tool: field('tool') || toolDir.name, version: field('version'), lastModified });
    }
  }
  return found;
}
