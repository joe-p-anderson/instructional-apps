import { test, expect } from '@playwright/test';

const PAGE = '/framework/v1/authoring/encode-keys.html';

test('the authoring page encodes a Condition that the runner decodes back exactly', async ({ page }) => {
  await page.goto(PAGE);
  await page.getByRole('textbox', { name: 'Value' })
    .fill("{ state: 'phi', target: Math.PI / 2, tol: 0.05, targetLabel: 'π/2 ≈ 1.571 rad' }");
  const output = page.getByRole('status', { name: 'Encoded key' });
  await expect(output).toHaveText(/^enc1:/);
  const key = await output.textContent();
  expect(key).not.toContain('target');

  const decoded = await page.evaluate(async (k) => {
    const { decodeKey } = await import('/framework/v1/runner/keys.js');
    return decodeKey(k);
  }, key);
  expect(decoded).toEqual({ state: 'phi', target: Math.PI / 2, tol: 0.05, targetLabel: 'π/2 ≈ 1.571 rad' });
});

test('encodeKey and decodeKey are available in the console', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.encodeKey);
  expect(await page.evaluate(() => window.decodeKey(window.encodeKey('b')))).toBe('b');
});

test('the oscilloscope Activity page source has no plain Condition targets', async ({ request }) => {
  const source = await (await request.get('/tools/oscilloscope/activities/phase-period-amplitude.js')).text();
  expect(source).not.toContain('π/2');
  expect(source).toContain("condition: 'enc1:");
});
