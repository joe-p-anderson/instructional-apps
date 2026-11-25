// Seam 2 (Spec 0002), ticket 10: entering XY through each skin's own menu on the Standalone page.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/bench-scope/';
const SKINS = [
  { id: 'tbs2072b', model: 'TBS2072B', button: 'acquire', softkey: 'softkey-6' },
  { id: 'tds2001c', model: 'TDS2001C', button: 'display', softkey: 'softkey-3' },
];

async function open(page, skin) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
  if (skin.id !== 'tbs2072b') {
    await page.getByRole('combobox', { name: 'Oscilloscope model', exact: true }).selectOption(skin.id);
  }
  await expect(page.locator(`svg[data-model="${skin.model}"]`)).toBeVisible();
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const control = (page, skin, id) => page.locator(`svg[data-model="${skin.model}"] .osc-control[data-control="${id}"]`);

for (const skin of SKINS) {
  test(`${skin.model}: ${skin.button} → ${skin.softkey} switches to XY and greys the time base`, async ({ page }) => {
    await open(page, skin);
    expect((await snapshot(page)).displayFormat).toBe('yt');
    await control(page, skin, skin.button).click();
    await control(page, skin, skin.softkey).click();
    await expect.poll(async () => (await snapshot(page)).displayFormat).toBe('xy');

    const hScale = control(page, skin, 'hor-scale');
    await expect(hScale).toHaveAttribute('data-disabled', 'true');
    await expect(control(page, skin, 'trig-menu')).toHaveAttribute('data-disabled', 'true');
    const before = (await snapshot(page)).hScale;
    await hScale.hover();
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(100);
    expect((await snapshot(page)).hScale).toBe(before);

    await control(page, skin, 'autoset').click();
    await expect.poll(async () => (await snapshot(page)).displayFormat).toBe('yt');
    await expect(hScale).toHaveAttribute('data-disabled', 'false');
  });
}
