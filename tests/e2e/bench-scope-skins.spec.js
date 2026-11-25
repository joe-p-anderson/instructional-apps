// Seam 2 (Spec 0002), ticket 03: the TDS2001C skin and the skin switcher on the real
// bench-scope Standalone page.
import { test, expect } from '@playwright/test';
import { installScreenReader } from './helpers/bench-screen.js';

test.beforeEach(({ page }) => installScreenReader(page));

const PAGE = '/tools/bench-scope/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const switcher = (page) => page.getByRole('combobox', { name: 'Oscilloscope model', exact: true });
const tdsControl = (page, id) => page.locator(`svg[data-model="TDS2001C"] .osc-control[data-control="${id}"]`);

async function toTds(page) {
  await switcher(page).selectOption('tds2001c');
  await expect(page.locator('svg[data-model="TDS2001C"]')).toBeVisible();
}

/** Pixels on the screen canvas that are (roughly) the CH1 trace yellow. */
const ch1Pixels = (page) => page.evaluate(async () => {
  const cv = await window.nativeScreen();
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 180 && d[i + 2] < 120) n += 1;
  return n;
});

async function centreOf(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('the skin switcher swaps the TBS2072B panel for the TDS2001C one, and back', async ({ page }) => {
  await open(page);
  await expect(switcher(page)).toHaveValue('tbs2072b');
  await expect(page.locator('svg[data-model="TBS2072B"]')).toBeVisible();
  await toTds(page);
  await expect(page.locator('svg[data-model]')).toHaveCount(1);
  await expect(page.locator('canvas.bs-screen')).toHaveCount(1);
  expect((await snapshot(page)).skin).toBe('tds2001c');

  await switcher(page).selectOption('tbs2072b');
  await expect(page.locator('svg[data-model="TBS2072B"]')).toBeVisible();
  await expect(page.locator('svg[data-model]')).toHaveCount(1);
  expect((await snapshot(page)).skin).toBe('tbs2072b');
});

const nativeSize = (page) => page.evaluate(async () => { const c = await window.nativeScreen(); return [c.width, c.height]; });

test('on the TDS the screen is 320×240 (snapshot), the canvas sits over the panel screen and draws the CH1 trace', async ({ page }) => {
  await open(page);
  await toTds(page);
  const canvas = page.locator('canvas.bs-screen');
  expect(await nativeSize(page)).toEqual([320, 240]);
  const screenRect = await page.locator('svg[data-model="TDS2001C"] [data-control="screen"]').boundingBox();
  const canvasRect = await canvas.boundingBox();
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(canvasRect[k] - screenRect[k])).toBeLessThan(2);
  await expect.poll(() => ch1Pixels(page)).toBeGreaterThan(300);
});

test('the skin is a Control, it survives a reload, and settings carry over', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').set(0.2));
  await page.evaluate(() => window.toolHost.instances[0].controls.get('skin').set('tds2001c'));
  await expect(page.locator('svg[data-model="TDS2001C"]')).toBeVisible();
  expect((await snapshot(page)).ch1VPerDiv).toBe(0.2);

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  await expect(page.locator('svg[data-model="TDS2001C"]')).toBeVisible();
  await expect(switcher(page)).toHaveValue('tds2001c');
  const s = await snapshot(page);
  expect(s.skin).toBe('tds2001c');
  expect(s.ch1VPerDiv).toBe(0.2);
  expect(await nativeSize(page)).toEqual([320, 240]);
});

test('the TDS panel registers its own controls: Horiz and Set to Zero, not fine', async ({ page }) => {
  await open(page);
  await toTds(page);
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids());
  for (const id of ['skin', 'gen1-freq', 'ch1-scale', 'horiz-menu', 'set-to-zero', 'trig-50']) expect(ids).toContain(id);
  expect(ids).not.toContain('fine');
  expect(ids).not.toContain('menu-onoff');
});

test('the TDS vertical knobs work as the TBS ones do', async ({ page }) => {
  await open(page);
  await toTds(page);
  // Wheel on the Volts/Div knob: one notch up is clockwise, a smaller V/div.
  const scale = tdsControl(page, 'ch1-scale');
  const rot = scale.locator('.osc-knob-rot');
  const angle = async () => Number((await rot.getAttribute('transform')).match(/^rotate\((-?[\d.]+) 1362(\.0)? 650\)$/)[1]);
  const before = await angle();
  const { x, y } = await centreOf(scale);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(0.5);
  await expect.poll(async () => (await angle()) - before).toBe(36);

  // Drag and arrow keys on Position.
  const pos = tdsControl(page, 'ch1-position');
  await pos.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).ch1Position).toBe(0.2);
  const c = await centreOf(pos);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y + 40, { steps: 8 }); // down: anticlockwise
  await page.mouse.up();
  expect((await snapshot(page)).ch1Position).toBeLessThan(0);

  // The CH2 menu button shows CH2.
  await tdsControl(page, 'ch2-menu').click();
  await expect.poll(async () => (await snapshot(page)).ch2Display).toBe(true);
});

test('a locked front-panel Control stays locked after switching skin', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').lock());
  await toTds(page);
  expect(await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').isLocked())).toBe(true);
  await expect(tdsControl(page, 'ch1-scale')).toHaveAttribute('aria-disabled', 'true');
});

test('the TDS multipurpose LEDs are dark while the knob has no function', async ({ page }) => {
  await open(page);
  await toTds(page);
  for (const id of ['mp-led-left', 'mp-led-right']) {
    await expect(tdsControl(page, id)).toHaveAttribute('data-lit', 'false');
  }
});
