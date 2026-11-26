import { test, expect } from '@playwright/test';

// No Display scrolls inside itself: for every Tool and Mode, the Display area (.fw-displays)
// holds its content without overflow, at 1366×768 and at the Tool's minimum Display width.

const TOOLS = ['bench-scope', 'electrostatics', 'least-squares', 'oscilloscope', 'spacetime', 'vernier'];

/** The Tool's declared minimum Display width (defineTool() defaults it to 480 px). */
const minDisplayWidth = (page) => page.evaluate(() => window.toolHost.tool.minDisplayWidth);

async function open(page, tool) {
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
  test(`${tool}: no Display scrolls inside itself, at 1366×768 and at the minimum Display width`, async ({ page }) => {
    await open(page, tool);
    for (const tab of await modeTabs(page)) {
      await page.setViewportSize({ width: 1366, height: 768 });
      if (tab !== null) await page.getByRole('tab').nth(tab).click();
      const mode = tab === null ? tool : `${tool} / ${await page.getByRole('tab').nth(tab).textContent()}`;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await overflow(page), `${mode} at 1366×768`).toBeLessThanOrEqual(0);

      const min = await minDisplayWidth(page);
      await setDisplayWidth(page, min);
      expect(await overflow(page), `${mode} at a ${min} px Display`).toBeLessThanOrEqual(0);
    }
  });
}
