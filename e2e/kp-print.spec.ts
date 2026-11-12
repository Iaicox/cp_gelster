/**
 * KP page end to end (docs/spec.md, section 8): a project from a fixture → preview → PDF.
 * The PDF is printed with the browser's own header and footer switched ON (displayHeaderFooter with Chromium's
 * default templates: date and title above, address and page numbers below) and the page size taken from CSS.
 * The page's `@page { size: A4; margin: 0 }` leaves no margin, and Chromium then prints no header or footer.
 * Custom header templates are not used on purpose: Chromium draws those over the content whatever the margins
 * are, which the real print dialog never does.
 */
import { expect, test, type Page } from '@playwright/test';
import { MANAGERS, mockNetwork, openKp, projectFixture, readPdf, seed } from './helpers.ts';

const A4 = { width: 595.28, height: 841.89 }; // points

/** The print dialog with «Колонтитулы» ticked and «Поля» = «По умолчанию». */
function printLikeDialog(page: Page): Promise<Buffer> {
  return page.pdf({ displayHeaderFooter: true, preferCSSPageSize: true });
}

function fileNameToday(company: string): string {
  const now = new Date();
  const two = (value: number) => String(value).padStart(2, '0');
  return `КП_${company}_от_${two(now.getDate())}.${two(now.getMonth() + 1)}.${two(now.getFullYear() % 100)}`;
}

test('prints the KP to PDF without browser headers: A4, as many sheets as preview pages', async ({ page }, testInfo) => {
  const network = await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);

  const previewPages = await openKp(page, project.id);
  expect(network.pageRequests).toEqual(['https://ooogelingen.ru/m_cocoa.htm']); // no snapshot: loaded and parsed
  expect(previewPages).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.kp-page').first()).toContainText(
    'Коммерческое предложение на поставку натурального линолеума с какао Forbo',
  );
  await expect(page.locator('.kp-page').first()).toContainText('Уважаемый Михаил!');
  await expect(page).toHaveTitle(fileNameToday('Gelingen'));
  await expect(page.getByText('Если появились поля: Печать → Поля → По умолчанию')).toBeVisible();

  // Every sheet is exactly A4 on screen, with the header and the signature as <img>.
  for (const sheet of await page.locator('.kp-page').all()) {
    const box = await sheet.boundingBox();
    expect(box?.width).toBeCloseTo((210 / 25.4) * 96, 0);
    expect(box?.height).toBeCloseTo((297 / 25.4) * 96, 0);
    await expect(sheet.locator('.kp-page-header img')).toHaveAttribute('src', 'header.jpg');
    await expect(sheet.locator('.kp-page-signature img')).toHaveAttribute('src', /^blob:/);
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
  }
  await page.screenshot({ path: testInfo.outputPath('kp-preview.png'), fullPage: true });

  const pdf = await readPdf(await printLikeDialog(page));
  await testInfo.attach('kp.pdf.txt', { body: pdf.text, contentType: 'text/plain' });

  expect(pdf.pages).toHaveLength(previewPages);
  for (const sheet of pdf.pages) {
    expect(Math.abs(sheet.width - A4.width)).toBeLessThan(1);
    expect(Math.abs(sheet.height - A4.height)).toBeLessThan(1);
  }
  // No header or footer of the browser: neither the address, nor the title line, nor the print date, nor «1/3».
  const fileName = fileNameToday('Gelingen');
  const printDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
  expect(pdf.text).not.toContain('127.0.0.1');
  expect(pdf.text).not.toContain(fileName);
  expect(pdf.text).not.toMatch(printDate);
  expect(pdf.text).not.toContain(`1/${previewPages}`);
  // The document itself is there, on the first and on the last sheet (no blank sheet at the end).
  expect(pdf.pages[0]?.text).toContain('Уважаемый Михаил!');
  expect(pdf.pages.at(-1)?.text.replace(/\s+/g, '')).not.toBe('');
  expect(pdf.text).toContain('Доставка до объекта рассчитывается отдельно.');
  // Rows without a name stay out; controls and warnings are not printed.
  expect(pdf.text).toContain('Линолеум');
  expect(pdf.text).not.toContain('Сохранить в PDF');
  expect(pdf.text).not.toContain('Обновить с сайта');
  expect(pdf.text).not.toContain('Если появились поля');

  // Control: the same page with ordinary margins does get the browser's header and footer, so the checks
  // above can fail. This is what happens when «Поля» in the dialog is not «По умолчанию».
  await page.addStyleTag({ content: '@page { size: A4; margin: 15mm; }' });
  const withMargins = await readPdf(await printLikeDialog(page));
  expect(withMargins.text).toContain('127.0.0.1');
  expect(withMargins.text).toContain(fileName);
  expect(withMargins.text).toMatch(printDate);
});

test('toolbar and warnings are hidden in print, the sheets stay', async ({ page }) => {
  await mockNetwork(page, []); // empty managers list: there is a warning to hide
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);

  await expect(page.locator('.kp-toolbar')).toBeVisible();
  await expect(page.locator('.kp-notes')).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.kp-toolbar')).toBeHidden();
  await expect(page.locator('.kp-notes')).toBeHidden();
  // Toolbar buttons and the «×» / «вернуть авто» controls on the sheets.
  expect(await page.locator('button').count()).toBeGreaterThan(4);
  await expect(page.locator('.kp-pages .kp-control').first()).toBeAttached();
  for (const button of await page.locator('button').all()) await expect(button).toBeHidden();
  await expect(page.locator('.kp-page').first()).toBeVisible();
  // Sheets follow each other without the screen gaps; every sheet but the last ends the paper page.
  const breaks = await page.locator('.kp-page').evaluateAll((sheets) => sheets.map((el) => getComputedStyle(el).breakAfter));
  expect(breaks.slice(0, -1).every((value) => value === 'page')).toBe(true);
  expect(breaks.at(-1)).toBe('auto');
});

test('removed manager: the signature comes from the image store, with a warning', async ({ page }) => {
  await mockNetwork(page, MANAGERS.filter((manager) => manager.id !== 'michael_smu'));
  const project = projectFixture();
  await seed(page, [project], [
    { key: 'signature:michael_smu', type: 'image/jpeg', file: 'api/seed/signatures/michael_smu.jpg' },
  ]);
  const signatureRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/signatures/')) signatureRequests.push(request.url());
  });

  await openKp(page, project.id);
  await expect(page.locator('.kp-notes')).toContainText('Менеджер «Михаил Смущенко» удалён из списка');
  await expect(page.locator('.kp-page-signature img').first()).toHaveAttribute('src', /^blob:/);
  expect(signatureRequests).toEqual([]);
});

test('no signature anywhere: common footer and a warning, the KP still opens', async ({ page }) => {
  await mockNetwork(page, []);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);
  await expect(page.locator('.kp-notes')).toContainText('Подпись менеджера не найдена');
  await expect(page.locator('.kp-page-signature img').first()).toHaveAttribute('src', 'footer.jpg');
});

test('changed link: asks, reloads the collection on consent and keeps the snapshot on refusal', async ({ page }) => {
  const network = await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);
  await expect(page.locator('.kp-page').first()).toContainText('Marmoleum Cocoa');

  // The manager puts another link into the form (written straight into the stored project here).
  const changeLink = async () => {
    const stored = await page.evaluate(
      (id) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const open = indexedDB.open('gelster-kp-projects');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const request = open.result.transaction('projects').objectStore('projects').get(id);
            request.onsuccess = () => {
              open.result.close();
              resolve(request.result as Record<string, unknown>);
            };
          };
        }),
      project.id,
    );
    expect((stored.collection as { sourceUrl: string }).sourceUrl).toBe('https://ooogelingen.ru/m_cocoa.htm');
    expect(stored.kp).not.toBeNull(); // created on the first opening
    const form = { ...(stored.form as Record<string, unknown>), link: 'https://ooogelingen.ru/coral_classic.htm' };
    await seed(page, [{ ...stored, form }]);
  };

  await changeLink();
  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await openKp(page, project.id);
  expect(messages[0]).toContain('будут сброшены');
  await expect(page.locator('.kp-page').first()).toContainText('Marmoleum Cocoa');
  expect(network.pageRequests).toHaveLength(1);

  await page.goto('./#/e2e-seed');
  page.once('dialog', (dialog) => void dialog.accept());
  await openKp(page, project.id);
  expect(network.pageRequests).toEqual(['https://ooogelingen.ru/m_cocoa.htm', 'https://ooogelingen.ru/coral_classic.htm']);
  await expect(page.locator('.kp-page').first()).not.toContainText('Marmoleum Cocoa');
  await expect(page.locator('.kp-page').first()).toContainText(/Coral/i);
});

test('«Обновить с сайта» asks first and re-reads the page; «К форме» leads back', async ({ page }) => {
  const network = await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Обновить с сайта' }).click();
  expect(network.pageRequests).toHaveLength(1);

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Описание, характеристики и выбор артикулов будут сброшены');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Обновить с сайта' }).click();
  await expect.poll(() => network.pageRequests.length).toBe(2);
  // The choice of articles is reset: the picker offers them again.
  const picker = page.getByRole('dialog', { name: 'Выберите артикулы' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Закрыть' }).click();
  await page.locator('.kp-pages[data-ready="true"]').waitFor();

  await page.getByRole('link', { name: 'К форме' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
