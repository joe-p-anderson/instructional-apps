// Feature: the time base. Owns settings.horizontal (ticket 04 adds the Scale and Position
// knobs and each skin's s/div sequence).
//
// settings.horizontal: { sPerDiv (s/div), position (s, trigger point offset from screen centre) }

import { si } from './util.js';

const DEFAULTS = { sPerDiv: 250e-6, position: 0 };

export const horizontal = {
  init(settings) {
    settings.horizontal = { ...DEFAULTS };
  },
  restore(settings) {
    settings.horizontal = { ...DEFAULTS };
  },
  frame({ settings }, frame) {
    frame.readouts.push({ id: 'timebase', text: `M ${si(settings.horizontal.sPerDiv)}s` });
  },
};
