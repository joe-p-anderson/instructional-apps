// Standalone mode's share link lives in the header's ⋯ menu as "Copy share link", which writes
// it to the clipboard. copyShareLink(page) picks that item and returns the copied link.

export async function copyShareLink(page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Copy share link' }).click();
  await page.waitForFunction(async () => (await navigator.clipboard.readText()) !== '');
  return page.evaluate(() => navigator.clipboard.readText());
}
