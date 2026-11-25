// Bench-scope keeps CH1 amplitude, DC offset and the CH2 source Controls in a drawer that the
// "More source controls" button opens. Tests that use those Controls open it first.
import { expect } from '@playwright/test';

export async function openSourceDrawer(page) {
  const toggle = page.getByRole('button', { name: 'More source controls' });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.getByRole('region', { name: 'Source controls' })).toBeVisible();
}
