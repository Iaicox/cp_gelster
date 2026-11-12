import { describe, expect, it } from 'vitest';
import type { Collection, KpEdits, Project } from '../../shared/schema.ts';
import { applyChange, deleteFeatureRow } from './edit.ts';
import { buildKpDocument, createInitialKp, joinDescription, splitDescription, type KpBlock } from './model.ts';

const NOW = new Date(2026, 10, 5);

const COLLECTION: Collection = {
  sourceUrl: 'https://ooogelingen.ru/m_cocoa.htm',
  site: 'ooogelingen',
  fetchedAt: '2026-11-01T00:00:00.000Z',
  name: 'Marmoleum Cocoa',
  flooringKind: 'Натуральный линолеум',
  manufacturer: 'Forbo',
  descriptionHtml: '<p>Первый.</p><p>Второй.</p><ol><li>один</li><li>два</li></ol><ul><li>пункт</li></ul>',
  mainImage: null,
  articles: [{ code: '350', image: 'https://ooogelingen.ru/350.jpg' }],
  features: [{ cells: [{ html: 'Толщина' }, { html: '2,5 мм' }] }, { cells: [{ html: 'Ширина' }, { html: '2 м' }] }],
  warnings: [],
};

function project(kp: Partial<KpEdits> = {}, form: Partial<Project['form']> = {}): Project {
  return {
    id: 'p1',
    version: 1,
    updatedAt: '',
    form: {
      managerId: '',
      managerName: '',
      client: 'ООО «Ромашка»',
      clientName: 'Анна',
      clientSex: 'f',
      link: COLLECTION.sourceUrl,
      euroRate: null,
      mainCurrency: 'rub',
      extraCurrency: 'rub',
      mainItems: [],
      extraItems: [],
      delivery: { mode: 'default', custom: [''] },
      ...form,
    },
    collection: COLLECTION,
    kp: { ...createInitialKp(COLLECTION), ...kp },
  };
}

function blocksOf(p: Project): KpBlock[] {
  return buildKpDocument(p, null, { now: NOW }).blocks;
}

function text(p: Project, type: 'greeting' | 'title' | 'intro'): string {
  const block = blocksOf(p).find((b) => b.type === type);
  return block && 'text' in block ? block.text : '';
}

describe('applyChange: fields derived from the form', () => {
  it('keeps an edited greeting when the client changes, the untouched one follows the form', () => {
    const edited = applyChange(project(), { kind: 'auto', field: 'greeting', value: 'Добрый день!' }, NOW);
    expect(edited.kp?.greeting).toBe('Добрый день!');
    const otherClient = { clientName: 'Олег', clientSex: 'm' as const };
    expect(text({ ...edited, form: { ...edited.form, ...otherClient } }, 'greeting')).toBe('Добрый день!');
    const untouched = project();
    expect(text({ ...untouched, form: { ...untouched.form, ...otherClient } }, 'greeting')).toBe('Уважаемый Олег!');
  });

  it('goes back to auto with null, with the derived text itself and with an emptied field', () => {
    const edited = applyChange(project(), { kind: 'auto', field: 'title', value: 'Мой заголовок' }, NOW);
    const block = blocksOf(edited).find((b) => b.type === 'title');
    expect(block).toMatchObject({ text: 'Мой заголовок', edited: true });
    expect(applyChange(edited, { kind: 'auto', field: 'title', value: null }, NOW).kp?.title).toBeNull();
    expect(applyChange(edited, { kind: 'auto', field: 'title', value: '  ' }, NOW).kp?.title).toBeNull();
    const auto = text(project(), 'intro');
    const same = project();
    expect(applyChange(same, { kind: 'auto', field: 'intro', value: auto }, NOW)).toBe(same); // nothing to save
  });
});

describe('applyChange: description', () => {
  it('replaces, splits and deletes paragraphs; numbered lists stay one list', () => {
    const p = project();
    const replaced = applyChange(p, { kind: 'paragraph', index: 1, pieces: ['Новый <b>второй</b>.'] });
    expect(replaced.kp?.descriptionHtml).toContain('<p>Новый <b>второй</b>.</p>');

    const split = applyChange(p, { kind: 'paragraph', index: 0, pieces: ['Раз.', 'Два.'] });
    expect(splitDescription(split.kp?.descriptionHtml ?? '').map((x) => x.html)).toEqual([
      'Раз.', 'Два.', 'Второй.', 'один', 'два', 'пункт',
    ]);

    const item = applyChange(p, { kind: 'paragraph', index: 2, pieces: ['од', 'ин'] });
    expect(item.kp?.descriptionHtml).toBe('<p>Первый.</p><p>Второй.</p><ol><li>од</li><li>ин</li><li>два</li></ol><ul><li>пункт</li></ul>');

    const deleted = applyChange(p, { kind: 'paragraph', index: 0, pieces: [] });
    expect(splitDescription(deleted.kp?.descriptionHtml ?? '')[0]?.html).toBe('Второй.');
    expect(applyChange(p, { kind: 'paragraph', index: 9, pieces: [] })).toBe(p);
  });

  it('joinDescription is the inverse of splitDescription', () => {
    const html = '<p>А</p><ol><li>1</li><li>2</li></ol><ol><li>снова 1</li></ol><ul><li>•</li></ul><p>Б</p>';
    expect(joinDescription(splitDescription(html))).toBe(html);
  });
});

describe('applyChange: articles, features, comments', () => {
  it('edits a caption of a chosen article', () => {
    const p = project({ selectedArticles: [{ code: '350', image: 'x', caption: 'Арт. 350' }] });
    expect(applyChange(p, { kind: 'caption', index: 0, text: 'Какао 350' }).kp?.selectedArticles[0]?.caption).toBe(
      'Какао 350',
    );
  });

  it('edits a feature cell and the title, deletes a row', () => {
    const p = project();
    const cell = applyChange(p, { kind: 'featureCell', row: 1, cell: 1, html: '<b>3 м</b>' });
    expect(cell.kp?.features[1]?.cells[1]?.html).toBe('<b>3 м</b>');
    expect(applyChange(p, { kind: 'featuresTitle', text: 'Свойства:' }).kp?.featuresTitle).toBe('Свойства:');
    const rows = applyChange(p, { kind: 'deleteFeatureRow', row: 0 }).kp?.features;
    expect(rows).toEqual([{ cells: [{ html: 'Ширина' }, { html: '2 м' }] }]);
  });

  it('a delivery line edited on the page becomes a custom delivery comment of the form', () => {
    const p = project();
    const next = applyChange(p, { kind: 'comment', index: 0, text: 'Доставка бесплатно.' });
    expect(next.form.delivery).toEqual({ mode: 'custom', custom: ['Доставка бесплатно.'] });
    const own = project({ comments: ['Свой'] }, { delivery: { mode: 'none', custom: [''] } });
    expect(applyChange(own, { kind: 'comment', index: 0, text: 'Свой, правленый' }).kp?.comments).toEqual([
      'Свой, правленый',
    ]);
  });
});

describe('deleteFeatureRow keeps the table whole', () => {
  // | A (rowSpan 3) | b1 |
  // |               | b2 |
  // |               | b3 |
  // | C             | d  |
  const spanned: KpEdits['features'] = [
    { cells: [{ html: 'A', rowSpan: 3 }, { html: 'b1' }] },
    { cells: [{ html: 'b2' }] },
    { cells: [{ html: 'b3' }] },
    { cells: [{ html: 'C' }, { html: 'd' }] },
  ];

  it('shortens a span coming from above', () => {
    expect(deleteFeatureRow(spanned, 1)).toEqual([
      { cells: [{ html: 'A', rowSpan: 2 }, { html: 'b1' }] },
      { cells: [{ html: 'b3' }] },
      { cells: [{ html: 'C' }, { html: 'd' }] },
    ]);
  });

  it('moves a spanning cell of the deleted row into the next row, at its column', () => {
    expect(deleteFeatureRow(spanned, 0)).toEqual([
      { cells: [{ html: 'A', rowSpan: 2 }, { html: 'b2' }] },
      { cells: [{ html: 'b3' }] },
      { cells: [{ html: 'C' }, { html: 'd' }] },
    ]);
    const right = [
      { cells: [{ html: 'x' }, { html: 'Y', rowSpan: 2 }] },
      { cells: [{ html: 'z' }] },
    ];
    expect(deleteFeatureRow(right, 0)).toEqual([{ cells: [{ html: 'z' }, { html: 'Y' }] }]);
  });

  it('every row still has the full number of columns', () => {
    const width = (rows: KpEdits['features']) => {
      const taken = rows.map(() => 0);
      rows.forEach((row, r) =>
        row.cells.forEach((cell) => {
          for (let dr = 0; dr < (cell.rowSpan ?? 1); dr++) taken[r + dr] = (taken[r + dr] ?? 0) + 1;
        }),
      );
      return taken;
    };
    for (let i = 0; i < spanned.length; i++) expect(width(deleteFeatureRow(spanned, i)).every((n) => n === 2)).toBe(true);
  });
});
