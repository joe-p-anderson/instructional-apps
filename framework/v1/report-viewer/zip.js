// A small zip reader for the Report Viewer (framework v1): no dependencies, no DOM.
//
//   await readZip(bytes) -> [{ name, bytes }]   every file entry, in archive order
//
// Reads the central directory and inflates with the platform's
// DecompressionStream('deflate-raw') (modern browsers and Node 18+), so the
// Brightspace bulk download is read entirely in the browser. Handles the stored (0)
// and deflate (8) methods, which is all Brightspace writes. Not handled: ZIP64,
// encryption, multi-disk archives; these are refused with a readable error.

export function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (count === 0xffff || at === 0xffffffff) throw new Error('This zip is too large to read (ZIP64).');
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('This zip is damaged: bad directory entry.');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decodeName(bytes.subarray(at + 46, at + 46 + nameLen), flags);
    at += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue; // a folder
    if (flags & 1) throw new Error(`${name}: encrypted zip entries cannot be read.`);
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error('This zip is damaged: bad file entry.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + size);
    entries.push({ name, bytes: await decompress(body, method, name) });
  }
  return entries;
}

function findEnd(view) {
  // The end-of-central-directory record sits in the last 22 + 65535 bytes.
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error('This file is not a zip archive.');
}

async function decompress(body, method, name) {
  if (method === 0) return body.slice();
  if (method !== 8) throw new Error(`${name}: unsupported zip compression method ${method}.`);
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Names are UTF-8 when flag bit 11 is set; older tools write CP437, read here as Latin-1.
function decodeName(raw, flags) {
  return new TextDecoder(flags & 0x0800 ? 'utf-8' : 'latin1').decode(raw);
}
