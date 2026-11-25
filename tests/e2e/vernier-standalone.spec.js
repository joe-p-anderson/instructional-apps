import { test, expect } from '@playwright/test';

const PAGE = '/tools/vernier/';

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const answer = (page, text) => page.getByRole('textbox', { name: 'Reading (mm)' }).fill(text);
const feedback = (page) => page.getByRole('status', { name: 'Feedback' });

test('Standalone mode shows one tab and every Control, unlocked', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(1);
  for (const name of ['Measurement', 'Zoom']) await expect(page.getByRole('combobox', { name })).toBeEnabled();
  for (const name of ['Check', 'Show answer', 'Next']) await expect(page.getByRole('button', { name })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Reading (mm)' })).toBeEnabled();
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids().sort());
  expect(ids).toEqual(['check', 'next', 'reading', 'reveal', 'type', 'zoom']);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Check accepts the correct reading and counts it', async ({ page }) => {
  await open(page);
  const s = await snapshot(page);
  await answer(page, s.reading.toFixed(2).replace('.', ','));
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(feedback(page)).toContainText(`Correct: ${s.reading.toFixed(2)} mm.`);
  await expect(page.getByRole('status', { name: 'Correct' })).toHaveText('1');
  await expect(page.getByRole('status', { name: 'Attempts' })).toHaveText('1');
  await expect(page.getByRole('status', { name: 'Streak' })).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled();
  expect((await snapshot(page)).answered).toBe(true);
});

test('Enter in the reading box checks it once', async ({ page }) => {
  await open(page);
  const s = await snapshot(page);
  await answer(page, s.reading.toFixed(2));
  await page.getByRole('textbox', { name: 'Reading (mm)' }).press('Enter');
  await expect(feedback(page)).toContainText(`Correct: ${s.reading.toFixed(2)} mm.`);
  await expect(page.getByRole('status', { name: 'Attempts' })).toHaveText('1');
});

test('Check rejects a wrong reading and shows the breakdown with the marks highlighted', async ({ page }) => {
  await open(page);
  const s = await snapshot(page);
  // Badly formatted readings are refused without counting an attempt.
  await answer(page, 'abc');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(feedback(page)).toHaveText('Enter a number in millimetres, e.g. 23.45.');
  await answer(page, '12.34');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(feedback(page)).toHaveText(/steps of 0\.05 mm/);
  expect((await snapshot(page)).attempts).toBe(0);

  const wrong = s.reading > 50 ? s.reading - 1 : s.reading + 1;
  await answer(page, wrong.toFixed(2));
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(feedback(page)).toContainText(`Not quite. You entered ${wrong.toFixed(2)} mm.`);
  await expect(feedback(page)).toContainText(`last mark at or before vernier 0 is ${s.mainMark} mm`);
  await expect(feedback(page)).toContainText(`Vernier line ${s.vernierLine} lines up (with the ${s.matchMark} mm mark)`);
  await expect(page.locator('[data-tool="vernier"] g[id$="-marks"] line')).toHaveCount(3);
  await expect(page.getByRole('status', { name: 'Correct' })).toHaveText('0');
  await expect(page.getByRole('status', { name: 'Attempts' })).toHaveText('1');
  await expect(page.getByRole('status', { name: 'Streak' })).toHaveText('0');

  // Next draws a fresh reading and clears the highlights.
  await page.getByRole('button', { name: 'Next' }).click();
  const after = await snapshot(page);
  expect(after.draw).toBe(s.draw + 1);
  expect(after.answered).toBe(false);
  await expect(page.locator('[data-tool="vernier"] g[id$="-marks"] line')).toHaveCount(0);
});

test('two instances on one page do not clash', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/vernier/vernier.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'caliper', { type: 'od', seed: 1 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'caliper',
      { type: 'depth', seed: 2, zoom: 'scale' });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('reveal').set();
    a.controls.get('next').set();
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const out = {
      a: a.state.snapshot(), b: b.state.snapshot(), bChanges,
      duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i).length,
      hatches: document.querySelectorAll('pattern[id$="-hatch"]').length,
    };
    a.destroy();
    b.destroy();
    return out;
  });
  expect(result.duplicateIds).toBe(0);
  expect(result.hatches).toBe(3); // the page's own instance plus a and b
  expect(result.a).toMatchObject({ type: 'od', seed: 1, draw: 1, attempts: 1 });
  expect(result.b).toMatchObject({ type: 'depth', pick: 'depth', seed: 2, draw: 0, zoom: 'scale', attempts: 0 });
  expect(result.bChanges).toBe(0);
});

test('the caliper Display snapshots to a PNG', async ({ page }) => {
  await open(page);
  const png = await page.evaluate(() => window.toolHost.instances[0].displays[0].snapshot());
  expect(png).toMatch(/^data:image\/png;base64,/);
  expect(png.length).toBeGreaterThan(5000);
});

test('a reload restores the same reading, counters and zoom', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('combobox', { name: 'Zoom' }).selectOption('scale');
  const before = await snapshot(page);

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByRole('combobox', { name: 'Zoom' })).toHaveValue('scale');
  await expect(page.getByRole('status', { name: 'Attempts' })).toHaveText('1');
});

test('a share link shows the same reading in a fresh browser', async ({ page, browser }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'Measurement' }).selectOption('random');
  await page.getByRole('button', { name: 'Next' }).click();
  const before = await snapshot(page);

  await page.getByRole('button', { name: 'Copy share link' }).click();
  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(url).toMatch(/#s=/);

  const other = await browser.newContext();
  const theirs = await other.newPage();
  await open(theirs, url);
  expect(await snapshot(theirs)).toEqual(before);
  await other.close();
});
