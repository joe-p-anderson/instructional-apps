// The Activity file (ADR 0004): an Activity stored as a JSON document beside a page made from
// one template. No DOM, so Node scripts, tests and the Activity editor share it.
//
// serializeActivity(activity) -> text
//   The saved form: JSON with a fixed key order and a two-space indent, ending in a newline, so
//   that diffs stay stable and the editor reproduces a file byte for byte. Keys are written in
//   the order of KEY_ORDER below for the Activity, Parts, Tasks, Hints, Questions, choices and
//   Conditions (including the components of a list or anyOf). Keys the order does not name are
//   kept, after the named ones, in the order they came in; so are the keys of a Part's setup
//   (Tool-defined data). Encoded strings (enc1:) are copied as they are: this module never
//   encodes or decodes. Throws on anything JSON cannot hold (a function Condition, Activity-level
//   conditionTypes, undefined in a list, NaN or Infinity), naming the path, instead of dropping it.
//
// activityPage({ title, tool, file }) -> text
//   The Activity page, the one template every Activity page is made from. It lives beside the
//   JSON in tools/<tool>/activities/, imports the Tool module ../<tool>.js (its default export,
//   plus its conditionTypes export when it has one), fetches ./<file> and calls
//   mountActivity(tool, activity, root, { conditionTypes }) as the hand-written pages did.

export const KEY_ORDER = {
  activity: ['id', 'version', 'title', 'course', 'tool', 'notes', 'parts'],
  part: ['id', 'title', 'mode', 'setup', 'notes', 'tasks'],
  task: ['id', 'title', 'prompt', 'show', 'lock', 'hide', 'condition', 'questions', 'points', 'hint', 'notes'],
  hint: ['after', 'text'],
  question: ['id', 'kind', 'prompt', 'choices', 'correct', 'answer', 'tol', 'relTol', 'modulus', 'points'],
  choice: ['id', 'text'],
  condition: ['type', 'state', 'target', 'equals', 'above', 'below', 'tol', 'relTol', 'targetLabel', 'conditions'],
};

// Which kind of object sits under a key of each kind (lists apply it to every item).
const CHILDREN = {
  activity: { parts: 'part' },
  part: { tasks: 'task' },
  task: { hint: 'hint', questions: 'question', condition: 'condition' },
  question: { choices: 'choice' },
  condition: { conditions: 'condition' },
};

export function serializeActivity(activity) {
  return `${JSON.stringify(ordered(activity, 'activity', ''), null, 2)}\n`;
}

function ordered(value, kind, path) {
  if (Array.isArray(value)) return value.map((item, i) => ordered(item, kind, `${path}[${i}]`));
  if (!isObject(value) || !kind) return plain(value, path);
  const order = KEY_ORDER[kind];
  const keys = [...order.filter((k) => Object.hasOwn(value, k)), ...Object.keys(value).filter((k) => !order.includes(k))];
  const out = {};
  for (const key of keys) {
    if (value[key] === undefined) continue;
    out[key] = ordered(value[key], CHILDREN[kind]?.[key], path ? `${path}.${key}` : key);
  }
  return out;
}

function plain(value, path) {
  const bad = () => { throw new Error(`An Activity file holds plain data only: ${path || 'the Activity'} can't be written as JSON`); };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : bad();
  if (Array.isArray(value)) return value.map((item, i) => (item === undefined ? bad() : plain(item, `${path}[${i}]`)));
  if (isObject(value)) {
    const out = {};
    for (const [key, v] of Object.entries(value)) if (v !== undefined) out[key] = plain(v, `${path}.${key}`);
    return out;
  }
  return bad();
}

function isObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function activityPage({ title, tool, file }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="../../../framework/v1/theme.css">
</head>
<body>
<div id="app"></div>
<!-- Made from the Activity page template (framework/v1/activity-file.js); the Activity is ${escapeHtml(file)}. -->
<script type="module">
  import * as tool from ${jsString(`../${tool}.js`)};
  import { mountActivity } from '../../../framework/v1/activity-ui.js';

  const app = document.getElementById('app');
  const response = await fetch(${jsString(`./${file}`)});
  if (!response.ok) {
    app.textContent = \`This Activity could not be loaded (\${response.status}). Try reloading the page.\`;
    throw new Error(\`Activity file: HTTP \${response.status}\`);
  }
  const activity = await response.json();
  window.activityHost = mountActivity(tool.default, activity, app, { conditionTypes: tool.conditionTypes });
</script>
</body>
</html>
`;
}
