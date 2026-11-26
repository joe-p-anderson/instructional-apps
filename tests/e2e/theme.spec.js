import { test, expect } from '@playwright/test';

// The Refined Cream theme (framework/v1/theme.css), checked on the oscilloscope Activity page.

const PAGE = '/tools/oscilloscope/activities/phase-period-amplitude.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });

// WCAG contrast audit: every visible framework text run against its effective background,
// with ancestor opacity blended in. Plot and math SVG are the Tool's, not framework text.
// Inactive components (locked Task cards, locked Controls, disabled inputs) are exempt
// (WCAG 1.4.3), except a locked Task's "Locked until …" line, which must stay readable.
function lowContrastText(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const over = (top, under) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const lum = ({ r, g, b }) => {
      const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

    function background(el) {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      for (const c of layers.reverse()) bg = over(c, bg);
      return bg;
    }
    function opacity(el) {
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return o;
    }
    const exempt = 'svg, mjx-container, .fw-display, .fw-task-card[data-status="locked"], .fw-control.fw-locked, :disabled';
    const lockedReason = /^Locked until /;

    const failures = [];
    let reasons = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || !el.closest('.fw-app')) continue;
      if (el.closest(exempt) && !lockedReason.test(text)) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue;
      const bg = background(el);
      const fg = parse(getComputedStyle(el).color);
      const seen = over({ ...fg, a: fg.a * opacity(el) }, bg);
      const r = ratio(seen, bg);
      if (lockedReason.test(text)) reasons++;
      if (r < 4.5) failures.push(`${text.slice(0, 40)} (.${[...el.classList].join('.')}): ${r.toFixed(2)}:1`);
    }
    return { failures, reasons };
  });
}

/** The audit's failures, checking that `reasons` "Locked until …" lines were audited. */
async function contrastFailures(page, reasons = 0) {
  const audit = await lowContrastText(page);
  expect(audit.reasons, 'locked reasons audited').toBe(reasons);
  return audit.failures;
}

test('no visible framework text is below 4.5:1 contrast on the Activity page', async ({ page }) => {
  await open(page);
  expect(await contrastFailures(page), 'name gate').toEqual([]);

  await enterName(page);
  const p1 = part(page, 1);
  // Reveal miss feedback and the Hint on Task 1.1; Tasks 1.2 and 1.3 are locked.
  const submit = p1.getByRole('button', { name: 'Submit Task 1.1' });
  for (let i = 0; i < 3; i++) await submit.click();
  await expect(p1.getByText(/Hint:/)).toBeVisible();
  expect(await contrastFailures(page, 2), 'Part 1').toEqual([]);

  await page.getByRole('tab', { name: /Part 2/ }).click();
  expect(await contrastFailures(page, 1), 'Part 2').toEqual([]);
});

test('Libre Baskerville is self-hosted and is the framework typeface', async ({ page }) => {
  const fontRequests = [];
  page.on('request', (r) => { if (r.resourceType() === 'font') fontRequests.push(new URL(r.url())); });
  await open(page);
  await enterName(page);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    regular: document.fonts.check('16px "Libre Baskerville"'),
    loaded: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Libre Baskerville' && f.status === 'loaded')
      .map((f) => `${f.style} ${f.weight}`),
  }));
  expect(fonts.family).toMatch(/^"?Libre Baskerville"?,/);
  expect(fonts.regular).toBe(true);
  expect(fonts.loaded).toContain('normal 400');
  expect(fontRequests.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  for (const url of fontRequests) {
    expect(url.origin).toBe(origin);
    expect(url.pathname).toMatch(/^\/framework\/v1\/vendor\/libre-baskerville\/.+\.woff2$/);
  }
});

test('Question prompts read as text with a blue rule, and the Hint sits in a tinted box', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const submit = p1.getByRole('button', { name: 'Submit Task 1.1' });
  for (let i = 0; i < 3; i++) await submit.click();
  const style = (el) => el.evaluate((e) => {
    const s = getComputedStyle(e);
    return { color: s.color, fontStyle: s.fontStyle, rule: `${s.borderLeftStyle} ${s.borderLeftColor}`, bg: s.backgroundColor };
  });
  const text = await page.evaluate(() => getComputedStyle(document.body).color);
  const blue = 'rgb(27, 79, 138)';

  const question = await style(page.locator('.fw-question-prompt').first());
  expect(question).toMatchObject({ color: text, fontStyle: 'normal', rule: `solid ${blue}` });

  const hint = await style(p1.locator('.fw-task-hint:not([hidden])'));
  expect(hint).toMatchObject({ color: 'rgb(138, 95, 0)', fontStyle: 'normal', rule: 'solid rgb(138, 95, 0)' });
  expect(hint.bg).not.toBe('rgba(0, 0, 0, 0)');

  expect(await style(p1.locator('.fw-task-prompt').first())).toMatchObject({ fontStyle: 'normal' });
  const label = await p1.locator('.fw-section-label').first().evaluate((e) => {
    const s = getComputedStyle(e);
    return { variant: s.fontVariantCaps, transform: s.textTransform, fontStyle: s.fontStyle };
  });
  expect(label).toEqual({ variant: 'normal', transform: 'uppercase', fontStyle: 'normal' });
});

const smallCapsText = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => e.checkVisibility() && e.textContent.trim() && getComputedStyle(e).fontVariantCaps !== 'normal')
  .map((e) => e.textContent.trim().slice(0, 30)));

test('no text is set in small caps, which Libre Baskerville would have to synthesise', async ({ page }) => {
  const smallCaps = () => smallCapsText(page);
  await open(page);
  expect(await smallCaps(), 'name gate').toEqual([]);
  await enterName(page);
  // The page title, the Part tabs, the Task titles and the buttons among them.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeVisible();
  await expect(part(page, 1).getByRole('heading', { level: 3 }).first()).toBeVisible();
  expect(await smallCaps(), 'Part 1').toEqual([]);
});

// The app-ports Tools' Standalone pages follow the same rules.
for (const tool of ['electrostatics', 'spacetime', 'least-squares']) {
  test(`the ${tool} page has no small caps and no framework text below 4.5:1`, async ({ page }) => {
    await page.goto(`/tools/${tool}/`);
    await page.waitForFunction(() => window.toolHost);
    expect(await smallCapsText(page), 'small caps').toEqual([]);
    expect(await contrastFailures(page), 'contrast').toEqual([]);
  });
}

test('the electrostatics plot takes its font and palette from the --fw-plot-* tokens', async ({ page }) => {
  await page.addInitScript(() => {
    const set = (html) => {
      html.style.setProperty('--fw-plot-bg', '#fffdf0');
      html.style.setProperty('--fw-plot-grid', '#e0e0e0');
      html.style.setProperty('--fw-plot-text', '#3a3a3a');
      html.style.setProperty('--fw-plot-font-size', '12px');
    };
    if (document.documentElement) set(document.documentElement);
    else new MutationObserver((_, obs) => { if (document.documentElement) { set(document.documentElement); obs.disconnect(); } })
      .observe(document, { childList: true });
  });
  await page.goto('/tools/electrostatics/');
  await page.waitForFunction(() => window.toolHost);
  const plot = await page.locator('.js-plotly-plot').first().evaluate((div) => ({
    paper: div.layout.paper_bgcolor,
    grid: div.layout.xaxis.gridcolor,
    font: div.layout.font,
    token: getComputedStyle(document.documentElement).getPropertyValue('--fw-plot-font').trim(),
  }));
  expect(plot.paper).toBe('#fffdf0');
  expect(plot.grid).toBe('#e0e0e0');
  expect(plot.font.family).toBe(plot.token);
  expect(plot.font.family).toMatch(/^'?"?Libre Baskerville/);
  expect(plot.font.size).toBe(12);
  expect(plot.font.color).toBe('#3a3a3a');
});

test('locked Task cards stay readable and say they are locked; locked Controls are at 0.55', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const locked = p1.getByRole('region', { name: 'Task 1.2' });
  await expect(locked).toHaveAttribute('data-status', 'locked');
  await expect(locked).toHaveCSS('opacity', '0.6');
  await expect(locked.getByText('Locked until Task 1.1 is done')).toBeVisible();
  // The open Task doesn't say so.
  await expect(p1.getByRole('region', { name: 'Task 1.1' }).getByText(/^Locked until/)).toBeHidden();

  // Part 2, Task 2.1 locks Va.
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const va = part(page, 2).locator('.fw-control.fw-locked').first();
  await expect(va).toHaveCSS('opacity', '0.55');
});

test('the oscilloscope plot takes its palette and font from the --fw-plot-* tokens', async ({ page }) => {
  // Retheme the plot before the page's scripts run: the Tool must follow the tokens.
  await page.addInitScript(() => {
    const set = (html) => {
      html.style.setProperty('--fw-plot-trace-1', '#007a33');
      html.style.setProperty('--fw-plot-bg', '#fffdf0');
      html.style.setProperty('--fw-plot-font-size', '13px');
    };
    if (document.documentElement) set(document.documentElement);
    else new MutationObserver((_, obs) => { if (document.documentElement) { set(document.documentElement); obs.disconnect(); } })
      .observe(document, { childList: true });
  });
  await open(page);
  await enterName(page);
  const plot = await part(page, 1).locator('.js-plotly-plot').evaluate((div) => ({
    trace: div.data[0].line.color,
    paper: div.layout.paper_bgcolor,
    font: div.layout.font,
    token: getComputedStyle(document.documentElement).getPropertyValue('--fw-plot-font').trim(),
  }));
  expect(plot.trace).toBe('#007a33');
  expect(plot.paper).toBe('#fffdf0');
  expect(plot.font.family).toBe(plot.token);
  expect(plot.font.family).toMatch(/^'?"?Libre Baskerville/);
  expect(plot.font.size).toBe(13);
});

test('slider thumbs are 18 px and round on a 4 px track', async ({ page }) => {
  await open(page);
  await enterName(page);
  const slider = part(page, 1).getByRole('slider').first();
  await expect(slider).toHaveCSS('height', '4px');
  // The thumb is a pseudo-element no style query can see, so measure it as rendered: the dark
  // pixels in a screenshot around the slider (the track and background are light).
  const s = await slider.boundingBox();
  const pad = 10; // the thumb overhangs the track by 7 px; the Control's name is further up
  const png = await page.screenshot({ clip: { x: s.x, y: s.y - pad, width: s.width, height: s.height + 2 * pad } });
  const thumb = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = canvas.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, img.width, img.height);
    const dark = (x, y) => { const i = 4 * (y * img.width + x); return data[i] + data[i + 1] + data[i + 2] < 3 * 128; };
    let [left, top, right, bottom] = [Infinity, Infinity, -1, -1];
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (dark(x, y)) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    const corners = [[left, top], [right, top], [left, bottom], [right, bottom]].filter(([x, y]) => dark(x, y)).length;
    return { width: right - left + 1, height: bottom - top + 1, corners };
  }, `data:image/png;base64,${png.toString('base64')}`);
  expect(thumb.width).toBeGreaterThanOrEqual(17);
  expect(thumb.width).toBeLessThanOrEqual(19);
  expect(thumb.height).toBeGreaterThanOrEqual(17);
  expect(thumb.height).toBeLessThanOrEqual(19);
  expect(thumb.corners, 'round, so its bounding box corners are empty').toBe(0);
});

test('buttons, tabs and reset buttons show a focus-visible outline', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const targets = [
    page.getByRole('tab', { name: /Part 1/ }),
    p1.getByRole('button', { name: 'Reset Va' }),
    p1.getByRole('button', { name: 'Submit Task 1.1' }),
  ];
  for (const target of targets) {
    // Keyboard focus: focus the element before it, then Tab onto it.
    await target.evaluate((e) => {
      const all = [...document.querySelectorAll('button, input, textarea, [tabindex]')]
        .filter((x) => x.tabIndex >= 0 && !x.disabled && x.checkVisibility());
      const i = all.indexOf(e);
      if (i > 0) all[i - 1].focus(); else document.body.focus();
    });
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expect(target).toHaveCSS('outline-style', 'solid');
    await expect(target).toHaveCSS('outline-width', '2px');
  }
});
