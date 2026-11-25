// Seam 3 (Spec 0003): the real spacetime Standalone page.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const PAGE = '/tools/spacetime/';
const CONTROLS = [
  'tool-select', 'tool-event', 'tool-worldline', 'tool-rod', 'tool-join',
  'v', 'gamma', 'flip', 'grid-K', 'grid-Kp', 'kp-panel', 'primed', 'measurements',
  'undo', 'redo', 'export-json', 'import-json', 'new', 'reset-view', 'save-png',
];

async function open(page, url = PAGE) {
  await page.goto(url);
  await page.waitForFunction(() => window.toolHost);
  // The K diagram is laid out at its box size.
  await page.waitForFunction(() => window.toolHost.instances[0].displays[0].toScreen(0, 0));
}

const snapshot = (page) => page.evaluate(() => window.toolHost.instances[0].state.snapshot());
const saved = (page) => page.evaluate(() => window.toolHost.instances[0].serialize());
const at = (page, x, t) => page.evaluate(([x, t]) => window.toolHost.instances[0].displays[0].toScreen(x, t), [x, t]);

/** Pick the Event tool and click the K diagram at (x, t). */
async function drawEvent(page, x, t) {
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  const p = await at(page, x, t);
  await page.mouse.click(p.x, p.y);
}

test('the page shows one Mode tab and both diagrams', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Spacetime diagram in frame K', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Spacetime diagram in frame K′' })).toBeVisible();
});

test('every Control is registered, shown and unlocked', async ({ page }) => {
  await open(page);
  const controls = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return i.controls.ids().map((id) => ({ id, locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }));
  });
  expect(controls.map((c) => c.id).sort()).toEqual([...CONTROLS].sort());
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
  for (const name of ['Move', 'Event', 'Worldline', 'Rod', 'Join events', 'Flip v', 'New diagram', 'Export JSON', 'Import JSON', 'Save PNG', 'Reset view']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  }
  await expect(page.getByRole('slider', { name: 'v/c' })).toBeEnabled();
});

test('drawing an event updates the State; setting v updates v and γ', async ({ page }) => {
  await open(page);
  expect(await snapshot(page)).toMatchObject({ v: 0, gamma: 1, events: 0, worldlines: 0, rods: 0 });

  await drawEvent(page, 3, 5);
  expect((await snapshot(page)).events).toBe(1);
  const ev = (await saved(page)).objs[0];
  expect(ev).toMatchObject({ kind: 'event', home: 'K', label: 'A' });
  expect(ev.x).toBeCloseTo(3, 1);
  expect(ev.t).toBeCloseTo(5, 1);

  const vBox = page.getByRole('spinbutton', { name: 'v/c' });
  await vBox.fill('0.6');
  await vBox.press('Enter');
  const s = await snapshot(page);
  expect(s.v).toBeCloseTo(0.6, 9);
  expect(s.gamma).toBeCloseTo(1.25, 9);
});

test('keyboard shortcuts pick tools, and undo and redo step through the drawing', async ({ page }) => {
  await open(page);
  const pressed = (name) => page.getByRole('button', { name, exact: true });
  const k = await at(page, 0, 0);
  await page.mouse.move(k.x, k.y); // shortcuts act on the instance under the pointer
  await page.keyboard.press('w');
  await expect(pressed('Worldline')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('e');
  await expect(pressed('Event')).toHaveAttribute('aria-pressed', 'true');

  await drawEvent(page, 1, 2);
  await drawEvent(page, 2, 4);
  expect((await snapshot(page)).events).toBe(2);

  await page.keyboard.press('Control+z');
  expect((await snapshot(page)).events).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await snapshot(page)).events).toBe(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.keyboard.press('Control+y');
  expect((await snapshot(page)).events).toBe(2);
});

test('a JSON export imports back as one undoable step', async ({ page }) => {
  await open(page);
  await drawEvent(page, 1, 1);
  await drawEvent(page, 2, 3);
  const before = await saved(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('spacetime-diagram.json');
  const file = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(file).toMatchObject({ app: 'spacetime-diagram', version: 1 });
  expect(file.objs).toEqual(before.objs);

  await page.getByRole('button', { name: 'New diagram', exact: true }).click();
  expect((await snapshot(page)).events).toBe(0);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import JSON', exact: true }).click(),
  ]);
  await chooser.setFiles(await download.path());
  await expect.poll(async () => (await snapshot(page)).events).toBe(2);
  expect((await saved(page)).objs).toEqual(before.objs);

  // One undo goes back to the empty diagram from before the import.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await snapshot(page)).events).toBe(0);
});

test('a reload keeps the diagram, and a share link reproduces it elsewhere', async ({ page, browser }) => {
  await open(page);
  await drawEvent(page, 3, 5);
  await page.getByRole('button', { name: 'Worldline', exact: true }).click();
  const a = await at(page, 0, 0), b = await at(page, 3, 5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  const vBox = page.getByRole('spinbutton', { name: 'v/c' });
  await vBox.fill('0.6');
  await vBox.press('Enter');
  const mine = await saved(page);
  expect(mine.objs.map((o) => o.kind)).toEqual(['event', 'wl']);
  expect(mine.objs[1].u).toBeCloseTo(0.6, 1);

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect((await saved(page)).objs).toEqual(mine.objs);
  expect((await snapshot(page)).v).toBeCloseTo(0.6, 9);
  // A restore starts a fresh history.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Copy share link' }).click();
  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(url).toMatch(/#s=/);
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await open(theirs, url);
  expect((await saved(theirs)).objs).toEqual(mine.objs);
  expect((await snapshot(theirs)).v).toBeCloseTo(0.6, 9);
  await other.close();
});

test('the State carries the drawn diagram, in step with every change, for the Condition types', async ({ page }) => {
  await open(page);
  const changes = [];
  await page.exposeFunction('recordDiagram', (d) => changes.push(d));
  await page.evaluate(() => window.toolHost.instances[0].state.onChange((s) => window.recordDiagram(s.diagram)));
  expect(JSON.parse((await snapshot(page)).diagram)).toEqual([]);
  expect(await page.evaluate(() => window.toolHost.instances[0].state.describe().diagram.label)).toBe('Diagram');

  await drawEvent(page, 3, 5);
  await page.getByRole('button', { name: 'Worldline', exact: true }).click();
  const a = await at(page, 0, 0), b = await at(page, 3, 5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();

  const s = await snapshot(page);
  expect(JSON.parse(s.diagram)).toEqual((await saved(page)).objs);
  await expect.poll(() => changes.at(-1)).toBe(s.diagram);

  const judged = await page.evaluate(async (state) => {
    const { conditionTypes } = await import('/tools/spacetime/spacetime.js');
    return [
      conditionTypes['st-event']({ x: 3, t: 5, tol: 0.15 }, state),
      conditionTypes['st-worldline']({ u: 0.6, uTol: 0.05, x: 1.5, t: 2.5, tol: 0.15 }, state),
      conditionTypes['st-worldline']({ u: -0.6, uTol: 0.05, x: 1.5, t: 2.5, tol: 0.15 }, state),
    ].map((r) => r.pass);
  }, s);
  expect(judged).toEqual([true, true, false]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => JSON.parse((await snapshot(page)).diagram).length).toBe(1);
  expect(changes.at(-1)).toBe((await snapshot(page)).diagram);
});

test('the Display snapshot is a PNG of both diagrams, and Save PNG downloads it', async ({ page }) => {
  await open(page);
  const size = await page.evaluate(async () => {
    const url = await window.toolHost.instances[0].displays[0].snapshot();
    const img = new Image();
    img.src = url;
    await img.decode();
    return { png: url.startsWith('data:image/png;base64,'), w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(size.png).toBe(true);
  expect(size.w).toBeGreaterThan(size.h); // side by side

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save PNG', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('spacetime-diagram.png');
});

test('hiding primed removes every x′/t′ readout but keeps the rod frame select', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.toolHost.instances[0].restore({
    v: 0.6,
    objs: [
      { id: 1, kind: 'event', home: 'Kp', x: 0, t: 4, label: 'E' },
      { id: 2, kind: 'rod', frame: 'Kp', T: 2, ends: [{ x: -2, wl: null }, { x: 2, wl: null }], label: 'R1' },
    ],
  }));
  const side = page.getByRole('complementary', { name: 'Objects and measurements' });
  await side.locator('b').getByText('E', { exact: true }).click();
  await expect(side.getByRole('textbox', { name: 't′' })).toBeVisible();

  await page.evaluate(() => window.toolHost.instances[0].controls.get('primed').hide());
  await expect(side.getByRole('textbox', { name: 't′' })).toHaveCount(0);
  await expect(side).not.toContainText('K′: (');
  await side.locator('b').getByText('R1', { exact: true }).click();
  await expect(side.getByRole('combobox', { name: 'End 1' })).toBeVisible();
  await expect(side.locator('select[data-k="frame"]')).toBeVisible();
  await expect(side.getByRole('textbox', { name: 't′ =' })).toHaveCount(0);
  await expect(side).not.toContainText('t′ = 2');
});

test('keyboard shortcuts act only on the instance with focus or under the pointer', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { default: tool } = await import('/tools/spacetime/spacetime.js');
    const box = document.body.appendChild(document.createElement('div'));
    box.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:500px;display:flex;z-index:5;background:#fff';
    window.second = tool.mount(box, 'diagram');
  });
  const tools = () => page.evaluate(() => ({
    host: window.toolHost.instances[0].controls.get('tool-rod').get(),
    second: window.second.controls.get('tool-rod').get(),
  }));

  // Focus inside the second instance: only it switches tool.
  await page.locator('.st-tool').nth(1).getByRole('button', { name: 'Move', exact: true }).focus();
  await page.keyboard.press('r');
  expect(await tools()).toEqual({ host: false, second: true });

  // Nothing focused, pointer over the host's K′ diagram (outside the second instance): only the host.
  await page.evaluate(() => { document.activeElement.blur(); window.second.controls.get('tool-select').set(true); });
  const kp = await page.getByRole('img', { name: 'Spacetime diagram in frame K′' }).first().boundingBox();
  await page.mouse.move(kp.x + kp.width - 20, kp.y + kp.height - 20);
  await page.keyboard.press('r');
  expect(await tools()).toEqual({ host: true, second: false });
  await page.evaluate(() => window.second.destroy());
});

test('the Tool mounts twice on one page with independent State', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/spacetime/spacetime.js');
    const mk = () => document.body.appendChild(document.createElement('div'));
    const a = tool.mount(mk(), 'diagram', { v: 0.6 });
    const b = tool.mount(mk(), 'diagram', { v: -0.3, objs: [{ id: 1, kind: 'event', x: 1, t: 1 }] });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('tool-event').set(true);
    a.controls.get('v').set(0.8);
    const out = { a: a.state.snapshot(), b: b.state.snapshot(), bChanges,
      bEvent: b.controls.get('tool-event').get(), aEvent: a.controls.get('tool-event').get() };
    a.destroy();
    b.destroy();
    return out;
  });
  expect(result).toMatchObject({ bChanges: 0, aEvent: true, bEvent: false });
  expect(result.a.v).toBeCloseTo(0.8, 9);
  expect(result.b).toMatchObject({ v: -0.3, events: 1 });
});

test('the layout fits a 1366×768 laptop screen without horizontal scrolling', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
