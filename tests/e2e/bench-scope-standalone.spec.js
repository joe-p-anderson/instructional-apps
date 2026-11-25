// Seam 2 (Spec 0002): the real bench-scope Standalone page.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/bench-scope/';
const SOURCE_CONTROLS = ['gen1-wave', 'gen1-freq', 'gen1-vpp', 'gen1-offset'];

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

/** Pixels on the scope screen canvas that are (roughly) the CH1 trace colour. */
const ch1Pixels = (page) => page.evaluate(() => {
  const cv = document.querySelector('canvas.bs-screen');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 180 && d[i + 2] < 120) n += 1;
  return n;
});

test('the page shows one Mode tab and the TBS2072B panel with its screen', async ({ page }) => {
  await open(page);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(1);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('svg[data-model="TBS2072B"]')).toBeVisible();
});

test('the screen canvas sits on the panel screen at 800×480 and draws the CH1 trace', async ({ page }) => {
  await open(page);
  const canvas = page.locator('canvas.bs-screen');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((c) => [c.width, c.height])).toEqual([800, 480]);
  expect(await canvas.evaluate((c) => getComputedStyle(c).imageRendering)).toBe('pixelated');

  // Overlaid on the control map's screen rectangle.
  const screenRect = await page.locator('svg [data-control="screen"]').boundingBox();
  const canvasRect = await canvas.boundingBox();
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(canvasRect[k] - screenRect[k])).toBeLessThan(2);

  await expect.poll(() => ch1Pixels(page)).toBeGreaterThan(1500);
});

test('the source Controls are shown, registered and unlocked', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('combobox', { name: 'CH1 waveform', exact: true })).toBeEnabled();
  for (const name of ['CH1 frequency', 'CH1 amplitude', 'CH1 offset']) {
    await expect(page.getByRole('slider', { name, exact: true })).toBeEnabled();
    await expect(page.getByRole('spinbutton', { name, exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: `Reset ${name}` })).toBeEnabled();
  }
  const controls = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return i.controls.ids().map((id) => ({ id, locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }));
  });
  for (const id of SOURCE_CONTROLS) {
    expect(controls.find((c) => c.id === id), id).toMatchObject({ locked: false, hidden: false });
  }
});

test('changing the generator updates State and the trace', async ({ page }) => {
  await open(page);
  await expect.poll(() => ch1Pixels(page)).toBeGreaterThan(1500);
  const before = await page.locator('canvas.bs-screen').evaluate((c) => c.toDataURL());

  await setNumber(page, 'CH1 frequency', 2500);
  await page.getByRole('combobox', { name: 'CH1 waveform', exact: true }).selectOption('square');
  const s = await snapshot(page);
  expect(s.gen1Freq).toBe(2500);
  expect(s.ch1TrueFreq).toBe(2500);
  expect(s.gen1Wave).toBe('square');

  await expect.poll(() => page.locator('canvas.bs-screen').evaluate((c) => c.toDataURL())).not.toBe(before);
});

test('a reload keeps the setup, and a share link reproduces it elsewhere', async ({ page, browser }) => {
  await open(page);
  await setNumber(page, 'CH1 amplitude', 6.5);
  await setNumber(page, 'CH1 offset', -1);

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toMatchObject({ gen1Vpp: 6.5, gen1Offset: -1 });
  await expect(page.getByRole('spinbutton', { name: 'CH1 amplitude', exact: true })).toHaveValue(/^6\.5/);

  await page.getByRole('button', { name: 'Copy share link' }).click();
  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(url).toMatch(/#s=/);
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await open(theirs, url);
  expect(await snapshot(theirs)).toMatchObject({ gen1Vpp: 6.5, gen1Offset: -1 });
  await other.close();
});

test('the screen Display snapshot is a PNG at the native 800×480', async ({ page }) => {
  await open(page);
  const size = await page.evaluate(async () => {
    const display = window.toolHost.instances[0].displays.find((d) => d.id === 'screen');
    const url = await display.snapshot();
    const img = new Image();
    img.src = url;
    await img.decode();
    return { png: url.startsWith('data:image/png;base64,'), w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(size).toEqual({ png: true, w: 800, h: 480 });
});

test('the Tool mounts twice on one page with independent State', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/bench-scope/bench-scope.js');
    const mk = () => document.body.appendChild(document.createElement('div'));
    const a = tool.mount(mk(), tool.modes[0].id, { gen1Freq: 100 });
    const b = tool.mount(mk(), tool.modes[0].id, { gen1Freq: 200 });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('gen1-vpp').set(9);
    const out = { a: a.state.snapshot(), b: b.state.snapshot(), bChanges, id: tool.id, title: tool.title, modes: tool.modes.length };
    a.destroy();
    b.destroy();
    return out;
  });
  expect(result).toMatchObject({ id: 'bench-scope', title: 'Bench Oscilloscope', modes: 1, bChanges: 0 });
  expect(result.a).toMatchObject({ gen1Freq: 100, gen1Vpp: 9 });
  expect(result.b.gen1Freq).toBe(200);
  expect(result.b.gen1Vpp).not.toBe(9);
});

test('the layout fits a 1366×768 laptop screen without horizontal scrolling', async ({ page }) => {
  await open(page);
  await expect(page.locator('canvas.bs-screen')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
