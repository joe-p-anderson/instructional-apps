// Seam 1 (Spec 0002), ticket 08: the Measure menu and its readouts, driven only through engine
// events and read through acquire() frames, state() and serialize().
//
// Menu flows under test (each skin's style):
//   TBS2072B  Measure: 1 Source (CH1 ⇄ CH2), 2 Type (cycles; the multipurpose knob turns it too),
//             3 Add, 4 Remove Last, 5 Remove All. Up to 6 readouts, shown on screen as readouts.
//   TDS2001C  Measure: softkeys 1..5 are the five measurement slots (value shown in the box);
//             pressing one opens it: 1 Source, 2 Type (None, Freq, ...), 5 Back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, switchSkin } from '../../../tools/bench-scope/engine/engine.js';
import { SKIN_IDS, skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const close = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} not within ${tol} of ${expected}`);

const TYPE_TEXT = {
  freq: 'Freq', period: 'Period', pkpk: 'Pk-Pk', amplitude: 'Ampl', mean: 'Mean', rms: 'RMS',
  rise: 'Rise', delay: 'Delay', phase: 'Phase',
};
const SOURCE_TEXT = { ch1: 'CH1', ch2: 'CH2' };

/** Press softkey n until the menu item there shows `text`. */
function cycleTo(engine, n, text) {
  for (let i = 0; i < 16; i++) {
    if (engine.acquire(0).menu.items[n - 1].value === text) return;
    engine.softkey(n);
  }
  assert.fail(`softkey ${n} never showed ${text}`);
}

/** Add a readout through the skin's Measure menu. */
function addReadout(engine, source, type) {
  engine.press('measure');
  if (engine.profile.id === 'tds2001c') {
    const k = engine.state().measureCount + 1;
    engine.softkey(k);
    if (source) cycleTo(engine, 1, SOURCE_TEXT[source]);
    cycleTo(engine, 2, TYPE_TEXT[type]);
    engine.softkey(5); // Back
  } else {
    if (source) cycleTo(engine, 1, SOURCE_TEXT[source]);
    cycleTo(engine, 2, TYPE_TEXT[type]);
    engine.softkey(3); // Add
  }
}

/** The published readout k (1-based) from the State. */
const meas = (s, k) => ({
  source: s[`measure${k}Source`], type: s[`measure${k}Type`], value: s[`measure${k}Value`], valid: s[`measure${k}Valid`],
});

function scope(skin = 'tbs2072b', patch = {}) {
  const engine = createEngine(skinProfile(skin));
  engine.apply({ type: 'set', control: 'hor-scale', value: 200e-6 }); // a few cycles of 1 kHz
  engine.setSource({ gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0, ...patch });
  return engine;
}

test('pk-pk and frequency readouts at sensible settings are close to the truth despite the noise', () => {
  for (const skin of SKIN_IDS) {
    const engine = scope(skin);
    addReadout(engine, 'ch1', 'pkpk');
    addReadout(engine, 'ch1', 'freq');
    engine.acquire(0);
    const s = engine.state();
    assert.equal(s.measureCount, 2, skin);
    const pk = meas(s, 1);
    const f = meas(s, 2);
    assert.deepEqual([pk.source, pk.type, pk.valid], ['ch1', 'pkpk', true], skin);
    assert.deepEqual([f.source, f.type, f.valid], ['ch1', 'freq', true], skin);
    close(pk.value, s.ch1TrueVpp, 0.12, `${skin} pk-pk`);
    close(f.value, s.ch1TrueFreq, 10, `${skin} frequency`);
  }
});

test('a low-pass at fc = f gives a CH1→CH2 phase readout close to −45° and a delay of about T/8', () => {
  for (const skin of SKIN_IDS) {
    const engine = scope(skin, { ch2Source: 'lowpass', ch2Fc: 1000 });
    engine.press('ch2-menu'); // CH2 on
    addReadout(engine, null, 'phase');
    addReadout(engine, null, 'delay');
    engine.acquire(0);
    const s = engine.state();
    close(s.ch2Phase, -45, 1e-6, 'truth');
    const ph = meas(s, 1);
    assert.deepEqual([ph.source, ph.type, ph.valid], ['ch1-ch2', 'phase', true], skin);
    close(ph.value, -45, 3, `${skin} phase`);
    close(meas(s, 2).value, 1e-3 / 8, 10e-6, `${skin} delay`);
  }
});

test('readouts show on screen in each skin\'s style, with "?" when invalid', () => {
  const tbs = scope('tbs2072b');
  addReadout(tbs, 'ch1', 'freq');
  addReadout(tbs, 'ch2', 'pkpk'); // CH2 is off: no data
  let texts = tbs.acquire(0).readouts.map((r) => r.text);
  assert.ok(texts.includes('Freq 1.00kHz'), texts.join(' ; '));
  assert.ok(texts.includes('Pk-Pk ?'), texts.join(' ; '));
  assert.equal(meas(tbs.state(), 2).valid, false);

  const tds = scope('tds2001c');
  addReadout(tds, 'ch1', 'freq');
  tds.press('measure');
  const box = tds.acquire(0).menu.items[0];
  assert.deepEqual([box.label, box.value], ['CH1 Freq', '1.00kHz']);
  assert.equal(tds.acquire(0).menu.items[1].value, 'None');
});

test('TBS: Remove Last and Remove All; no duplicates; at most six readouts', () => {
  const engine = scope('tbs2072b');
  addReadout(engine, 'ch1', 'freq');
  addReadout(engine, 'ch1', 'freq');
  assert.equal(engine.state().measureCount, 1, 'the same readout is not added twice');
  for (const t of ['period', 'pkpk', 'amplitude', 'mean', 'rms', 'rise']) addReadout(engine, 'ch1', t);
  const s = engine.state();
  assert.equal(s.measureCount, 6);
  assert.equal(s.measure6Type, 'rms', 'the seventh did not fit');
  engine.softkey(4); // Remove Last
  assert.equal(engine.state().measureCount, 5);
  assert.equal(engine.state().measure6Type, null);
  engine.softkey(5); // Remove All
  assert.equal(engine.state().measureCount, 0);
});

test('TBS: the multipurpose knob picks the type while the Measure menu shows', () => {
  const engine = scope('tbs2072b');
  assert.equal(engine.mpFunction(), null);
  engine.press('measure');
  assert.equal(engine.mpFunction(), 'Measure type');
  engine.turn('mp-knob', 2); // Freq → Period → Pk-Pk
  assert.equal(engine.acquire(0).menu.items[1].value, 'Pk-Pk');
  engine.turn('mp-knob', -3); // wraps to the last type
  assert.equal(engine.acquire(0).menu.items[1].value, 'Phase');
  engine.press('trig-menu');
  assert.equal(engine.mpFunction(), null, 'not with another menu on screen');
  engine.turn('mp-knob', 1);
  engine.press('measure');
  assert.equal(engine.acquire(0).menu.items[1].value, 'Phase');
});

test('TBS: with cursors on, the knob picks the Measure type only while the Measure menu shows', () => {
  const engine = scope('tbs2072b');
  engine.press('cursors');
  engine.softkey(1); // Type: Time
  assert.equal(engine.mpFunction(), 'Cursor 1');
  const c0 = engine.state().cursor1;
  engine.press('measure');
  assert.equal(engine.mpFunction(), 'Measure type');
  engine.turn('mp-knob', 1);
  assert.equal(engine.acquire(0).menu.items[1].value, 'Period');
  assert.equal(engine.state().cursor1, c0, 'the cursor did not move');
  engine.press('cursors'); // Measure menu no longer on screen
  assert.equal(engine.mpFunction(), 'Cursor 1');
  engine.turn('mp-knob', 1);
  assert.notEqual(engine.state().cursor1, c0, 'now the knob moves the cursor');
  engine.press('measure');
  assert.equal(engine.acquire(0).menu.items[1].value, 'Period', 'and not the Measure type');
});

test('XY: no automatic measurements; the readouts come back in YT', () => {
  for (const skin of SKIN_IDS) {
    const engine = scope(skin);
    addReadout(engine, 'ch1', 'freq');
    const saved = engine.serialize();
    saved.display.format = 'xy';
    engine.restore(saved);
    assert.equal(engine.disabled('measure'), true, skin);
    const frame = engine.acquire(0);
    assert.ok(!frame.readouts.some((r) => r.id.startsWith('measure')), skin);
    let s = engine.state();
    assert.deepEqual([s.measureCount, s.measure1Type, s.measure1Valid], [1, 'freq', false], skin);
    engine.press('autoset'); // back to YT
    engine.acquire(0);
    s = engine.state();
    assert.equal(engine.disabled('measure'), false);
    assert.equal(s.measure1Valid, true, skin);
  }
});

test('TDS: a slot set to None clears it; readouts survive save/restore and a skin switch', () => {
  const engine = scope('tds2001c');
  addReadout(engine, 'ch1', 'freq');
  addReadout(engine, 'ch1', 'pkpk');
  const again = createEngine(skinProfile('tds2001c'));
  again.restore(engine.serialize());
  assert.deepEqual([again.state().measureCount, again.state().measure2Type], [2, 'pkpk']);
  again.press('measure');
  assert.equal(again.acquire(0).menu.title, 'Measure', 'restore closes any open slot');

  const tbs = switchSkin(engine, skinProfile('tbs2072b'));
  assert.deepEqual([tbs.state().measure1Type, tbs.state().measure2Type], ['freq', 'pkpk']);

  engine.press('measure');
  engine.softkey(1); // open slot 1
  cycleTo(engine, 2, 'None');
  engine.softkey(5);
  const s = engine.state();
  assert.deepEqual([s.measureCount, s.measure1Type], [1, 'pkpk']);
});

test('a clipped trace makes its readouts invalid; rescaling makes them valid again', () => {
  for (const skin of SKIN_IDS) {
    const engine = scope(skin);
    addReadout(engine, 'ch1', 'pkpk');
    addReadout(engine, 'ch1', 'freq');
    engine.apply({ type: 'set', control: 'ch1-scale', value: 0.2 }); // 4 Vpp at 0.2 V/div: 20 div
    const frame = engine.acquire(0);
    assert.equal(frame.traces.ch1.clipped, true, skin);
    let s = engine.state();
    assert.deepEqual([meas(s, 1).valid, meas(s, 1).value, meas(s, 2).valid], [false, null, false], skin);
    engine.apply({ type: 'set', control: 'ch1-scale', value: 1 });
    engine.acquire(0);
    s = engine.state();
    assert.deepEqual([meas(s, 1).valid, meas(s, 2).valid], [true, true], skin);
  }
});
