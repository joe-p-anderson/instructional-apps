// The Tool contract's panel layout (framework/v1/tool.js): side, strip or banner, default side.
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
