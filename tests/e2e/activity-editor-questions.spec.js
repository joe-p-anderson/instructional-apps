// The Activity editor's Questions tab: numeric, choice and free-text Questions, expression
// answers with their live value, the tolerance field and presets, and choices (ticket 12).
import { test, expect } from '@playwright/test';
import { OSC, PHASORS, read, openEditor, openActivity, written, outline, liveTool, save } from './helpers/activity-editor.js';
import { decodeKey } from '../../framework/v1/runner/keys.js';

const tab = (page, name) => page.getByRole('tablist', { name: 'Task sections' }).getByRole('tab', { name });
const task = (page, num) => outline(page).getByRole('button', { name: new RegExp(`^${num.replace('.', '\\.')}\\s`) });
const card = (page, n) => page.getByRole('group', { name: `Question ${n}`, exact: true });

async function questionsAt(page, title, num) {
  await openEditor(page);
  await openActivity(page, title);
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, num).click();
  await tab(page, /^Questions/).click();
}

test('journey: add a numeric Question with an expression answer, apply a preset, see the live value, save, and check the JSON', async ({ page }) => {
  await questionsAt(page, 'Sinusoidal Signals', '1.1');
  await expect(page.getByText('No Questions.')).toBeVisible();

  await page.getByRole('textbox', { name: 'New Question prompt' }).fill('Peak to peak (V)');
  await page.getByRole('button', { name: '+ Numeric' }).click();
  const q = card(page, 1);
  await expect(page.getByRole('textbox', { name: 'Question 1 prompt' })).toBeFocused();
  await expect(q.locator('.idfield code')).toHaveText('peak-to-peak-v');

  await q.getByRole('group', { name: 'Question 1 answer is' }).getByRole('button', { name: 'State expression' }).click();
  await page.getByRole('textbox', { name: 'Question 1 answer' }).fill('2 * Va');
  const va = liveTool(page).getByRole('spinbutton', { name: 'Va (V)', exact: true });
  const start = Number(await va.inputValue());
  await expect(q.locator('[data-live="answer"]')).toHaveText(`= ${2 * start} at the live Tool`);

  // A preset stamps its plain values; the % switch follows.
  await q.getByRole('button', { name: 'Question 1 tolerance preset' }).click();
  await q.getByRole('menuitem', { name: /Phase ±2° mod 360/ }).click();
  await expect(page.getByRole('textbox', { name: 'Question 1 tolerance', exact: true })).toHaveValue('2');
  await expect(card(page, 1).getByRole('textbox', { name: 'modulus' })).toHaveValue('360');
  await card(page, 1).getByRole('button', { name: 'Question 1 tolerance preset' }).click();
  await card(page, 1).getByRole('menuitem', { name: /Amplitude 5%/ }).click();
  await expect(page.getByRole('textbox', { name: 'Question 1 tolerance', exact: true })).toHaveValue('5');
  await expect(page.getByRole('group', { name: 'Question 1 tolerance in' }).getByRole('button', { name: '%' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 1).getByRole('textbox', { name: 'modulus' })).toHaveValue('');

  // The live value follows the live Tool.
  await va.fill('1.5');
  await va.press('Enter');
  await expect(card(page, 1).locator('[data-live="answer"]')).toHaveText('= 3 at the live Tool');

  await save(page);
  const [saved] = JSON.parse(await written(page, OSC)).parts[0].tasks[0].questions;
  expect(Object.keys(saved)).toEqual(['id', 'kind', 'prompt', 'answer', 'relTol', 'points']);
  expect(saved).toMatchObject({ id: 'peak-to-peak-v', kind: 'numeric', prompt: 'Peak to peak (V)', relTol: 0.05, points: 1 });
  expect(saved.answer).toMatch(/^enc1:/);
  expect(decodeKey(saved.answer)).toEqual({ expr: '2 * Va' });
});

test('the tolerance field writes tol on the unit side and relTol on the % side, clearing the other', async ({ page }) => {
  await questionsAt(page, 'Phasors and Impedance', '1.1');
  const q = card(page, 1);
  const tol = page.getByRole('textbox', { name: 'Question 1 tolerance', exact: true });
  await expect(tol).toHaveValue('2');
  await expect(q.getByRole('button', { name: 'Question 1 tolerance preset' })).toContainText('Amplitude 2%');
  await tol.fill('3');
  await expect(q.getByRole('button', { name: 'Question 1 tolerance preset' })).toContainText('Custom');
  await page.getByRole('group', { name: 'Question 1 tolerance in' }).getByRole('button', { name: 'unit', exact: true }).click();
  await save(page);
  let [saved] = JSON.parse(await written(page, PHASORS)).parts[0].tasks[0].questions;
  expect(saved.tol).toBe(3);
  expect('relTol' in saved).toBe(false);
  await page.getByRole('group', { name: 'Question 1 tolerance in' }).getByRole('button', { name: '%' }).click();
  await save(page);
  [saved] = JSON.parse(await written(page, PHASORS)).parts[0].tasks[0].questions;
  expect(saved.relTol).toBe(0.03);
  expect('tol' in saved).toBe(false);
});

test('choices are shown decoded, added, reordered, removed and marked; a correct id matching no choice is a problem', async ({ page }) => {
  await questionsAt(page, 'Phasors and Impedance', '1.2');
  const original = JSON.parse(read(PHASORS)).parts[0].tasks[1].questions[0];
  const correct = decodeKey(original.correct);
  const q = card(page, 1);
  const k = original.choices.findIndex((c) => c.id === correct);
  await expect(q.getByRole('radio', { name: `Choice ${k + 1} is correct` })).toBeChecked();
  await expect(q.getByRole('textbox', { name: 'Question 1 choice 1 text' })).toHaveValue(original.choices[0].text);

  await q.getByRole('button', { name: '+ Choice' }).click();
  const m = original.choices.length + 1;
  await card(page, 1).getByRole('textbox', { name: `Question 1 choice ${m} text` }).fill('None of these');
  await card(page, 1).getByRole('radio', { name: `Choice ${m} is correct` }).check();
  await card(page, 1).getByRole('button', { name: `Move choice ${m} up` }).click();
  await save(page);
  const [saved] = JSON.parse(await written(page, PHASORS)).parts[0].tasks[1].questions;
  const added = saved.choices[m - 2];
  expect(added.text).toBe('None of these');
  expect(decodeKey(saved.correct)).toBe(added.id);

  // Removing the correct choice leaves a problem that jumps to the correct field.
  await card(page, 1).getByRole('button', { name: `Remove choice ${m - 1}` }).click();
  const problem = page.getByRole('region', { name: 'Problems' }).getByRole('button', { name: /correct must name one of its choices/ });
  await expect(problem).toBeVisible();
  await problem.click();
  await expect(card(page, 1).getByRole('radio').first()).toBeFocused();
});

test('Questions of every kind open as they are, change kind, reorder and are removed', async ({ page }) => {
  await questionsAt(page, 'Phasors and Impedance', '2.1');
  const before = JSON.parse(read(PHASORS)).parts[1].tasks[0].questions;
  await expect(page.locator('.qcard')).toHaveCount(before.length);
  for (const [i, q] of before.entries()) {
    await expect(card(page, i + 1).locator('.idfield code')).toHaveText(q.id);
    await expect(page.getByRole('textbox', { name: `Question ${i + 1} prompt` })).toHaveValue(q.prompt);
    await expect(page.getByRole('textbox', { name: `Question ${i + 1} answer` })).toHaveValue(String(decodeKey(q.answer)));
  }
  await card(page, 1).getByRole('button', { name: 'Move Question 1 down' }).click();
  await expect(card(page, 1).locator('.idfield code')).toHaveText(before[1].id);
  await card(page, 1).getByRole('combobox', { name: 'Question 1 kind' }).selectOption('Free text');
  await expect(card(page, 1)).toContainText('Never judged');
  await card(page, 2).getByRole('button', { name: 'Remove Question 2' }).click();
  await save(page);
  const after = JSON.parse(await written(page, PHASORS)).parts[1].tasks[0].questions;
  expect(after.map((q) => q.id)).toEqual([before[1].id, ...before.slice(2).map((q) => q.id)]);
  expect(after[0]).toEqual({ id: before[1].id, kind: 'text', prompt: before[1].prompt, points: before[1].points });
});
