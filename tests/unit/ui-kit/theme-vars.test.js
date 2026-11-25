// Framework v1 UI kit: themeVars(el, names), the one reader of theme variables for drawing
// colours (canvas, SVG, Plotly). Runs in Node with a stand-in element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeVars } from '../../../framework/v1/ui-kit.js';

/** A stand-in element whose computed style has the given custom properties. */
function element(props, { connected = true } = {}) {
  const style = { getPropertyValue: (name) => props[name] ?? '' };
  return { isConnected: connected, ownerDocument: { defaultView: { getComputedStyle: () => style } } };
}

test('reads each named variable as computed at the element, trimmed', () => {
  const el = element({ '--fw-blue': ' #123456', '--fw-text': '#000000 ' });
  assert.deepEqual(themeVars(el, { accent: '--fw-blue', ink: '--fw-text' }), { accent: '#123456', ink: '#000000' });
});

test('falls back to the v1 palette for a variable the page does not set', () => {
  const el = element({ '--fw-blue': '#123456' });
  assert.deepEqual(themeVars(el, { accent: '--fw-blue', bad: '--fw-red', paper: '--fw-paper' }),
    { accent: '#123456', bad: '#B81C1C', paper: '#FFFFFF' });
});

test('uses the v1 palette while the element is not in a page', () => {
  const el = element({ '--fw-blue': '#123456' }, { connected: false });
  assert.deepEqual(themeVars(el, { accent: '--fw-blue', surface: '--fw-surface' }), { accent: '#1B4F8A', surface: '#FAF8F2' });
  assert.deepEqual(themeVars(null, { ink: '--fw-text' }), { ink: '#1A1008' });
});
