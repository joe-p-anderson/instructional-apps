// Feature: vertical settings per channel. Owns settings.ch1 (ticket 02 adds the Scale and
// Position knobs, CH2, display on/off and clipping; ticket 05 coupling, probe, BW limit, invert).
//
// settings.ch1: { vPerDiv (V/div at the probe tip), position (divisions) }

import { si } from './util.js';

const DEFAULTS = { vPerDiv: 1, position: 0 };

export const vertical = {
  init(settings) {
    settings.ch1 = { ...DEFAULTS };
  },
  restore(settings) {
    settings.ch1 = { ...DEFAULTS };
  },
  frame({ settings }, frame) {
    frame.readouts.push({ id: 'ch1-scale', channel: 'ch1', text: `${si(settings.ch1.vPerDiv)}V` });
  },
};
