// Seam 1 (Spec 0002), ticket 03: the two skins drive one engine. Driven only through engine
// events, read through state(), acquire() frames and serialize().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, switchSkin } from '../../../tools/bench-scope/engine/engine.js';
import { DEFAULT_SKIN, SKIN_IDS, skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const withoutSkin = ({ skin, ...rest }) => rest;
const readoutTexts = (frame) => Object.fromEntries(frame.readouts.map((r) => [r.id, r.text]));

test('there are two skins, the TBS2072B by default and the TDS2001C', () => {
  assert.deepEqual([...SKIN_IDS].sort(), ['tbs2072b', 'tds2001c']);
  assert.equal(DEFAULT_SKIN, 'tbs2072b');
  assert.equal(createEngine(skinProfile()).state().skin, 'tbs2072b');
  assert.equal(createEngine(skinProfile('tds2001c')).state().skin, 'tds2001c');
});

test('each skin acquires at its native resolution and graticule', () => {
  const tbs = createEngine(skinProfile('tbs2072b')).acquire(0);
  const tds = createEngine(skinProfile('tds2001c')).acquire(0);
  assert.deepEqual(tbs.screen, { width: 800, height: 480, divX: 15, divY: 8 });
  assert.deepEqual(tds.screen, { width: 320, height: 240, divX: 10, divY: 8 });
  assert.equal(tds.skin, 'tds2001c');
  // The trace spans the TDS graticule: x from 0 to 10 divisions.
  const { x } = tds.traces.ch1;
  assert.equal(x[0], 0);
  assert.equal(x.at(-1), 10);
});

test('the same events on either skin give the same settings and readings', () => {
  const setup = { gen1Freq: 2000, gen1Vpp: 3 };
  const [tbs, tds] = ['tbs2072b', 'tds2001c'].map((id) => createEngine(skinProfile(id), setup));
  const events = [
    { type: 'turn', control: 'ch1-scale', detents: 2 },
    { type: 'turn', control: 'ch1-position', detents: -7 },
    { type: 'press', control: 'ch2-menu' },
    { type: 'turn', control: 'ch2-scale', detents: -1 },
    { type: 'push', control: 'ch1-position' },
    { type: 'turn', control: 'ch1-position', detents: 3 },
    { type: 'setSource', patch: { gen1Wave: 'square', gen1Offset: 0.5 } },
    { type: 'set', control: 'ch2-position', value: -1.2 },
  ];
  for (const e of events) { tbs.apply(e); tds.apply(e); }

  assert.deepEqual(withoutSkin(tds.state()), withoutSkin(tbs.state()));
  assert.equal(tds.state().ch1VPerDiv, 0.2);
  assert.equal(tds.state().ch2Display, true);
  assert.deepEqual(readoutTexts(tds.acquire(0)), readoutTexts(tbs.acquire(0)));
  assert.deepEqual(withoutSkin(tds.serialize()), withoutSkin(tbs.serialize()));
});

test('the skin profile holds the per-skin differences', () => {
  const tbs = skinProfile('tbs2072b');
  const tds = skinProfile('tds2001c');
  assert.equal(tds.model, 'TDS2001C');
  assert.equal(tds.panel, 'tds2001c.svg');
  // Controls only one model has.
  for (const c of ['fine', 'menu-onoff']) assert.ok(tbs.onlyControls.includes(c), c);
  for (const c of ['horiz-menu', 'set-to-zero', 'trig-50', 'trig-view', 'mp-led-left', 'mp-led-right']) {
    assert.ok(tds.onlyControls.includes(c), c);
  }
  assert.ok(!tds.onlyControls.includes('fine'));
  // Where XY lives in the menus.
  assert.deepEqual(tbs.xyMenu, { button: 'acquire', item: 'XY Display' });
  assert.deepEqual(tds.xyMenu, { button: 'display', item: 'Format' });
  // Its own on-screen style: the plot fits the native screen with whole-pixel divisions.
  for (const p of [tbs, tds]) {
    const { plot } = p.style;
    assert.ok(plot.x >= 0 && plot.y >= 0 && plot.x + plot.w <= p.screen.width && plot.y + plot.h <= p.screen.height, p.id);
    assert.ok(Number.isInteger(plot.w / p.screen.divX) && Number.isInteger(plot.h / p.screen.divY), p.id);
  }
  assert.notEqual(tds.style.font, tbs.style.font);
});

test('switching skin keeps the shared settings and reports the new skin', () => {
  const tbs = createEngine(skinProfile('tbs2072b'), { gen1Freq: 500 });
  tbs.turn('ch1-scale', 3);
  tbs.press('ch2-menu');
  tbs.turn('ch2-position', 12);
  const tds = switchSkin(tbs, skinProfile('tds2001c'));
  assert.equal(tds.profile.id, 'tds2001c');
  assert.equal(tds.state().skin, 'tds2001c');
  assert.equal(tds.serialize().skin, 'tds2001c');
  assert.deepEqual(withoutSkin(tds.state()), withoutSkin(tbs.state()));
  // And back.
  const back = switchSkin(tds, skinProfile('tbs2072b'));
  assert.deepEqual(back.state(), tbs.state());
});

test('switching skin clamps out-of-range values to the new skin', () => {
  const tbs = createEngine(skinProfile('tbs2072b'));
  // A saved state from elsewhere, with values outside every range.
  tbs.restore({ v: 1, skin: 'tbs2072b', ch1: { display: true, vPerDiv: 50, position: 9 }, source: { gen1Freq: 1e9 } });
  const tds = switchSkin(tbs, skinProfile('tds2001c'));
  const s = tds.state();
  assert.equal(s.ch1VPerDiv, 5);
  assert.equal(s.ch1Position, 5);
  assert.equal(s.gen1Freq, 100e3);
  // Out-of-range on the TDS: every trace sample stays on the TDS graticule.
  const { y } = tds.acquire(0).traces.ch1;
  assert.ok(y.every((v) => Math.abs(v) <= 4));
});

test('restore ignores a saved skin: the engine keeps the skin it was created with', () => {
  const tds = createEngine(skinProfile('tds2001c'));
  tds.restore({ v: 1, skin: 'tbs2072b' });
  assert.equal(tds.state().skin, 'tds2001c');
});

test('the multipurpose knob has no function until a feature gives it one (the TDS LEDs stay off)', () => {
  for (const id of SKIN_IDS) assert.equal(createEngine(skinProfile(id)).mpFunction(), null, id);
});
