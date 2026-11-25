// Seam 1 (Spec 0002), ticket 10: the XY display, driven only through engine events and read
// through acquire() frames, state() and serialize().
//
// Menu paths under test:
//   TDS2001C  Display button → softkey 3 Format (YT ⇄ XY)       (the real menu's Format slot)
//   TBS2072B  Acquire button → softkey 6 XY Display (Off ⇄ On); softkeys 1–5 greyed
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { SKIN_IDS, skinProfile } from '../../../tools/bench-scope/engine/skins.js';

/** An engine of `skin` switched to XY through its own menu. */
function xyEngine(skin, setup) {
  const engine = createEngine(skinProfile(skin), setup);
  enterXY(engine);
  return engine;
}
function enterXY(engine) {
  if (engine.profile.id === 'tds2001c') { engine.press('display'); engine.softkey(3); } else { engine.press('acquire'); engine.softkey(6); }
}

test('TDS: the Display button opens a menu holding only Format, which toggles YT ⇄ XY', () => {
  const engine = createEngine(skinProfile('tds2001c'));
  assert.equal(engine.state().displayFormat, 'yt');
  engine.press('display');
  const menu = engine.acquire(0).menu;
  assert.equal(menu.title, 'Display');
  assert.deepEqual(menu.items.filter(Boolean).map((it) => it.label), ['Format']);
  assert.equal(menu.items[2].value, 'YT');
  engine.softkey(3);
  assert.equal(engine.state().displayFormat, 'xy');
  assert.equal(engine.acquire(0).menu.items[2].value, 'XY');
  engine.softkey(3);
  assert.equal(engine.state().displayFormat, 'yt');
});

test('TBS: the Acquire side menu has XY Display On/Off active and the other items greyed', () => {
  const engine = createEngine(skinProfile('tbs2072b'));
  engine.press('acquire');
  const menu = engine.acquire(0).menu;
  assert.equal(menu.title, 'Acquire');
  assert.deepEqual(menu.items.slice(0, 6).map((it) => it.label),
    ['Mode', 'Record Length', 'Delay', 'Set Horizontal Position', 'Waveform Display', 'XY Display']);
  assert.deepEqual(menu.items.slice(0, 6).map((it) => it.disabled), [true, true, true, true, true, false]);
  assert.equal(menu.items[5].value, 'Off');
  const before = JSON.stringify(engine.serialize());
  for (let n = 1; n <= 5; n++) engine.softkey(n);
  assert.equal(JSON.stringify(engine.serialize()), before, 'greyed items do nothing');
  engine.softkey(6);
  assert.equal(engine.state().displayFormat, 'xy');
  assert.equal(engine.acquire(0).menu.items[5].value, 'On');
  engine.softkey(6);
  assert.equal(engine.state().displayFormat, 'yt');
});

test('each skin only has its own XY path (TDS has no Acquire menu, TBS no Display menu)', () => {
  const tds = createEngine(skinProfile('tds2001c'));
  tds.press('acquire');
  assert.equal(tds.acquire(0).menu, null);
  const tbs = createEngine(skinProfile('tbs2072b'));
  tbs.press('display');
  assert.equal(tbs.acquire(0).menu, null);
});

test('in XY, an independent CH2 at the same frequency, 90° out of phase, draws a circle', () => {
  for (const skin of SKIN_IDS) {
    const engine = xyEngine(skin);
    engine.press('ch2-menu'); // CH2 on
    engine.setSource({ gen1Vpp: 2, ch2Source: 'independent', gen2Freq: 1000, gen2Vpp: 2, gen2Phase: 90 });
    const frame = engine.acquire(0);
    assert.ok(frame.xy, `${skin}: an XY trace`);
    assert.deepEqual(frame.traces, {}, 'no YT traces');
    const { x, y } = frame.xy;
    const cx = frame.screen.divX / 2;
    // Both 2 Vpp at 1 V/div: radius 1 div about the screen centre (noise 8 mV ≈ 0.01 div).
    const r = x.map((xi, i) => Math.hypot(xi - cx, y[i]));
    for (const ri of r) assert.ok(Math.abs(ri - 1) < 0.05, `${skin}: radius ${ri}`);
    // The figure goes all the way round: points in every quadrant.
    const quads = new Set(x.map((xi, i) => `${xi > cx}${y[i] > 0}`));
    assert.equal(quads.size, 4, `${skin}: all four quadrants`);
  }
});

test('in XY each channel uses its own V/div and position; in phase gives a line', () => {
  const engine = xyEngine('tbs2072b');
  engine.press('ch2-menu');
  engine.setSource({ gen1Vpp: 2, ch2Source: 'copy' });
  engine.apply({ type: 'set', control: 'ch1-scale', value: 0.5 }); // X: ±2 div
  engine.apply({ type: 'set', control: 'ch2-position', value: 1 }); // Y: up 1 div
  const { x, y } = engine.acquire(0).xy;
  const cx = engine.profile.screen.divX / 2;
  const xs = x.map((v) => v - cx);
  assert.ok(Math.abs(Math.max(...xs) - 2) < 0.05 && Math.abs(Math.min(...xs) + 2) < 0.05, 'CH1 ±1 V at 0.5 V/div');
  assert.ok(Math.abs(Math.max(...y) - 2) < 0.05 && Math.abs(Math.min(...y) - 0) < 0.05, 'CH2 ±1 V at 1 V/div, +1 div');
  // A straight line: y − 1 = x / 2.
  xs.forEach((xi, i) => assert.ok(Math.abs(y[i] - 1 - xi / 2) < 0.05));
});

test('in XY, the time base and trigger controls ignore events; Run/Stop still works', () => {
  for (const skin of SKIN_IDS) {
    const engine = xyEngine(skin);
    const before = JSON.stringify(engine.serialize());
    engine.turn('hor-scale', 3);
    engine.turn('hor-position', 5);
    engine.push('hor-position');
    engine.press('set-to-zero');
    engine.turn('trig-level', 10);
    engine.push('trig-level');
    engine.press('trig-50');
    engine.press('force-trig');
    engine.apply({ type: 'hold', control: 'trig-view' });
    assert.equal(engine.value('trig-view'), false, `${skin}: Trig View stays off`);
    engine.press('trig-menu');
    engine.press('horiz-menu');
    assert.notEqual(engine.acquire(0).menu?.id, 'trigger', 'the Trigger menu does not open');
    assert.notEqual(engine.acquire(0).menu?.id, 'horiz', 'the Horiz menu does not open');
    assert.equal(JSON.stringify(engine.serialize()), before, `${skin}: nothing changed`);
    engine.press('run-stop');
    assert.equal(engine.state().runState, 'stopped', 'Run/Stop still works');
  }
});

test('in XY the trigger and time-base readouts and markers are gone; back in YT they return', () => {
  const engine = xyEngine('tds2001c');
  let frame = engine.acquire(0);
  assert.equal(frame.readouts.find((r) => r.id === 'timebase'), undefined);
  assert.equal(frame.readouts.find((r) => r.id === 'trigger'), undefined);
  assert.equal(frame.markers.triggerLevel, undefined);
  assert.equal(frame.markers.triggerPoint, undefined);
  enterXY(engine); // the same softkey toggles back to YT
  frame = engine.acquire(0);
  assert.equal(engine.state().displayFormat, 'yt');
  assert.ok(frame.readouts.find((r) => r.id === 'timebase'));
  assert.ok(frame.markers.triggerLevel);
  assert.equal(frame.xy, undefined);
  engine.turn('hor-scale', 1);
  assert.notEqual(engine.state().hScale, 1e-3, 'the time base works again');
});

test('a stopped XY display holds its figure', () => {
  const engine = xyEngine('tbs2072b');
  engine.press('ch2-menu');
  engine.setSource({ ch2Source: 'independent', gen2Freq: 1000, gen2Phase: 90 });
  engine.acquire(0);
  engine.press('run-stop');
  const held = engine.acquire(0).xy;
  assert.ok(held, 'the figure is still drawn');
  assert.deepEqual(engine.acquire(1234.5).xy, held);
});

test('Autoset in XY returns to YT', () => {
  for (const skin of SKIN_IDS) {
    const engine = xyEngine(skin);
    assert.equal(engine.state().displayFormat, 'xy');
    engine.press('autoset');
    assert.equal(engine.state().displayFormat, 'yt', skin);
    assert.equal(engine.acquire(0).xy, undefined);
  }
});

test('the XY format survives serialize/restore, and restore closes the menu', () => {
  const engine = xyEngine('tds2001c');
  const other = createEngine(skinProfile('tds2001c'));
  other.restore(engine.serialize());
  assert.equal(other.state().displayFormat, 'xy');
  assert.equal(other.acquire(0).menu, null);
  other.turn('hor-scale', 2);
  assert.equal(other.state().hScale, 1e-3, 'still disabled after restore');
});
