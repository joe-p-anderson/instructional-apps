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
