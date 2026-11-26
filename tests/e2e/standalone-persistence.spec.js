import { test, expect } from '@playwright/test';
import { copyShareLink } from './helpers/share-link.js';

const PAGE = '/tools/oscilloscope/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}

async function setNumber(page, name, value) {
  const box = page.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

test('a reload restores the Standalone State', async ({ page }) => {
  await open(page);
  await setNumber(page, 'f (Hz)', 0.25);
  await setNumber(page, 'Va (V)', 1.5);

  await page.reload();
  await page.waitForFunction(() => window.toolHost);

  const s = await snapshot(page);
  expect(s.f).toBeCloseTo(0.25, 9);
  expect(s.Va).toBeCloseTo(1.5, 9);
  await expect(page.getByRole('spinbutton', { name: 'f (Hz)', exact: true })).toHaveValue(/^0\.25/);
});

test('a share link reproduces the State in a fresh browser', async ({ page, browser }) => {
  await open(page);
  await setNumber(page, 'f (Hz)', 0.4);
  await setNumber(page, 'Δt (s)', 1.5);

  const url = await copyShareLink(page);
  expect(url).toMatch(/#s=/);

  // A classmate opens the link: new context, so no autosave to fall back on.
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await open(theirs, url);
  const s = await snapshot(theirs);
  expect(s.f).toBeCloseTo(0.4, 9);
  expect(s.Dt).toBeCloseTo(1.5, 9);

  // The link is applied once: the hash is cleared, so a later reload shows their own autosave.
  expect(new URL(theirs.url()).hash).toBe('');
  await setNumber(theirs, 'f (Hz)', 0.8);
  await theirs.reload();
  await theirs.waitForFunction(() => window.toolHost);
  expect((await snapshot(theirs)).f).toBeCloseTo(0.8, 9);
  await other.close();
});
