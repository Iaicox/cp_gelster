import { expect, test } from '@playwright/test';
import { mockNetwork, openKp, projectFixture, seed } from './helpers.ts';

test('pages are measured with the document fonts loaded, not with fallbacks', async ({ page }) => {
  await mockNetwork(page);
  const project = projectFixture();
  await seed(page, [project]);
  await openKp(page, project.id);
  const faces = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((face) => face.status === 'loaded')
      .map((face) => `${face.family.replace(/"/g, '')} ${face.weight} ${face.style}`)
      .sort(),
  );
  expect(faces).toEqual(expect.arrayContaining(['PT Sans bold normal', 'PT Sans normal normal', 'PT Serif bold normal', 'PT Serif normal normal']));
});
