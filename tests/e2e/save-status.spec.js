import { test, expect } from '@playwright/test';

// Save status in the header (shell revision 04): "Saved hh:mm" after each autosave, and a
// warning, announced once, when the browser refuses to save.

const ACTIVITY = '/tools/oscilloscope/activities/phase-period-amplitude.html';
const STANDALONE = '/tools/oscilloscope/';
const WARNING = 'Not saved: download your Report';

async function openActivity(page) {
  await page.goto(ACTIVITY);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('tablist')).toBeVisible();
}

async function openStandalone(page) {
  await page.goto(STANDALONE);
  await page.waitForFunction(() => window.toolHost);
}

async function setNumber(page, name, value) {
  const box = page.getByRole('tabpanel').getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

/** The browser refuses every write, as in a private window or with full storage. */
async function refuseStorage(page) {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
  });
}

const status = (page) => page.getByRole('banner').locator('.fw-save-status');

for (const [where, open] of [['an Activity', openActivity], ['a Standalone page', openStandalone]]) {
  test(`changing a Control on ${where} shows "Saved" and the time in the header`, async ({ page }) => {
    await open(page);
    await setNumber(page, 'f (Hz)', 0.3);
    await expect(status(page)).toHaveText(/^Saved \d{2}:\d{2}$/);
    await expect(status(page)).toBeVisible();
    // Successful saves are not announced: the status is no live region.
    await expect(status(page)).not.toHaveAttribute('role', /./);
    await expect(status(page)).not.toHaveAttribute('aria-live', /./);
  });

  test(`a refused save on ${where} shows the warning, announced once`, async ({ page }) => {
    await refuseStorage(page);
    await open(page);
    await setNumber(page, 'f (Hz)', 0.3);
    await expect(status(page)).toHaveText(WARNING);
    await expect(status(page)).toHaveAttribute('data-state', 'failed');

    const alert = page.getByRole('banner').locator('[aria-live="assertive"]');
    await expect(alert).toHaveText(WARNING);

    // Further refused saves leave the live region alone, so the warning isn't repeated.
    await alert.evaluate((el) => {
      window.alertChanges = 0;
      new MutationObserver((records) => { window.alertChanges += records.length; })
        .observe(el, { childList: true, characterData: true, subtree: true });
    });
    await setNumber(page, 'f (Hz)', 0.4);
    await setNumber(page, 'f (Hz)', 0.5);
    await expect(status(page)).toHaveText(WARNING);
    expect(await page.evaluate(() => window.alertChanges)).toBe(0);
  });
}
