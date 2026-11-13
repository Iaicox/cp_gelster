/**
 * Choosing articles and editing in place, end to end: the choice and the edits survive a reload of the page and
 * a trip to the form, where a price is changed; controls never reach the PDF.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { mockNetwork, openKp, pickArticles, projectFixture, readPdf, seed } from './helpers.ts';

/** The project record as the app has stored it. */
function storedKp(page: Page, id: string): Promise<{ descriptionHtml: string; greeting: string | null; selectedArticles: { code: string }[] }> {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('gelster-kp-projects');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('projects').objectStore('projects').get(key);
          request.onsuccess = () => {
            open.result.close();
            resolve((request.result as { kp: never }).kp);
          };
        };
      }),
    id,
  );
}

const paragraphs = (page: Page) => page.locator('.kp-pages').getByRole('textbox', { name: 'Абзац описания' });
const total = (page: Page) => page.locator('.kp-pages .table-sum_tables th').nth(1);
const money = (text: string) => text.replace(/ /g, ' ');

test('picked articles and an edited paragraph survive a reload and a new price in the form', async ({ page }) => {
  await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);

  // First opening: the picker is there by itself.
  await openKp(page, project.id, { pick: 0 });
  await expect(page.getByRole('dialog', { name: 'Выберите артикулы' })).toBeVisible();
  await pickArticles(page, 5);
  await expect(page.locator('.kp-pages .table-items tr')).toHaveCount(4); // 4 + 1: two rows of pictures and captions
  const codes = await page.locator('.kp-pages .table-items th').allTextContents();
  expect(codes).toHaveLength(5);

  // Edit the first paragraph: type at its end, Enter starts a new paragraph, leaving the text commits it.
  const first = paragraphs(page).first();
  const before = (await first.textContent())?.trim() ?? '';
  const count = await paragraphs(page).count();
  await first.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Правка менеджера.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Новый абзац менеджера.');
  await page.locator('.kp-toolbar').click({ position: { x: 5, y: 5 } }); // blur
  await expect(paragraphs(page)).toHaveCount(count + 1);
  await expect(paragraphs(page).nth(0)).toHaveText(`${before} Правка менеджера.`);
  await expect(paragraphs(page).nth(1)).toHaveText('Новый абзац менеджера.');
  const kp = await storedKp(page, project.id);
  expect(kp.descriptionHtml).toContain('Правка менеджера.</p><p>Новый абзац менеджера.</p>');
  expect(kp.selectedArticles).toHaveLength(5);
  await expect(total(page)).toHaveText(money('35 000,00'));

  // Reload: the choice and the edit are in place, the picker stays closed.
  await page.reload();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await expect(page.locator('.kp-pages .table-items th')).toHaveText(codes);
  await expect(paragraphs(page).nth(1)).toHaveText('Новый абзац менеджера.');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Back to the form, a new price, a new KP: new tables, old edits.
  await page.getByRole('link', { name: 'К форме' }).click();
  const price = page.getByRole('textbox', { name: 'Основные: цена в рублях, строка 1' });
  await price.fill('200');
  await page.getByRole('button', { name: 'Создать КП' }).click();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  await expect(total(page)).toHaveText(money('50 000,00'));
  await expect(paragraphs(page).nth(0)).toHaveText(`${before} Правка менеджера.`);
  await expect(paragraphs(page).nth(1)).toHaveText('Новый абзац менеджера.');
  await expect(page.locator('.kp-pages .table-items th')).toHaveText(codes);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('controls are not printed: as many sheets as pages, no button text in the PDF', async ({ page }) => {
  await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);

  // An edited greeting gets «вернуть авто»; paragraphs and feature rows have «×».
  const greeting = page.getByRole('textbox', { name: 'Обращение' });
  await greeting.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Добрый день, Михаил!');
  await page.keyboard.press('Enter'); // finishes editing a one-line field
  await expect(page.getByRole('button', { name: 'Обращение: вернуть авто' })).toBeAttached();
  await expect(greeting).toHaveText('Добрый день, Михаил!');
  await page.locator('.kp-pages[data-ready="true"]').waitFor();

  const sheets = await page.locator('.kp-pages .kp-page').count();
  // A control made visible by hover must not get into print either.
  await paragraphs(page).first().hover();
  await expect(page.locator('.kp-pages .kp-control:visible').first()).toBeVisible();

  const pdf = await readPdf(await page.pdf({ displayHeaderFooter: true, preferCSSPageSize: true }));
  expect(pdf.pages).toHaveLength(sheets);
  expect(pdf.text).toContain('Добрый день, Михаил!');
  expect(pdf.text).not.toContain('×');
  expect(pdf.text).not.toContain('вернуть авто');
  expect(pdf.text).not.toContain('Добавить артикулы');
  expect(pdf.text).not.toContain('Перевыбрать артикулы');

  // «вернуть авто» brings the greeting of the form back.
  await page.getByRole('button', { name: 'Обращение: вернуть авто' }).click();
  await expect(greeting).toHaveText('Уважаемый Михаил!');
  expect((await storedKp(page, project.id)).greeting).toBeNull();
});

/** word/document.xml of the DOCX the page saves now. */
async function docxXml(page: Page, path: string): Promise<string> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить в DOCX' }).click();
  await (await download).saveAs(path);
  return strFromU8(unzipSync(new Uint8Array(readFileSync(path)))['word/document.xml'] ?? new Uint8Array());
}

test('the main photo and the palette line are removed, edited and brought back (spec 8.1)', async ({ page }, testInfo) => {
  await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);
  const ready = () => page.locator('.kp-pages[data-ready="true"]').waitFor();
  const photo = page.locator('.kp-pages .mainContent-img img');
  const palette = page.locator('.kp-pages .linkToOtherItems');
  const paletteText = page.getByRole('textbox', { name: 'Текст перед ссылкой на палитру' });
  await expect(photo).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Вернуть фото' })).toHaveCount(0);

  // «×» on the photo: gone from the pages, the print and the DOCX, and still gone after a reload.
  await photo.hover();
  await page.getByRole('button', { name: 'Удалить главное фото' }).click();
  await expect(photo).toHaveCount(0);
  await ready();
  await page.reload();
  await ready();
  await expect(photo).toHaveCount(0);
  const pdf = await readPdf(await page.pdf({ preferCSSPageSize: true }));
  expect(pdf.pages).toHaveLength(await page.locator('.kp-pages .kp-page').count());
  expect(await docxXml(page, testInfo.outputPath('no-photo.docx'))).not.toContain('<wp:anchor ');

  // The palette text: edited in one line, kept after a reload, in the DOCX too; the address stays a link.
  await paletteText.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Другие цвета коллекции:');
  await page.keyboard.press('Enter');
  await expect(paletteText).toHaveText('Другие цвета коллекции:');
  await ready();
  await page.reload();
  await ready();
  await expect(paletteText).toHaveText('Другие цвета коллекции:');
  await expect(palette.locator('a')).toHaveAttribute('href', String(project.form.link));
  expect(await docxXml(page, testInfo.outputPath('palette.docx'))).toContain('Другие цвета коллекции: </w:t>');
  await palette.hover();
  await page.getByRole('button', { name: 'Ссылка на палитру: вернуть авто' }).click();
  await expect(paletteText).toHaveText('Всю палитру можно посмотреть по ссылке:');

  // «×» on the line, then the toolbar brings it back.
  await palette.hover();
  await page.getByRole('button', { name: 'Удалить ссылку на палитру' }).click();
  await expect(palette).toHaveCount(0);
  expect(await docxXml(page, testInfo.outputPath('no-palette.docx'))).not.toContain('Всю палитру');
  await page.getByRole('button', { name: 'Вернуть ссылку на палитру' }).click();
  await expect(palette).toHaveCount(1);

  // «Вернуть фото»: the picture is loaded again and the pages are laid out anew.
  await page.getByRole('button', { name: 'Вернуть фото' }).click();
  await ready();
  await expect(photo).toHaveCount(1);
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('button', { name: 'Вернуть фото' })).toHaveCount(0);
  expect(await docxXml(page, testInfo.outputPath('photo.docx'))).toContain('<wp:anchor ');

  // «Обновить с сайта» brings a removed photo back as well.
  await photo.hover();
  await page.getByRole('button', { name: 'Удалить главное фото' }).click();
  await expect(photo).toHaveCount(0);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Обновить с сайта' }).click();
  await page.getByRole('dialog', { name: 'Выберите артикулы' }).waitFor();
  await pickArticles(page, 2);
  await ready();
  await expect(photo).toHaveCount(1);
});
