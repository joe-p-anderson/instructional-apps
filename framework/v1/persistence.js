// Persistence (framework v1): browser-storage autosave and `#s=` share links.
// No DOM, so it can be imported from Node. Used by the Tool host's Standalone mode
// and meant for Run autosave too.
//
// Share links follow spacetime's precedent: `#s=` + base64url(UTF-8 JSON).
//   shareHash(value)     -> '#s=...'
//   readShareHash(hash)  -> value, or null when the hash is not a readable share link
//
// Autosave stores JSON in a Storage-like object (localStorage in the browser):
//   createStore(key, storage) -> { load(), save(value), clear() }
//   load() returns null when nothing usable is saved. No method ever throws, so a
//   private window, blocked storage or a full quota just means no autosave.
//   standaloneKey(toolId, modeId) -> the key for one Tool's Mode in Standalone mode.
//   runKey(activityId)            -> the key for an Activity's Run (see runner.save()/restore()).

export function standaloneKey(toolId, modeId) {
  return `fw1:standalone:${toolId}:${modeId}`;
}

export function runKey(activityId) {
  return `fw1:run:${activityId}`;
}

export function createStore(key, storage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch { return null; }
    },
    save(value) {
      try { storage?.setItem(key, JSON.stringify(value)); } catch { /* no autosave */ }
    },
    clear() {
      try { storage?.removeItem(key); } catch { /* nothing to clear */ }
    },
  };
}

export function shareHash(value) {
  return '#s=' + encode(value);
}

export function readShareHash(hash) {
  const m = /^#s=(.+)$/.exec(hash ?? '');
  if (!m) return null;
  try { return decode(m[1]); } catch { return null; }
}

function encode(value) {
  let bin = '';
  for (const b of new TextEncoder().encode(JSON.stringify(value))) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('not base64url');
  let s = text.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
