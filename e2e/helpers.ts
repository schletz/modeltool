import { expect, type Download, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Opens the app in English with an empty localStorage. The File System Access API is
 * removed so that saving downloads the file and opening uses `<input type="file">`,
 * which Playwright can drive without native dialogs.
 */
export async function openApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('er-modeltool.language', 'en');
    const w = window as unknown as Record<string, unknown>;
    delete w.showOpenFilePicker;
    delete w.showSaveFilePicker;
  });
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
}

export function nodeByName(page: Page, name: string): Locator {
  return page.locator('.react-flow__node').filter({ has: page.locator('.node-title', { hasText: new RegExp(`^${name}$`) }) });
}

/**
 * Creates an entity/table purely by keyboard: E at the pointer position, type the name,
 * Enter for every attribute (prefixes like "#id" allowed), Escape to close.
 */
export async function createNodeByKeyboard(page: Page, x: number, y: number, name: string, attributes: string[]): Promise<Locator> {
  await page.mouse.move(x, y);
  await page.keyboard.press('e');
  await page.keyboard.type(name);
  for (const attribute of attributes) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(attribute);
  }
  await page.keyboard.press('Escape');
  const node = nodeByName(page, name);
  await expect(node).toBeVisible();
  return node;
}

/** Drags from the right docking point of `from` onto the body of `to`. */
export async function drawRelationship(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.hover();
  const handle = from.locator('.dock-handle[data-handleid="right"]');
  const start = await handle.boundingBox();
  const target = await to.boundingBox();
  if (!start || !target) throw new Error('missing geometry');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 10, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
}

export async function downloadedText(download: Download): Promise<string> {
  const path = await download.path();
  return readFile(path, 'utf-8');
}
