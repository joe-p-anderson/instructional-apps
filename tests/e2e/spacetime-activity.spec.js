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

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });
const at = (page, x, t) => page.evaluate(([x, t]) => window.activityHost.instances.building.displays[0].toScreen(x, t), [x, t]);
const diagram = (page) => page.evaluate(() => JSON.parse(window.activityHost.instances.building.state.snapshot().diagram));

/** Draw a worldline with the real Worldline tool, dragging from one K point to another. */
async function drawWorldline(page, [x1, t1], [x2, t2]) {
  await part(page, 1).getByRole('button', { name: 'Worldline', exact: true }).click();
  const a = await at(page, x1, t1), b = await at(page, x2, t2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

/** Mark an event with the real Event tool. */
async function drawEvent(page, x, t) {
  await part(page, 1).getByRole('button', { name: 'Event', exact: true }).click();
  const p = await at(page, x, t);
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
