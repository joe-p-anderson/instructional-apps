// plotlyMapping(plotDiv): the one map between a Plotly plot's data coordinates and client pixels.
// Runs in Node with a stand-in plot div (Plotly's laid-out axes as plain linear maps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plotlyMapping } from '../../../framework/v1/plot-map.js';

/**
 * A plot div at client (100, 50), 400 px wide, whose plot area starts 60 px in and 20 px down;
 * x runs 0..10 over 300 px and y runs 0..5 over 200 px (upwards).
 */
function plotDiv({ laidOut = true, shown = true, width = 400 } = {}) {
  const xaxis = { _offset: 60, d2p: (x) => x * 30, p2d: (px) => px / 30 };
  const yaxis = { _offset: 20, d2p: (y) => 200 - y * 40, p2d: (px) => (200 - px) / 40 };
  return {
    _fullLayout: laidOut ? { width, xaxis, yaxis } : undefined,
    offsetParent: shown ? {} : null,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 100, top: 50 }),
  };
}

test('toScreen gives the client pixel of a data point', () => {
  assert.deepEqual(plotlyMapping(plotDiv()).toScreen(5, 2.5), { x: 100 + 60 + 150, y: 50 + 20 + 100 });
});

test('fromScreen gives the data point under a client pixel (the inverse of toScreen)', () => {
  assert.deepEqual(plotlyMapping(plotDiv()).fromScreen(310, 170), { x: 5, y: 2.5 });
});

test('both are null until the plot is laid out', () => {
  const map = plotlyMapping(plotDiv({ laidOut: false }));
  assert.equal(map.toScreen(5, 2.5), null);
  assert.equal(map.fromScreen(310, 170), null);
});

test('toScreen is null while the plot is hidden or its layout is stale (box resized, not yet redrawn)', () => {
  assert.equal(plotlyMapping(plotDiv({ shown: false })).toScreen(5, 2.5), null);
  assert.equal(plotlyMapping(plotDiv({ width: 380 })).toScreen(5, 2.5), null);
});
