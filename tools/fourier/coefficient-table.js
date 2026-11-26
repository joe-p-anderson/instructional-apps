// The input's coefficient table: n, Aₙ (V) and φₙ (°) for n = 1 … TABLE_N, in the cos form
// Aₙ cos(nω₀t + φₙ). It shows the coefficients outright, so a Mode builds it only when its Setup
// asks for it ({ coefficientTable: true }, as the Activity's Part 1 does); Standalone mode never
// shows it.
//
// coefficientTable() returns { el, update(series) }: el is a 'Coefficients' section holding the
// table (its accessible name is "Coefficients"); update(series) refills it from an engine series.
// Styled by fourier.css (.fo-coefficients).

import { h, section } from '../../framework/v1/ui-kit.js';

export const TABLE_N = 10;

const minus = (s) => s.replace('-', '−');

export function coefficientTable() {
  const body = h('tbody');
  const table = h('table', { 'aria-label': 'Coefficients', class: 'fo-coefficients' },
    h('thead', {}, h('tr', {}, ...['n', 'Aₙ (V)', 'φₙ (°)'].map((t) => h('th', { scope: 'col' }, t)))),
    body);

  function update(series) {
    body.replaceChildren(...series.terms.slice(0, TABLE_N).map(({ n, amp, phase }) => h('tr', {},
      h('th', { scope: 'row' }, String(n)),
      h('td', {}, amp.toFixed(3)),
      h('td', {}, amp === 0 ? '—' : minus(phase.toFixed(0))))));
  }

  return { el: section('Coefficients', table), update };
}
