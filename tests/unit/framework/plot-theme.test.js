import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plotTheme } from '../../../framework/v1/plot-theme.js';

// A computed style as getComputedStyle returns it: custom properties as raw strings.
const styleOf = (props) => ({ getPropertyValue: (name) => props[name] ?? '' });

const THEME = {
  '--fw-plot-bg': ' #FAF8F2',
  '--fw-plot-grid': ' #DDD5C0',
  '--fw-plot-axis': ' #8B7D5E',
  '--fw-plot-text': ' #5C4F38',
  '--fw-plot-ink': ' #1A1008',
  '--fw-plot-muted': ' #C8BFA0',
  '--fw-plot-trace-1': ' #1B4F8A',
  '--fw-plot-trace-2': ' #B81C1C',
  '--fw-plot-trace-3': ' #E8720C',
  '--fw-plot-font': ` 'Libre Baskerville', Georgia, serif`,
  '--fw-plot-font-size': ' 14px',
};

test('plotTheme reads the --fw-plot-* tokens into a plot palette and font', () => {
  assert.deepEqual(plotTheme(styleOf(THEME)), {
    background: '#FAF8F2',
    grid: '#DDD5C0',
    axis: '#8B7D5E',
    text: '#5C4F38',
    ink: '#1A1008',
    muted: '#C8BFA0',
    traces: ['#1B4F8A', '#B81C1C', '#E8720C'],
    font: { family: `'Libre Baskerville', Georgia, serif`, size: 14 },
  });
});

test('plotTheme names the missing token when theme.css is not loaded', () => {
  const { '--fw-plot-grid': _, ...partial } = THEME;
  assert.throws(() => plotTheme(styleOf(partial)), /--fw-plot-grid.*theme\.css/);
  assert.throws(() => plotTheme(styleOf({})), /--fw-plot-bg/);
});
