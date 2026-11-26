import { test, expect } from '@playwright/test';

const PAGE = '/tools/oscilloscope/';

async function open(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.toolHost);
}

test('Standalone mode shows one tab per Mode', async ({ page }) => {
  await open(page);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(1);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
});

test('Standalone mode shows every Control, unlocked', async ({ page }) => {
  await open(page);

  // The signal Controls: each slider is paired with a number box and a reset button, which is
  // disabled while the slider is at its default.
  for (const name of ['Va (V)', 'f (Hz)', 'Δt (s)']) {
    await expect(page.getByRole('slider', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('slider', { name, exact: true })).toBeEnabled();
    await expect(page.getByRole('spinbutton', { name, exact: true })).toBeEnabled();
    const reset = page.locator('.fw-slider', { has: page.getByRole('slider', { name, exact: true }) })
      .getByRole('button', { name: /^Reset to / });
    await expect(reset).toBeDisabled();
  }

  // Every registered Control (including the draggable markers inside the Display)
  // reports itself shown and unlocked through the Tool contract.
  const controls = await page.evaluate(() => {
    const instance = window.toolHost.instances[0];
    return instance.controls.ids().map((id) => instance.controls.get(id)).map((c) => ({
      id: c.id,
      locked: c.isLocked(),
      hidden: c.isHidden(),
    }));
  });
  expect(controls.map((c) => c.id).sort()).toEqual(
    ['Dt', 'Dt-marker', 'Va', 'Va-marker', 'f', 'f-marker', 'phi-readout', 'ratio-readout'].sort(),
  );
  for (const c of controls) expect(c, c.id).toMatchObject({ locked: false, hidden: false });
});

test('live metrics publish φ, T and pk-pk as State with units', async ({ page }) => {
  await open(page);
  // Default Setup: Va = 2 V, f = 0.5 Hz, Δt = 0.25 s  →  φ = 2π·0.5·0.25 = π/4, T = 2 s, pk-pk = 4 V
  const { state, info } = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    return { state: i.state.snapshot(), info: i.state.describe() };
  });
  expect(state.phi).toBeCloseTo(Math.PI / 4, 6);
  expect(state.T).toBeCloseTo(2, 6);
  expect(state.pkpk).toBeCloseTo(4, 6);
  expect(info.phi.unit).toBe('rad');
  expect(info.T.unit).toBe('s');
  expect(info.pkpk.unit).toBe('V');

  await page.getByRole('spinbutton', { name: 'f (Hz)', exact: true }).fill('0.25');
  await page.getByRole('spinbutton', { name: 'f (Hz)', exact: true }).press('Enter');
  await expect(page.getByRole('status', { name: 'T', exact: true })).toContainText('4.000 s');
});

test('layout fits a laptop screen without horizontal scrolling', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('slider', { name: 'Va (V)', exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the Tool mounts several times on one page with independent State', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { default: tool } = await import('/tools/oscilloscope/oscilloscope.js');
    const a = tool.mount(document.body.appendChild(document.createElement('div')), 'dual-trace', { f: 0.25 });
    const b = tool.mount(document.body.appendChild(document.createElement('div')), 'dual-trace', { f: 0.5 });
    let bChanges = 0;
    b.state.onChange(() => { bChanges += 1; });
    a.controls.get('Va').set(1);
    const s = { a: a.state.snapshot(), b: b.state.snapshot() };
    a.destroy();
    b.destroy();
    return { aVa: s.a.Va, bVa: s.b.Va, aT: s.a.T, bT: s.b.T, bChanges };
  });
  expect(result).toEqual({ aVa: 1, bVa: 2, aT: 4, bT: 2, bChanges: 0 });
});

test('State serializes and restores', async ({ page }) => {
  await open(page);
  const restored = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    i.controls.get('f').set(0.4);
    i.controls.get('Dt').set(1.5);
    const saved = JSON.parse(JSON.stringify(i.serialize()));
    i.controls.get('f').set(0.9);
    i.controls.get('Dt').set(0);
    i.restore(saved);
    return i.state.snapshot();
  });
  expect(restored.f).toBeCloseTo(0.4, 9);
  expect(restored.Dt).toBeCloseTo(1.5, 9);
});

test('the Δt marker is a Control that can be locked like a slider', async ({ page }) => {
  await open(page);
  // Wait until the scope Display has been laid out at the size of its box.
  await page.waitForFunction(() => window.toolHost.instances[0].displays[0].toScreen(0, 0));

  // Screen position of the Δt marker, which sits at (T − Δt, Va).
  const markerAt = () => page.evaluate(() => {
    const instance = window.toolHost.instances[0];
    const scope = instance.displays[0];
    const { Dt, f, Va } = instance.state.snapshot();
    return { ...scope.toScreen(1 / f - Dt, Va), pxPerSecond: scope.toScreen(1, 0).x - scope.toScreen(0, 0).x };
  });
  const dt = () => page.evaluate(() => window.toolHost.instances[0].state.snapshot().Dt);
  const dragLeftOneSecond = async () => {
    const p = await markerAt();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - p.pxPerSecond, p.y, { steps: 5 });
    await page.mouse.up();
  };

  // Default Setup Δt = 0.25 s; dragging the marker 1 s left adds 1 s.
  await dragLeftOneSecond();
  expect(await dt()).toBeCloseTo(1.25, 1);

  // Locked: the same drag leaves Δt alone.
  await page.evaluate(() => window.toolHost.instances[0].controls.get('Dt-marker').lock());
  const before = await dt();
  await dragLeftOneSecond();
  expect(await dt()).toBe(before);
});

test('each plot marker can be focused and moved with the arrow keys, like a drag', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.toolHost.instances[0].displays[0].toScreen(0, 0));
  const state = () => page.evaluate(() => window.toolHost.instances[0].state.snapshot());

  // Va marker: a vertical handle at (0, Va). Up raises Va; Shift steps 0.1 V.
  const va = page.getByRole('slider', { name: 'Va marker' });
  await va.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  expect((await state()).Va).toBeCloseTo(2.11, 9);
  await expect(va).toHaveAttribute('aria-valuetext', '2.11 V');
  await expect(page.getByRole('spinbutton', { name: 'Va (V)', exact: true })).toHaveValue('2.11');

  // Δt marker at (T − Δt, Va): Right moves it right on the plot, so Δt shrinks.
  const dt = page.getByRole('slider', { name: 'Δt marker' });
  await dt.focus();
  await page.keyboard.press('ArrowRight');
  expect((await state()).Dt).toBeCloseTo(0.24, 9);
  await page.keyboard.press('Shift+ArrowLeft');
  const s = await state();
  expect(s.Dt).toBeCloseTo(0.34, 9);
  expect(s.ratio).toBeCloseTo(0.34 / 2, 9); // the derived State follows, as on a drag

  // f marker at (T, 0): Right moves it right, a longer period, so f falls.
  const f = page.getByRole('slider', { name: 'f marker' });
  await f.focus();
  await page.keyboard.press('ArrowRight');
  expect((await state()).f).toBeCloseTo(0.49, 9);
  await page.keyboard.press('Shift+ArrowLeft');
  expect((await state()).f).toBeCloseTo(0.59, 9);

  // The marker sits where its State puts it.
  const at = await page.evaluate(() => {
    const i = window.toolHost.instances[0];
    const { f, Dt, Va } = i.state.snapshot();
    return i.displays[0].toScreen(1 / f - Dt, Va);
  });
  const box = await dt.boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(at.x, 0);
  expect(box.y + box.height / 2).toBeCloseTo(at.y, 0);

  // A locked marker ignores the keys.
  await page.evaluate(() => window.toolHost.instances[0].controls.get('Va-marker').lock());
  await va.focus();
  await page.keyboard.press('ArrowUp');
  expect((await state()).Va).toBeCloseTo(2.11, 9);
});
