"""Generate clean-vector oscilloscope front panels (SVG) + shared control map.

Every interactive element is <g class="osc-control" data-control=... data-kind=...>.
data-control names are SHARED between models so one JS engine can drive either skin.
Element ids are prefixed per model (tbs-/tds-) so both SVGs can be inlined in one page.
"""
import json, math
from xml.sax.saxutils import escape

FONT = "Arial, Helvetica, sans-serif"


class Panel:
    def __init__(self, model, prefix, w, h, dx=0, dy=0):
        self.model, self.prefix, self.w, self.h = model, prefix, w, h
        self.dx, self.dy = dx, dy  # offset applied to photo-derived coords
        self.out = []
        self.controls = []

    # ---------- primitives ----------
    def X(self, x): return round(x + self.dx, 1)
    def Y(self, y): return round(y + self.dy, 1)

    def raw(self, s): self.out.append(s)

    def rect(self, x0, y0, x1, y1, fill, stroke="none", sw=0, rx=0, extra=""):
        self.raw(f'<rect x="{self.X(x0)}" y="{self.Y(y0)}" width="{round(x1-x0,1)}" height="{round(y1-y0,1)}" '
                 f'rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def text(self, x, y, s, size=18, fill="#222", weight="normal", anchor="middle", extra=""):
        lines = s.split("\n")
        n = len(lines)
        for i, ln in enumerate(lines):
            yy = y + (i - (n - 1) / 2) * size * 1.05
            self.raw(f'<text x="{self.X(x)}" y="{self.Y(yy)}" font-family="{FONT}" font-size="{size}" '
                     f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" dominant-baseline="central" {extra}>'
                     f'{escape(ln)}</text>')

    def push_hint(self, x, y, rest, size=12):
        """Small grey 'Push' pill + text, centred on x (as printed on the panel)."""
        pw, tw = 3.0 * size, 0.55 * size * len(rest)
        x0 = x - (pw + 5 + tw) / 2
        self.rect(x0, y - size * 0.75, x0 + pw, y + size * 0.75, "#9a9a9a", rx=3)
        self.text(x0 + pw / 2, y, "Push", size * 0.9, "#fff")
        self.text(x0 + pw + 5, y, rest, size, "#888", anchor="start")

    # ---------- control wrapper ----------
    def begin(self, control, kind, label, active=True, push=None, extra_meta=None, cx=None, cy=None):
        meta = dict(control=control, kind=kind, label=label.replace("\n", " "), active=active)
        if push: meta["push"] = push
        if cx is not None: meta["cx"], meta["cy"] = self.X(cx), self.Y(cy)
        if extra_meta: meta.update(extra_meta)
        self.controls.append(meta)
        attrs = (f'id="{self.prefix}-{control}" class="osc-control" data-control="{control}" '
                 f'data-kind="{kind}" data-active="{str(active).lower()}" data-label="{escape(meta["label"])}"')
        if push: attrs += f' data-push="{push}"'
        if cx is not None: attrs += f' data-cx="{self.X(cx)}" data-cy="{self.Y(cy)}"'
        self.raw(f'<g {attrs}>')
        tip = meta["label"] + ("" if active else " (not available in this simulation)")
        if push: tip += f" (push: {push})"
        self.raw(f'<title>{escape(tip)}</title>')

    def end(self): self.raw('</g>')

    # ---------- controls ----------
    def button(self, control, cx, cy, w, h, label, active=True, size=18, dark=False,
               outline=None, fill="#d9d9d9", text_fill=None, rx=7, kind="button", weight="bold"):
        self.begin(control, kind, label, active, cx=cx, cy=cy)
        x0, y0 = cx - w / 2, cy - h / 2
        if dark: fill = "#262626"
        if outline:
            self.rect(x0 - 7, y0 - 7, x0 + w + 7, y0 + h + 7, "none", outline, 4, rx + 5)
        # drop shadow + face
        self.rect(x0, y0 + 4, x0 + w, y0 + h + 4, "#7d7d7d", rx=rx)
        self.rect(x0, y0, x0 + w, y0 + h, fill, "#7a7a7a", 1.5, rx, 'class="osc-face"')
        if label:
            self.text(cx, cy, label, size, text_fill or ("#fff" if dark else "#222"), weight)
        self.end()

    def round_button(self, control, cx, cy, r, label="", active=True, size=13, fill="#d4d4d4", kind="button"):
        self.begin(control, kind, label or control, active, cx=cx, cy=cy)
        self.raw(f'<circle cx="{self.X(cx)}" cy="{self.Y(cy)+3}" r="{r}" fill="#7d7d7d"/>')
        self.raw(f'<circle class="osc-face" cx="{self.X(cx)}" cy="{self.Y(cy)}" r="{r}" fill="{fill}" stroke="#6f6f6f" stroke-width="2"/>')
        if label:
            self.text(cx, cy, label, size, "#222", "bold")
        self.end()

    def knob(self, control, cx, cy, r, label, ring=None, push=None, active=True, notches=14, detent=15):
        self.begin(control, "knob", label, active, push=push, cx=cx, cy=cy, extra_meta={"detentDeg": detent})
        self.out[-2] = self.out[-2].replace('<g ', f'<g data-detent="{detent}" ', 1)
        X, Y = self.X(cx), self.Y(cy)
        if ring:
            self.raw(f'<circle cx="{X}" cy="{Y}" r="{r+7}" fill="none" stroke="{ring}" stroke-width="7"/>')
        self.raw(f'<circle cx="{X}" cy="{Y+3}" r="{r}" fill="#8a8a8a"/>')
        # rotating part: grip notches + index dot
        self.raw(f'<g class="osc-knob-rot" data-angle="0">')
        self.raw(f'<circle class="osc-face" cx="{X}" cy="{Y}" r="{r}" fill="#c8c8ca" stroke="#7a7a7a" stroke-width="2"/>')
        nw = max(4, r * 0.11)
        for i in range(notches):
            a = 360 * i / notches
            self.raw(f'<rect x="{X - nw/2}" y="{Y - r + 2}" width="{nw}" height="{r*0.22}" rx="{nw/2}" '
                     f'fill="#9c9c9e" transform="rotate({a} {X} {Y})"/>')
        self.raw(f'<circle cx="{X}" cy="{Y}" r="{r*0.70}" fill="#dcdcde" stroke="#b5b5b7" stroke-width="1.5"/>')
        self.raw(f'<circle cx="{X}" cy="{Y - r*0.52}" r="{max(2.5, r*0.06)}" fill="#8f8f91"/>')
        self.raw('</g>')
        self.end()

    def bnc(self, control, cx, cy, label, style="gold", active=True):
        self.begin(control, "bnc", label, active, cx=cx, cy=cy)
        X, Y = self.X(cx), self.Y(cy)
        if style == "gold":
            self.rect(cx - 58, cy - 108, cx + 58, cy + 58, "#3b3b3d", "#222", 2, 10)
            # contact pads above connector (probe interface)
            for i in range(3):
                for j in range(2):
                    self.rect(cx + 2 + j * 14, cy - 92 + i * 14, cx + 12 + j * 14, cy - 82 + i * 14, "#d9b23a", rx=2)
            self.raw(f'<circle cx="{X}" cy="{Y}" r="44" fill="#d4ac2e" stroke="#8c6d12" stroke-width="2"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="30" fill="#e8e3d6" stroke="#9c8a55" stroke-width="2"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="16" fill="#f7f4ec" stroke="#b9a874" stroke-width="2"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="6" fill="#b88a1c"/>')
        else:
            self.raw(f'<circle cx="{X}" cy="{Y}" r="46" fill="#b5b5b7" stroke="#6c6c6e" stroke-width="2"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="34" fill="#d8d8da" stroke="#8a8a8c" stroke-width="2"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="22" fill="#4a4a4c"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="14" fill="#eeeeee"/>')
            self.raw(f'<circle cx="{X}" cy="{Y}" r="5" fill="#c79a2a"/>')
        self.end()

    def terminal(self, control, cx, cy, label, active=False):
        self.begin(control, "terminal", label, active, cx=cx, cy=cy)
        self.rect(cx - 9, cy - 22, cx + 9, cy + 22, "#e9e9e9", "#555", 2, 3)
        self.rect(cx - 3, cy - 14, cx + 3, cy + 14, "#9d9d9d", rx=2)
        self.end()

    def usb(self, control, cx, cy, w, h, active=False):
        self.begin(control, "port", "USB port", active, cx=cx, cy=cy)
        self.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, "#1d1d1d", "#555", 2, 3)
        if w > h:
            self.rect(cx - w / 2 + 8, cy - h / 2 + 7, cx + w / 2 - 8, cy - 2, "#f0f0f0", rx=1)
        else:
            self.rect(cx - w / 2 + 7, cy - h / 2 + 8, cx - 2, cy + h / 2 - 8, "#f0f0f0", rx=1)
        self.end()

    def led(self, control, cx, cy, label):
        self.begin(control, "led", label, True, cx=cx, cy=cy)
        self.raw(f'<circle class="osc-led" cx="{self.X(cx)}" cy="{self.Y(cy)}" r="8" fill="#7d7d7d" stroke="#555" stroke-width="1.5"/>')
        self.end()

    def screen(self, x0, y0, x1, y1, px_w, px_h, graticule):
        meta = dict(control="screen", kind="screen", label="Display (canvas overlay)", active=True,
                    x=self.X(x0), y=self.Y(y0), w=x1 - x0, h=y1 - y0, pixels=[px_w, px_h], graticule=graticule)
        self.controls.append(meta)
        self.raw(f'<rect id="{self.prefix}-screen" class="osc-screen" data-control="screen" data-kind="screen" '
                 f'data-pixels="{px_w}x{px_h}" data-graticule="{graticule}" x="{self.X(x0)}" y="{self.Y(y0)}" '
                 f'width="{x1-x0}" height="{y1-y0}" fill="#141414"/>')

    # ---------- output ----------
    def svg(self):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
                f'data-model="{self.model}" id="{self.prefix}-panel" class="osc-panel" '
                f'font-family="{FONT}">\n')
        return head + "\n".join(self.out) + "\n</svg>\n"


# =====================================================================
#  NEW: TBS2072B  (coords traced from the frontal photo, offset +110,-320)
# =====================================================================
def build_tbs():
    p = Panel("TBS2072B", "tbs", 2280, 1000, dx=110, dy=-320)
    YEL, BLU = "#e9dc1c", "#55b8e3"

    # chassis
    p.rect(-108, 326, 2168, 1308, "#e6e5e2", "#b9b9b9", 2, 28)
    p.rect(-95, 352, 1283, 1288, "#4b4b4d", rx=20)                    # dark display bezel
    p.text(-60, 422, "2-CHANNEL", 34, "#ffffff", "bold", "start")     # neutral label (no brand mark)
    p.text(1225, 425, "DIGITAL OSCILLOSCOPE", 30, "#e8e8e8", anchor="end",
           extra=f'id="tbs-panel-label"')
    p.rect(30, 474, 1236, 1202, "#111", "#2a2a2a", 3, 10)              # screen recess
    p.screen(50, 488, 1220, 1190, 800, 480, "15x8")

    # bezel side (softkeys)
    p.round_button("save", 1328, 493, 28, "Save", active=False, size=14)
    for i, y in enumerate([595, 682, 769, 856, 943, 1028, 1113], start=1):
        p.button(f"softkey-{i}", 1330, y, 58, 48, "", rx=5, kind="softkey")
    p.round_button("menu-onoff", 1335, 1212, 28, "Menu\nOn/Off", size=11)

    # control panel plate
    p.rect(1390, 344, 2152, 1290, "#f3f2ef", "#c9c9c9", 2, 12)

    # top row
    for ctl, x, lab, act, dark in [("help", 1465, "Help", False, False), ("function", 1620, "Function", False, False),
                                   ("autoset", 1777, "Autoset", True, True), ("single", 1930, "Single", True, False),
                                   ("run-stop", 2087, "Run/Stop", True, False)]:
        p.button(ctl, x, 386, 112, 50, lab, act, dark=dark)

    def section(x0, y0, x1, y1, title):
        p.rect(x0, y0, x1, y1, "none", "#4d4d4f", 3, 6)
        p.rect(x0, y0, x1, y0 + 28, "#4d4d4f", rx=4)
        p.text((x0 + x1) / 2, y0 + 14, title, 17, "#fff", "bold")

    # NAVIGATION
    section(1395, 434, 2008, 668, "NAVIGATION")
    p.text(1435, 483, "Cursors", 17)
    p.round_button("cursors", 1433, 516, 19)
    p.text(1435, 593, "Fine", 17)
    p.round_button("fine", 1433, 626, 19)
    p.raw(f'<circle cx="{p.X(1494)}" cy="{p.Y(498)}" r="15" fill="#1e9be0"/>')
    p.text(1494, 498, "M", 16, "#fff", "bold")
    p.push_hint(1563, 478, "to Select", 12)
    p.knob("mp-knob", 1563, 566, 72, "Multipurpose knob", push="select", notches=10)
    p.button("zoom", 1705, 516, 98, 46, "Zoom", False, 17)
    p.button("search", 1828, 514, 98, 46, "Search", False, 17)
    p.button("measure", 1952, 512, 98, 46, "Measure", True, 17)
    p.raw(f'<line x1="{p.X(1652)}" y1="{p.Y(572)}" x2="{p.X(1790)}" y2="{p.Y(572)}" stroke="#555" stroke-width="2"/>')
    p.raw(f'<line x1="{p.X(1862)}" y1="{p.Y(572)}" x2="{p.X(1995)}" y2="{p.Y(572)}" stroke="#555" stroke-width="2"/>')
    p.text(1826, 572, "Mark", 17)
    p.button("mark-prev", 1702, 612, 98, 46, "←", False, 26)
    p.button("mark-set", 1826, 611, 98, 46, "Set/Clear", False, 17)
    p.button("mark-next", 1948, 609, 98, 46, "→", False, 26)

    # RESOURCES
    section(2014, 430, 2146, 668, "RESOURCES")
    p.button("save-recall", 2082, 488, 98, 50, "Save/\nRecall", False, 16)
    p.button("default-setup", 2082, 562, 98, 50, "Default\nSetup", False, 16)
    p.button("utility", 2082, 632, 98, 42, "Utility", False, 16)

    # VERTICAL
    section(1395, 677, 1861, 1021, "VERTICAL")
    p.button("math", 1443, 763, 64, 40, "Math", False, 16, outline="#f0a080")
    p.button("ref", 1443, 832, 64, 40, "Ref", False, 16, outline="#c8c8c8")
    p.button("fft", 1443, 900, 64, 40, "FFT", False, 16, outline="#c0602a")
    p.button("bus", 1443, 970, 64, 40, "Bus", False, 16, outline="#a090d0")
    p.knob("ch1-position", 1588, 763, 38, "CH1 vertical position", YEL, push="center")
    p.knob("ch2-position", 1768, 763, 38, "CH2 vertical position", BLU, push="center")
    p.text(1678, 767, "Position", 18, weight="bold")
    p.push_hint(1678, 792, "to Center", 11)
    p.button("ch1-menu", 1583, 849, 62, 44, "1", True, 20, outline=YEL)
    p.text(1676, 847, "Menu", 18, weight="bold")
    p.button("ch2-menu", 1757, 847, 62, 44, "2", True, 20, outline=BLU)
    p.knob("ch1-scale", 1580, 955, 52, "CH1 volts/div", YEL, push="trig-source", notches=10, detent=36)
    p.knob("ch2-scale", 1774, 955, 52, "CH2 volts/div", BLU, push="trig-source", notches=10, detent=36)
    p.text(1678, 955, "Scale", 18, weight="bold")
    p.push_hint(1678, 980, "for", 11)
    p.text(1678, 996, "Trig Source", 11, "#888")

    # HORIZONTAL
    section(1866, 675, 2006, 1017, "HORIZONTAL")
    p.text(1936, 717, "Position", 17, weight="bold")
    p.knob("hor-position", 1936, 762, 36, "Horizontal position", push="center")
    p.push_hint(1936, 808, "to Center", 11)
    p.button("acquire", 1936, 846, 100, 44, "Acquire", False, 17)
    p.text(1936, 890, "Scale", 17, weight="bold")
    p.knob("hor-scale", 1936, 950, 52, "Horizontal sec/div", notches=10, detent=36)

    # TRIGGER
    section(2011, 673, 2142, 1015, "TRIGGER")
    p.button("trig-menu", 2076, 742, 100, 44, "Menu", True, 17)
    p.text(2076, 784, "Level", 17, weight="bold")
    p.knob("trig-level", 2076, 832, 36, "Trigger level", push="set-50")
    p.push_hint(2076, 884, "to Set 50%", 10)
    p.button("force-trig", 2076, 950, 104, 44, "Force Trig", True, 16)

    # badge (model text kept neutral)
    p.rect(1918, 1032, 2068, 1068, "#a9a9a9", rx=3)
    p.text(1993, 1050, "2 CH", 22, "#fff", "bold")
    p.rect(1918, 1072, 1992, 1102, "#bdbdbd", rx=2)
    p.rect(1995, 1072, 2068, 1102, "#bdbdbd", rx=2)
    p.text(1955, 1087, "70 MHz", 14, "#fff")
    p.text(2031, 1087, "2 GS/s", 14, "#fff")

    # inputs
    p.text(1552, 1060, "1", 22, weight="bold")
    p.rect(1570, 1054, 1682, 1061, YEL, rx=2)
    p.text(1742, 1058, "2", 22, weight="bold")
    p.rect(1760, 1052, 1872, 1059, BLU, rx=2)
    p.bnc("ch1-input", 1612, 1186, "CH1 input")
    p.bnc("ch2-input", 1798, 1186, "CH2 input")
    p.terminal("probe-comp", 1433, 1166, "Probe comp (5 V square)")
    p.terminal("probe-comp-gnd", 1433, 1218, "Probe comp ground")
    p.text(1462, 1166, "Probe\nComp\n≈5V⎍", 11, "#999", anchor="start")
    p.text(1462, 1218, "⏚", 20, "#999", anchor="start")
    p.text(1572, 1266, "Inputs 1-2", 12, "#999")
    p.text(1712, 1266, "1MΩ || 13pF ≤ 300V RMS CAT II", 11, "#999")
    p.raw(f'<path d="M{p.X(1880)},{p.Y(1244)} l12,20 h-24 z" fill="none" stroke="#999" stroke-width="2"/>')
    p.text(1953, 1125, "USB 2.0", 11, "#999")
    p.usb("usb", 1953, 1180, 32, 76)
    p.begin("power", "button", "Power", False, cx=2075, cy=1183)
    p.raw(f'<circle cx="{p.X(2075)}" cy="{p.Y(1186)}" r="36" fill="#9a9a9a"/>')
    p.raw(f'<circle class="osc-face" cx="{p.X(2075)}" cy="{p.Y(1183)}" r="36" fill="#e2e2e2" stroke="#8a8a8a" stroke-width="2"/>')
    X, Y = p.X(2075), p.Y(1183)
    p.raw(f'<path d="M{X-9},{Y-9} A13,13 0 1,0 {X+9},{Y-9}" fill="none" stroke="#666" stroke-width="3"/>'
          f'<line x1="{X}" y1="{Y-17}" x2="{X}" y2="{Y-2}" stroke="#666" stroke-width="3"/>')
    p.end()
    return p


# =====================================================================
#  OLD: TDS2001C  (frontal geometry from the TDS2024C photo; right-hand
#  control layout from the angled TDS2001C photo; offset -5,-315)
# =====================================================================
def build_tds():
    p = Panel("TDS2001C", "tds", 2200, 1025, dx=-5, dy=-315)
    YEL, BLU, PNK = "#f5ee7a", "#8fc3ef", "#f7b9b0"

    # chassis
    p.rect(8, 318, 2202, 1336, "#e9e7e1", "#b9b6ae", 2, 22)
    p.rect(18, 328, 1086, 1326, "#eeece6", "#c4c1b9", 2, 18)          # display module
    p.rect(1092, 336, 2192, 1316, "#ecebe6", "#c4c1b9", 2, 12)        # control module
    # brand strip (neutral)
    p.rect(45, 362, 956, 425, "#f7f6f2", "#c9c6be", 2, 4)
    p.text(80, 394, "2-CHANNEL", 34, "#2f3a7a", "bold", "start")
    p.text(320, 394, "DIGITAL STORAGE OSCILLOSCOPE", 24, "#555", anchor="start", extra='id="tds-panel-label"')
    p.raw(f'<path d="M{p.X(800)},{p.Y(425)} L{p.X(850)},{p.Y(362)} H{p.X(956)} V{p.Y(425)} Z" fill="#3f3d8c"/>')
    p.text(905, 381, "50 MHz", 21, "#fff", "bold")
    p.text(912, 407, "500 MS/s", 19, "#fff", "bold")
    # screen recess + LCD
    p.rect(64, 440, 962, 1146, "#dddad2", "#bbb7ad", 2, 10)
    p.rect(128, 490, 930, 1094, "#2a2a2c", rx=4)
    p.screen(138, 498, 922, 1086, 320, 240, "10x8")
    # softkeys
    for i, y in enumerate([573, 674, 773, 873, 974], start=1):
        p.raw(f'<line x1="{p.X(925)}" y1="{p.Y(y)}" x2="{p.X(975)}" y2="{p.Y(y)}" stroke="#777" stroke-width="2"/>')
        p.button(f"softkey-{i}", 1008, y, 64, 46, "", rx=9, kind="softkey", fill="#f4f3ef")
    p.round_button("probe-check", 1010, 1072, 22, "", active=False, fill="#f4f3ef")
    p.text(1112, 1070, "Probe\nCheck", 11, "#999", extra=f'transform="rotate(-90 {p.X(1112)} {p.Y(1070)})"')
    # USB strip
    p.rect(66, 1183, 1002, 1297, "#ebe9e3", "#c9c6be", 2, 6)
    p.text(785, 1236, "USB\nFlash Drive", 18, "#aaa", "bold")
    p.usb("usb", 914, 1237, 88, 36)
    # probe comp
    p.terminal("probe-comp", 1072, 1205, "Probe comp (5 V @ 1 kHz)")
    p.terminal("probe-comp-gnd", 1072, 1258, "Probe comp ground")
    p.text(1112, 1215, "Probe Comp ~5V@1kHz", 10, "#999", extra=f'transform="rotate(-90 {p.X(1112)} {p.Y(1215)})"')

    # multipurpose knob + LEDs
    p.led("mp-led-left", 1147, 396, "Multipurpose knob indicator (left)")
    p.led("mp-led-right", 1273, 396, "Multipurpose knob indicator (right)")
    p.knob("mp-knob", 1208, 465, 58, "Multipurpose knob", notches=10)

    # Help group shading
    p.rect(1780, 358, 1902, 546, "#d6d4ce", rx=8)
    rows = [
        (418, 377, [("autorange", 1357, "AutoRange", False), ("save-recall", 1477, "Save/Recall", False),
                    ("measure", 1597, "Measure", True), ("acquire", 1717, "Acquire", False),
                    ("help", 1840, "Help", False)]),
        (510, 467, [("ref", 1357, "Ref", False), ("utility", 1477, "Utility", False),
                    ("cursors", 1597, "Cursor", True), ("display", 1717, "Display", False),
                    ("default-setup", 1840, "Default Setup", False), ("single", 1960, "Single", True)]),
    ]
    for by, ly, items in rows:
        for ctl, x, lab, act in items:
            if ctl != "ref": p.text(x, ly, lab, 17, "#222", "bold")
            p.button(ctl, x, by, 76, 50, "Ref" if ctl == "ref" else "", act,
                     fill="#ffffff" if ctl == "ref" else "#e8e6e0", rx=9, size=17)
    p.button("autoset", 1960, 410, 74, 50, "Auto\nSet", True, 16, dark=True, rx=9)
    p.button("run-stop", 2083, 457, 76, 52, "Run/\nStop", True, 16, rx=9, fill="#e8e6e0")
    p.raw(f'<path d="M{p.X(2012)},{p.Y(507)} H{p.X(2083)} V{p.Y(490)}" fill="none" stroke="#999" stroke-width="2"/>')

    # Save (print) button
    p.led("save-led", 1150, 588, "Save indicator")
    p.text(1208, 585, "Save", 17, "#222", "bold")
    p.begin("save", "button", "Save (print)", False, cx=1208, cy=636)
    X, Y = p.X(1208), p.Y(636)
    p.raw(f'<circle cx="{X}" cy="{Y+3}" r="33" fill="#7d7d7d"/>')
    p.raw(f'<circle class="osc-face" cx="{X}" cy="{Y}" r="33" fill="#e8e6e0" stroke="#6f6f6f" stroke-width="2"/>')
    p.raw(f'<rect x="{X-14}" y="{Y-6}" width="28" height="14" rx="2" fill="none" stroke="#333" stroke-width="2.5"/>'
          f'<rect x="{X-9}" y="{Y-15}" width="18" height="9" fill="none" stroke="#333" stroke-width="2"/>'
          f'<line x1="{X-9}" y1="{Y+12}" x2="{X+9}" y2="{Y+12}" stroke="#333" stroke-width="2"/>')
    p.end()

    def section(x0, y0, x1, y1, title):
        p.rect(x0, y0, x1, y1, "#d6d4ce", rx=8)
        p.rect(x0, y0, x1, y0 + 30, "#c4c2bc", rx=6)
        p.text((x0 + x1) / 2, y0 + 15, title, 19, "#fff", "bold")

    # VERTICAL  (sections now run up to just below the button rows)
    TOP = 568
    section(1268, TOP, 1690, 1258, "Vertical")
    C, D = (1268 + 1690) / 2, 112          # section centre line; CH1/CH2 columns at C -/+ D
    L, Rr = C - D, C + D
    p.text(C, 690, "Position", 19, "#222", "bold")
    p.knob("ch1-position", L, 690, 40, "CH1 vertical position")
    p.knob("ch2-position", Rr, 690, 40, "CH2 vertical position")
    p.button("ch1-menu", L, 800, 70, 46, "1", True, 20, fill=YEL, rx=9)
    p.button("math", C, 800, 70, 46, "Math", False, 17, fill=PNK, rx=9)
    p.button("ch2-menu", Rr, 800, 70, 46, "2", True, 20, fill=BLU, rx=9)
    p.raw(f'<line x1="{p.X(L-40)}" y1="{p.Y(840)}" x2="{p.X(Rr+40)}" y2="{p.Y(840)}" stroke="#999" stroke-width="2"/>')
    p.text(C, 858, "Menu", 18, "#666", "bold")
    p.text(C, 965, "Scale", 19, "#222", "bold")
    p.knob("ch1-scale", L, 965, 60, "CH1 volts/div", notches=10, detent=36)
    p.knob("ch2-scale", Rr, 965, 60, "CH2 volts/div", notches=10, detent=36)
    for x0, x1 in [(1288, C - 75), (C + 75, 1670)]:
        p.raw(f'<line x1="{p.X(x0)}" y1="{p.Y(1092)}" x2="{p.X(x1)}" y2="{p.Y(1092)}" stroke="#aaa" stroke-width="2"/>')
    p.text(C, 1092, "300 V CAT II", 17, "#bbb", "bold")
    p.text(L - 40, 1140, "1", 20, "#222", "bold")
    p.text(Rr - 40, 1140, "2", 20, "#222", "bold")
    p.bnc("ch1-input", L, 1203, "CH1 input", "silver")
    p.bnc("ch2-input", Rr, 1203, "CH2 input", "silver")

    # HORIZONTAL
    section(1704, TOP, 1918, 1258, "Horizontal")
    p.text(1811, 632, "Position", 18, "#222", "bold")
    p.knob("hor-position", 1811, 690, 40, "Horizontal position")
    p.button("horiz-menu", 1811, 790, 80, 46, "Horiz", True, 17, rx=9, fill="#f4f3ef")
    p.button("set-to-zero", 1811, 862, 80, 50, "Set to\nZero", True, 15, rx=9, fill="#f4f3ef")
    p.text(1811, 920, "Scale", 18, "#222", "bold")
    p.knob("hor-scale", 1811, 1000, 58, "Horizontal sec/div", notches=10, detent=36)
    p.text(1811, 1140, "Ext Trig", 19, "#222", "bold")
    p.bnc("ext-trig", 1811, 1203, "External trigger input", "silver", active=False)

    # TRIGGER
    section(1932, TOP, 2172, 1258, "Trigger")
    p.text(2052, 632, "Level", 18, "#222", "bold")
    p.knob("trig-level", 2052, 690, 40, "Trigger level")
    p.button("trig-menu", 2052, 800, 84, 52, "Trig\nMenu", True, 15, rx=9, fill="#f4f3ef")
    p.button("trig-50", 2052, 885, 84, 52, "Set To\n50%", True, 15, rx=9, fill="#f4f3ef")
    p.button("force-trig", 2052, 970, 84, 52, "Force\nTrig", True, 15, rx=9, fill="#f4f3ef")
    p.button("trig-view", 2052, 1055, 84, 52, "Trig\nView", True, 15, rx=9, fill="#f4f3ef")
    return p


if __name__ == "__main__":
    import os
    # Writes the SVGs and the control map beside this script, in place:
    #   python tools/bench-scope/panels/gen_panels.py
    here = os.path.dirname(os.path.abspath(__file__))
    cmap = {"version": 1, "notes": "data-control names are shared across models. "
            "Element id = <prefix>-<data-control>. Knobs rotate via the child g.osc-knob-rot "
            "about (data-cx, data-cy). data-push names the knob's push action, if any.",
            "models": {}}
    for build, fname in [(build_tbs, "tbs2072b.svg"), (build_tds, "tds2001c.svg")]:
        p = build()
        with open(os.path.join(here, fname), "w", encoding="utf-8") as f:
            f.write(p.svg())
        cmap["models"][p.model] = {"file": fname, "idPrefix": p.prefix,
                                   "viewBox": [0, 0, p.w, p.h], "controls": p.controls}
    with open(os.path.join(here, "controls.json"), "w", encoding="utf-8") as f:
        json.dump(cmap, f, indent=1)
    print("ok")
