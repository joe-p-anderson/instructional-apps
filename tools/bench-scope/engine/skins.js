// Skin profiles: the per-model differences the engine and the screen renderer need.
// Pure data, no DOM. The panel art and control positions live in ../panels/controls.json.
//
// A profile:
//   id, model, panel           Setup value, control-map model key, SVG file in ../panels/
//   screen                     { width, height } native pixels; { divX, divY } graticule divisions
//   recordLength               samples per trace across the full graticule width
//   sdivSequence               the Horizontal Scale steps (s/div), fastest first, 1 µs .. 1 s
//   xyMenu                     where XY lives: { button (control that opens the menu), item };
//                              display.js opens only the menu behind this skin's button
//   style                      on-screen look, used only by render.js:
//     plot                     { x, y, w, h } graticule rectangle in screen pixels
//     colors                   background, grid, text, per-channel trace colours
//     font                     canvas font for readouts
//     menu                     { x, y, w, h, items, titleY } the softkey menu area (one slot per
//                              softkey, lined up with the bezel buttons), its item count, and the
//                              baseline of the menu title above it
//     readouts                 { y, spareX } bottom readout baseline and where unslotted ones start
//
// Readout positions per id and the skin-specific drawing live in render.js, keyed by profile.id.
// Switching skin (engine.js switchSkin) keeps the shared settings; each feature's restore()
// clamps them to the new profile.

/** m · 10^e for each exponent from..to and mantissa, up to 10^to; exact decimals (0.4, not 0.4000000000000001). */
function decades(mantissas, from, to) {
  const out = [];
  for (let e = from; e < to; e++) for (const m of mantissas) out.push(Number((m * 10 ** e).toPrecision(3)));
  out.push(10 ** to);
  return out;
}

const PROFILES = {
  tbs2072b: {
    id: 'tbs2072b',
    model: 'TBS2072B',
    panel: 'tbs2072b.svg',
    screen: { width: 800, height: 480, divX: 15, divY: 8 },
    recordLength: 751,
    // 1-2-4 (TBS2000B datasheet: 1 ns to 100 s/div in a 1-2-4 sequence), cut to 1 µs .. 1 s.
    sdivSequence: decades([1, 2, 4], -6, 0),
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
        menu: '#1c2a3a',
        menuText: '#ffffff',
      },
      font: '17px monospace',
      // Slots line up with softkeys 1..7 (centres 73..427 px on this screen).
      menu: { x: 650, y: 43, w: 150, h: 413, items: 7, titleY: 15 },
      readouts: { y: 455, spareX: 620 },
    },
    xyMenu: { button: 'acquire', item: 'XY Display' },
  },
  tds2001c: {
    id: 'tds2001c',
    model: 'TDS2001C',
    panel: 'tds2001c.svg',
    screen: { width: 320, height: 240, divX: 10, divY: 8 },
    recordLength: 251,
    // 1-2.5-5 (TDS2000C: 5 ns to 50 s/div in a 1, 2.5, 5 sequence), cut to 1 µs .. 1 s.
    sdivSequence: decades([1, 2.5, 5], -6, 0),
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
        menuText: '#ffffff',
      },
      font: '10px monospace',
      // Slots line up with softkeys 1..5 (centres 31..194 px on this screen).
      menu: { x: 258, y: 11, w: 62, h: 204, items: 5, titleY: 5 },
      readouts: { y: 228, spareX: 196 },
    },
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
