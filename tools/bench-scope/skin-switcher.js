// The skin switcher: a UI-kit select Control (id 'skin') choosing the drawn model. Standalone
// has no Setup picker, so this is how a student switches; an Activity sets the skin through
// its Setup and can hide this Control.
//
// createSkinSwitcher({ value, onSwitch }) -> { el, control, sync(skin) }
//   onSwitch  (skin) => void, a skin id from SKIN_IDS
//   sync      show a skin (after a restore) without calling onSwitch

import { section, select } from '../../framework/v1/ui-kit.js';
import { SKIN_IDS, skinProfile } from './engine/skins.js';

const LABELS = { tbs2072b: 'TBS2072B (new)', tds2001c: 'TDS2001C (old)' };

export function createSkinSwitcher({ value, onSwitch }) {
  let syncing = false;
  const control = select({
    id: 'skin',
    name: 'Oscilloscope model',
    label: 'Model',
    options: SKIN_IDS.map((id) => ({ value: id, label: LABELS[id] ?? skinProfile(id).model })),
    value,
    onChange: (skin) => { if (!syncing) onSwitch(skin); },
  });
  const el = section('Oscilloscope', control.el);
  el.classList.add('bs-skin-switcher');
  return {
    el,
    control,
    sync(skin) {
      if (control.get() === skin) return;
      syncing = true;
      try { control.set(skin); } finally { syncing = false; }
    },
  };
}
