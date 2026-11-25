// Feature: the display settings. Owns settings.display.
//
// settings.display: { format 'yt' | 'xy' }. Only YT is drawn so far; ticket 10 adds XY (the TDS
// Display → Format and TBS Acquire → XY Display menu items set the format, and the renderer
// draws CH1 against CH2). Autoset calls display.reset(), which returns the format to YT.
// State: displayFormat.

import { oneOf } from './util.js';

export const DISPLAY_FORMATS = ['yt', 'xy'];
const DEFAULTS = { format: 'yt' };

export const display = {
  init(settings) { settings.display = { ...DEFAULTS }; },
  restore(settings, saved) {
    settings.display = { format: oneOf(saved?.display?.format, DISPLAY_FORMATS, DEFAULTS.format) };
  },
  /** What Autoset does to the display: back to YT. */
  reset(settings) { settings.display.format = 'yt'; },
  state: ({ settings }) => ({ displayFormat: settings.display.format }),
  describe: () => ({ displayFormat: { label: 'Display format (yt or xy)', unit: '' } }),
};
