import { test, expect } from '@playwright/test';
import { installCanvasTextRecorder, displayTexts } from './helpers/display-text.js';

// No Display scrolls inside itself: for every Tool and Mode, the Display area (.fw-displays)
// holds its content without overflow, at 1366×768 and at the Tool's minimum Display width.
// Display text meets the floor: at 1366×768 and at the Tool's minimum Display width, no visible
// text in the Display area, DOM or canvas, is under 12 px (the token is 13 px), except exempt
// artwork marked `data-fw-artwork`. Activities are checked in every Part at 1366×768.

const TOOLS = ['bench-scope', 'electrostatics', 'fourier', 'least-squares', 'oscilloscope', 'spacetime', 'vernier'];

/** The Tool's declared minimum Display width (defineTool() defaults it to 480 px). */
const minDisplayWidth = (page) => page.evaluate(() => window.toolHost.tool.minDisplayWidth);

const TEXT_FLOOR = 12;

const ACTIVITIES = [
  '/tools/electrostatics/activities/conductor-properties.html',
  '/tools/fourier/activities/fourier-series.html',
  '/tools/oscilloscope/activities/phase-period-amplitude.html',
  '/tools/spacetime/activities/lab10.html',
];

/** Display text under the floor, as readable lines; [] when everything meets it. */
const smallText = async (page) => (await displayTexts(page))
  .filter((t) => t.px < TEXT_FLOOR)
  .map((t) => `${t.px} px ${t.where}: ${JSON.stringify(t.text)}`);

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page, tool) {
  await installCanvasTextRecorder(page);
  await page.goto(`/tools/${tool}/`);
  await page.waitForFunction(() => window.toolHost);
}

/** Every Mode tab of the Standalone page, or [null] for a page with one unlabelled panel. */
const modeTabs = async (page) => {
  const n = await page.getByRole('tab').count();
  return n ? [...Array(n).keys()] : [null];
};

/** The visible Display area's overflow in px (scrollHeight − clientHeight); ≤ 0 means it fits. */
const overflow = (page) => page.locator('.fw-displays:visible').evaluate((e) => e.scrollHeight - e.clientHeight);

/** Resize the viewport so the visible Display area is `width` px wide, keeping the height. */
async function setDisplayWidth(page, width) {
  const vp = page.viewportSize();
  const now = await page.locator('.fw-displays:visible').evaluate((e) => e.getBoundingClientRect().width);
  await page.setViewportSize({ width: Math.round(vp.width - (now - width)), height: vp.height });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

for (const tool of TOOLS) {
  test(`${tool}: no Display scrolls inside itself and its text meets the floor`, async ({ page }) => {
    await open(page, tool);
    for (const tab of await modeTabs(page)) {
      await page.setViewportSize({ width: 1366, height: 768 });
      if (tab !== null) await page.getByRole('tab').nth(tab).click();
      const mode = tab === null ? tool : `${tool} / ${await page.getByRole('tab').nth(tab).textContent()}`;
      await settle(page);
      expect(await overflow(page), `${mode} at 1366×768`).toBeLessThanOrEqual(0);
      expect(await smallText(page), `${mode}: Display text under ${TEXT_FLOOR} px`).toEqual([]);

      const min = await minDisplayWidth(page);
      await setDisplayWidth(page, min);
      await settle(page);
      expect(await overflow(page), `${mode} at a ${min} px Display`).toBeLessThanOrEqual(0);
      expect(await smallText(page), `${mode} at a ${min} px Display: text under ${TEXT_FLOOR} px`).toEqual([]);
    }
    // Bench-scope's other skin draws its screen readouts at its own native size.
    if (tool === 'bench-scope') {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.getByRole('combobox', { name: 'Oscilloscope model', exact: true }).selectOption('tds2001c');
      await expect(page.locator('svg[data-model="TDS2001C"]')).toBeVisible();
      await settle(page);
      expect(await smallText(page), `bench-scope / TDS2001C: Display text under ${TEXT_FLOOR} px`).toEqual([]);
      const min = await minDisplayWidth(page);
      await setDisplayWidth(page, min);
      await settle(page);
      expect(await smallText(page), `bench-scope / TDS2001C at a ${min} px Display: text under ${TEXT_FLOOR} px`).toEqual([]);
    }
  });
}

for (const url of ACTIVITIES) {
  test(`${url}: no Display scrolls inside itself and its text meets the floor in every Part at 1366×768`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installCanvasTextRecorder(page);
    await page.goto(url);
    await page.waitForFunction(() => window.activityHost);
    await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
    await page.getByRole('button', { name: 'Start' }).click();
    for (const tab of await modeTabs(page)) {
      if (tab !== null) await page.getByRole('tab').nth(tab).click();
      const part = tab === null ? url : `${url} / ${await page.getByRole('tab').nth(tab).textContent()}`;
      await settle(page);
      expect(await overflow(page), `${part}: Display scrolls inside itself`).toBeLessThanOrEqual(0);
      expect(await smallText(page), `${part}: Display text under ${TEXT_FLOOR} px`).toEqual([]);
    }
  });
}
