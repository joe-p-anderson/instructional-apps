// Theme refresh ticket 03: bench-scope uses the banner layout and its front panel fills the
// full-width Display, so the panel labels are readable at 1366×768.
import { test, expect } from '@playwright/test';
import { openSourceDrawer } from './helpers/bench-drawer.js';

const PAGE = '/tools/bench-scope/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}

const box = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

/** Median rendered height (CSS px, to 0.01 px) of the front panel's text labels. */
const medianLabelHeight = (page) => page.evaluate(() => {
  const hs = [...document.querySelectorAll('svg.osc-panel text')]
    .map((t) => Math.round(t.getBoundingClientRect().height * 100) / 100)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  return hs[Math.floor(hs.length / 2)];
});

/** The content box (inside the padding) of an element. */
const contentBox = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  const [t, rt, b, l] = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs[`padding${k}`]) + parseFloat(cs[`border${k}Width`]));
  return { width: r.width - l - rt, height: r.height - t - b, bottom: r.bottom - b };
});

const noPageScroll = (page) => page.evaluate(() => {
  const s = document.scrollingElement;
  return s.scrollHeight <= innerHeight && s.scrollWidth <= innerWidth;
});

test('bench-scope declares the banner layout: the strip sections side by side below the Display', async ({ page }) => {
  await open(page);
  await expect(page.locator('.fw-app')).toHaveClass(/\bfw-layout-banner\b/);
  const panel = page.getByRole('tabpanel');
  const d = await box(panel.locator('.fw-displays'));
  expect(d.width).toBeGreaterThan((await box(panel)).width - 40);
  const c = await box(panel.locator('.fw-controls'));
  expect(c.top).toBeGreaterThanOrEqual(d.bottom - 1);
  const sections = await panel.locator('.fw-controls .fw-section').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right };
  }));
  expect(sections.length).toBeGreaterThan(1);
  for (let i = 1; i < sections.length; i++) {
    expect(Math.abs(sections[i].top - sections[0].top)).toBeLessThan(1);
    expect(sections[i].left).toBeGreaterThanOrEqual(sections[i - 1].right - 1);
  }
});

for (const skin of ['tbs2072b', 'tds2001c']) {
  test(`${skin}: at 1366×768 the front panel fills the Display, its labels are at least 11 px, and the page does not scroll`, async ({ page }) => {
    await open(page);
    await page.getByRole('combobox', { name: /model|skin/i }).selectOption(skin);
    await expect(page.locator('svg.osc-panel')).toHaveCount(1);
    const label = await medianLabelHeight(page);
    console.log(`${skin}: median panel label height ${label.toFixed(2)} px`);
    expect(label).toBeGreaterThanOrEqual(11);
    expect(await noPageScroll(page)).toBe(true);

    // The panel is as large as the Display allows (keeping its aspect ratio): it touches the
    // Display's width or height, and leaves no empty band below it.
    const d = await contentBox(page.locator('.fw-displays'));
    const svg = await box(page.locator('svg.osc-panel'));
    expect(svg.width).toBeLessThanOrEqual(d.width + 1);
    expect(svg.height).toBeLessThanOrEqual(d.height + 1);
    expect(Math.min(d.width - svg.width, d.height - svg.height)).toBeLessThan(2);
    expect(d.bottom - svg.bottom).toBeLessThan(2);
  });
}

test('the Controls strip is one row of comfortable height, so the front panel keeps the height', async ({ page }) => {
  await open(page);
  const strip = page.locator('.fw-controls');
  const [scrollW, clientW] = await strip.evaluate((e) => [e.scrollWidth, e.clientWidth]);
  expect(scrollW).toBeLessThanOrEqual(clientW);
  for (const name of ['Oscilloscope model', 'CH1 waveform']) {
    const sel = page.getByRole('combobox', { name, exact: true });
    await expect(sel).toBeVisible();
    expect((await box(sel)).height, name).toBeGreaterThanOrEqual(22);
  }
  await expect(page.getByRole('slider', { name: 'CH1 frequency', exact: true })).toBeVisible();
  expect((await box(strip)).height).toBeLessThanOrEqual(70);
  // The other source Controls wait in the closed drawer.
  await expect(page.getByRole('spinbutton', { name: 'CH1 amplitude', exact: true })).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'CH2 source', exact: true })).toBeHidden();
});

test('the Controls strip section label is at least 11 px', async ({ page }) => {
  await open(page);
  const label = page.locator('.fw-controls').getByText('CH1 generator', { exact: true });
  await expect(label).toBeVisible();
  expect(parseFloat(await label.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(11);
});

test('the source drawer opens over the Display, holds the other source Controls, and Escape closes it', async ({ page }) => {
  await open(page);
  const toggle = page.getByRole('button', { name: 'More source controls' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await openSourceDrawer(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const drawer = page.getByRole('region', { name: 'Source controls' });
  const d = await box(drawer);
  const displays = await box(page.locator('.fw-displays'));
  expect(d.top).toBeGreaterThanOrEqual(displays.top - 1);
  expect(d.bottom).toBeLessThanOrEqual(displays.bottom + 1);

  await page.getByRole('combobox', { name: 'CH2 source', exact: true }).selectOption('independent');
  for (const name of ['CH1 amplitude', 'CH1 offset', 'CH2 amplitude', 'CH2 phase']) {
    await expect(page.getByRole('spinbutton', { name, exact: true }), name).toBeVisible();
  }
  for (const name of ['CH1 output', 'CH2 source']) {
    const label = drawer.getByText(name, { exact: true });
    await expect(label).toBeVisible();
    expect(parseFloat(await label.evaluate((e) => getComputedStyle(e).fontSize)), name).toBeGreaterThanOrEqual(11);
  }
  expect(await noPageScroll(page)).toBe(true);

  await page.getByRole('spinbutton', { name: 'CH1 amplitude', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(drawer).toBeHidden();
});

test('the screen canvas backing store matches its displayed size times devicePixelRatio', async ({ browser }) => {
  for (const dpr of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await open(page);
    const [w, h, cw, ch] = await page.locator('canvas.bs-screen').evaluate((c) => {
      const r = c.getBoundingClientRect();
      return [c.width, c.height, r.width, r.height];
    });
    expect(Math.abs(w - cw * dpr)).toBeLessThanOrEqual(2);
    expect(Math.abs(h - ch * dpr)).toBeLessThanOrEqual(2);
    await ctx.close();
  }
});
