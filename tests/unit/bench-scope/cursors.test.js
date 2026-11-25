// Seam 1 (Spec 0002), ticket 09: time and amplitude cursors, driven only through engine events
// and read through acquire() frames, state() and serialize().
//
// Cursor menu (the `cursors` button, both skins): 1 Type (Off → Time → Amplitude), 2 Source
// (CH1 ⇄ CH2), 3 Cursor 1, 4 Cursor 2 (select which cursor the multipurpose knob moves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { SKIN_IDS, skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const tbs = () => skinProfile('tbs2072b');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

/** An engine with time cursors on (Cursor menu, Type pressed once). */
function timeCursors(profile = tbs()) {
  const engine = createEngine(profile);
  engine.press('cursors');
  engine.softkey(1);
  return engine;
}

test('cursors are off by default; the Type softkey turns on time cursors', () => {
  for (const skin of SKIN_IDS) {
    const engine = createEngine(skinProfile(skin));
    assert.equal(engine.state().cursorMode, 'off', skin);
    assert.equal(engine.state().cursorDt, null, skin);
    engine.press('cursors');
    assert.equal(engine.acquire(0).menu.title, 'Cursor', skin);
    engine.softkey(1);
    const s = engine.state();
    assert.equal(s.cursorMode, 'time', skin);
    assert.ok(s.cursorDt > 0, `${skin}: Δt is positive`);
  }
});

test('multipurpose knob turns move the selected cursor and Δt follows', () => {
  const engine = timeCursors();
  engine.apply({ type: 'set', control: 'hor-scale', value: 200e-6 });
  const s0 = engine.state();
  engine.turn('mp-knob', 10); // 10 × 0.1 div = 1 div = 200 µs
  const s1 = engine.state();
  near(s1.cursor1 - s0.cursor1, 200e-6, 1e-12, 'cursor 1 moved one division');
  assert.equal(s1.cursor2, s0.cursor2, 'cursor 2 stayed');
  near(s1.cursorDt, s0.cursorDt - 200e-6, 1e-12, 'Δt shrank by 200 µs');
  near(s1.cursorInvDt, 1 / s1.cursorDt, 1e-9, '1/Δt');

  engine.softkey(4); // select Cursor 2
  assert.equal(engine.state().cursorSelected, 2);
  engine.turn('mp-knob', -5);
  const s2 = engine.state();
  assert.equal(s2.cursor1, s1.cursor1, 'cursor 1 stayed');
  near(s2.cursor2 - s1.cursor2, -100e-6, 1e-12, 'cursor 2 moved left half a division');
});

test('Fine (TBS) makes each knob detent move the cursor a fifth as far', () => {
  const coarse = timeCursors();
  const fine = timeCursors();
  fine.press('fine');
  assert.equal(fine.state().cursorFine, true);
  const c0 = coarse.state().cursor1;
  const f0 = fine.state().cursor1;
  coarse.turn('mp-knob', 3);
  fine.turn('mp-knob', 3);
  const dc = coarse.state().cursor1 - c0;
  const df = fine.state().cursor1 - f0;
  assert.ok(df > 0, 'fine still moves');
  near(df, dc / 5, 1e-12, 'fine step');
  fine.press('fine');
  assert.equal(fine.state().cursorFine, false, 'a second press turns Fine off');
});

test('pushing the multipurpose knob (TBS select) switches the selected cursor', () => {
  const engine = timeCursors();
  assert.equal(engine.state().cursorSelected, 1);
  engine.push('mp-knob');
  assert.equal(engine.state().cursorSelected, 2);
  const s0 = engine.state();
  engine.turn('mp-knob', 2);
  assert.equal(engine.state().cursor1, s0.cursor1);
  assert.notEqual(engine.state().cursor2, s0.cursor2);
});

test('a cursor stops at the edge of the screen', () => {
  for (const skin of SKIN_IDS) {
    const profile = skinProfile(skin);
    const engine = timeCursors(profile);
    engine.turn('mp-knob', -1000);
    const x = engine.acquire(0).cursors.lines[0].pos;
    assert.equal(x, 0, `${skin}: left edge`);
    engine.turn('mp-knob', 5000);
    assert.equal(engine.acquire(0).cursors.lines[0].pos, profile.screen.divX, `${skin}: right edge`);
  }
});

test('amplitude cursors read ΔV on the chosen source, in displayed volts', () => {
  const engine = timeCursors();
  engine.softkey(1); // Time → Amplitude
  assert.equal(engine.state().cursorMode, 'amplitude');
  assert.equal(engine.state().cursorDt, null, 'no Δt for amplitude cursors');
  engine.apply({ type: 'set', control: 'cursor-1', value: 1 });
  engine.apply({ type: 'set', control: 'cursor-2', value: -1 });
  near(engine.state().cursorDv, 2, 1e-9, 'ΔV at 1 V/div');
  engine.apply({ type: 'set', control: 'ch1-scale', value: 0.5 });
  near(engine.state().cursorDv, 1, 1e-9, 'same screen positions at 0.5 V/div read half');

  engine.softkey(2); // Source → CH2
  assert.equal(engine.state().cursorSource, 'ch2');
  engine.press('ch2-menu'); // CH2 on, its menu opens
  engine.softkey(3); // CH2 probe 10×
  near(engine.state().cursorDv, 20, 1e-9, '2 div on CH2 at 1 V/div with a 10× probe');
  engine.press('cursors');
  engine.turn('mp-knob', 10); // cursor 1 up a division
  near(engine.state().cursorDv, 30, 1e-9, 'one more division apart = 10 V more');
  const frame = engine.acquire(0);
  assert.equal(frame.cursors.channel, 'ch2');
  assert.deepEqual(frame.cursors.lines.map((l) => l.axis), ['y', 'y']);
  assert.ok(frame.readouts.find((r) => r.id === 'cursor-dv'), 'ΔV readout on screen');
});

test('the frame has the cursor lines and Δt / 1/Δt readouts that follow the knob', () => {
  const engine = timeCursors();
  assert.equal(createEngine(tbs()).acquire(0).cursors, null, 'no cursors when off');
  const f0 = engine.acquire(0);
  assert.deepEqual(f0.cursors.lines.map((l) => [l.id, l.axis]), [['cursor-1', 'x'], ['cursor-2', 'x']]);
  const text = (f, id) => f.readouts.find((r) => r.id === id)?.text;
  assert.match(text(f0, 'cursor-dt'), /^Δt /);
  assert.match(text(f0, 'cursor-inv'), /^1\/Δt .*Hz$/);
  engine.turn('mp-knob', 7);
  const f1 = engine.acquire(0);
  assert.notEqual(text(f1, 'cursor-dt'), text(f0, 'cursor-dt'));
  near(f1.cursors.lines[0].pos - f0.cursors.lines[0].pos, 0.7, 1e-9, 'line moved 0.7 div');
});

test('the multipurpose knob function is the selected cursor while cursors are on', () => {
  const engine = createEngine(skinProfile('tds2001c'));
  assert.equal(engine.mpFunction(), null);
  engine.press('cursors');
  engine.softkey(1);
  assert.equal(engine.mpFunction(), 'Cursor 1');
  engine.softkey(4);
  assert.equal(engine.mpFunction(), 'Cursor 2');
  engine.softkey(1);
  engine.softkey(1); // Amplitude → Off
  assert.equal(engine.mpFunction(), null);
});

test('in XY the cursors are disabled: no input, nothing drawn, no Δ values', () => {
  const engine = timeCursors();
  engine.restore({ ...engine.serialize(), display: { format: 'xy' } }); // XY, as ticket 10 sets it
  assert.equal(engine.state().displayFormat, 'xy');
  assert.equal(engine.state().cursorMode, 'time', 'the cursor type is kept');
  assert.equal(engine.state().cursorDt, null);
  assert.equal(engine.mpFunction(), null, 'the knob has no cursor function');
  const before = engine.serialize().cursors;
  engine.turn('mp-knob', 5);
  engine.push('mp-knob');
  engine.press('cursors');
  engine.softkey(1);
  assert.deepEqual(engine.serialize().cursors, before, 'input ignored');
  const frame = engine.acquire(0);
  assert.equal(frame.cursors, null);
  assert.equal(frame.menu, null, 'the Cursor menu does not open');
  assert.ok(!frame.readouts.some((r) => r.id.startsWith('cursor')));
  engine.restore({ ...engine.serialize(), display: { format: 'yt' } });
  assert.ok(engine.state().cursorDt > 0, 'back in YT the cursors return');
});

test('cursor type, source and positions are saved; restore and a skin switch keep them within the screen', () => {
  const engine = timeCursors();
  engine.turn('mp-knob', 50); // cursor 1 from -2 to +3 div about the centre
  const saved = engine.serialize();
  const back = createEngine(tbs());
  back.restore(saved);
  assert.deepEqual(back.state(), engine.state());
  const tds = createEngine(skinProfile('tds2001c'));
  tds.restore(saved);
  const lines = tds.acquire(0).cursors.lines;
  assert.ok(lines.every((l) => l.pos >= 0 && l.pos <= 10), 'within the TDS 10 divisions');
  const junk = createEngine(tbs());
  junk.restore({ cursors: { mode: 'sideways', time: ['x', 99] } });
  assert.equal(junk.state().cursorMode, 'off');
});

test('1/Δt with the cursors one period apart reads the true frequency', () => {
  for (const skin of SKIN_IDS) {
    const engine = timeCursors(skinProfile(skin));
    engine.setSource({ gen1Freq: 1000 });
    engine.apply({ type: 'set', control: 'hor-scale', value: 500e-6 }); // a period is 2 div
    engine.apply({ type: 'set', control: 'cursor-1', value: 0 }); // on the trigger point
    engine.apply({ type: 'set', control: 'cursor-2', value: 1e-3 }); // one period later
    const s = engine.state();
    near(s.cursorDt, 1e-3, 1e-12, `${skin}: Δt`);
    near(s.cursorInvDt, s.ch1TrueFreq, 1e-6, `${skin}: 1/Δt`);
  }
});
