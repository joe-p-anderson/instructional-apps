// Framework v1 UI kit Controls in a real browser: lock and unlock act on the Control's element
// itself when it is operable (a button() is its own element), not only on its descendants.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/framework/v1/authoring/encode-keys.html');
  await page.evaluate(async () => {
    const kit = await import('/framework/v1/ui-kit.js');
    window.presses = 0;
    window.btn = kit.button({ id: 'go', name: 'Go', onClick: () => { window.presses += 1; } });
    document.body.append(window.btn.el);
  });
});

test('a locked button() is disabled and neither a click nor set() presses it', async ({ page }) => {
  const go = page.getByRole('button', { name: 'Go', exact: true });
  await go.click();
  expect(await page.evaluate(() => window.presses)).toBe(1);

  await page.evaluate(() => window.btn.lock());
  await expect(go).toBeDisabled();
  await go.dispatchEvent('click');
  await page.evaluate(() => window.btn.set());
  expect(await page.evaluate(() => [window.presses, window.btn.get()])).toEqual([1, 1]);

  await page.evaluate(() => window.btn.unlock());
  await expect(go).toBeEnabled();
  await go.click();
  expect(await page.evaluate(() => [window.presses, window.btn.get()])).toEqual([2, 2]);
});

test('button() and toggle() pass onLock and onHide through', async ({ page }) => {
  const seen = await page.evaluate(async () => {
    const kit = await import('/framework/v1/ui-kit.js');
    const log = [];
    const b = kit.button({ id: 'b', onLock: (l) => log.push(`b lock ${l}`), onHide: (x) => log.push(`b hide ${x}`) });
    const t = kit.toggle({ id: 't', onLock: (l) => log.push(`t lock ${l}`), onHide: (x) => log.push(`t hide ${x}`) });
    b.lock(); b.hide(); t.lock(); t.show(); t.hide();
    return log;
  });
  expect(seen).toEqual(['b lock true', 'b hide true', 't lock true', 't hide true']);
});

// slider(): "Label (unit)", accessible names from the label, icon-only reset (shell-revision 07).
async function addSlider(page, opts) {
  await page.evaluate(async (o) => {
    const kit = await import('/framework/v1/ui-kit.js');
    window.sl = kit.slider({ min: 0, max: 3, step: 0.01, ...o });
    document.body.append(window.sl.el);
  }, opts);
}

test('a slider shows its unit in parentheses and names its inputs from the label', async ({ page }) => {
  await addSlider(page, { id: 'amp', name: 'Va', label: 'V<sub>a</sub>', unit: 'V', value: 1 });
  await expect(page.locator('.fw-control-name')).toHaveText('Va (V)');
  await expect(page.getByRole('slider', { name: 'Va (V)', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Va (V)', exact: true })).toBeVisible();
});

test('a slider with only an HTML label takes its accessible name from the label, not the id', async ({ page }) => {
  await addSlider(page, { id: 'v', label: '<i>v</i>/<i>c</i>', value: 0 });
  await expect(page.getByRole('slider', { name: 'v/c', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'v/c', exact: true })).toBeVisible();
});

test('the reset is an icon named "Reset to <default> <unit>", disabled at the default', async ({ page }) => {
  await addSlider(page, { id: 'amp', name: 'Va', unit: 'V', value: 1, reset: 0.25 });
  const reset = page.getByRole('button', { name: 'Reset to 0.25 V', exact: true });
  const box = page.getByRole('spinbutton', { name: 'Va (V)', exact: true });
  await expect(reset).toHaveText('↻');
  await expect(reset).toHaveAttribute('title', 'Reset to 0.25 V');
  await expect(reset).toBeEnabled();

  await reset.click();
  await expect(box).toHaveValue('0.25');
  await expect(reset).toBeDisabled();

  await box.fill('2');
  await box.press('Enter');
  await expect(reset).toBeEnabled();
  await page.evaluate(() => window.sl.set(0.25));
  await expect(reset).toBeDisabled();
});

test('unlocking a slider at its default leaves the reset disabled', async ({ page }) => {
  await addSlider(page, { id: 'amp', name: 'Va', unit: 'V', value: 0.25, reset: 0.25 });
  const reset = page.getByRole('button', { name: 'Reset to 0.25 V', exact: true });
  await page.evaluate(() => { window.sl.lock(); window.sl.unlock(); });
  await expect(page.getByRole('slider', { name: 'Va (V)', exact: true })).toBeEnabled();
  await expect(reset).toBeDisabled();
  await page.evaluate(() => window.sl.set(1));
  await expect(reset).toBeEnabled();
});
