import { test, expect } from '@playwright/test';
import { copyShareLink } from './helpers/share-link.js';

const PAGE = '/tools/electrostatics/';

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

test('the Electric field tab loads with every Control shown and unlocked', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab', { name: 'Electric field' })).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByRole('slider', { name: 'Q (nC)', exact: true })).toBeEnabled();
  for (const name of ['Q (nC)', 'θ', 'E₀x', 'E₀y']) {
    await expect(page.getByRole('spinbutton', { name, exact: true })).toBeEnabled();
  }
  // Q is a kit slider, whose reset is disabled at the default (0 nC).
  await expect(page.getByRole('button', { name: 'Reset to 0 nC', exact: true })).toBeDisabled();
  for (const name of ['Reset θ', 'Reset E₀']) {
    await expect(page.getByRole('button', { name })).toBeEnabled();
  }
  await expect(page.getByLabel('θ arc picker')).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Electric field' }).getByLabel('E₀ joystick')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Induced charges' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Charge overlay' })).toBeChecked();

  const controls = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return i.controls.ids().map((id) => ({ id, locked: i.controls.get(id).isLocked(), hidden: i.controls.get(id).isHidden() }));
  });
  expect(controls.map((c) => c.id).sort()).toEqual(['E0', 'Q', 'induce', 'showCharges', 'theta']);
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
});

test('the State carries every value with a label and unit, and changing Q updates it', async ({ page }) => {
  await open(page);
  const { state, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return { state: i.state.snapshot(), info: i.state.describe() };
  });
  expect(state).toEqual({ Q: 0, E0x: 0, E0y: 0, E0mag: 0, E0angle: 0, theta: 0, induce: false, showCharges: true, Emax: 0 });
  for (const k of Object.keys(state)) {
    expect(typeof info[k].label, k).toBe('string');
    expect(typeof info[k].unit, k).toBe('string');
  }
  expect(info.Q.unit).toBe('nC');
  expect(info.E0mag.unit).toBe('V/m');
  expect(info.theta.unit).toBe('rad');

  await setNumber(page, 'Q (nC)', 1.5);
  const s = await snapshot(page);
  expect(s.Q).toBeCloseTo(1.5, 9);
  expect(s.Emax).toBeGreaterThan(0);
});

test('typing E₀x and E₀y sets E₀; its magnitude is kept to 2000 V/m', async ({ page }) => {
  await open(page);
  await setNumber(page, 'E₀x', 300);
  await setNumber(page, 'E₀y', 400);
  let s = await snapshot(page);
  expect(s).toMatchObject({ E0x: 300, E0y: 400, E0mag: 500 });
  await expect(page.getByRole('status', { name: '|E₀|' })).toContainText('500 V/m');

  await setNumber(page, 'E₀x', 2000);
  s = await snapshot(page);
  expect(s.E0mag).toBeCloseTo(2000, 6);

  await page.getByRole('button', { name: 'Reset E₀' }).click();
  s = await snapshot(page);
  expect(s).toMatchObject({ E0x: 0, E0y: 0 });
});

test('the joystick sets E₀ by dragging, but not while locked', async ({ page }) => {
  await open(page);
  const stick = page.getByRole('tabpanel', { name: 'Electric field' }).getByLabel('E₀ joystick');
  const box = await stick.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width / 4, cy, { steps: 4 });
  await page.mouse.up();
  let s = await snapshot(page);
  expect(s.E0x).toBeGreaterThan(500);
  expect(Math.abs(s.E0y)).toBeLessThan(100);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('E0').lock());
  const before = await snapshot(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - box.height / 4, { steps: 4 });
  await page.mouse.up();
  s = await snapshot(page);
  expect(s.E0x).toBe(before.E0x);
  expect(s.E0y).toBe(before.E0y);
  await expect(page.getByRole('spinbutton', { name: 'E₀x', exact: true })).toBeDisabled();
});

test('the arc picker sets θ between 0 and π/2, but not while locked', async ({ page }) => {
  await open(page);
  const arc = page.getByLabel('θ arc picker');
  const box = await arc.boundingBox();
  // Far to the right of the arc's centre: the parallel end, θ = π/2.
  await page.mouse.click(box.x + box.width - 2, box.y + box.height - 10);
  let s = await snapshot(page);
  expect(s.theta).toBeCloseTo(Math.PI / 2, 1);

  await page.getByRole('button', { name: 'Reset θ' }).click();
  expect((await snapshot(page)).theta).toBe(0);

  await page.evaluate(() => window.toolHost.instances[0].controls.get('theta').lock());
  await page.mouse.click(box.x + box.width - 2, box.y + box.height - 10);
  s = await snapshot(page);
  expect(s.theta).toBe(0);
});

test('a reload and a share link restore the same setup', async ({ page, browser }) => {
  await open(page);
  await setNumber(page, 'Q (nC)', -2.3);
  await setNumber(page, 'θ', 0.7);
  await setNumber(page, 'E₀x', -600);
  await setNumber(page, 'E₀y', 800);
  await page.getByRole('checkbox', { name: 'Induced charges' }).check();
  await page.getByRole('checkbox', { name: 'Charge overlay' }).uncheck();
  const want = await snapshot(page);
  expect(want).toMatchObject({ Q: -2.3, theta: 0.7, E0x: -600, E0y: 800, induce: true, showCharges: false });

  await page.reload();
  await page.waitForFunction(() => window.toolHost);
  expect(await snapshot(page)).toEqual(want);
  await expect(page.getByRole('spinbutton', { name: 'Q (nC)', exact: true })).toHaveValue('-2.3');

  const url = await copyShareLink(page);
  expect(url).toMatch(/#s=/);
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await open(theirs, url);
  expect(await snapshot(theirs)).toEqual(want);
  await other.close();
});

test('the Display gives a PNG snapshot', async ({ page }) => {
  await open(page);
  const png = await page.evaluate(() => window.toolHost.instances[0].displays[0].snapshot());
  expect(png).toMatch(/^data:image\/png;base64,/);
});

test('two instances on one page are independent, and only a visible one animates', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/electrostatics/electrostatics.js');
    const shown = document.body.appendChild(document.createElement('div'));
    shown.style.cssText = 'width:600px;height:500px;display:flex';
    const hidden = document.body.appendChild(document.createElement('div'));
    hidden.style.cssText = 'width:600px;height:500px;display:none';
    const a = tool.mount(shown, 'electric-field', { E0x: 1000 });
    const b = tool.mount(hidden, 'electric-field', { E0x: 1000 });
    shown.scrollIntoView();
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('Q').set(2);
    // The animated charges move between two Display snapshots only on the visible instance.
    const picture = (instance) => instance.displays[0].snapshot();
    const a0 = await picture(a);
    const b0 = await picture(b);
    await new Promise((r) => setTimeout(r, 500));
    const out = {
      aMoved: (await picture(a)) !== a0,
      bMoved: (await picture(b)) !== b0,
      aQ: a.state.snapshot().Q,
      bQ: b.state.snapshot().Q,
      bChanges,
    };
    a.destroy();
    b.destroy();
    out.leftover = shown.childElementCount + hidden.childElementCount;
    return out;
  });
  expect(result).toEqual({ aMoved: true, bMoved: false, aQ: 2, bQ: 0, bChanges: 0, leftover: 0 });
});
