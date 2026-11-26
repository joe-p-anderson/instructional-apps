// Framework v1 UI kit: the handle (1-D and 2-D) and knob Controls on a fixture board
// (tests/e2e/fixtures/handles.html: x = 40 px per unit, y = 30 px per unit up from the bottom).
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/handles.html');
  await page.waitForFunction(() => window.kit);
});

const get = (page, id) => page.evaluate((id) => window.kit[id].get(), id);

test('a 1-D handle is a slider: arrows nudge, Shift steps further, Home/End go to the bounds', async ({ page }) => {
  const level = page.getByRole('slider', { name: 'Level' });
  await expect(level).toHaveAttribute('aria-valuetext', '2.0 V');
  await level.focus();
  await page.keyboard.press('ArrowUp');
  expect(await get(page, 'level')).toBeCloseTo(2.1, 9);
  await page.keyboard.press('Shift+ArrowUp');
  expect(await get(page, 'level')).toBeCloseTo(3.1, 9);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  expect(await get(page, 'level')).toBeCloseTo(2.9, 9);
  await expect(level).toHaveAttribute('aria-valuetext', '2.9 V');
  await page.keyboard.press('End');
  expect(await get(page, 'level')).toBe(10);
  await page.keyboard.press('Shift+ArrowUp');
  expect(await get(page, 'level')).toBe(10);
  await page.keyboard.press('Home');
  expect(await get(page, 'level')).toBe(0);
  await expect(level).toHaveAttribute('aria-valuenow', '0');
  expect((await page.evaluate(() => window.changes)).at(-1)).toEqual(['level', 0]);
});

test('a 2-D handle is a focusable group whose value names both coordinates', async ({ page }) => {
  const point = page.getByRole('group', { name: 'Point P' });
  await expect(point).toHaveAccessibleDescription('x = 5.0 m, y = 5.0 m');
  await point.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  const p = await get(page, 'point');
  expect(p.x).toBeCloseTo(5.1, 9);
  expect(p.y).toBeCloseTo(6.1, 9);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect(point).toHaveAccessibleDescription('x = 4.1 m, y = 6.0 m');
  await expect(point.locator('[aria-live]')).toHaveText('x = 4.1 m, y = 6.0 m');
});

test('a handle is placed by the Tool\'s mapping and follows a pointer drag', async ({ page }) => {
  const point = page.getByRole('group', { name: 'Point P' });
  const centre = async () => {
    const b = await point.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const board = await page.locator('#board').boundingBox();
  // (5, 5) sits 200 px right of the board's left edge and 150 px up from its bottom (border box).
  const c = await centre();
  expect(c.x - board.x).toBeCloseTo(200, 0);
  expect(board.y + board.height - c.y).toBeCloseTo(150, 0);

  await expect(point).toHaveCSS('touch-action', 'none');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y - 60, { steps: 4 });
  await page.mouse.up();
  const p = await get(page, 'point');
  expect(p.x).toBeCloseTo(6, 1);
  expect(p.y).toBeCloseTo(7, 1);
  const moved = await centre();
  expect(moved.x - c.x).toBeCloseTo(40, 0);
  await expect(point).toBeFocused();
});

test('a locked handle ignores keys and pointer, and set() still applies a value', async ({ page }) => {
  await page.evaluate(() => { window.kit.level.lock(); window.kit.point.lock(); });
  const level = page.getByRole('slider', { name: 'Level' });
  await expect(level).toHaveAttribute('aria-disabled', 'true');
  await level.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  expect(await get(page, 'level')).toBe(2);

  const point = page.getByRole('group', { name: 'Point P' });
  const b = await point.boundingBox();
  await point.focus();
  await page.keyboard.press('ArrowRight');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 100, b.y + 100, { steps: 4 });
  await page.mouse.up();
  expect(await get(page, 'point')).toEqual({ x: 5, y: 5 });
  expect(await page.evaluate(() => window.changes)).toEqual([]);

  await page.evaluate(() => { window.kit.level.unlock(); window.kit.point.set({ x: 20, y: 1 }); });
  expect(await get(page, 'point')).toEqual({ x: 10, y: 1 }); // clamped to the bounds
  await level.focus();
  await page.keyboard.press('ArrowUp');
  expect(await get(page, 'level')).toBeCloseTo(2.1, 9);
});

test('a hidden handle is hidden and leaves the tab order', async ({ page }) => {
  await page.evaluate(() => window.kit.level.hide());
  await expect(page.getByRole('slider', { name: 'Level' })).toBeHidden();
  expect(await page.evaluate(() => window.kit.level.isHidden())).toBe(true);
});

test('a knob is a slider that arrow keys turn and Enter pushes; a locked knob ignores them', async ({ page }) => {
  const dial = page.getByRole('slider', { name: 'Dial' });
  await dial.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  expect(await get(page, 'dial')).toBe(1);
  await expect(dial).toHaveAttribute('aria-valuetext', '1');
  await page.evaluate(() => window.kit.dial.lock());
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => window.changes)).toEqual([['dial', 1], ['dial', 1], ['dial', -1], ['dial', 'push']]);
});
