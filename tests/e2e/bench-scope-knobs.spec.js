// Seam 2 (Spec 0002), ticket 02: knob input, vertical controls and front-panel Controls on the
// real bench-scope Standalone page.
import { test, expect } from '@playwright/test';
import { installScreenReader } from './helpers/bench-screen.js';

test.beforeEach(({ page }) => installScreenReader(page));

const PAGE = '/tools/bench-scope/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const control = (page, id) => page.locator(`svg[data-model] .osc-control[data-control="${id}"]`);

/** The pixels of the CH1 V/div readout's corner of the screen, as a string to compare. */
const ch1Readout = (page) => page.evaluate(async () => {
  const cv = await window.nativeScreen();
  return Array.from(cv.getContext('2d').getImageData(25, 440, 120, 30).data).join(',');
});

/** Pixels on the screen canvas in the CH2 trace colour (#22c4e8). */
const ch2Pixels = (page) => page.evaluate(async () => {
  const cv = await window.nativeScreen();
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 90 && d[i + 1] > 150 && d[i + 2] > 190) n += 1;
  return n;
});

async function centreOf(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('the wheel turns the CH1 Scale knob one detent per notch, and the V/div readout follows', async ({ page }) => {
  await open(page);
  const knob = control(page, 'ch1-scale');
  const before = await ch1Readout(page);
  const { x, y } = await centreOf(knob);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -100); // one notch up: clockwise
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(0.5);
  await expect.poll(() => ch1Readout(page)).not.toBe(before);
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(2);
});

test('the knob is drawn at the engine value: it rotates by its detent angle per step', async ({ page }) => {
  await open(page);
  const rot = control(page, 'ch1-scale').locator('.osc-knob-rot');
  const before = await rot.getAttribute('transform');
  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').set(0.5));
  const after = await rot.getAttribute('transform');
  expect(after).not.toBe(before);
  expect(after).toMatch(/^rotate\((-?[\d.]+) 1690 635\)$/);
  const angle = (t) => Number((t ?? 'rotate(0 ').match(/rotate\((-?[\d.]+)/)[1]);
  expect(angle(after) - angle(before)).toBe(36);
});

test('a vertical drag turns the knob continuously in detents', async ({ page }) => {
  await open(page);
  const before = await ch1Readout(page);
  const { x, y } = await centreOf(control(page, 'ch1-scale'));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 40, { steps: 8 }); // up: clockwise, several detents
  await page.mouse.up();
  const s = await snapshot(page);
  expect(s.ch1VPerDiv).toBeLessThan(0.5); // at least two steps down from 1 V/div
  await expect.poll(() => ch1Readout(page)).not.toBe(before);
  expect((await snapshot(page)).ch1Position, 'a drag is not a push').toBe(0);
});

test('the arrow keys turn a focused knob', async ({ page }) => {
  await open(page);
  const before = await ch1Readout(page);
  await control(page, 'ch1-scale').focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(2);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(0.5);
  await expect.poll(() => ch1Readout(page)).not.toBe(before);
});

test('a click on the CH1 Position knob pushes it, recentring the trace', async ({ page }) => {
  await open(page);
  const knob = control(page, 'ch1-position');
  await knob.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).ch1Position).toBe(0.2);
  await knob.click();
  await expect.poll(async () => (await snapshot(page)).ch1Position).toBe(0);
});

test('a locked knob ignores the wheel, drag and keys, and shows it is locked', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').lock());
  const knob = control(page, 'ch1-scale');
  await expect(knob).toHaveAttribute('aria-disabled', 'true');
  await expect(knob).toHaveClass(/bs-locked/);
  const { x, y } = await centreOf(knob);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -100);
  await page.mouse.down();
  await page.mouse.move(x, y - 40, { steps: 8 });
  await page.mouse.up();
  await knob.focus();
  await page.keyboard.press('ArrowUp');
  expect((await snapshot(page)).ch1VPerDiv).toBe(1);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-scale').unlock());
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await snapshot(page)).ch1VPerDiv).toBe(0.5);
});

test('the CH2 menu button shows the CH2 trace, with a pressed state', async ({ page }) => {
  await open(page);
  expect(await ch2Pixels(page)).toBeLessThan(50);
  const button = control(page, 'ch2-menu');
  const { x, y } = await centreOf(button);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(button).toHaveClass(/bs-pressed/);
  await page.mouse.up();
  await expect(button).not.toHaveClass(/bs-pressed/);
  expect((await snapshot(page)).ch2Display).toBe(true);
  await expect.poll(() => ch2Pixels(page)).toBeGreaterThan(1000);
  await button.click();
  await expect.poll(() => ch2Pixels(page)).toBeLessThan(50);
});

test('every front-panel control is a registered Control; hiding one keeps the layout', async ({ page }) => {
  await open(page);
  const ids = await page.evaluate(() => window.toolHost.instances[0].controls.ids());
  for (const id of ['ch1-scale', 'ch2-scale', 'ch1-position', 'ch2-position', 'ch1-menu', 'ch2-menu',
    'hor-scale', 'trig-level', 'mp-knob', 'run-stop', 'softkey-1', 'softkey-7', 'gen1-freq',
    'math', 'utility', 'ch1-input', 'probe-comp', 'usb', 'power']) { // inactive and passive ones too
    expect(ids, id).toContain(id);
  }
  await expect(control(page, 'math')).toHaveAttribute('data-active', 'false');

  const panel = page.locator('svg[data-model]');
  const box = await panel.boundingBox();
  const result = await page.evaluate(() => {
    const c = window.toolHost.instances[0].controls.get('ch1-menu');
    c.hide();
    return { hidden: c.isHidden(), get: c.get() };
  });
  expect(result).toEqual({ hidden: true, get: true });
  await expect(control(page, 'ch1-menu')).toBeHidden();
  expect(await panel.boundingBox()).toEqual(box);
  await page.evaluate(() => window.toolHost.instances[0].controls.get('ch1-menu').show());
  await expect(control(page, 'ch1-menu')).toBeVisible();
});

test('an inactive control (Utility) is a Control an Activity can lock and hide; it stays greyed and inert', async ({ page }) => {
  await open(page);
  const utility = control(page, 'utility');
  await expect(utility).toHaveAttribute('data-active', 'false');
  const before = await snapshot(page);
  await utility.click();
  const after = await page.evaluate(() => {
    const c = window.toolHost.instances[0].controls.get('utility');
    c.set(1);
    c.lock();
    return { label: c.label, locked: c.isLocked(), get: c.get() };
  });
  expect(after).toEqual({ label: 'Utility', locked: true, get: null });
  const { runState, ...settings } = await snapshot(page);
  const { runState: r0, ...settings0 } = before;
  expect(settings).toEqual(settings0); // nothing happened
  await expect(utility).toHaveAttribute('aria-disabled', 'true');

  const panel = page.locator('svg[data-model]');
  const box = await panel.boundingBox();
  await page.evaluate(() => window.toolHost.instances[0].controls.get('utility').hide());
  await expect(utility).toBeHidden();
  expect(await panel.boundingBox()).toEqual(box);
  await page.evaluate(() => window.toolHost.instances[0].controls.get('utility').show());
  await expect(utility).toBeVisible();
});
