/**
 * gelster.ru: the banner `.big-background` becomes the main photo of the KP — left of the description on screen
 * and in print, and a floating picture in the DOCX (as for ooogelingen.ru).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { mockNetwork, pickArticles } from './helpers.ts';

const LINK = 'https://gelster.ru/marmoleum_cocoa.htm';
const PHOTO = 'https://gelster.ru/img/collections/marmoleum/m_cocoa/catalog-in-new_03.jpg';

async function expectPhotoLeftOfDescription(page: Page): Promise<void> {
  const photo = page.locator('.kp-pages .mainContent-img img');
  await expect(photo).toHaveCount(1);
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const box = await photo.boundingBox();
  const text = await page.locator('.kp-pages').getByRole('textbox', { name: 'Абзац описания' }).first().boundingBox();
  expect(box && text).toBeTruthy();
  if (!box || !text) return;
  // A third of the column at its left edge, beside the first paragraph: the text flows around it on the right.
  expect(Math.abs(box.x - text.x)).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThan(text.width * 0.25);
  expect(box.width).toBeLessThan(text.width * 0.4);
  expect(box.y).toBeLessThan(text.y + text.height);
}

test('gelster.ru page: the banner is the main photo in the preview, in print and in the DOCX', async ({ page }, testInfo) => {
  const network = await mockNetwork(page);
  await page.goto('./#/');
  await page.getByRole('combobox', { name: 'Менеджер' }).selectOption('michael_smu');
  await page.getByPlaceholder('Название компании или ИП').fill('Ромашка');
  await page.getByPlaceholder('https://ooogelingen.ru/…').fill(LINK);
  await page.getByRole('button', { name: 'Создать КП' }).click();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await pickArticles(page, 2);

  expect(network.imageRequests).toContain(PHOTO);
  await expect(page.getByText('Не найден производитель')).toBeVisible(); // collection warnings are listed…
  await expect(page.getByText('Не найдено главное фото')).toHaveCount(0); // …but not this one
  await expectPhotoLeftOfDescription(page);

  // The PDF is printed from the same pages with print styles.
  await page.emulateMedia({ media: 'print' });
  await expectPhotoLeftOfDescription(page);
  await page.emulateMedia({ media: 'screen' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить в DOCX' }).click();
  const path = testInfo.outputPath('kp.docx');
  await (await download).saveAs(path);
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  const xml = strFromU8(files['word/document.xml'] ?? new Uint8Array());
  expect(xml.match(/<wp:anchor /g)).toHaveLength(1); // the floating main photo
  const anchor = xml.slice(xml.indexOf('<wp:anchor '), xml.indexOf('</wp:anchor>'));
  expect(anchor).toContain('<wp:wrapSquare');
});
