import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plotTheme } from '../../../framework/v1/plot-theme.js';

/** A stand-in element whose computed style has the given custom properties (raw strings). */
function element(props, { connected = true } = {}) {
  const style = { getPropertyValue: (name) => props[name] ?? '' };
  return { isConnected: connected, ownerDocument: { defaultView: { getComputedStyle: () => style } } };
}

// The v1 Refined Cream plot palette (theme.css :root), as plotTheme returns it.
const V1 = {
  background: '#FAF8F2',
  grid: '#DDD5C0',
  axis: '#8B7D5E',
  text: '#5C4F38',
  ink: '#1A1008',
  muted: '#C8BFA0',
  traces: ['#1B4F8A', '#B81C1C', '#E8720C'],
  font: { family: `'Libre Baskerville', Georgia, serif`, size: 13 },
};

test('plotTheme reads the --fw-plot-* tokens at the element into a plot palette and font', () => {
  const el = element({
    '--fw-plot-bg': ' #fffdf0',
    '--fw-plot-grid': ' #eeeeee',
    '--fw-plot-axis': ' #333333',
    '--fw-plot-text': ' #444444',
    '--fw-plot-ink': ' #000000',
    '--fw-plot-muted': ' #999999',
    '--fw-plot-trace-1': ' #007a33',
    '--fw-plot-trace-2': ' #aa0000',
    '--fw-plot-trace-3': ' #ff8800',
    '--fw-plot-font': ' Georgia, serif',
    '--fw-plot-font-size': ' 13px',
  });
  assert.deepEqual(plotTheme(el), {
    background: '#fffdf0', grid: '#eeeeee', axis: '#333333', text: '#444444', ink: '#000000', muted: '#999999',
    traces: ['#007a33', '#aa0000', '#ff8800'], font: { family: 'Georgia, serif', size: 13 },
  });
});

test('plotTheme falls back to the v1 plot palette for a token the page does not set', () => {
  assert.deepEqual(plotTheme(element({ '--fw-plot-trace-1': '#007a33' })),
    { ...V1, traces: ['#007a33', '#B81C1C', '#E8720C'] });
});

test('plotTheme is the v1 plot palette while the element is not in a page', () => {
  assert.deepEqual(plotTheme(element({ '--fw-plot-bg': '#fffdf0' }, { connected: false })), V1);
  assert.deepEqual(plotTheme(null), V1);
});
