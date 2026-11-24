// Encoded answer keys: Condition targets and Question keys stored so they don't
// appear in plain text in the page source. This only deters casual cheating
// (ADR 0001): the keying material ships in the client.
//
//   encodeKey(value)       // any JSON value -> 'enc1:...' string (run at authoring time)
//   decodeKey(string)      // 'enc1:...' -> the value
//   decodeActivity(def)    // a copy of an Activity with every encoded key decoded
//
// An author may encode any value inside an Activity: a whole Condition (which also
// hides its targetLabel), or one field such as a Question's answer, tol or correct,
// or a Hint's text (decoded only when the Hint is revealed).
// Use framework/v1/authoring/encode-keys.html, or encodeKey() in its console.

const PREFIX = 'enc1:';
const PAD = new TextEncoder().encode('fw-v1 casual-deterrent key; see ADR 0001');

export const isEncodedKey = (v) => typeof v === 'string' && v.startsWith(PREFIX);

export function encodeKey(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('Only JSON values can be encoded as keys.');
  const bytes = xor(new TextEncoder().encode(json));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeKey(key) {
  if (!isEncodedKey(key)) throw new Error('Not an encoded key.');
  try {
    const b64 = key.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = xor(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`Invalid encoded key "${key}".`);
  }
}

// Walk the definition, decoding encoded keys; functions (custom Conditions and
// Condition types) are kept as they are. A Hint's encoded text stays encoded until
// the Hint is revealed (decodeHint).
export function decodeActivity(value) {
  if (isEncodedKey(value)) return decodeActivity(decodeKey(value));
  if (Array.isArray(value)) return value.map(decodeActivity);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'hint' ? decodeHintShape(v) : decodeActivity(v)]));
  }
  return value;
}

// The text of a Hint being revealed: decoded if it was encoded.
export const decodeHint = (text) => (isEncodedKey(text) ? decodeKey(text) : text);

function decodeHintShape(hint) {
  const decoded = isEncodedKey(hint) ? decodeKey(hint) : hint;
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return decodeActivity(decoded);
  const { text, ...rest } = decoded;
  return { ...decodeActivity(rest), ...(text === undefined ? {} : { text }) };
}

function xor(bytes) {
  return bytes.map((b, i) => b ^ PAD[i % PAD.length]);
}
