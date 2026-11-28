// The Activity editor's Tasks: the tabbed Task form, Task edits, the exposure list and the live
// Tool's Student / Full view (ticket 10).
import { test, expect } from '@playwright/test';
import { OSC, PHASORS, read, openEditor, openActivity, written, saveStatus, outline, liveTool, save } from './helpers/activity-editor.js';

const switchOf = (page, label) => page.getByRole('group', { name: `${label}: state at this Task`, exact: true });
const exposureRow = (page, id) => page.getByRole('table', { name: 'Exposure' }).locator(`tr[data-control="${id}"]`);
const tab = (page, name) => page.getByRole('tablist', { name: 'Task sections' }).getByRole('tab', { name });
const task = (page, num) => outline(page).getByRole('button', { name: new RegExp(`^${num.replace('.', '\\.')}\\s`) });

test('journey: lock a Control at Task 1, see it locked and inherited at Task 3, open it at Task 3, save, and the lists are in the JSON', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, '1.1').click();
  await tab(page, 'Exposure').click();

  // Task 1 shows Va; lock it there. The live Tool (Student view) locks it at once.
  await expect(switchOf(page, 'Va').getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
  await expect(exposureRow(page, 'Va')).toContainText('changed here');
  const va = liveTool(page).getByRole('spinbutton', { name: 'Va (V)', exact: true });
  await expect(va).toBeEnabled();
  await switchOf(page, 'Va').getByRole('button', { name: 'Locked' }).click();
  await expect(switchOf(page, 'Va').getByRole('button', { name: 'Locked' })).toHaveAttribute('aria-pressed', 'true');
  await expect(va).toBeDisabled();

  // At Task 3 (the tab is remembered), Va is locked and inherited from Task 1.1.
  await task(page, '1.3').click();
  await expect(tab(page, 'Exposure')).toHaveAttribute('aria-selected', 'true');
  await expect(switchOf(page, 'Va').getByRole('button', { name: 'Locked' })).toHaveAttribute('aria-pressed', 'true');
  await expect(exposureRow(page, 'Va')).toContainText('inherited from Task 1.1');
  await expect(va).toBeDisabled();

  await switchOf(page, 'Va').getByRole('button', { name: 'Open' }).click();
  await expect(exposureRow(page, 'Va')).toContainText('changed here');
  await expect(va).toBeEnabled();
  await save(page);

  const before = JSON.parse(read(OSC)).parts[0].tasks;
  const tasks = JSON.parse(await written(page, OSC)).parts[0].tasks;
  expect(tasks[0].show).toEqual(before[0].show.filter((id) => id !== 'Va'));
  expect(tasks[0].lock).toEqual(['Va']);
  expect(tasks[1].lock).toEqual(before[1].lock);
  expect(tasks[2].show).toEqual([...before[2].show, 'Va']);
});

test('setting a Control back to its inherited state drops it from the lists; Changed here filters the list', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, '1.2').click();
  await tab(page, 'Exposure').click();
  await expect(page.getByRole('button', { name: 'Changed here (2)' })).toBeVisible();
  // Task 1.2 locks Dt, which Task 1.1 opened. Opening it again drops it from Task 1.2's lists.
  await switchOf(page, 'Δt').getByRole('button', { name: 'Open' }).click();
  await expect(exposureRow(page, 'Dt')).toContainText('inherited from Task 1.1');
  await page.getByRole('button', { name: 'Changed here (1)' }).click();
  await expect(page.getByRole('table', { name: 'Exposure' }).locator('tr[data-control]')).toHaveCount(1);
  await save(page);
  expect(JSON.parse(await written(page, OSC)).parts[0].tasks[1].lock).toEqual(['Dt-marker']);
});

test('the live Tool shows the Student view on a Task and Full on demand; with a Part selected it is Full', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Phasors and Impedance');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  const tool = liveTool(page);
  const student = tool.getByRole('button', { name: 'Student', exact: true });
  const full = tool.getByRole('button', { name: 'Full', exact: true });
  const sumLayer = () => page.evaluate(() => window.activityEditor.live.controls.get('sum').isHidden());
  const a1Locked = () => page.evaluate(() => window.activityEditor.live.controls.get('A1').isLocked());

  await outline(page).getByRole('button', { name: /^1\s/ }).click();
  await expect(full).toHaveAttribute('aria-pressed', 'true');
  await expect(student).toBeDisabled();
  expect(await sumLayer()).toBe(false);

  // Task 1.1 locks the inputs and hides the sum layer.
  const first = JSON.parse(read(PHASORS)).parts[0].tasks[0];
  expect(first.hide).toContain('sum');
  expect(first.lock).toContain('A1');
  await task(page, '1.1').click();
  await expect(student).toHaveAttribute('aria-pressed', 'true');
  await expect(tool.getByText('Student view at Task 1.1')).toBeVisible();
  await expect.poll(sumLayer).toBe(true);
  expect(await a1Locked()).toBe(true);

  await full.click();
  await expect(full).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(sumLayer).toBe(false);
  expect(await a1Locked()).toBe(false);
  await student.click();
  await expect.poll(sumLayer).toBe(true);

  // Flipping the layer in the exposure list updates the Tool at once.
  await tab(page, 'Exposure').click();
  await page.getByRole('table', { name: 'Exposure' }).locator('tr[data-control="sum"]').getByRole('button', { name: 'Open' }).click();
  await expect.poll(sumLayer).toBe(false);
  // The toggle never edits the Activity.
  await full.click();
  await expect(saveStatus(page)).toHaveText('Unsaved changes');
  expect(await page.evaluate(() => window.activityEditor.editor.canUndo)).toBe(true);
});

test('Tasks are added, retitled, reordered, duplicated and deleted; ids come from the title and stay frozen', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await outline(page).getByRole('button', { name: 'Add a Task to Part 2' }).click();
  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toBeFocused();
  await title.fill('Find the frequency');
  await expect(task(page, '2.3')).toContainText('Find the frequency');
  await expect(page.locator('[data-path="parts.1.tasks.2.id"] code')).toHaveText('new-task');
  await title.fill('Find f');
  await expect(page.locator('[data-path="parts.1.tasks.2.id"] code')).toHaveText('new-task');

  await page.getByRole('button', { name: 'Move up' }).click();
  await expect(task(page, '2.2')).toContainText('Find f');
  await page.getByRole('button', { name: 'Duplicate Task' }).click();
  await expect(task(page, '2.3')).toContainText('Find f');
  await expect(page.locator('[data-path="parts.1.tasks.2.id"] code')).toHaveText('new-task-2');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete Task' }).click();
  await save(page);
  const ids = JSON.parse(await written(page, OSC)).parts[1].tasks.map((t) => t.id);
  expect(ids).toEqual(['period-3', 'new-task', 'pkpk-4']);
});

test('renaming a Task id by hand warns that it drops student progress', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, '1.1').click();
  await page.getByRole('button', { name: 'Rename id…' }).click();
  await expect(page.getByRole('alert')).toContainText("drops students' progress on this Task");
  const id = page.getByRole('textbox', { name: 'New id' });
  await id.fill('phase-half-pi');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(page.locator('[data-path="parts.0.tasks.0.id"] code')).toHaveText('phase-half-pi');
  await save(page);
  expect(JSON.parse(await written(page, OSC)).parts[0].tasks[0].id).toBe('phase-half-pi');
});

test('points, the Hint and notes are edited; the Hint text stays encoded', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await task(page, '1.3').click();
  await page.getByRole('textbox', { name: 'Points' }).fill('2');
  await tab(page, 'Hint & notes').click();
  await page.getByRole('button', { name: '+ Add a Hint' }).click();
  await page.getByRole('textbox', { name: 'Appears after' }).fill('2');
  await page.getByRole('textbox', { name: 'Hint text' }).fill('Read the ratio');  await page.getByRole('textbox', { name: 'Notes' }).fill('Why: the readout');
  await save(page);
  const t = JSON.parse(await written(page, OSC)).parts[0].tasks[2];
  expect(t.points).toBe(2);
  expect(t.notes).toBe('Why: the readout');
  expect(t.hint.after).toBe(2);
  const text = await page.evaluate((s) => import('/framework/v1/runner/keys.js').then((k) => k.decodeKey(s)), t.hint.text);
  expect(text).toBe('Read the ratio');

  await page.getByRole('button', { name: 'Remove Hint' }).click();
  await expect(page.getByRole('button', { name: '+ Add a Hint' })).toBeVisible();
});

test('each tab shows its problem count; an unknown Control is a problem that opens the Exposure tab', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await expect(liveTool(page).getByRole('heading', { name: /^Live Tool · / })).toBeVisible();
  await page.evaluate(() => window.activityEditor.editor.edit({ type: 'setExposure', p: 0, t: 1, control: 'Vb', state: 'hidden' }));
  await task(page, '1.2').click();
  await expect(tab(page, 'Exposure')).toContainText('1');
  await expect(tab(page, 'Prompt')).toHaveAttribute('aria-selected', 'true');
  // Points typed as text: a runner problem, counted on the Prompt tab as it is typed.
  await page.getByRole('textbox', { name: 'Points' }).fill('two');
  await expect(tab(page, 'Prompt').locator('.ftab-count')).toHaveText('1');

  await page.getByRole('region', { name: 'Problems' }).getByRole('button', { name: /"Vb"/ }).click();
  await expect(tab(page, 'Exposure')).toHaveAttribute('aria-selected', 'true');
  const bad = page.locator('[data-path="parts.0.tasks.1.hide.0"]');
  await expect(bad).toContainText('Vb');
  await bad.getByRole('button', { name: 'Remove Vb' }).click();
  await expect(page.getByRole('region', { name: 'Problems' }).getByRole('button', { name: /"Vb"/ })).toHaveCount(0);
  await expect(tab(page, 'Exposure').locator('.ftab-count')).toHaveCount(0);
});
