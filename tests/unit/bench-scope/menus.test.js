// Seam 1 (Spec 0002), ticket 05: the softkey menus (CH and Trigger, TDS Horiz, Trig View),
// driven only through engine events and read through acquire() frames, state() and serialize().
//
// Softkey layout under test (the same on both skins):
//   CH menu       1 Coupling (DC → AC → GND), 2 BW Limit (Off/On), 3 Probe (1× ⇄ 10×), 4 Invert (Off/On)
//   Trigger menu  1 Type (Edge), 2 Source (CH1 ⇄ CH2), 3 Slope (Rising ⇄ Falling), 4 Mode (Auto ⇄ Normal)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, switchSkin } from '../../../tools/bench-scope/engine/engine.js';
import { SKIN_IDS, skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const tbs = () => skinProfile('tbs2072b');
const readout = (frame, id) => frame.readouts.find((r) => r.id === id);
const volts = (tr) => tr.y.map((y) => (y - tr.position) * tr.vPerDiv);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const rms = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

test('softkey sequences in the CH1 menu change coupling, BW limit, probe and invert', () => {
  for (const skin of SKIN_IDS) {
    const engine = createEngine(skinProfile(skin));
    const s0 = engine.state();
    assert.deepEqual([s0.ch1Coupling, s0.ch1BwLimit, s0.ch1Probe, s0.ch1Invert], ['dc', false, 1, false], skin);
    engine.press('ch1-menu');
    assert.ok(engine.acquire(0).menu, `${skin}: the CH1 menu is on screen`);
    assert.equal(engine.state().ch1Display, true, 'opening the menu leaves CH1 on');
    engine.softkey(1);
    assert.equal(engine.state().ch1Coupling, 'ac');
    engine.softkey(1);
    assert.equal(engine.state().ch1Coupling, 'gnd');
    engine.softkey(1);
    assert.equal(engine.state().ch1Coupling, 'dc');
    engine.softkey(2);
    engine.softkey(3);
    engine.softkey(4);
    const s = engine.state();
    assert.deepEqual([s.ch1BwLimit, s.ch1Probe, s.ch1Invert], [true, 10, true], skin);
    assert.equal(s.ch2Coupling, 'dc', 'CH2 untouched');
  }
});

test('softkeys do nothing with no menu open', () => {
  const engine = createEngine(tbs());
  const before = JSON.stringify(engine.state());
  for (let n = 1; n <= 7; n++) engine.softkey(n);
  assert.equal(JSON.stringify(engine.state()), before);
  assert.equal(engine.acquire(0).menu, null);
});

test('a CH menu button opens its menu; pressed again while that menu shows, it turns the channel off', () => {
  const engine = createEngine(tbs());
  engine.press('ch1-menu');
  assert.equal(engine.state().ch1Display, true);
  assert.ok(engine.acquire(0).menu);
  engine.press('ch1-menu');
  assert.equal(engine.state().ch1Display, false, 'second press: CH1 off');
  assert.equal(engine.acquire(0).menu, null, 'and its menu closes');
  engine.press('ch1-menu');
  assert.equal(engine.state().ch1Display, true, 'a third press turns it back on');
  // From another menu, the CH2 button opens the CH2 menu (turning CH2 on); CH1 stays on.
  engine.press('ch2-menu');
  assert.deepEqual([engine.state().ch1Display, engine.state().ch2Display], [true, true]);
  engine.softkey(1);
  assert.deepEqual([engine.state().ch1Coupling, engine.state().ch2Coupling], ['dc', 'ac'], 'softkeys now act on CH2');
  engine.press('ch1-menu');
  assert.equal(engine.state().ch1Display, true, 'CH1 menu not showing: the press only opens it');
});

test('AC coupling removes the DC offset; GND is a flat line at the channel ground', () => {
  const engine = createEngine(tbs(), { gen1Offset: 1.5, gen1Vpp: 2 });
  engine.apply({ type: 'set', control: 'hor-scale', value: 200e-6 }); // a few cycles of 1 kHz
  assert.ok(Math.abs(mean(volts(engine.acquire(0).traces.ch1)) - 1.5) < 0.05, 'DC: mean is the offset');
  engine.press('ch1-menu');
  engine.softkey(1); // AC
  const ac = volts(engine.acquire(0).traces.ch1);
  assert.ok(Math.abs(mean(ac)) < 0.05, `AC: mean ${mean(ac)}`);
  assert.ok(Math.max(...ac) - Math.min(...ac) > 1.9, 'the AC part is still there');
  engine.softkey(1); // GND
  engine.turn('ch1-position', 10); // ground one division up
  const tr = engine.acquire(0).traces.ch1;
  assert.ok(tr.y.every((y) => Math.abs(y - 1) < 1e-9), 'flat at the channel position');
});

test('a 10× probe setting scales the V/div readout and what the scope reads, not the trace on screen', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 2 });
  const before = engine.acquire(0).traces.ch1;
  assert.equal(readout(engine.acquire(0), 'ch1-scale').text, '1.00V');
  engine.press('ch1-menu');
  engine.softkey(3);
  assert.equal(engine.state().ch1Probe, 10);
  const frame = engine.acquire(0);
  assert.equal(readout(frame, 'ch1-scale').text, '10.0V');
  const tr = frame.traces.ch1;
  assert.equal(tr.vPerDiv, 10);
  const v = volts(tr);
  assert.ok(Math.abs(Math.max(...v) - Math.min(...v) - 20) < 1, 'reads 20 Vpp for a 2 Vpp signal');
  assert.ok(tr.y.every((y, i) => Math.abs(y - before.y[i]) < 0.02), 'the trace does not move');
});

/** Screen x (divisions) of the first crossing of `level` with the given slope in a trace's volts. */
function firstCrossing(tr, slope, level = 0) {
  const v = volts(tr);
  const s = slope === 'falling' ? -1 : 1;
  for (let i = 1; i < v.length; i++) {
    if (s * (v[i - 1] - level) < 0 && s * (v[i] - level) >= 0) return tr.x[i];
  }
  return NaN;
}

test('the Trigger menu sets source, slope and mode; rising and falling trigger on opposite edges', () => {
  for (const skin of SKIN_IDS) {
    const engine = createEngine(skinProfile(skin), { gen1Freq: 100 }); // 10 ms period
    const centre = skinProfile(skin).screen.divX / 2;
    engine.press('trig-menu');
    assert.equal(engine.acquire(0).menu.items.length >= 4, true);
    const rise = engine.acquire(0).traces.ch1;
    assert.ok(Math.abs(rise.y[Math.round(((rise.x.length - 1) * centre) / skinProfile(skin).screen.divX)]) < 0.1);
    engine.softkey(3); // slope
    assert.equal(engine.state().trigSlope, 'falling', skin);
    const fall = engine.acquire(0).traces.ch1;
    const i = Math.round(((fall.x.length - 1) * centre) / skinProfile(skin).screen.divX);
    // Just after the centre the trace rises on a rising trigger and falls on a falling one.
    assert.ok(rise.y[i + 5] > rise.y[i - 5], `${skin}: rising edge at the trigger point`);
    assert.ok(fall.y[i + 5] < fall.y[i - 5], `${skin}: falling edge at the trigger point`);
    assert.ok(Math.abs(firstCrossing(fall, 'falling') - centre) < 0.1);
    engine.softkey(2);
    assert.equal(engine.state().trigSource, 'ch2');
    engine.softkey(4);
    assert.equal(engine.state().trigMode, 'normal');
    engine.softkey(4);
    assert.equal(engine.state().trigMode, 'auto');
  }
});

test('Normal mode with no valid crossing waits and keeps the last frame', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 2 });
  engine.press('trig-menu');
  engine.softkey(4); // Normal
  const first = engine.acquire(0);
  assert.equal(first.status, 'triggered');
  engine.turn('trig-level', 50); // 2 div: 2 V, above the 1 V peak
  const waiting = engine.acquire(137);
  assert.equal(waiting.status, 'waiting');
  assert.deepEqual(waiting.traces.ch1.y, first.traces.ch1.y, 'the last capture stays on screen');
  engine.softkey(4); // back to Auto: free-runs
  assert.equal(engine.acquire(200).status, 'auto');
});

test('Menu On/Off (TBS) hides and shows the menu; softkeys do nothing while it is hidden', () => {
  const engine = createEngine(tbs());
  engine.press('ch1-menu');
  engine.press('menu-onoff');
  assert.equal(engine.acquire(0).menu, null);
  engine.softkey(1);
  assert.equal(engine.state().ch1Coupling, 'dc');
  engine.press('ch1-menu'); // menu hidden: the button brings it back rather than turning CH1 off
  assert.equal(engine.state().ch1Display, true);
  assert.equal(engine.acquire(0).menu.title, 'CH1');
  engine.press('menu-onoff');
  engine.press('menu-onoff');
  assert.ok(engine.acquire(0).menu);
});

test('the TDS Horiz menu opens from its button; the TBS has none', () => {
  const tds = createEngine(skinProfile('tds2001c'));
  tds.press('horiz-menu');
  const menu = tds.acquire(0).menu;
  assert.ok(menu && menu.items.some((it) => it && /main/i.test(`${it.label} ${it.value}`)));
  const before = JSON.stringify(tds.state());
  for (let n = 1; n <= 5; n++) tds.softkey(n);
  assert.equal(JSON.stringify(tds.state()), before, 'its items only show the one time base');
});

test('menu state is not saved: restore and a skin switch close the menu, settings stay', () => {
  const engine = createEngine(tbs());
  engine.press('ch1-menu');
  engine.softkey(1);
  engine.softkey(3);
  const saved = JSON.parse(JSON.stringify(engine.serialize()));
  const b = createEngine(tbs());
  b.restore(saved);
  assert.equal(b.acquire(0).menu, null);
  assert.deepEqual([b.state().ch1Coupling, b.state().ch1Probe], ['ac', 10]);
  engine.restore(saved);
  assert.equal(engine.acquire(0).menu, null, 'restore closes the open menu');
  engine.press('trig-menu');
  const tds = switchSkin(engine, skinProfile('tds2001c'));
  assert.equal(tds.acquire(0).menu, null, 'switching skin closes it');
  assert.deepEqual([tds.state().ch1Coupling, tds.state().ch1Probe], ['ac', 10]);
  b.restore({ ch1: { coupling: 'xx', probe: 3, bwLimit: 'y', invert: 1 } });
  const s = b.state();
  assert.deepEqual([s.ch1Coupling, s.ch1Probe, s.ch1BwLimit, s.ch1Invert], ['dc', 1, false, false], 'junk is ignored');
});

test('TDS Trig View shows the trigger signal in place of the channels while held', () => {
  const engine = createEngine(skinProfile('tds2001c'), { gen1Offset: 1, ch2Source: 'copy' });
  engine.press('ch1-menu');
  engine.softkey(1); // CH1 AC: the trace loses its offset
  engine.press('ch1-menu'); // CH1 off
  const off = engine.acquire(0);
  assert.equal(off.traces.ch1, undefined);
  engine.apply({ type: 'hold', control: 'trig-view' });
  const held = engine.acquire(0);
  assert.ok(held.traces.ch1, 'the CH1 trigger signal is shown although CH1 is off');
  assert.ok(Math.abs(mean(volts(held.traces.ch1))) < 0.1, 'the trigger sees the conditioned (AC) signal');
  engine.apply({ type: 'release', control: 'trig-view' });
  assert.equal(engine.acquire(0).traces.ch1, undefined);
});

test('Autoset sets DC coupling and works in displayed volts with a 10× probe and invert', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 2, gen1Offset: 1 });
  engine.press('ch1-menu');
  engine.softkey(1); // AC
  engine.softkey(3); // 10×
  engine.softkey(4); // invert
  engine.press('autoset');
  const s = engine.state();
  assert.equal(s.ch1Coupling, 'dc');
  assert.equal(s.ch1VPerDiv, 0.5, 'knob V/div for 2 Vpp at the BNC (4 div)');
  // Displayed signal: -10 × (1 ± 1 V) = -20..0 V; its 50% level is -10 V and the trace is centred.
  assert.ok(Math.abs(s.trigLevel + 10) < 0.05, `level ${s.trigLevel}`);
  assert.ok(engine.state().traceStable);
  const v = volts(engine.acquire(0).traces.ch1);
  assert.ok(Math.abs(mean(v) + 10) < 0.5, `centred on -10 V (mean ${mean(v)})`);
  assert.equal(engine.acquire(0).traces.ch1.clipped, false);
});

test('invert flips the trace; BW limit visibly lowers the noise', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 0, gen1Offset: 0.04 });
  engine.turn('ch1-scale', 5); // 1 V → 20 mV/div: noise is visible
  const plain = volts(engine.acquire(0).traces.ch1);
  engine.press('ch1-menu');
  engine.softkey(4); // invert
  const inv = volts(engine.acquire(0).traces.ch1);
  assert.ok(Math.abs(mean(inv) + 0.04) < 0.005, `inverted mean ${mean(inv)}`);
  engine.softkey(4);
  engine.softkey(2); // BW limit
  const bw = volts(engine.acquire(0).traces.ch1);
  assert.ok(rms(bw) < 0.6 * rms(plain), `noise ${rms(plain)} → ${rms(bw)}`);
  assert.match(readout(engine.acquire(0), 'ch1-scale').text, /B/);
});

test('BW limit is a gentle low-pass on the samples: square edges are rounded, a sine keeps its size', () => {
  for (const skin of SKIN_IDS) {
    const engine = createEngine(skinProfile(skin), { gen1Wave: 'square', gen1Freq: 1000, gen1Vpp: 2 });
    engine.apply({ type: 'set', control: 'hor-scale', value: 200e-6 });
    const maxStep = (v) => Math.max(...v.slice(1).map((y, i) => Math.abs(y - v[i])));
    const plain = volts(engine.acquire(0).traces.ch1);
    engine.press('ch1-menu');
    engine.softkey(2); // BW limit on
    const bw = volts(engine.acquire(0).traces.ch1);
    assert.ok(maxStep(plain) > 1.8, `${skin}: an ideal edge is one sample (${maxStep(plain)} V)`);
    assert.ok(maxStep(bw) < 0.8, `${skin}: the edge spreads over several samples (${maxStep(bw)} V)`);
    assert.deepEqual(engine.acquire(0).traces.ch1.y, engine.acquire(0).traces.ch1.y, `${skin}: deterministic`);
    engine.setSource({ gen1Wave: 'sine' });
    const pk = (v) => Math.max(...v) - Math.min(...v);
    const sine = pk(volts(engine.acquire(0).traces.ch1));
    assert.ok(Math.abs(sine - 2) < 0.06, `${skin}: sine pk-pk ${sine} V with BW limit`);
  }
});
