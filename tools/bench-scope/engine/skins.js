// Skin profiles: the per-model differences the engine and the screen renderer need.
// Pure data, no DOM. The panel art and control positions live in ../panels/controls.json.
//
// A profile:
//   id, model, panel           Setup value, control-map model key, SVG file in ../panels/
//   screen                     { width, height } native pixels; { divX, divY } graticule divisions
//   recordLength               samples per trace across the full graticule width
//   onlyControls               control-map names (or "<knob>:push") that only this model has
//   xyMenu                     where XY lives: { button (control that opens the menu), item }
//   style                      on-screen look, used only by render.js:
//     plot                     { x, y, w, h } graticule rectangle in screen pixels
//     colors                   background, grid, text, per-channel trace colours
//     font                     canvas font for readouts
//     menu                     { x, y, w, h, items } the softkey menu area and its item count
//     readouts                 { y, spareX } bottom readout baseline and where unslotted ones start
//   (ticket 04 adds sdivSequence: the model's s/div steps, smallest first)
//
// Readout positions per id and the skin-specific drawing live in render.js, keyed by profile.id.
// Switching skin (engine.js switchSkin) keeps the shared settings; each feature's restore()
// clamps them to the new profile.

const PROFILES = {
  tbs2072b: {
    id: 'tbs2072b',
    model: 'TBS2072B',
    panel: 'tbs2072b.svg',
    screen: { width: 800, height: 480, divX: 15, divY: 8 },
    recordLength: 751,
    style: {
      // Status bar along the top, channel/time-base/trigger readouts along the bottom,
      // 50 px per division (TBS2000B user manual, screen layout).
      plot: { x: 25, y: 30, w: 750, h: 400 },
      colors: {
        background: '#000000',
        grid: '#4a4a4a',
        gridMajor: '#7a7a7a',
        text: '#dddddd',
        ch1: '#f0e130',
        ch2: '#22c4e8',
      },
      font: '16px monospace',
      menu: { x: 650, y: 30, w: 150, h: 400, items: 7 },
      readouts: { y: 455, spareX: 620 },
    },
    onlyControls: ['fine', 'menu-onoff', 'trig-level:push', 'hor-position:push', 'softkey-6', 'softkey-7'],
    xyMenu: { button: 'acquire', item: 'XY Display' },
  },
  tds2001c: {
    id: 'tds2001c',
    model: 'TDS2001C',
    panel: 'tds2001c.svg',
    screen: { width: 320, height: 240, divX: 10, divY: 8 },
    recordLength: 251,
    style: {
      // TDS1000C/2000C screen: status line on top, readouts along the bottom, the softkey menu
      // in a column on the right, 25 px per division.
      plot: { x: 3, y: 15, w: 250, h: 200 },
      colors: {
        background: '#000000',
        grid: '#505050',
        gridMajor: '#8a8a8a',
        text: '#e8e8e8',
        ch1: '#ffff00',
        ch2: '#00c8ff',
        menu: '#1e3c78',
      },
      font: '10px monospace',
      menu: { x: 258, y: 0, w: 62, h: 240, items: 5 },
      readouts: { y: 228, spareX: 196 },
    },
    onlyControls: ['horiz-menu', 'set-to-zero', 'trig-50', 'trig-view', 'mp-led-left', 'mp-led-right'],
    xyMenu: { button: 'display', item: 'Format' },
  },
};

export const SKIN_IDS = Object.keys(PROFILES);
export const DEFAULT_SKIN = 'tbs2072b';

/** A fresh copy of the named skin profile. Throws on an unknown skin. */
export function skinProfile(id = DEFAULT_SKIN) {
  const p = PROFILES[id];
  if (!p) throw new RangeError(`Unknown bench-scope skin: ${id}`);
  return structuredClone(p);
}
