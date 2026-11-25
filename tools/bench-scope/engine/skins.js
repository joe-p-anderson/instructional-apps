// Skin profiles: the per-model differences the engine and the screen renderer need.
// Pure data, no DOM. The panel art and control positions live in ../panels/controls.json.
//
// A profile:
//   id, model, panel           Setup value, control-map model key, SVG file in ../panels/
//   screen                     { width, height } native pixels; { divX, divY } graticule divisions
//   recordLength               samples per trace across the full graticule width
//   sdivSequence               the Horizontal Scale steps (s/div), fastest first, 1 µs .. 1 s
//   style                      on-screen look, used only by render.js:
//     plot                     { x, y, w, h } graticule rectangle in screen pixels
//     colors                   background, grid, text, per-channel trace colours
//     font                     canvas font for readouts

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
      },
      font: '16px monospace',
    },
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
