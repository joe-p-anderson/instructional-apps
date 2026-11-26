import { test, expect } from '@playwright/test';

// Collapsed Part tabs: when the Part tabs' full titles don't fit in the header row, every
// inactive tab shows just its Part number and the active tab its full title
// (fixture: tests/e2e/fixtures/many-parts.html, seven long Part titles).
const MANY = '/tests/e2e/fixtures/many-parts.html';
const FITS = '/tools/oscilloscope/activities/phase-period-amplitude.html';
const TITLES = ['Part 1: Phase Shift Between Traces', 'Part 2: Period and Amplitude', 'Part 3: Frequency From the Period',
  'Part 4: Peak-to-Peak Voltage', 'Part 5: Reading the Time Base', 'Part 6: Phase From a Time Delay',
  'Part 7: Lissajous Figures'];

async function openActivity(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.activityHost);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('tablist')).toBeVisible();
}

const tabs = (page) => page.getByRole('banner').getByRole('tab');

/** The text a sighted student sees on each tab (text actually drawn wider than a pixel), minus the progress badge. */
const shownTabText = (page) => tabs(page).evaluateAll((els) => els.map((tab) => {
  let text = '';
  const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement.closest('.fw-tab-badge')) continue;
    // Visually hidden text (screen-reader only) sits in a box a pixel wide.
    let shown = true;
    for (let el = n.parentElement; el !== tab; el = el.parentElement) if (el.getBoundingClientRect().width <= 2) shown = false;
    if (shown) text += n.textContent;
  }
  return text.trim();
}));

const expected = (active) => TITLES.map((t, i) => (i === active ? t : String(i + 1)));
const tooltips = (page) => tabs(page).evaluateAll((els) => els.map((el) => el.getAttribute('title')));

const fullNames = (page) => tabs(page).evaluateAll((els) => els.map((el) => el.querySelector('.fw-tab-title').textContent));
const sameRow = async (page) => {
  const bottoms = await tabs(page).evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().bottom)));
  return new Set(bottoms).size === 1;
};

test('at 1366×768 the seven long Part titles collapse: inactive tabs show their number, the active one its full title', async ({ page }) => {
  await openActivity(page, MANY);
  await expect.poll(() => shownTabText(page)).toEqual(expected(0));
  expect(await sameRow(page)).toBe(true); // one header row again
  // Collapsed tabs carry their full title as a tooltip.
  expect(await tooltips(page)).toEqual(TITLES);
});

test('switching Part moves the full title to the newly active tab', async ({ page }) => {
  await openActivity(page, MANY);
  await page.getByRole('tab', { name: /^Part 3:/ }).click();
  await expect.poll(() => shownTabText(page)).toEqual(expected(2));
  await expect(page.getByRole('tab', { name: /^Part 3:/ })).toHaveAttribute('aria-selected', 'true');
  expect(await sameRow(page)).toBe(true);
});

test('widening the window restores the full titles; narrowing collapses them again', async ({ page }) => {
  await openActivity(page, MANY);
  await expect.poll(() => shownTabText(page)).toEqual(expected(0));
  await page.setViewportSize({ width: 3200, height: 768 });
  await expect.poll(() => shownTabText(page)).toEqual(TITLES);
  expect(await tooltips(page)).toEqual(TITLES.map(() => null));
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(() => shownTabText(page)).toEqual(expected(0));
});

test('collapsed tabs keep their accessible names, progress badges and keyboard use', async ({ page }) => {
  await openActivity(page, MANY);
  await page.getByRole('tabpanel', { name: /^Part 1:/ }).getByRole('button', { name: 'Submit Task 1.1' }).click();
  await page.getByRole('tab', { name: /^Part 2:/ }).click();
  await expect.poll(() => shownTabText(page)).toEqual(expected(1));
  const collapsed = await tabs(page).evaluateAll((els) => els.map((el) => el.textContent));
  for (let i = 0; i < TITLES.length; i++) {
    await expect(tabs(page).nth(i)).toHaveAccessibleName(`${TITLES[i]} (${i === 0 ? 1 : 0} of 1 Tasks done)`);
  }
  // Part 1's passed badge still shows on its collapsed tab.
  await expect(tabs(page).nth(0).getByText('1/1', { exact: true })).toBeVisible();
  await expect(tabs(page).nth(0).locator('.fw-tab-badge')).toHaveAttribute('data-done', 'true');

  // Tab moves focus from tab to tab; Enter opens the focused Part.
  await tabs(page).nth(2).focus();
  await page.keyboard.press('Tab');
  await expect(tabs(page).nth(3)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tabs(page).nth(3)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => shownTabText(page)).toEqual(expected(3));

  // The wide layout reads the same names.
  await page.setViewportSize({ width: 3200, height: 768 });
  await expect.poll(() => shownTabText(page)).toEqual(TITLES);
  expect(await tabs(page).evaluateAll((els) => els.map((el) => el.textContent))).toEqual(collapsed);
});

test('an Activity whose Part tabs fit is unchanged: full titles and no tooltips', async ({ page }) => {
  await openActivity(page, FITS);
  const titles = await fullNames(page);
  await expect.poll(() => shownTabText(page)).toEqual(titles);
  expect(await tooltips(page)).toEqual(titles.map(() => null));
  await page.getByRole('tab', { name: /^Part 2/ }).click();
  await expect.poll(() => shownTabText(page)).toEqual(titles);
});

for (const viewport of [{ width: 768, height: 1024 }]) {
  test(`${viewport.width}×${viewport.height}: collapsed tabs stay in the header, no header text under 13 px and no sideways scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openActivity(page, MANY);
    await expect.poll(() => shownTabText(page)).toEqual(expected(0));
    const sizes = await page.getByRole('banner').evaluate((header) => [...header.querySelectorAll('*')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))
      .map((el) => [el.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(el).fontSize)])
      .filter(([, size]) => size < 13));
    expect(sizes).toEqual([]);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth)).toBe(true);
    for (let i = 0; i < TITLES.length; i++) await expect(tabs(page).nth(i)).toBeVisible();
  });
}
