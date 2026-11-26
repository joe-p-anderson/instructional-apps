import { test, expect } from '@playwright/test';

const PAGE = '/tools/oscilloscope/activities/phase-period-amplitude.html';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.activityHost);
}

async function enterName(page, name = 'Ada Lovelace') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await page.getByRole('button', { name: 'Start' }).click();
}

test('the page title and header read "Sinusoidal Signals"', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle('Sinusoidal Signals');
  await expect(page.getByRole('heading', { name: 'Sinusoidal Signals', level: 1 })).toBeVisible();
});

test('the name gate blocks Part 1 until a name is entered', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeHidden();

  // An empty name doesn't start the Run.
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toBeHidden();

  await enterName(page);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toBeHidden();
  await expect(page.getByRole('tab', { name: /Part 1/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Part 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
});

// Exposure of each Control in a Part, as the Tool contract reports it.
const exposure = (page, partId) => page.evaluate((id) => {
  const controls = window.activityHost.instances[id].controls;
  return Object.fromEntries(controls.ids().map((c) => {
    const ctl = controls.get(c);
    return [c, ctl.isHidden() ? 'hidden' : ctl.isLocked() ? 'locked' : 'open'];
  }));
}, partId);

const part = (page, n) => page.getByRole('tabpanel', { name: new RegExp(`Part ${n}`) });

async function setNumber(page, scope, name, value) {
  const box = scope.getByRole('spinbutton', { name, exact: true });
  await box.fill(String(value));
  await box.press('Enter');
}

test('exposure rules show, lock and hide the expected Controls, including the Δt marker', async ({ page }) => {
  await open(page);
  await enterName(page);

  // Part 1, Task 1.1: every input open; the φ readouts hidden.
  expect(await exposure(page, 'phase')).toEqual({
    Va: 'open', f: 'open', Dt: 'open', 'Va-marker': 'open', 'f-marker': 'open', 'Dt-marker': 'open',
    'phi-readout': 'hidden', 'ratio-readout': 'hidden',
  });

  // Part 2, Task 2.1: f only; Va locked; Δt hidden (slider and marker).
  expect(await exposure(page, 'period-amplitude')).toEqual({
    Va: 'locked', f: 'open', Dt: 'hidden', 'Va-marker': 'locked', 'f-marker': 'open', 'Dt-marker': 'hidden',
    'phi-readout': 'open', 'ratio-readout': 'open',
  });
  await page.getByRole('tab', { name: /Part 2/ }).click();
  const p2 = part(page, 2);
  await expect(p2.getByRole('slider', { name: 'Δt (s)', exact: true })).toBeHidden();
  await expect(p2.getByRole('slider', { name: 'Va (V)', exact: true })).toBeDisabled();
  await expect(p2.getByRole('slider', { name: 'f (Hz)', exact: true })).toBeEnabled();

  // Passing Task 1.1 locks Δt (slider, number box and marker) for Task 1.2.
  await page.getByRole('tab', { name: /Part 1/ }).click();
  const p1 = part(page, 1);
  await setNumber(page, p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(p1.getByRole('slider', { name: 'Δt (s)', exact: true })).toBeDisabled();
  await expect(p1.getByRole('spinbutton', { name: 'Δt (s)', exact: true })).toBeDisabled();
  expect(await exposure(page, 'phase')).toMatchObject({ Dt: 'locked', 'Dt-marker': 'locked', f: 'open' });
});

test('the φ Tasks hide the readouts that print φ; they reappear once a later Task no longer hides them', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const phi = p1.getByRole('status', { name: 'φ', exact: true, includeHidden: true });
  const ratio = p1.getByRole('status', { name: 'Δt / T', exact: true, includeHidden: true });
  // φ = 2π f Δt at the Setup (f = 0.5 Hz, Δt = 0.25 s), as the readout would print it.
  const startPhi = '0.7854';

  // Task 1.1 asks for φ: neither readout is shown, and φ's value is nowhere on the Part.
  await expect(p1.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
  await expect(phi).toBeHidden();
  await expect(ratio).toBeHidden();
  expect(await p1.evaluate((el) => el.innerText)).not.toContain(startPhi); // rendered text only
  // Part 2 doesn't ask for φ, so its readouts stay.
  await page.getByRole('tab', { name: /Part 2/ }).click();
  await expect(part(page, 2).getByRole('status', { name: 'φ', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Part 1/ }).click();

  // Task 1.2 also asks for φ.
  await setNumber(page, p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(p1.getByRole('button', { name: 'Submit Task 1.2' })).toBeVisible();
  await expect(phi).toBeHidden();
  await expect(ratio).toBeHidden();

  // Task 1.3 (the Question) no longer hides them.
  await setNumber(page, p1, 'f (Hz)', 0.25);
  await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
  await expect(phi).toBeVisible();
  await expect(phi).toContainText('0.7854 rad');
  await expect(ratio).toBeVisible();
});

test('dragging through the target without Submitting does not pass; a Submit at the target passes and unlocks the next Task', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  // Wait until the scope Display is laid out, then find the Δt marker at (T − Δt, Va).
  await page.waitForFunction(() => window.activityHost.instances.phase.displays[0].toScreen(0, 0));

  // Drag the Δt marker from Δt = 0.25 s to 1.25 s, passing through 0.5 s (φ = π/2).
  const p = await page.evaluate(() => {
    const instance = window.activityHost.instances.phase;
    const scope = instance.displays[0];
    const { Dt, f, Va } = instance.state.snapshot();
    const at = scope.toScreen(1 / f - Dt, Va);
    return { ...at, pxPerSecond: scope.toScreen(1, 0).x - scope.toScreen(0, 0).x };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - p.pxPerSecond, p.y, { steps: 10 });
  await page.mouse.up();
  const dt = await page.evaluate(() => window.activityHost.instances.phase.state.snapshot().Dt);
  expect(dt).toBeCloseTo(1.25, 1);

  const card11 = p1.getByRole('region', { name: 'Task 1.1' });
  const card12 = p1.getByRole('region', { name: 'Task 1.2' });
  await expect(card11).toHaveAttribute('data-status', 'open');
  await expect(card12).toHaveAttribute('data-status', 'locked');

  // Submitting where the drag ended misses, with specific feedback.
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(p1.getByRole('status', { name: 'Task 1.1 feedback' })).toContainText('need π/2');
  await expect(card11).toHaveAttribute('data-status', 'open');
  // A locked Task's Submit is disabled (and, in the oscilloscope's side layout, not shown).
  await expect(p1.getByRole('button', { name: 'Submit Task 1.2', includeHidden: true })).toBeDisabled();

  // A Submit at the target passes, marks the Task done and unlocks the next one.
  await setNumber(page, p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await expect(card11).toHaveAttribute('data-status', 'passed');
  await expect(p1.getByRole('button', { name: 'Submit Task 1.1' })).toBeHidden();
  await expect(card12).toHaveAttribute('data-status', 'open');
  await expect(p1.getByRole('button', { name: 'Submit Task 1.2' })).toBeEnabled();
  await expect(p1.getByRole('progressbar')).toHaveAttribute('value', '1');
  await expect(p1.getByText('1 of 3 Tasks done')).toBeVisible();
});

test('the free-text Question follows Task 1.2', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  // Disabled while locked (and, in the oscilloscope's side layout, not shown until it opens).
  const answer = p1.getByRole('textbox', { name: /difficult to measure/, includeHidden: true });
  await expect(answer).toBeDisabled();
  await setNumber(page, p1, 'Δt (s)', 0.5);
  await p1.getByRole('button', { name: 'Submit Task 1.1' }).click();
  await setNumber(page, p1, 'f (Hz)', 0.25);
  await p1.getByRole('button', { name: 'Submit Task 1.2' }).click();
  await expect(answer).toBeEnabled();
  await answer.fill('The traces must be lined up by eye.');
  await p1.getByRole('button', { name: 'Submit Task 1.3' }).click();
  await expect(p1.getByRole('region', { name: 'Task 1.3' })).toHaveAttribute('data-status', 'passed');
  await expect(p1.getByText('3 of 3 Tasks done')).toBeVisible();
});

test('a Hint appears after repeated misses', async ({ page }) => {
  await open(page);
  await enterName(page);
  const p1 = part(page, 1);
  const submit = p1.getByRole('button', { name: 'Submit Task 1.1' });
  // Three different misses (an identical repeat would be refused, and not count).
  for (const dt of [0.1, 0.2, 0.3]) {
    const field = p1.getByRole('spinbutton', { name: 'Δt (s)', exact: true });
    await field.fill(String(dt));
    await field.press('Enter');
    await submit.click();
  }
  await expect(p1.getByText(/Hint:/)).toBeVisible();
});

test('math in prompts and Questions is rendered with MathJax', async ({ page }) => {
  await open(page);
  await enterName(page);
  const card = part(page, 1).getByRole('region', { name: 'Task 1.1' });
  await expect(card.locator('mjx-container').first()).toBeVisible({ timeout: 15000 });
  await expect(card).not.toContainText('\\(');
});

test('the Activity layout fits a laptop screen without horizontal scrolling', async ({ page }) => {
  await open(page);
  await enterName(page);
  await expect(page.getByRole('button', { name: 'Submit Task 1.1' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('rendered maths (MathJax) is out of the Tab order', async ({ page }) => {
  await open(page);
  await enterName(page);
  await expect(page.locator('mjx-container').first()).toBeAttached();
  // MathJax elements Tab would stop on: tabindex >= 0 on a container or inside one.
  const tabStops = () => page.evaluate(() => [...document.querySelectorAll('mjx-container, mjx-container *')]
    .filter((el) => el.tabIndex >= 0).length);
  await expect.poll(tabStops).toBe(0);
});
