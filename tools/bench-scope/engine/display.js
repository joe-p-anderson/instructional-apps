// Feature: the display format, YT or XY. Owns settings.display.
//
// settings.display: { format 'yt' | 'xy' }. In XY, CH1 drives X and CH2 drives Y, each at its own
// V/div and position (the capture is in acquire.js, frame.xy).
//
// Where XY lives (each skin reaches only its own menu; the other's button is inactive there):
//   display   press (TDS): opens the Display menu, reduced to Format YT/XY on softkey 3 (its slot
//             on the real menu: Type, Persist, Format, Contrast).
//   acquire   press (TBS): opens the Acquire side menu: Mode, Record Length, Delay, Set Horizontal
//             Position and Waveform Display drawn greyed (disabled, they do nothing), then
//             XY Display Off/On on softkey 6.
// In XY the controls the real models disable there ignore events (XY_DISABLED: the time base and
// the trigger controls; cursors check the format themselves). Run/Stop and Single still work.
// Autoset works and calls display.reset(), which returns the format to YT.
// Frame in XY: no time-base or trigger readout, no trigger markers (horizontal.js and trigger.js
// check isXY).
// State: displayFormat.

import { choiceItem } from './menus.js';
import { oneOf } from './util.js';

export const DISPLAY_FORMATS = ['yt', 'xy'];
const DEFAULTS = { format: 'yt' };

/** Controls that ignore events in XY: the time base and the trigger. */
export const XY_DISABLED = new Set([
  'hor-scale', 'hor-position', 'set-to-zero', 'horiz-menu',
  'trig-level', 'trig-50', 'trig-menu', 'trig-view', 'force-trig',
]);

/** Whether the display is in XY format. */
export const isXY = (settings) => settings.display?.format === 'xy';

const format = [({ settings }) => settings.display.format, ({ settings }, v) => { settings.display.format = v; }];
// Only the skin whose XY lives behind this button opens the menu (profile.xyMenu, skins.js).
const ownSkin = (button) => ({ profile }) => profile.xyMenu?.button === button;
const greyed = (label, value = '') => ({ label, value, disabled: true });

const menus = {
  display: {
    button: 'display',
    title: 'Display',
    onButton: ownSkin('display'),
    items: () => [null, null, choiceItem('Format', [{ value: 'yt', text: 'YT' }, { value: 'xy', text: 'XY' }], ...format)],
  },
  acquire: {
    button: 'acquire',
    title: 'Acquire',
    onButton: ownSkin('acquire'),
    items: () => [
      greyed('Mode', 'Sample'),
      greyed('Record Length'),
      greyed('Delay'),
      greyed('Set Horizontal Position'),
      greyed('Waveform Display'),
      choiceItem('XY Display', [{ value: 'yt', text: 'Off' }, { value: 'xy', text: 'On' }], ...format),
    ],
  },
};

export const display = {
  menus,
  init(settings) { settings.display = { ...DEFAULTS }; },
  restore(settings, saved) {
    settings.display = { format: oneOf(saved?.display?.format, DISPLAY_FORMATS, DEFAULTS.format) };
  },
  /** What Autoset does to the display: back to YT. */
  reset(settings) { settings.display.format = 'yt'; },
  disabled: ({ settings }, control) => isXY(settings) && XY_DISABLED.has(control),
  state: ({ settings }) => ({ displayFormat: settings.display.format }),
  describe: () => ({ displayFormat: { label: 'Display format (yt or xy)', unit: '' } }),
};
