import { describe, expect, it } from 'vitest';
import type { Item, Project } from '../../../shared/schema.ts';
import { buildKpDocument, type KpBlock } from '../model.ts';
import type { Placed } from '../paginate.ts';
import { toSegments } from './segments.ts';

function item(id: string, name: string): Item {
  return { id, name, qty: 1, unit: 'шт.', priceRub: 10 };
}

const LINK = 'https://gelster.ru/x';

const project: Project = {
  id: 'p',
  version: 1,
  updatedAt: '',
  form: {
    managerId: 'm',
    managerName: 'М',
    client: 'К',
    clientName: 'Имя',
    clientSex: 'm',
    link: LINK,
    euroRate: null,
    mainCurrency: 'rub',
    extraCurrency: 'rub',
    mainItems: [item('a', 'А'), item('b', 'Б')],
    extraItems: [item('c', 'В')],
    delivery: { mode: 'custom', custom: ['Раз', 'Два'] },
  },
  collection: {
    sourceUrl: LINK,
    site: 'gelster',
    fetchedAt: '',
    name: 'Имя',
    flooringKind: 'Плитка',
    manufacturer: '',
    descriptionHtml: '<p>а</p><p>б</p><ul><li>в</li></ul>',
    mainImage: null,
    articles: Array.from({ length: 6 }, (_, i) => ({ code: String(i), image: `${LINK}/${i}.jpg` })),
    features: [{ cells: [{ html: 'x' }, { html: 'y' }] }, { cells: [{ html: 'z' }, { html: 'w' }] }],
    warnings: [],
  },
  kp: null,
};

const blocks = buildKpDocument(project, null).blocks;
const placed = (list: KpBlock[]): Placed<KpBlock>[] => list.map((block) => ({ block, repeated: false }));
const shape = (list: Placed<KpBlock>[]) =>
  toSegments(list).map((s) => `${s.kind === 'single' ? s.block.type : s.kind}${s.gapBefore ? '+gap' : ''}`);

describe('toSegments', () => {
  it('joins paragraphs, article rows and the parts of each table', () => {
    expect(shape(placed(blocks))).toEqual([
      'date', 'title', 'greeting', 'intro', 'collectionHeading', 'text', 'articles', 'paletteLink',
      'features+gap', 'calcNote', 'price', 'price+gap', 'total+gap', 'comment+gap', 'comment+gap',
    ]);
    const segments = toSegments(placed(blocks));
    const main = segments.find((s) => s.kind === 'price');
    expect(main?.kind === 'price' && [main.head?.title, main.rows.length, main.foot !== null]).toEqual([
      'Основные материалы', 2, true,
    ]);
    const text = segments.find((s) => s.kind === 'text');
    expect(text?.kind === 'text' && text.paragraphs.length).toBe(3);
    const articles = segments.find((s) => s.kind === 'articles');
    expect(articles?.kind === 'articles' && articles.rows.length).toBe(2);
  });

  it('keeps two price tables apart and has no gap at the top of a page', () => {
    const rows = blocks.filter((b) => b.type === 'priceRow' || b.type === 'priceFoot' || b.type === 'priceHead');
    expect(shape(placed(rows))).toEqual(['price', 'price+gap']);
    const tail = blocks.filter((b) => b.type === 'total' || b.type === 'comment');
    expect(shape(placed(tail))).toEqual(['total', 'comment+gap', 'comment+gap']);
  });

  it('gives a repeated head its own key', () => {
    const head = blocks.find((b) => b.type === 'featuresHead');
    const row = blocks.filter((b) => b.type === 'featureRow')[1];
    if (!head || !row) throw new Error('fixture');
    const [segment] = toSegments([{ block: head, repeated: true }, { block: row, repeated: false }]);
    expect(segment?.key).toBe('features-head-repeat');
    expect(segment?.kind === 'features' && segment.rows.length).toBe(1);
  });
});
