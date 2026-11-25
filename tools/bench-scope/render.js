// Skin renderer: draws an engine frame onto the screen canvas at native resolution,
// in the skin's on-screen style (profile.style). Needs only a CanvasRenderingContext2D.
//
// Readouts are placed by id through READOUT_SLOTS; ids without a slot are laid out along
// the bottom bar after the placed ones, so a new readout shows up before it gets a slot.

/** Where each readout id goes on the TBS2072B screen: [x, y, align]. */
const READOUT_SLOTS = {
  tbs2072b: {
    status: [8, 15, 'left'],
    'ch1-scale': [30, 455, 'left'],
    'ch2-scale': [150, 455, 'left'],
    timebase: [330, 455, 'left'],
    trigger: [560, 455, 'left'],
  },
};

const STATUS_TEXT = { triggered: "Trig'd", auto: 'Auto', waiting: 'Trig?', stopped: 'Stop' };

export function renderScreen(g, frame, profile) {
  const { width, height, divX, divY } = frame.screen;
  const { plot, colors, font } = profile.style;
  const px = plot.w / divX;
  const py = plot.h / divY;
  const toX = (x) => plot.x + x * px;
  const toY = (y) => plot.y + plot.h / 2 - y * py;

  g.save();
  g.fillStyle = colors.background;
  g.fillRect(0, 0, width, height);

  // Graticule: division lines, dotted; centre axes with fifth-division ticks.
  g.strokeStyle = colors.grid;
  g.lineWidth = 1;
  g.setLineDash([1, 4]);
  g.beginPath();
  for (let i = 1; i < divX; i++) { const x = Math.round(toX(i)) + 0.5; g.moveTo(x, plot.y); g.lineTo(x, plot.y + plot.h); }
  for (let j = 1; j < divY; j++) { const y = Math.round(plot.y + j * py) + 0.5; g.moveTo(plot.x, y); g.lineTo(plot.x + plot.w, y); }
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = colors.gridMajor;
  g.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.w - 1, plot.h - 1);
  g.beginPath();
  const cx = Math.round(toX(divX / 2)) + 0.5;
  const cy = Math.round(toY(0)) + 0.5;
  for (let i = 0; i <= divX * 5; i++) { const x = Math.round(plot.x + (i * px) / 5) + 0.5; g.moveTo(x, cy - 3); g.lineTo(x, cy + 3); }
  for (let j = 0; j <= divY * 5; j++) { const y = Math.round(plot.y + (j * py) / 5) + 0.5; g.moveTo(cx - 3, y); g.lineTo(cx + 3, y); }
  g.stroke();

  // Traces, clipped to the graticule.
  g.save();
  g.beginPath();
  g.rect(plot.x, plot.y, plot.w, plot.h);
  g.clip();
  g.lineWidth = 2;
  for (const [ch, tr] of Object.entries(frame.traces)) {
    g.strokeStyle = colors[ch] ?? colors.text;
    g.beginPath();
    for (let i = 0; i < tr.x.length; i++) {
      const X = toX(tr.x[i]);
      const Y = toY(tr.y[i]);
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.stroke();
  }
  g.restore();

  // Readouts.
  g.font = font;
  g.textBaseline = 'middle';
  const slots = READOUT_SLOTS[profile.id] ?? {};
  const readouts = [{ id: 'status', text: STATUS_TEXT[frame.status] ?? frame.status }, ...frame.readouts];
  let spareX = 620;
  for (const r of readouts) {
    const slot = slots[r.id] ?? [spareX, 455, 'left'];
    if (!slots[r.id]) spareX += g.measureText(r.text).width + 16;
    const [x, y, align] = slot;
    g.textAlign = align;
    if (r.channel) {
      // Channel badge in the channel colour, as on the real screen.
      g.fillStyle = colors[r.channel] ?? colors.text;
      const label = r.channel.toUpperCase().replace('CH', '');
      g.fillRect(x, y - 10, 20, 20);
      g.fillStyle = colors.background;
      g.textAlign = 'center';
      g.fillText(label, x + 10, y + 1);
      g.textAlign = 'left';
      g.fillStyle = colors[r.channel] ?? colors.text;
      g.fillText(r.text, x + 26, y + 1);
    } else {
      g.fillStyle = colors.text;
      g.fillText(r.text, x, y + 1);
    }
  }
  g.restore();
}
