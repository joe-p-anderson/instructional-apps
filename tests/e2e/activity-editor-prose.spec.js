// The Activity editor's prose fields (ticket 13): a source box, a live preview typeset as the
// Task card shows it, and the formatting help hover.
import { test, expect } from '@playwright/test';
import { OSC, read, openEditor, openActivity, written, outline, liveTool, save } from './helpers/activity-editor.js';

const ELECTRO = 'tools/electrostatics/activities/conductor-properties.json';
const tab = (page, name) => page.getByRole('tablist', { name: 'Task sections' }).getByRole('tab', { name });
const task = (page, num) => outline(page).getByRole('button', { name: new RegExp(`^${num.replace('.', '\\.')}\\s`) });
const preview = (page, label) => page.getByRole('region', { name: `${label} preview` });

async function openTask(page, title, num) {
  await openEditor(page);
  await openActivity(page, title);
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, num).click();
}

test('journey: type a prompt with a subscript and inline math, and see both rendered in the preview', async ({ page }) => {
  await openTask(page, 'Sinusoidal Signals', '1.1');
  const source = page.getByRole('textbox', { name: 'Prompt', exact: true });
  await source.fill('');
  const typed = 'Measure V<sub>R</sub> where \\(\\omega_0 = 1/\\sqrt{LC}\\).';
  await source.pressSequentially(typed);
  const out = preview(page, 'Prompt');
  await expect(out.locator('sub')).toHaveText('R');
  await expect(out.locator('mjx-container')).toHaveCount(1);
  await expect(out).not.toContainText('\\(');
  // Rendered as the Task card renders prompts.
  await expect(out.locator('.fw-task-prompt')).toHaveCount(1);
  await save(page);
  expect(JSON.parse(await written(page, OSC)).parts[0].tasks[0].prompt).toBe(typed);
});

test('the preview shows the existing prompt typeset when the Task opens', async ({ page }) => {
  await openTask(page, 'Conductor Properties', '1.1');
  const out = preview(page, 'Prompt');
  await expect(out.locator('em')).toHaveText('modus tollens');
  await expect(out.locator('mjx-container').first()).toBeVisible();
});

test('the formatting help opens by keyboard and by hover', async ({ page }) => {
  await openTask(page, 'Sinusoidal Signals', '1.1');
  const help = page.getByRole('button', { name: 'Formatting help for Prompt' });
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeHidden();
  await page.getByRole('textbox', { name: 'Prompt', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(help).toBeFocused();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('<sub>');
  await expect(tip).toContainText('<sup>');
  await expect(tip).toContainText('<br>');
  await expect(tip).toContainText('\\( … \\)');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.mouse.move(0, 0);
  await help.hover();
  await expect(tip).toBeVisible();
});

test('a Hint text is edited decoded with its preview, and open-and-save stays byte-identical', async ({ page }) => {
  await openTask(page, 'Conductor Properties', '1.1');
  await tab(page, 'Hint & notes').click();
  const source = page.getByRole('textbox', { name: 'Hint text', exact: true });
  const plain = 'Drag the E₀ joystick away from its centre, or type a nonzero E₀x or E₀y.';
  await expect(source).toHaveValue(plain);
  const out = preview(page, 'Hint text');
  await expect(out.locator('.fw-task-hint')).toContainText(`Hint: ${plain}`);
  await expect(page.getByRole('button', { name: 'Formatting help for Hint text' })).toBeVisible();

  await source.pressSequentially(' \\(x\\)');
  await expect(out.locator('mjx-container')).toHaveCount(1);
  for (let i = 0; i < 6; i += 1) await source.press('Backspace');
  await expect(source).toHaveValue(plain);
  await save(page);
  expect(await written(page, ELECTRO)).toBe(read(ELECTRO));
});
