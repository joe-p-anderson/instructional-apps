// Shared helpers for the Activity editor's e2e specs (activity-editor*.spec.js): the page run
// against an in-memory folder holding this checkout's Activity files (window.activityEditorFolder).
import { expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const PAGE = '/framework/v1/authoring/activity-editor.html';
export const OSC = 'tools/oscilloscope/activities/phase-period-amplitude.json';
export const SPACETIME = 'tools/spacetime/activities/lab10.json';
export const PHASORS = 'tools/phasors/activities/phasors-impedance.json';
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

// Every Activity file in the checkout, with a last-modified time each (oscilloscope newest).
const MODIFIED = { phasors: 1, electrostatics: 2, spacetime: 3, fourier: 4, oscilloscope: 5 };
export function repoFiles() {
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

export async function openEditor(page, files = repoFiles()) {
  await page.addInitScript((f) => {
    window.activityEditorFolder = (lib) => lib.createMemoryFolder(f, { name: 'Instructional-apps' });
  }, files);
  await page.goto(PAGE);
  await expect(page.getByRole('region', { name: 'Open an Activity' })).toBeVisible();
}

export const written = (page, path) => page.evaluate((p) => window.activityEditor.folder.readFile(p).then((f) => f.text), path);
export const openScreen = (page) => page.getByRole('region', { name: 'Open an Activity' });
export const saveStatus = (page) => page.getByRole('status', { name: 'Save status' });
export const outline = (page) => page.getByRole('navigation', { name: 'Activity outline' });
export const liveTool = (page) => page.getByRole('complementary', { name: 'Live Tool' });

export async function openActivity(page, title) {
  await openScreen(page).getByRole('table').getByRole('button', { name: title }).click();
  await expect(outline(page)).toBeVisible();
}

// Save with Ctrl+S and wait for it.
export async function save(page) {
  await page.keyboard.press('Control+s');
  await expect(saveStatus(page)).toHaveText('Saved');
}
