// The Activity editor's Condition builder (ticket 11): the Condition tab of the Task form.
import { test, expect } from '@playwright/test';
import { OSC, read, openEditor, openActivity, written, outline, liveTool, save, repoFiles } from './helpers/activity-editor.js';
import { decodeKey } from '../../framework/v1/runner/keys.js';

const tab = (page, name) => page.getByRole('tablist', { name: 'Task sections' }).getByRole('tab', { name });
const task = (page, num) => outline(page).getByRole('button', { name: new RegExp(`^${num.replace('.', '\\.')}\\s`) });
const node = (page, name) => page.getByRole('group', { name, exact: true });
const verdict = (page) => page.getByRole('status', { name: 'Live result' });

async function openTaskCondition(page, title, num) {
  await openActivity(page, title);
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, num).click();
  await tab(page, 'Condition').click();
}

test('journey: build an any-of group with a target and an expression range, watch the live result follow the Tool, save, and the file holds it encoded', async ({ page }) => {
  await openEditor(page);
  await openTaskCondition(page, 'Sinusoidal Signals', '1.3');
  await expect(page.getByText('No Condition')).toBeVisible();
  await page.getByRole('button', { name: '+ Any of' }).click();

  // The group starts with one target. Test T within 5 % of 3 s.
  const first = node(page, 'Condition 1');
  const state = first.getByRole('combobox', { name: 'State' });
  await expect(state.locator('option')).toHaveCount(7); // only the Mode's State
  await expect(state.locator('option[value="T"]')).toHaveText('T · Period T (s)');
  await state.selectOption('T');
  await first.getByRole('textbox', { name: 'Target', exact: true }).fill('3');
  await first.getByRole('textbox', { name: 'Tolerance' }).fill('5');
  await first.getByRole('group', { name: 'Tolerance in' }).getByRole('button', { name: '%' }).click();
  await expect(first.getByRole('textbox', { name: 'Tolerance' })).toHaveValue('5');

  // And a range on an expression: f * 10 above 9.
  await node(page, 'Condition').getByRole('button', { name: '+ Range' }).click();
  const second = node(page, 'Condition 2');
  await second.getByRole('group', { name: 'Tested' }).getByRole('button', { name: 'Expression' }).click();
  await second.getByRole('textbox', { name: 'Expression' }).fill('f * 10');
  await second.getByRole('textbox', { name: 'Above' }).fill('9');

  // f = 0.5 Hz at the Setup: T = 2 s, so both miss.
  await expect(verdict(page)).toContainText('Miss now');
  await expect(verdict(page)).toContainText('Period T = 2 s; need 3.00 s ± 5%');
  await expect(verdict(page)).toContainText('f * 10 = 5; need > 9');

  // Arrange the live Tool (Full view): f = 1/3 Hz makes T = 3 s.
  await liveTool(page).getByRole('button', { name: 'Full', exact: true }).click();
  const f = liveTool(page).getByRole('spinbutton', { name: 'f (Hz)', exact: true });
  await f.fill('0.34');
  await f.press('Enter');
  await expect(verdict(page)).toContainText('Pass now');

  await save(page);
  const stored = JSON.parse(await written(page, OSC)).parts[0].tasks[2].condition;
  expect(stored).toMatch(/^enc1:/);
  expect(decodeKey(stored)).toEqual({ type: 'anyOf', conditions: [
    { state: 'T', target: 3, relTol: 0.05 },
    { type: 'range', state: { expr: 'f * 10' }, above: 9 },
  ] });
});

test('"Use current value" fills a target from the live Tool, and the tolerance switch clears the other key', async ({ page }) => {
  await openEditor(page);
  await openTaskCondition(page, 'Sinusoidal Signals', '2.1'); // { state: T, target: 3, tol: 0.05, targetLabel }
  const root = node(page, 'Condition');
  await expect(root.getByRole('combobox', { name: 'State' })).toHaveValue('T');
  await expect(root.getByRole('textbox', { name: 'Target label' })).toHaveValue('3.00 s');
  await root.getByRole('button', { name: 'Use current value' }).click();
  await expect(root.getByRole('textbox', { name: 'Target', exact: true })).toHaveValue('2');
  await expect(verdict(page)).toContainText('Pass now');
  await root.getByRole('group', { name: 'Tolerance in' }).getByRole('button', { name: '%' }).click();
  await root.getByRole('textbox', { name: 'Tolerance' }).fill('2');
  await save(page);
  expect(decodeKey(JSON.parse(await written(page, OSC)).parts[1].tasks[0].condition))
    .toEqual({ state: 'T', target: 2, relTol: 0.02, targetLabel: '3.00 s' });
  expect(JSON.stringify(decodeKey(JSON.parse(await written(page, OSC)).parts[1].tasks[0].condition)))
    .toBe('{"state":"T","target":2,"relTol":0.02,"targetLabel":"3.00 s"}');
});

test("an expression that doesn't parse, or names unknown State, is listed as a problem that goes to its field", async ({ page }) => {
  await openEditor(page);
  await openTaskCondition(page, 'Sinusoidal Signals', '2.1');
  const problems = page.getByRole('region', { name: 'Problems' });
  const target = node(page, 'Condition').getByRole('textbox', { name: 'Target', exact: true });
  await target.fill('1 / (f');
  await expect(problems).toContainText(`target expression "1 / (f" doesn't parse`);
  await target.fill('1 / fq');
  await expect(problems).toContainText('expression "1 / fq" names "fq", which is not State of Mode "dual-trace"');
  await tab(page, 'Prompt').click();
  await problems.getByRole('button', { name: /names "fq"/ }).click();
  await expect(tab(page, 'Condition')).toHaveAttribute('aria-selected', 'true');
  await expect(node(page, 'Condition').getByRole('textbox', { name: 'Target', exact: true })).toBeFocused();
});

test('groups nest and come apart: an all-of inside an any-of, removing nodes, and removing the Condition', async ({ page }) => {
  await openEditor(page);
  await openTaskCondition(page, 'Sinusoidal Signals', '1.3');
  await page.getByRole('button', { name: '+ Any of' }).click();
  await node(page, 'Condition').getByRole('button', { name: '+ All of' }).click();
  await node(page, 'Condition 2').getByRole('button', { name: '+ Equals' }).click();
  await expect(node(page, 'Condition 2.2')).toBeVisible();
  await node(page, 'Condition 2.2').getByRole('textbox', { name: 'Equals', exact: true }).fill('2');
  await node(page, 'Condition 1').getByRole('button', { name: 'Remove' }).click();
  await save(page);
  expect(decodeKey(JSON.parse(await written(page, OSC)).parts[0].tasks[2].condition))
    .toEqual({ type: 'anyOf', conditions: [[{ state: 'Va', target: 0, tol: 0.05 }, { state: 'Va', equals: 2 }]] });
  await node(page, 'Condition').getByRole('button', { name: 'Remove' }).first().click();
  await expect(page.getByText('No Condition')).toBeVisible();
  await save(page);
  expect(JSON.parse(await written(page, OSC)).parts[0].tasks[2]).not.toHaveProperty('condition');
});

test("every existing Activity's Conditions open in the builder without loss or problems", async ({ page }) => {
  const files = repoFiles();
  await openEditor(page, files);
  for (const [path, { text }] of Object.entries(files).filter(([f]) => f.endsWith('.json'))) {
    const activity = JSON.parse(text);
    await page.keyboard.press('Control+o');
    await openActivity(page, activity.title);
    await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
    for (const [p, part] of activity.parts.entries()) {
      for (const [t, x] of part.tasks.entries()) {
        if (x.condition === undefined) continue;
        await task(page, `${p + 1}.${t + 1}`).click();
        await tab(page, 'Condition').click();
        await expect(node(page, 'Condition')).toBeVisible();
        await expect(page.locator('#task-tabpanel .ftab-count, #task-tabpanel .sev')).toHaveCount(0);
        await expect(verdict(page)).not.toContainText("Can't judge");
      }
    }
    expect(await page.evaluate(() => window.activityEditor.editor.dirty)).toBe(false);
    expect(await page.evaluate(() => window.activityEditor.editor.serialize())).toBe(read(path));
    expect(await page.evaluate(() => window.activityEditor.editor.problems(window.activityEditor.toolInfo).length)).toBe(0);
  }
});
