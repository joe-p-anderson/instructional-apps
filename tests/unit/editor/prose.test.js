// Prose fields in the editor core (ticket 13): Hint texts open decoded for editing and save
// encoded, and an edited prose field typed back to its old text saves byte-identical.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openActivity } from '../../../framework/v1/authoring/editor/core.js';
import { decodeKey } from '../../../framework/v1/runner/index.js';

const read = (path) => readFileSync(new URL(`../../../tools/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FILES = {
  oscilloscope: read('oscilloscope/activities/phase-period-amplitude.json'),
  electrostatics: read('electrostatics/activities/conductor-properties.json'),
  fourier: read('fourier/activities/fourier-series.json'),
  phasors: read('phasors/activities/phasors-impedance.json'),
  spacetime: read('spacetime/activities/lab10.json'),
};

async function saved(editor) {
  let written;
  await editor.save((text) => { written = text; });
  return written;
}

const hints = (doc) => doc.parts.flatMap((part, p) => part.tasks.flatMap((task, t) => (task.hint ? [{ p, t, hint: task.hint }] : [])));

test('every Hint text opens decoded, as the text the student reads', () => {
  let count = 0;
  for (const text of Object.values(FILES)) {
    const raw = JSON.parse(text);
    const editor = openActivity(text);
    for (const { p, t, hint } of hints(editor.doc)) {
      const stored = raw.parts[p].tasks[t].hint.text;
      assert.doesNotMatch(hint.text, /^enc1:/);
      assert.equal(hint.text, stored.startsWith('enc1:') ? decodeKey(stored) : stored);
      count += 1;
    }
  }
  assert.ok(count >= 9, `expected the 5 Activities' Hints, found ${count}`);
});

test('typing a Hint text or prompt and typing it back saves byte-identical', async () => {
  for (const [name, text] of Object.entries(FILES)) {
    const editor = openActivity(text);
    const { p, t } = hints(editor.doc)[0] ?? { p: 0, t: 0 };
    const task = editor.doc.parts[p].tasks[t];
    if (task.hint) {
      const old = task.hint.text;
      editor.edit({ type: 'setHintField', p, t, field: 'text', value: `${old} V<sub>R</sub>` }, { group: 'h' });
      const wasEncoded = JSON.parse(text).parts[p].tasks[t].hint.text.startsWith('enc1:');
      assert.equal(JSON.parse(editor.serialize()).parts[p].tasks[t].hint.text.startsWith('enc1:'), wasEncoded, name);
      editor.edit({ type: 'setHintField', p, t, field: 'text', value: old }, { group: 'h' });
    }
    const prompt = task.prompt;
    editor.edit({ type: 'setTaskField', p, t, field: 'prompt', value: `${prompt} \\(x\\)` }, { group: 'p' });
    editor.edit({ type: 'setTaskField', p, t, field: 'prompt', value: prompt }, { group: 'p' });
    assert.equal(await saved(editor), text, name);
  }
});

test('the stored prompt is exactly what was typed', () => {
  const editor = openActivity(FILES.oscilloscope);
  const typed = 'Measure V<sub>R</sub> &amp; \\(\\omega_0 = 1/\\sqrt{LC}\\)<br>  then stop.';
  editor.edit({ type: 'setTaskField', p: 0, t: 0, field: 'prompt', value: typed });
  assert.equal(JSON.parse(editor.serialize()).parts[0].tasks[0].prompt, typed);
});
