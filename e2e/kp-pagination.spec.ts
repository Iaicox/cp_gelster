/** Page breaking in a real browser: split tables repeat their head, an oversized block is clipped and reported. */
import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, openKp, projectFixture, readPdf, seed } from './helpers.ts';

/** The project record as the app has stored it. */
function storedProject(page: Page, id: string): Promise<{ kp: Record<string, unknown> }> {
  return page.evaluate(
    (key) =>
      new Promise<{ kp: Record<string, unknown> }>((resolve, reject) => {
        const open = indexedDB.open('gelster-kp-projects');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('projects').objectStore('projects').get(key);
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as { kp: Record<string, unknown> });
          };
        };
      }),
    id,
  );
}

test('a long price table continues on the next sheets under a repeated head', async ({ page }) => {
  await mockNetwork(page);
  const project = projectFixture();
  project.form.mainItems = Array.from({ length: 70 }, (_, i) => ({
    id: `row-${i}`,
    name: `Позиция ${i + 1}`,
    qty: i + 1,
    unit: 'шт.',
    priceRub: 100,
  }));
  await seed(page, [project]);
  const previewPages = await openKp(page, project.id);

  const tables = page.locator('.kp-pages .table-main_materials');
  expect(await tables.count()).toBeGreaterThanOrEqual(2);
  for (const table of await tables.all()) {
    await expect(table.locator('thead th').nth(1)).toHaveText('Основные материалы');
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);
  }
  await expect(page.locator('.kp-pages .table-main_materials tbody tr')).toHaveCount(70);
  await expect(page.locator('.kp-pages .table-main_materials tfoot')).toHaveCount(1);
  await expect(page.locator('.kp-overflow')).toHaveCount(0);

  // Nothing is cut off: on every sheet the content ends above the signature strip.
  const fits = await page.locator('.kp-pages .kp-page').evaluateAll((sheets) =>
    sheets.map((sheet) => {
      const flow = sheet.querySelector('.kp-page-flow')?.getBoundingClientRect();
      const strip = sheet.querySelector('.kp-page-signature')?.getBoundingClientRect();
      return flow !== undefined && strip !== undefined && flow.bottom <= strip.top + 0.5;
    }),
  );
  expect(fits.every(Boolean)).toBe(true);

  const pdf = await readPdf(await page.pdf({ displayHeaderFooter: true, preferCSSPageSize: true }));
  expect(pdf.pages).toHaveLength(previewPages);
  expect(pdf.text).toContain('Позиция 70');
});

test('a paragraph taller than a sheet gets its own sheet, is clipped and reported', async ({ page }) => {
  await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id); // loads the collection and creates project.kp

  const stored = await storedProject(page, project.id);
  const huge = `<p>${'Очень длинный абзац без единого разрыва. '.repeat(400)}</p><p>Короткий абзац после.</p>`;
  await seed(page, [{ ...stored, kp: { ...stored.kp, descriptionHtml: huge } }]);
  const previewPages = await openKp(page, project.id);

  await expect(page.locator('.kp-overflow')).toHaveCount(1);
  await expect(page.locator('.kp-overflow')).toContainText('текст не помещается');
  const clipped = page.locator('.kp-page[data-overflow="true"]');
  await expect(clipped).toHaveCount(1);
  await expect(clipped.locator('.mainText p')).toHaveCount(1); // alone on its sheet
  expect(await clipped.locator('.kp-page-content').evaluate((el) => getComputedStyle(el).overflow)).toBe('hidden');

  // The clipped sheet is still one paper page; the warning is not printed.
  const pdf = await readPdf(await page.pdf({ displayHeaderFooter: true, preferCSSPageSize: true }));
  expect(pdf.pages).toHaveLength(previewPages);
  expect(pdf.text).not.toContain('текст не помещается');
  expect(pdf.text).toContain('Короткий абзац после.');
});
