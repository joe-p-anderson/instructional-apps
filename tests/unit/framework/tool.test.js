// The Tool contract's panel layout (framework/v1/tool.js): side, strip or banner, default side;
// and its minimum Display width, default 480 px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineTool } from '../../../framework/v1/tool.js';

const tool = (extra = {}) => ({ id: 't', title: 'T', modes: [{ id: 'm' }], mount() {}, ...extra });

test('a Tool without a layout gets the side layout', () => {
  assert.equal(defineTool(tool()).layout, 'side');
});

test('a Tool may declare the side, strip or banner layout', () => {
  for (const layout of ['side', 'strip', 'banner']) assert.equal(defineTool(tool({ layout })).layout, layout);
});

test('any other layout is rejected', () => {
  for (const layout of ['columns', '', 3, null]) {
    assert.throws(() => defineTool(tool({ layout })), /layout/);
  }
});

test('defineTool leaves the definition it is given unchanged', () => {
  const definition = tool();
  const defined = defineTool(definition);
  assert.equal(definition.layout, undefined);
  assert.equal(defined.layout, 'side');
  assert.equal(defined.mount, definition.mount);
});

test('a Tool without a minDisplayWidth gets 480 px', () => {
  assert.equal(defineTool(tool()).minDisplayWidth, 480);
});

test('a Tool may declare a positive minDisplayWidth', () => {
  for (const minDisplayWidth of [320, 600.5]) {
    assert.equal(defineTool(tool({ minDisplayWidth })).minDisplayWidth, minDisplayWidth);
  }
});

test('a minDisplayWidth that is not a positive number is rejected', () => {
  for (const minDisplayWidth of [0, -10, '480', null, NaN, Infinity]) {
    assert.throws(() => defineTool(tool({ minDisplayWidth })), /minDisplayWidth/);
  }
});

test('a Tool without a maxDisplayWidth has none (unlimited)', () => {
  assert.equal(defineTool(tool()).maxDisplayWidth, undefined);
});

test('a Tool may declare a positive maxDisplayWidth no smaller than its minDisplayWidth', () => {
  assert.equal(defineTool(tool({ maxDisplayWidth: 1100 })).maxDisplayWidth, 1100);
  assert.equal(defineTool(tool({ minDisplayWidth: 600, maxDisplayWidth: 600 })).maxDisplayWidth, 600);
});

test('a maxDisplayWidth that is not a positive number is rejected', () => {
  for (const maxDisplayWidth of [0, -10, '900', null, NaN, Infinity]) {
    assert.throws(() => defineTool(tool({ maxDisplayWidth })), /maxDisplayWidth/);
  }
});

test('a maxDisplayWidth smaller than the minDisplayWidth is rejected', () => {
  assert.throws(() => defineTool(tool({ minDisplayWidth: 600, maxDisplayWidth: 599 })), /maxDisplayWidth/);
  // ... including the default minimum of 480 px.
  assert.throws(() => defineTool(tool({ maxDisplayWidth: 400 })), /maxDisplayWidth/);
});

// Setup keys: each Mode declares the State names its mount accepts as a Setup.

test('a Mode may declare its Setup keys as a list of State names', () => {
  const defined = defineTool(tool({ modes: [{ id: 'm', setupKeys: ['f', 'amp'] }, { id: 'n', setupKeys: [] }] }));
  assert.deepEqual(defined.modes.map((m) => m.setupKeys), [['f', 'amp'], []]);
});

test('Setup keys that are not a list of State names are rejected', () => {
  for (const setupKeys of ['f', null, {}, [1], ['f', ''], ['f', null], ['f', 'f']]) {
    assert.throws(() => defineTool(tool({ modes: [{ id: 'm', setupKeys }] })), /modes\[0\]\.setupKeys/);
  }
});
