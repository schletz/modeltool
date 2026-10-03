import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createNodeByKeyboard, downloadedText, drawRelationship, nodeByName, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

/** School 1:n Student, drawn by keyboard and mouse. */
async function buildSchoolModel(page: Page) {
  const school = await createNodeByKeyboard(page, 300, 300, 'School', ['#Id', 'Name']);
  const student = await createNodeByKeyboard(page, 800, 450, 'Student', ['#Nr', 'Firstname', '?Email']);
  await drawRelationship(page, school, student);
  return { school, student };
}

/** Opens the editor of a table and sets the data type of every column (in display order). */
async function setDataTypes(page: Page, table: string, types: string[]) {
  await nodeByName(page, table).dblclick();
  const editor = page.getByTestId('inline-editor');
  const typeInputs = editor.getByRole('textbox', { name: 'Data type' });
  for (const [index, type] of types.entries()) {
    const input = typeInputs.nth(index);
    if (await input.isDisabled()) continue;
    await input.fill(type);
  }
  await page.keyboard.press('Escape');
}

test('creates an entity with attributes by keyboard only', async ({ page }) => {
  await page.getByTestId('canvas').locator('.react-flow__pane').dblclick({ position: { x: 300, y: 300 } });
  await page.keyboard.type('Customer');
  await page.keyboard.press('Enter');
  await page.keyboard.type('#Id');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Name');
  await page.keyboard.press('Enter');
  await page.keyboard.type('?Phone');
  // Alt+Up moves "Phone" above "Name".
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Escape');

  const node = nodeByName(page, 'Customer');
  await expect(node.locator('.key-block .node-row')).toHaveText(['PKId*']);
  await expect(node.locator('.other-block .node-row')).toHaveText(['Phoneo', 'Name*']);
});

test('draws a relationship, creates the FK and changes cardinalities', async ({ page }) => {
  const { student } = await buildSchoolModel(page);
  await expect(student.locator('.other-block .node-row').filter({ hasText: 'SchoolId' })).toContainText('FK');

  const edge = page.getByTestId('relationship-edge');
  await expect(edge).toHaveCount(1);
  await expect(page.getByTestId('context-bar')).toBeVisible();

  // Context bar: child end 1..n.
  await page.getByTestId('set-target-oneOrMany').click();
  await expect(edge.getByTestId('cardinality-target')).toHaveAttribute('data-cardinality', 'oneOrMany');

  // Clicking a line end cycles to the next symbol (1..n -> 0..1).
  await edge.getByTestId('cardinality-target').click();
  await expect(edge.getByTestId('cardinality-target')).toHaveAttribute('data-cardinality', 'zeroOrOne');

  // Parent end 0..1 makes the FK optional.
  await page.getByTestId('set-source-zeroOrOne').click();
  await expect(student.locator('.node-row').filter({ hasText: 'SchoolId' })).toContainText('o');

  // Identifying: the FK becomes part of the key.
  await page.getByTestId('set-source-one').click();
  await page.getByTestId('toggle-identifying').check();
  await expect(student.locator('.key-block .node-row').filter({ hasText: 'SchoolId' })).toContainText('PK, FK');

  // Undo restores the non-identifying state.
  await page.keyboard.press('Control+z');
  await expect(student.locator('.other-block .node-row').filter({ hasText: 'SchoolId' })).toBeVisible();
});

test('transforms, sets data types and exports SQL', async ({ page }) => {
  await buildSchoolModel(page);
  await page.getByTestId('transform').click();
  await page.getByTestId('transform-confirm').click();
  await expect(page.getByTestId('tab-physical')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('table-node')).toHaveCount(2);

  // Export is blocked while data types are missing.
  await page.getByTestId('export-sql').click();
  await expect(page.getByTestId('issue-panel')).toContainText('has no data type');

  await setDataTypes(page, 'School', ['INTEGER', 'VARCHAR(100)']);
  await setDataTypes(page, 'Student', ['INTEGER', 'VARCHAR(50)', 'VARCHAR(200)']);
  // The FK column follows the referenced key's type.
  await expect(nodeByName(page, 'Student').locator('.node-row').filter({ hasText: 'SchoolId' })).toContainText('INTEGER');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-sql').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.sql$/);
  const sql = await downloadedText(download);
  expect(sql).toContain('CREATE TABLE School');
  expect(sql).toContain('CONSTRAINT PK_Student PRIMARY KEY (Nr)');
  expect(sql).toContain('CONSTRAINT FK_Student_School FOREIGN KEY (SchoolId) REFERENCES School (Id)');
  expect(sql.indexOf('CREATE TABLE School')).toBeLessThan(sql.indexOf('CREATE TABLE Student'));
});

test('saves and reopens the model as JSON', async ({ page }) => {
  await buildSchoolModel(page);
  await page.getByTestId('settings').click();
  await page.getByTestId('meta-modelName').fill('Schools');
  await page.keyboard.press('Escape');

  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Schools.json');
  const json = JSON.parse(await downloadedText(download)) as { format: string; logical: { entities: unknown[] } };
  expect(json.format).toBe('er-modeltool');
  expect(json.logical.entities).toHaveLength(2);

  // New document, then open the saved file again.
  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByTestId('entity-node')).toHaveCount(0);

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(await download.path());
  await expect(page.getByTestId('entity-node')).toHaveCount(2);
  await expect(nodeByName(page, 'Student')).toContainText('SchoolId');
});

test('rejects an invalid file with an understandable message', async ({ page }) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"other"}') });
  await expect(page.getByTestId('toast')).toContainText('not a model file');
});

test('exports a PDF of both models', async ({ page }) => {
  const example = await readFile(new URL('../examples/university.json', import.meta.url), 'utf-8');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  await (await chooserPromise).setFiles({ name: 'university.json', mimeType: 'application/json', buffer: Buffer.from(example) });
  await expect(page.getByTestId('entity-node')).toHaveCount(5);
  await page.getByTestId('transform').click();
  await page.getByTestId('transform-confirm').click();
  await expect(page.getByTestId('table-node')).toHaveCount(4);

  await page.getByTestId('export-pdf').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('pdf-confirm').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Universität.pdf');
  const content = await readFile(await download.path());
  expect(content.subarray(0, 4).toString()).toBe('%PDF');
  // Two pages: logical and physical.
  expect(content.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
});

test('creates a generalization in generalization mode', async ({ page }) => {
  const person = await createNodeByKeyboard(page, 500, 250, 'Person', ['#Id', 'Name']);
  const student = await createNodeByKeyboard(page, 300, 550, 'Student', ['MatrNr']);
  await page.getByRole('radio', { name: 'Generalization' }).click();
  await drawRelationship(page, person, student);

  await expect(page.getByTestId('generalization-node')).toHaveCount(1);
  await expect(page.getByTestId('relationship-edge')).toHaveCount(0);
  // The subtype shows the inherited key greyed out.
  await expect(student.locator('.node-row.inherited')).toContainText('Id');
  await page.getByTestId('toggle-complete').uncheck();
  await expect(page.getByTestId('toggle-complete')).not.toBeChecked();
});

test('offers to restore the autosaved state', async ({ page, context }) => {
  await createNodeByKeyboard(page, 400, 300, 'Draft', ['#Id']);
  // Autosave runs about one second after the last change.
  await page.waitForTimeout(1500);

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('restore-dialog')).toBeVisible();
  await second.getByTestId('restore-confirm').click();
  await expect(nodeByName(second, 'Draft')).toBeVisible();
});
