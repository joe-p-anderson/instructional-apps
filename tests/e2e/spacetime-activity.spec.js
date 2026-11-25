// Seam 3 (Spec 0003): the "Spacetime Diagrams" Activity page, used as a student would.
import { test, expect } from '@playwright/test';

const PAGE = '/tools/spacetime/activities/lab10.html';
const VIEWER = '/framework/v1/report-viewer/index.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
  // The K diagram of Part 1 is laid out.
  await page.waitForFunction(() => window.activityHost.instances.building.displays[0].toScreen(0, 0));
}

const PART_IDS = { 1: 'building', 2: 'simultaneity' };
const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const at = (page, x, t, n = 1) => page.evaluate(([x, t, id]) => window.activityHost.instances[id].displays[0].toScreen(x, t), [x, t, PART_IDS[n]]);
const diagram = (page, n = 1) => page.evaluate((id) => JSON.parse(window.activityHost.instances[id].state.snapshot().diagram), PART_IDS[n]);

/** Drag with the mouse from one K point to another in Part n's K diagram. */
async function drag(page, [x1, t1], [x2, t2], n = 1) {
  const a = await at(page, x1, t1, n), b = await at(page, x2, t2, n);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

/** Draw a worldline with the real Worldline tool, dragging from one K point to another. */
async function drawWorldline(page, from, to, n = 1) {
  await part(page, n).getByRole('button', { name: 'Worldline', exact: true }).click();
  await drag(page, from, to, n);
}

/** Mark an event with the real Event tool. */
async function drawEvent(page, x, t, n = 1) {
  await part(page, n).getByRole('button', { name: 'Event', exact: true }).click();
  const p = await at(page, x, t, n);
  await page.mouse.click(p.x, p.y);
}

async function answer(scope, prompt, value) {
  await scope.getByRole('textbox', { name: prompt }).fill(value);
}

/** Tasks 1.1–1.3: draw the lamp, rocket and both light rays, Submitting each. */
async function drawPart1Worldlines(page) {
  const p1 = part(page, 1);
  await drawWorldline(page, [2, 0], [2, 5]);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(p1.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'passed');

  await drawWorldline(page, [0, 0], [3, 5]);
  await answer(p1, /Where is the rocket/, '3');
  await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
  await expect(p1.getByRole('region', { name: 'Task 1.2' })).toHaveAttribute('data-status', 'passed');

  await drawWorldline(page, [0, 0], [4, 4]);
  await drawWorldline(page, [0, 0], [-2, 2]);
  await p1.getByRole('button', { name: 'Submit Task 1.3' }).click();
  await expect(p1.getByRole('region', { name: 'Task 1.3' })).toHaveAttribute('data-status', 'passed');
}

test('the name gate blocks Part 1 until a name is entered', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Spacetime Diagrams', level: 1 })).toBeVisible();
  await expect(page.getByText('PHY 1200').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeHidden();

  await enterName(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
});

test('Part 1 stages the Tool: v locked, the K′ panel and rod and join tools hidden', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  await expect(p1.getByRole('slider', { name: 'v/c' })).toBeDisabled();
  await expect(p1.getByRole('spinbutton', { name: 'v/c' })).toBeDisabled();
  await expect(p1.getByRole('button', { name: 'Flip v', exact: true })).toBeDisabled();
  for (const name of ['Rod', 'Join events']) await expect(p1.getByRole('button', { name, exact: true })).toBeHidden();
  for (const name of ['Move', 'Event', 'Worldline']) await expect(p1.getByRole('button', { name, exact: true })).toBeEnabled();
  await expect(p1.getByRole('img', { name: 'Spacetime diagram in frame K', exact: true })).toBeVisible();
  await expect(p1.getByRole('img', { name: /frame K′/ })).toBeHidden();
  const s = await page.evaluate(() => window.activityHost.instances.building.state.snapshot());
  expect(s.v).toBeCloseTo(0.6, 9);
  expect(JSON.parse(s.diagram)).toEqual([]);
});

test('drawing the Part 1 worldlines with the real tools passes only on Submit', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  // A worldline in the wrong place misses, with specific feedback.
  await drawWorldline(page, [3, 0], [3, 5]);
  await expect(p1.getByRole('region', { name: 'Task 1.1' })).toHaveAttribute('data-status', 'open');
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(p1.getByRole('status', { name: 'Task 1.1 feedback' })).toContainText('need within 0.1');
  await p1.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await diagram(page)).length).toBe(0);

  await drawPart1Worldlines(page);
  const objs = await diagram(page);
  expect(objs.map((o) => o.kind)).toEqual(['wl', 'wl', 'wl', 'wl']);
  await expect(p1.getByText('3 of 7 Tasks done')).toBeVisible();
});

test('rocket coordinates aren\'t visible anywhere', async ({ page }) => {
  await open(page);
  await enterName(page);
  await drawPart1Worldlines(page);
  await drawEvent(page, 3, 5);
  await drawEvent(page, 5, 5);
  expect((await diagram(page)).filter((o) => o.kind === 'event')).toHaveLength(2);

  const p1 = part(page, 1);
  const side = p1.getByRole('complementary', { name: 'Objects and measurements' });
  // Open each event and worldline in the sidebar: no primed readout or input appears.
  for (const label of ['A', 'B']) {
    await side.locator('b').getByText(label, { exact: true }).first().click();
    await expect(side.getByRole('textbox', { name: /^[xt]′/ })).toHaveCount(0);
  }
  await expect(p1.getByRole('checkbox', { name: /readouts/ })).toHaveCount(0);
  await expect(p1.getByRole('img', { name: /frame K′/ })).toBeHidden();
  const text = await p1.locator('.st-tool').innerText();
  for (const leak of ['K′: (', 'Rocket: (', '(0, 4)', '(2.5, 2.5)', 'x′ =', 't′ =']) expect(text).not.toContain(leak);
  // The K diagram keeps the K′ axes and their names, but no K′ tick numbers to read coordinates off.
  const kTexts = await p1.getByRole('img', { name: 'Spacetime diagram in frame K', exact: true }).locator('text')
    .evaluateAll((els) => els.map((el) => ({ text: el.textContent, fill: el.getAttribute('fill') })));
  const kpName = kTexts.find((t) => t.text === 't′');
  expect(kpName).toBeTruthy();
  expect(kTexts.find((t) => t.text === 'x′')).toBeTruthy();
  const kpTicks = kTexts.filter((t) => t.fill === kpName.fill && /^[−\d.]+$/.test(t.text));
  expect(kpTicks).toEqual([]);
  // The K axes keep their tick numbers.
  expect(kTexts.filter((t) => t.fill !== kpName.fill && /^[−\d.]+$/.test(t.text)).length).toBeGreaterThan(0);
});

test('a reload restores progress, the drawing and the staged Controls', async ({ page }) => {
  await open(page);
  await enterName(page);
  await drawPart1Worldlines(page);
  const p1 = part(page, 1);
  await answer(p1, /tilt farther from vertical/, 'Faster than light.');
  const before = await diagram(page);

  await page.reload();
  await page.waitForFunction(() => window.activityHost);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  for (const n of [1, 2, 3]) await expect(p1.getByRole('region', { name: `Task 1.${n}` })).toHaveAttribute('data-status', 'passed');
  await expect(p1.getByRole('region', { name: 'Task 1.4' })).toHaveAttribute('data-status', 'open');
  await expect(p1.getByRole('textbox', { name: /tilt farther from vertical/ })).toHaveValue('Faster than light.');
  expect(await diagram(page)).toEqual(before);
  await expect(p1.getByRole('slider', { name: 'v/c' })).toBeDisabled();
  await expect(p1.getByRole('button', { name: 'Rod', exact: true })).toBeHidden();
});

test('the downloaded Report opens in the Report Viewer', async ({ page }) => {
  await open(page);
  await enterName(page);
  await drawPart1Worldlines(page);
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Report' }).click(),
  ]);
  const reportPath = await file.path();

  await page.goto(VIEWER);
  await page.getByLabel('Open a Report').setInputFiles(reportPath);
  const view = page.getByRole('article', { name: 'Report' });
  await expect(view).toContainText('Spacetime Diagrams');
  await expect(view).toContainText('PHY 1200');
  await expect(view).toContainText('Ada Lovelace');
  await expect(view.getByRole('heading', { name: 'Part 1: Building the diagram' })).toBeVisible();
  const task = view.getByRole('region', { name: /Task 1\.1/ });
  await expect(task).toHaveAttribute('data-status', 'passed');
  await expect(task).toContainText('diagram = [{'); // each Attempt records what was drawn
});

test('the Activity layout fits a laptop screen without horizontal scrolling', async ({ page }) => {
  await open(page);
  await enterName(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

/** Fill a Task's text boxes in order. */
async function fill(scope, task, values) {
  const boxes = scope.getByRole('region', { name: task }).getByRole('textbox');
  for (const [i, v] of values.entries()) await boxes.nth(i).fill(v);
}

async function submitPasses(scope, task) {
  await scope.getByRole('button', { name: `Submit ${task}` }).click();
  await expect(scope.getByRole('region', { name: task })).toHaveAttribute('data-status', 'passed');
}

test('Part 2: only a rocket-frame rod lies from B to F, and it passes Task 2.5 on Submit', async ({ page }) => {
  await open(page);
  await enterName(page);
  await page.getByRole('tab', { name: /Part 2/ }).click();
  await page.waitForFunction(() => window.activityHost.instances.simultaneity.displays[0].toScreen(0, 0));
  const p2 = part(page, 2);
  await expect(p2.getByRole('slider', { name: 'v/c' })).toBeDisabled();
  await expect(p2.getByRole('button', { name: 'Rod', exact: true })).toBeHidden();

  // 2.1: the back and the front of the rocket (x′ = ∓2, through x = ∓1.6 at t = 0), and the flash.
  await drawWorldline(page, [-1.6, 0], [-0.4, 2], 2);
  await drawWorldline(page, [1.6, 0], [4, 4], 2);
  await drawWorldline(page, [0, 0], [4, 4], 2);
  await drawWorldline(page, [0, 0], [-2, 2], 2);
  await submitPasses(p2, 'Task 2.1');

  // 2.2–2.4: mark B and F on the worldlines, and answer.
  await drawEvent(page, -1, 1, 2);
  await drawEvent(page, 4, 4, 2);
  await fill(p2, 'Task 2.2', ['2', '2']);
  await submitPasses(p2, 'Task 2.2');
  await fill(p2, 'Task 2.3', ['1', '4']);
  await p2.getByRole('region', { name: 'Task 2.3' }).getByRole('radio', { name: /reaches the back/ }).check();
  await submitPasses(p2, 'Task 2.3');
  await fill(p2, 'Task 2.4', ['The back runs into the light; the front runs away from it.']);
  await submitPasses(p2, 'Task 2.4');

  // 2.5: the rod tool appears. A rod laid in the Earth frame from B can't reach F.
  const rodTool = p2.getByRole('button', { name: 'Rod', exact: true });
  await expect(rodTool).toBeVisible();
  await rodTool.click();
  await drag(page, [-1, 1], [4, 1], 2);
  const task = p2.getByRole('region', { name: 'Task 2.5' });
  await task.locator('input[type=radio][value="xp-axis"]').check();
  await fill(p2, 'Task 2.5', ['Events simultaneous in one frame are not in another.']);
  await p2.getByRole('button', { name: 'Submit Task 2.5' }).click();
  await expect(p2.getByRole('status', { name: 'Task 2.5 feedback' })).toContainText('nearest rod');
  await expect(task).toHaveAttribute('data-status', 'open');

  // Make it simultaneous in the rocket frame, put its ends on the back and the front, and drag it
  // up to B: a rocket "now" line.
  const side = p2.getByRole('complementary', { name: 'Objects and measurements' });
  const rodItem = side.locator('[data-item]').last();
  await rodItem.locator('select[data-k="frame"]').selectOption('Kp');
  await side.getByRole('combobox', { name: 'End 1' }).selectOption({ index: 1 });
  await side.getByRole('combobox', { name: 'End 2' }).selectOption({ index: 2 });
  let rod = (await diagram(page, 2)).find((o) => o.kind === 'rod');
  expect(rod.frame).toBe('Kp');
  expect(rod.ends.map((e) => e.wl)).toEqual([1, 2]);
  await p2.getByRole('button', { name: 'Move', exact: true }).click();
  // Grab the rod where it is drawn on top. Where the earlier drag laid it varies by a few pixels,
  // and the diagram redraws on the next frame, so look along the drawn rod between its ends.
  const kSvg = p2.getByRole('img', { name: 'Spacetime diagram in frame K', exact: true });
  let q;
  await expect.poll(async () => {
    q = await kSvg.evaluate((svg, id) => {
      const ends = [...svg.querySelectorAll(`[data-role="rodend"][data-id="${id}"]`)].map((c) => c.getBoundingClientRect());
      if (ends.length !== 2) return null;
      const [a, b] = ends.map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
      for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
        const p = { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
        if (document.elementFromPoint(p.x, p.y)?.dataset.role === 'rod') return p;
      }
      return null;
    }, rod.id);
    return q;
  }).not.toBeNull();
  // Starting the drag re-renders the sidebar, which can shift the diagram on the page by a few
  // pixels, so find B again once the drag has started.
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y - 10, { steps: 2 });
  const b = await at(page, -1, 1, 2);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  rod = (await diagram(page, 2)).find((o) => o.kind === 'rod');
  expect(rod.T).toBeCloseTo(2, 9);

  await p2.getByRole('button', { name: 'Submit Task 2.5' }).click();
  await expect(task).toHaveAttribute('data-status', 'passed');
  await expect(p2.getByText('5 of 5 Tasks done')).toBeVisible();
});
