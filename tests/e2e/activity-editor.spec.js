// The Activity editor page (framework/v1/authoring/activity-editor.html), run against an
// in-memory folder holding this checkout's Activity files (window.activityEditorFolder).
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PAGE = '/framework/v1/authoring/activity-editor.html';
const OSC = 'tools/oscilloscope/activities/phase-period-amplitude.json';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

// Every Activity file in the checkout, with a last-modified time each (oscilloscope newest).
const MODIFIED = { phasors: 1, electrostatics: 2, spacetime: 3, fourier: 4, oscilloscope: 5 };
function repoFiles() {
  const files = {};
  for (const tool of readdirSync(join(ROOT, 'tools'))) {
    if (!existsSync(join(ROOT, 'tools', tool, 'activities'))) continue;
    for (const f of readdirSync(join(ROOT, 'tools', tool, 'activities'))) {
      const path = `tools/${tool}/activities/${f}`;
      files[path] = { text: read(path), lastModified: Date.UTC(2026, 9, MODIFIED[tool] ?? 0, 12) };
    }
  }
  return files;
}

async function openEditor(page, files = repoFiles()) {
  await page.addInitScript((f) => {
    window.activityEditorFolder = (lib) => lib.createMemoryFolder(f, { name: 'Instructional-apps' });
  }, files);
  await page.goto(PAGE);
  await expect(page.getByRole('region', { name: 'Open an Activity' })).toBeVisible();
}

const written = (page, path) => page.evaluate((p) => window.activityEditor.folder.readFile(p).then((f) => f.text), path);
const openScreen = (page) => page.getByRole('region', { name: 'Open an Activity' });
const saveStatus = (page) => page.getByRole('status', { name: 'Save status' });

async function openActivity(page, title) {
  await openScreen(page).getByRole('table').getByRole('button', { name: title }).click();
  await expect(page.getByRole('navigation', { name: 'Activity outline' })).toBeVisible();
}

test('journey: open an Activity, change its title, save, and the written JSON has only that change', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');

  const outline = page.getByRole('navigation', { name: 'Activity outline' });
  await expect(outline.getByRole('button', { name: /Part 1: Phase Shift/ })).toBeVisible();
  await expect(outline.getByRole('button', { name: /Phase shift/ }).first()).toBeVisible();

  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toHaveValue('Sinusoidal Signals');
  await title.fill('Sinusoids');
  await expect(saveStatus(page)).toHaveText('Unsaved changes');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Saved');

  expect(await written(page, OSC)).toBe(read(OSC).replace('  "title": "Sinusoidal Signals",', '  "title": "Sinusoids",'));
});

const rowTitles = (page) => openScreen(page).getByRole('table').getByRole('button');

test('the Open screen lists every Activity, most recently modified first, and filters by text, course and Tool', async ({ page }) => {
  await openEditor(page);
  const screen = openScreen(page);
  await expect(rowTitles(page)).toHaveText(['Sinusoidal Signals', 'Frequency Domain: Fourier Series', 'Spacetime Diagrams',
    'Conductor Properties', 'Phasors and Impedance']);
  const row = screen.getByRole('row').filter({ hasText: 'Spacetime Diagrams' });
  for (const cell of ['spacetime-lab10', 'spacetime', 'PHY 1200', '1']) await expect(row.getByRole('cell', { name: cell, exact: true })).toBeVisible();
  await expect(row.getByRole('cell').last()).toContainText('2026');

  const search = screen.getByRole('searchbox', { name: 'Search' });
  await search.fill('lab10');
  await expect(rowTitles(page)).toHaveText(['Spacetime Diagrams']);
  await search.fill('egr 3120');
  await expect(rowTitles(page)).toHaveText(['Sinusoidal Signals', 'Frequency Domain: Fourier Series', 'Phasors and Impedance']);
  await search.fill('fourier');
  await expect(rowTitles(page)).toHaveText(['Frequency Domain: Fourier Series']);
  await search.fill('');

  await screen.getByRole('combobox', { name: 'Course' }).selectOption('PHY/EGR 3120');
  await expect(rowTitles(page)).toHaveCount(3);
  await screen.getByRole('combobox', { name: 'Tool' }).selectOption('phasors');
  await expect(rowTitles(page)).toHaveText(['Phasors and Impedance']);
  await screen.getByRole('combobox', { name: 'Course' }).selectOption('');
  await screen.getByRole('combobox', { name: 'Tool' }).selectOption('');
  await expect(rowTitles(page)).toHaveCount(5);
});

test('Ctrl+O and the header title show the Open screen; recents are pinned and remembered between visits', async ({ page }) => {
  await openEditor(page);
  const recent = () => openScreen(page).getByRole('region', { name: 'Recent' }).getByRole('button');
  await expect(openScreen(page).getByRole('region', { name: 'Recent' })).toHaveCount(0);
  await openActivity(page, 'Sinusoidal Signals');

  await page.keyboard.press('Control+o');
  await expect(openScreen(page)).toBeVisible();
  await expect(recent()).toHaveText([/Sinusoidal Signals/]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Activity outline' })).toBeVisible();

  await page.getByRole('button', { name: 'Open another Activity (now: Sinusoidal Signals)' }).click();
  await openActivity(page, 'Spacetime Diagrams');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Spacetime Diagrams');

  await page.reload();
  await expect(openScreen(page)).toBeVisible();
  await expect(recent()).toHaveText([/Spacetime Diagrams/, /Sinusoidal Signals/]);
  await recent().first().click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Spacetime Diagrams');
});

test('undo and redo work for edits, by key and by button', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await page.getByRole('textbox', { name: 'Course' }).fill('PHY 9999');
  await page.getByRole('textbox', { name: 'Notes' }).fill('Short.');

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue(/^Activity "Sinusoidal Signals"/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Course' })).toHaveValue('PHY/EGR 3120');
  await expect(saveStatus(page)).toHaveText('No unsaved changes');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('textbox', { name: 'Course' })).toHaveValue('PHY 9999');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('Short.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(saveStatus(page)).toHaveText('Saved');
  expect(JSON.parse(await written(page, OSC))).toMatchObject({ course: 'PHY 9999', notes: 'Short.' });
});

test('switching Activities with unsaved changes warns first', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await page.getByRole('textbox', { name: 'Title' }).fill('Changed');

  await page.keyboard.press('Control+o');
  page.once('dialog', (d) => { expect(d.message()).toContain('unsaved changes'); d.dismiss(); });
  await openScreen(page).getByRole('table').getByRole('button', { name: 'Spacetime Diagrams' }).click();
  await expect(openScreen(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Changed');

  await page.keyboard.press('Control+o');
  page.once('dialog', (d) => d.accept());
  await openActivity(page, 'Spacetime Diagrams');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Spacetime Diagrams');
});

test('closing the page with unsaved changes asks first', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await page.getByRole('textbox', { name: 'Title' }).fill('Changed');
  const asked = new Promise((resolve) => page.once('dialog', (d) => { resolve(d.type()); d.dismiss(); }));
  await page.close({ runBeforeUnload: true });
  expect(await asked).toBe('beforeunload');
});

// The real folder picker can't be driven by a test, so showDirectoryPicker is replaced by one that
// hands over a folder in the origin-private file system (a real File System Access directory
// handle), holding the oscilloscope Activity. localStorage 'needs-permission' makes the browser
// report that permission must be asked for again.
async function stubPicker(page) {
  await page.addInitScript((files) => {
    window.showDirectoryPicker = async () => {
      const repo = await (await navigator.storage.getDirectory()).getDirectoryHandle('Instructional-apps', { create: true });
      const { createDirectoryFolder } = await import('/framework/v1/authoring/editor/folder.js');
      for (const [path, text] of Object.entries(files)) await createDirectoryFolder(repo).writeFile(path, text);
      return repo;
    };
    if (localStorage.getItem('needs-permission')) {
      FileSystemHandle.prototype.queryPermission = async () => 'prompt';
      FileSystemHandle.prototype.requestPermission = async () => { localStorage.setItem('asked', 'yes'); return 'granted'; };
    }
  }, { [OSC]: read(OSC) });
}

test('the folder is granted once, remembered between visits, and permission is asked again when needed', async ({ page }) => {
  await stubPicker(page);
  await page.goto(PAGE);
  await page.getByRole('button', { name: 'Choose folder…' }).click();
  await expect(rowTitles(page)).toHaveText(['Sinusoidal Signals']);
  await expect(page.getByText('Folder: Instructional-apps')).toBeVisible();

  await page.reload();
  await expect(rowTitles(page)).toHaveText(['Sinusoidal Signals']);

  await page.evaluate(() => localStorage.setItem('needs-permission', 'yes'));
  await page.reload();
  await page.getByRole('button', { name: 'Reconnect to Instructional-apps' }).click();
  await expect(rowTitles(page)).toHaveText(['Sinusoidal Signals']);
  expect(await page.evaluate(() => localStorage.getItem('asked'))).toBe('yes');

  // Saving writes into the folder itself.
  await openActivity(page, 'Sinusoidal Signals');
  await page.getByRole('textbox', { name: 'Title' }).fill('Sinusoids');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Saved');
  const text = await page.evaluate(async (path) => {
    const repo = await (await navigator.storage.getDirectory()).getDirectoryHandle('Instructional-apps');
    const { createDirectoryFolder } = await import('/framework/v1/authoring/editor/folder.js');
    return (await createDirectoryFolder(repo).readFile(path)).text;
  }, OSC);
  expect(text).toBe(read(OSC).replace('  "title": "Sinusoidal Signals",', '  "title": "Sinusoids",'));
});

test('a folder without a tools folder is refused', async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('empty', { create: true });
  });
  await page.goto(PAGE);
  await page.getByRole('button', { name: 'Choose folder…' }).click();
  await expect(page.getByRole('alert')).toHaveText(/has no tools folder/);
});

test('without the File System Access API, Save downloads the file', async ({ page }, testInfo) => {
  const checkout = testInfo.outputPath('checkout');
  mkdirSync(join(checkout, 'tools/oscilloscope/activities'), { recursive: true });
  writeFileSync(join(checkout, OSC), read(OSC));
  await page.addInitScript(() => {
    delete Window.prototype.showDirectoryPicker;
    delete window.showDirectoryPicker;
  });
  await page.goto(PAGE);
  await page.getByLabel('Choose folder').setInputFiles(checkout);
  await openActivity(page, 'Sinusoidal Signals');
  await page.getByRole('textbox', { name: 'Title' }).fill('Sinusoids');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('phase-period-amplitude.json');
  expect(readFileSync(await file.path(), 'utf8')).toBe(read(OSC).replace('  "title": "Sinusoidal Signals",', '  "title": "Sinusoids",'));
  await expect(saveStatus(page)).toHaveText('Downloaded phase-period-amplitude.json: move it into tools/oscilloscope/activities');
});

test("the problems list shows the runner's validation errors and goes to the field", async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  const problems = page.getByRole('region', { name: 'Problems' });
  await expect(problems.getByRole('heading')).toContainText('Problems (0)');

  await page.getByRole('textbox', { name: 'Version' }).fill('');
  await expect(problems.getByRole('heading')).toContainText('Problems (1)');
  await page.getByRole('navigation', { name: 'Activity outline' }).getByRole('button', { name: /Part 1: Phase Shift/ }).click();
  await problems.getByRole('button', { name: /Activity\s*missing version/ }).click();
  await expect(page.getByRole('textbox', { name: 'Version' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Version' }).fill('2');
  await expect(problems.getByRole('heading')).toContainText('Problems (0)');
});

// ───────────────────────── Parts, Setup and the live Tool (ticket 08) ──

const outline = (page) => page.getByRole('navigation', { name: 'Activity outline' });
const liveTool = (page) => page.getByRole('complementary', { name: 'Live Tool' });
const setupField = (page, key) => page.getByRole('textbox', { name: `Setup ${key}`, exact: true });
const SPACETIME = 'tools/spacetime/activities/lab10.json';

test('journey: add a Part, choose its Mode, move a Control on the live Tool, Capture, save, and the Setup is in the JSON', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await outline(page).getByRole('button', { name: '+ Part' }).click();

  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toHaveValue('Part 3: New Part');
  await title.fill('Part 3: Beats');
  await expect(outline(page).getByRole('button', { name: /Part 3: Beats/ })).toBeVisible();

  const mode = page.getByRole('combobox', { name: 'Mode' });
  await expect(mode.getByRole('option')).toHaveText(['Dual-trace scope']);
  await mode.selectOption({ label: 'Dual-trace scope' });

  // The live Tool is the real oscilloscope at this Part's (empty) Setup; operating it edits nothing.
  const tool = liveTool(page);
  await expect(tool.getByRole('heading', { name: 'Live Tool · Dual-trace scope' })).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Saved');
  const va = tool.getByRole('spinbutton', { name: 'Va (V)', exact: true });
  await va.fill('2.5');
  await va.press('Enter');
  await expect(tool.getByRole('table', { name: 'State now' }).getByRole('row').filter({ hasText: /^Va/ })).toContainText('2.5');
  await expect(saveStatus(page)).toHaveText('Saved');
  expect(await page.evaluate(() => window.activityEditor.editor.dirty)).toBe(false);

  await page.getByRole('button', { name: /Capture from the live Tool/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Captured 3 Setup keys' })).toBeVisible();
  await expect(setupField(page, 'Va')).toHaveValue('2.5');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(saveStatus(page)).toHaveText('Saved');

  const part = JSON.parse(await written(page, OSC)).parts[2];
  expect(part.id).toBe('part-3-new-part');
  expect(part.title).toBe('Part 3: Beats');
  expect(part.mode).toBe('dual-trace');
  const live = await page.evaluate(() => window.activityEditor.live.state.snapshot());
  expect(part.setup).toEqual({ Va: 2.5, f: live.f, Dt: live.Dt });
});

test('the live Tool remounts at the selected Part and its Setup; other edits leave it alone', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  const tool = liveTool(page);
  await expect(tool.getByRole('spinbutton', { name: 'Va (V)', exact: true })).toHaveValue('2.00');

  await outline(page).getByRole('button', { name: /Part 2: Period and Amplitude/ }).click();
  const setup = JSON.parse(read(OSC)).parts[1].setup;
  await expect(tool.getByText('Part 2 at its Setup')).toBeVisible();
  await expect(tool.getByRole('spinbutton', { name: 'Va (V)', exact: true })).toHaveValue(setup.Va.toFixed(2));

  // Arrange the Tool, then retitle the Part: the Tool keeps the arrangement.
  const f = tool.getByRole('spinbutton', { name: 'f (Hz)', exact: true });
  await f.fill('0.77');
  await f.press('Enter');
  await page.getByRole('textbox', { name: 'Title' }).fill('Part 2: Period');
  await expect(f).toHaveValue('0.77');

  // Typing a Setup value remounts it there.
  await setupField(page, 'Va').fill('1.25');
  await expect(tool.getByRole('spinbutton', { name: 'Va (V)', exact: true })).toHaveValue('1.25');
  await expect(f).toHaveValue(setup.f.toFixed(2));
});

test('Setup values are typed and cleared one by one; Capture keeps the Setup options', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Spacetime Diagrams');
  await outline(page).getByRole('button', { name: /^1\s/ }).click();
  const before = JSON.parse(read(SPACETIME)).parts[0].setup;

  await expect(setupField(page, 'tool')).toHaveValue(before.tool);
  await setupField(page, 'grid').fill('{"K":false,"Kp":true}');
  await page.getByRole('button', { name: 'Clear v', exact: true }).click();
  await expect(setupField(page, 'v')).toHaveValue('');
  await page.getByRole('button', { name: /Capture from the live Tool/ }).click();
  await expect(setupField(page, 'v')).not.toHaveValue('');
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Saved');

  const setup = JSON.parse(await written(page, SPACETIME)).parts[0].setup;
  const v = await page.evaluate(() => window.activityEditor.live.state.snapshot().v);
  expect(setup).toEqual({ ...before, v, grid: { K: false, Kp: true } });
});

test('Parts are reordered and deleted from the Part form; an unknown Mode or Setup value is a problem', async ({ page }) => {
  await openEditor(page);
  await openActivity(page, 'Sinusoidal Signals');
  await outline(page).getByRole('button', { name: /Part 2: Period and Amplitude/ }).click();
  await page.getByRole('button', { name: 'Move up' }).click();
  await expect(outline(page).getByRole('button', { name: /Period and Amplitude/ })).toContainText('1');
  await expect(page.getByRole('button', { name: 'Move up' })).toBeDisabled();
  await page.getByRole('button', { name: 'Move down' }).click();
  await expect(outline(page).getByRole('button', { name: /Phase Shift/ })).toContainText('1');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete Part' }).click();
  await expect(outline(page).getByRole('button', { name: /Period and Amplitude/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(outline(page).getByRole('button', { name: /Part 2: Period and Amplitude/ })).toBeVisible();
});

test('a Setup value the Mode does not know, or an unknown Mode, is a problem that links to its field', async ({ page }) => {
  const doc = JSON.parse(read(OSC));
  doc.parts[0].setup.seed = 3;
  doc.parts[1].mode = 'xy';
  const files = repoFiles();
  files[OSC].text = `${JSON.stringify(doc, null, 2)}\n`;
  await openEditor(page, files);
  await openActivity(page, 'Sinusoidal Signals');
  const problems = page.getByRole('region', { name: 'Problems' });
  await expect(problems.getByRole('button', { name: /Setup "seed" is not a Setup key or Setup option/ })).toBeVisible();
  await problems.getByRole('button', { name: /Mode "xy" is not a Mode of the Tool/ }).click();
  await expect(page.getByRole('combobox', { name: 'Mode' })).toBeFocused();
  await expect(liveTool(page).getByRole('alert')).toContainText('not a Mode of Oscilloscope');

  await outline(page).getByRole('button', { name: /Part 1: Phase Shift/ }).click();
  await page.getByRole('button', { name: 'Remove seed' }).click();
  await expect(problems.getByRole('button', { name: /Setup "seed"/ })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Mode' }).selectOption({ label: 'Dual-trace scope' });
  await outline(page).getByRole('button', { name: /Part 2/ }).click();
  await page.getByRole('combobox', { name: 'Mode' }).selectOption({ label: 'Dual-trace scope' });
  await expect(problems.getByRole('heading')).toContainText('Problems (0)');
});
