// The Task form's Exposure tab: every Control of the Mode (revealable layers included, as they
// are Controls too) under its label, with its effective state at this Task as a three-way switch
// (open, locked, hidden), marked as changed here or inherited. Flipping a switch is a setExposure
// edit (edits.js), which rewrites this Task's show, lock and hide lists minimally. An id the Mode
// doesn't have is listed apart with a Remove. See task-form.js for the tab shape.

import { h } from '../../../ui-kit.js';
import { STATES, LIST_OF } from '../exposure.js';

const WORD = { open: 'Open', locked: 'Locked', hidden: 'Hidden' };
let filter = 'all'; // 'all' | 'here', kept between Tasks

export const exposureTab = {
  id: 'exposure',
  label: () => 'Exposure',
  owns: (rest) => ['show', 'lock', 'hide'].includes(rest[0]),
  render(ctx) {
    const { p, t, task, base, mode } = ctx;
    if (!mode) {
      return [ctx.section('Exposure', null, h('p', { class: 'muted', 'data-path': `${base}.show` },
        ctx.tool ? `The Part's Mode is not a Mode of ${ctx.tool.tool.title}, so its Controls are unknown.`
          : ctx.toolError ?? 'Loading the Tool…'))];
    }
    const eff = ctx.exposure();
    const controls = mode.controls;
    const changedHere = controls.filter((c) => eff[c.id].here);
    const shown = filter === 'here' ? changedHere : controls;
    const rows = shown.map((c) => {
      const e = eff[c.id];
      const seg = h('span', { class: 'seg', role: 'group', 'aria-label': `${c.label}: state at this Task` },
        ...STATES.map((v) => h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(e.state === v),
          onclick: () => ctx.commitAndRender({ type: 'setExposure', p, t, control: c.id, state: v }) }, WORD[v])));
      const badge = e.here
        ? h('span', { class: 'badge here', title: `In this Task's ${LIST_OF[e.state]} list` }, 'changed here')
        : h('span', { class: 'badge inh' }, e.from == null ? 'inherited: default' : `inherited from Task ${p + 1}.${e.from + 1}`);
      return h('tr', { 'data-control': c.id },
        h('th', { scope: 'row' }, c.label, c.label !== c.id ? h('div', { class: 'cid' }, c.id) : null), h('td', {}, seg), h('td', {}, badge));
    });
    const known = new Set(controls.map((c) => c.id));
    for (const k of ['show', 'lock', 'hide']) {
      (Array.isArray(task[k]) ? task[k] : []).forEach((id, i) => {
        if (known.has(id)) return;
        rows.push(h('tr', { class: 'bad', 'data-path': `${base}.${k}.${i}` },
          h('th', { scope: 'row' }, h('span', { class: 'sev', 'aria-hidden': 'true' }, '⚠ '), h('span', { class: 'mono' }, id),
            h('div', { class: 'cid' }, `not a Control of this Mode (in the ${k} list)`)),
          h('td'),
          h('td', {}, h('button', { type: 'button', class: 'lnk danger', 'aria-label': `Remove ${id}`,
            onclick: () => ctx.commitAndRender({ type: 'clearExposure', p, t, control: id }) }, 'remove'))));
      });
    }
    const filterBar = h('div', { class: 'expo-filter' },
      h('span', { class: 'seg small', role: 'group', 'aria-label': 'Show Controls' },
        ...[['all', `All Controls (${controls.length})`], ['here', `Changed here (${changedHere.length})`]].map(([v, l]) =>
          h('button', { type: 'button', 'aria-pressed': String(filter === v), onclick: () => { filter = v; ctx.rerender(); } }, l))),
      h('span', { class: 'muted' }, 'what the student gets at this Task, after carry-over'));
    return [ctx.section('Exposure', 'open · locked · hidden', filterBar,
      h('table', { class: 'grid', 'aria-label': 'Exposure', 'data-path': `${base}.show` }, h('tbody', {}, ...rows)),
      h('div', { class: 'muted', style: 'margin-top:6px' },
        "Setting a Control back to its inherited state drops it from this Task's lists. Later Tasks follow at once."))];
  },
};
