/**
 * The whole path of a manager, end to end (docs/spec.md, section 10), with the network replaced by fixtures:
 * form → KP → articles → an edit → reload → PDF → DOCX → export of the project → removal → import.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { mockNetwork, pickArticles, readPdf } from './helpers.ts';

const LINK = 'https://ooogelingen.ru/m_cocoa.htm';
const COMPANY = 'Ромашка Плюс';

function stamp(): string {
  const now = new Date();
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(now.getDate())}.${two(now.getMonth() + 1)}.${two(now.getFullYear() % 100)}`;
}

const paragraphs = (page: Page) => page.locator('.kp-pages').getByRole('textbox', { name: 'Абзац описания' });

test('form → KP → articles → edit → reload → PDF → DOCX → export → delete → import', async ({ page }, testInfo) => {
  await mockNetwork(page);
  await page.goto('./#/');

  // The form of a new project.
  await page.getByRole('combobox', { name: 'Менеджер' }).selectOption('michael_smu');
  await page.getByPlaceholder('Название компании или ИП').fill(COMPANY);
  await page.getByPlaceholder('Имя контактного лица').fill('Анна');
  await page.getByRole('radio', { name: 'Жен.' }).check();
  await page.getByPlaceholder('https://ooogelingen.ru/…').fill(LINK);
  await page.getByRole('textbox', { name: 'Основные: наименование, строка 1' }).fill('Линолеум Marmoleum');
  await page.getByRole('textbox', { name: 'Основные: количество, строка 1' }).fill('100');
  await page.getByRole('textbox', { name: 'Основные: цена в рублях, строка 1' }).fill('250');
  await page.getByRole('button', { name: 'Создать КП' }).click();

  // The KP: the collection is loaded, the picker opens by itself.
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await expect(page.getByRole('dialog', { name: 'Выберите артикулы' })).toBeVisible();
  await pickArticles(page, 3);
  await expect(page.locator('.kp-page').first()).toContainText('Уважаемая Анна!');
  await expect(page).toHaveTitle(`КП_${COMPANY}_от_${stamp()}`);

  // An edit of the first paragraph, committed on blur.
  const first = paragraphs(page).first();
  await first.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Правка для Word.');
  await page.locator('.kp-toolbar').click({ position: { x: 5, y: 5 } });
  await expect(first).toContainText('Правка для Word.');

  // Reload: the edit and the articles are kept.
  await page.reload();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await expect(paragraphs(page).first()).toContainText('Правка для Word.');
  await expect(page.locator('.kp-pages .table-items th')).toHaveCount(3);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // PDF: as many A4 sheets as preview pages, no header or footer of the browser.
  const sheets = await page.locator('.kp-pages .kp-page').count();
  const pdf = await readPdf(await page.pdf({ displayHeaderFooter: true, preferCSSPageSize: true }));
  expect(pdf.pages).toHaveLength(sheets);
  expect(pdf.text).toContain('Правка для Word.');
  expect(pdf.text).not.toContain('127.0.0.1');
  expect(pdf.text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);

  // DOCX: the file has the edited text, styles, lists or tables, pictures in the header and footer.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить в DOCX' }).click();
  const docx = await download;
  expect(docx.suggestedFilename()).toBe(`КП_${COMPANY}_от_${stamp()}.docx`);
  const docxPath = testInfo.outputPath('kp.docx');
  await docx.saveAs(docxPath);
  await testInfo.attach('kp.docx', { path: docxPath, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const files = unzipSync(new Uint8Array(readFileSync(docxPath)));
  const part = (name: string) => strFromU8(files[name] ?? new Uint8Array());
  const xml = part('word/document.xml');
  expect(xml).toContain('Правка для Word.');
  expect(xml).toContain('Уважаемая Анна!');
  expect(xml).toContain('<w:pStyle w:val="KpText"/>');
  expect(xml.split('<w:tbl>').length - 1).toBeGreaterThanOrEqual(4); // articles, features, prices, total
  expect(xml).toContain('<w:cantSplit/>');
  expect(xml).toContain('<w:tblHeader/>');
  expect(xml).not.toContain('txbxContent');
  expect(Object.keys(files).some((name) => /^word\/header\d*\.xml$/.test(name))).toBe(true);
  expect(Object.keys(files).filter((name) => name.startsWith('word/media/')).length).toBeGreaterThanOrEqual(5);
  expect(Object.keys(files).filter((name) => name.endsWith('.odttf'))).toHaveLength(8);
  await expect(page.locator('.kp-notes .kp-error')).toHaveCount(0);

  // Export of the project from the form.
  await page.getByRole('link', { name: 'К форме' }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт проекта', exact: true }).click();
  const exportFile = await exported;
  expect(exportFile.suggestedFilename()).toMatch(/^gelster-kp_Ромашка_Плюс_\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = testInfo.outputPath('project.json');
  await exportFile.saveAs(exportPath);
  const exportJson = JSON.parse(readFileSync(exportPath, 'utf8')) as { projects: { kp: { descriptionHtml: string } }[]; images: Record<string, string> };
  expect(exportJson.projects[0]?.kp.descriptionHtml).toContain('Правка для Word.');
  expect(Object.keys(exportJson.images).length).toBeGreaterThanOrEqual(4); // photo, 3 articles (and the signature)

  // Removal.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `Удалить проект ${COMPANY}` }).click();
  await expect(page.getByRole('list', { name: 'Список проектов' })).not.toContainText(COMPANY);

  // Import brings it back with the edit, the articles and the pictures (no new network requests needed).
  await page.getByTestId('import-file').setInputFiles(exportPath);
  await expect(page.getByRole('list', { name: 'Список проектов' })).toContainText(COMPANY);
  await page.getByRole('radio', { name: COMPANY }).click();
  await expect(page.getByPlaceholder('Название компании или ИП')).toHaveValue(COMPANY);
  await page.getByRole('button', { name: 'Создать КП' }).click();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await expect(paragraphs(page).first()).toContainText('Правка для Word.');
  await expect(page.locator('.kp-pages .table-items th')).toHaveCount(3);
});
