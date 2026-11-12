import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCollection } from '../../shared/parsers/index.ts';
import type { Collection, Item, Manager, Project } from '../../shared/schema.ts';
import {
  buildFileName,
  buildKpDocument,
  createInitialKp,
  DEFAULT_DELIVERY_COMMENT,
  formatKpDate,
  splitDescription,
  type KpBlock,
} from './model.ts';

/** formatMoney separates thousands with a no-break space. */
const money = (text: string) => text.replace(/ /g, '\u00a0');

const NOW = new Date(2026, 10, 5); // 5 November 2026, local time
const MANAGER: Manager = { id: 'm1', name: 'Иван Логинов', signature: 'api/data/signatures/ivan.jpg' };

function item(id: string, name: string, qty: number | null, priceRub: number | null): Item {
  return { id, name, qty, unit: 'м²', priceRub };
}

function collection(patch: Partial<Collection> = {}): Collection {
  return {
    sourceUrl: 'https://ooogelingen.ru/m_cocoa.htm',
    site: 'ooogelingen',
    fetchedAt: '2026-11-01T00:00:00.000Z',
    name: 'Marmoleum Cocoa',
    flooringKind: 'Натуральный линолеум с какао',
    manufacturer: 'Forbo',
    descriptionHtml: '<p>Первый абзац.</p><ul><li>раз</li><li>два</li></ul><ol><li>один</li><li>два</li></ol>',
    mainImage: 'https://ooogelingen.ru/img/main.jpg',
    articles: Array.from({ length: 10 }, (_, i) => ({ code: `35${i}`, image: `https://ooogelingen.ru/img/${i}.jpg` })),
    features: [{ cells: [{ html: 'Толщина' }, { html: '2,5 мм' }] }, { cells: [{ html: 'Ширина' }, { html: '2 м' }] }],
    warnings: [],
    ...patch,
  };
}

function project(patch: Partial<Project['form']> = {}, rest: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    version: 1,
    updatedAt: '2026-11-01T00:00:00.000Z',
    form: {
      managerId: 'm1',
      managerName: 'Иван Логинов',
      client: 'ООО «Ромашка»',
      clientName: 'Анна Петровна',
      clientSex: 'f',
      link: 'https://ooogelingen.ru/m_cocoa.htm',
      euroRate: 100,
      mainCurrency: 'rub',
      extraCurrency: 'rub',
      mainItems: [item('a', 'Marmoleum Cocoa 3581', 120, 2500), item('b', '', 5, 100)],
      extraItems: [item('c', 'Клей 522', 3, 4000.5)],
      delivery: { mode: 'default', custom: [''] },
      ...patch,
    },
    collection: collection(),
    kp: null,
    ...rest,
  };
}

function build(p: Project, manager: Manager | null = MANAGER) {
  return buildKpDocument(p, manager, { now: NOW });
}

function one<T extends KpBlock['type']>(blocks: KpBlock[], type: T): Extract<KpBlock, { type: T }> {
  const found = blocks.filter((block) => block.type === type);
  expect(found).toHaveLength(1);
  return found[0] as Extract<KpBlock, { type: T }>;
}

function all<T extends KpBlock['type']>(blocks: KpBlock[], type: T): Extract<KpBlock, { type: T }>[] {
  return blocks.filter((block) => block.type === type) as Extract<KpBlock, { type: T }>[];
}

describe('buildKpDocument: fields derived from the form', () => {
  it('addresses the client by sex', () => {
    expect(one(build(project()).blocks, 'greeting').text).toBe('Уважаемая Анна Петровна!');
    const male = project({ clientSex: 'm', clientName: ' Пётр Ильич ' });
    expect(one(build(male).blocks, 'greeting').text).toBe('Уважаемый Пётр Ильич!');
  });

  it('builds the title with the flooring kind in the genitive and the manufacturer', () => {
    expect(one(build(project()).blocks, 'title').text).toBe(
      'Коммерческое предложение на поставку натурального линолеума с какао Forbo',
    );
  });

  it('builds the title without missing kind and manufacturer', () => {
    const p = project({}, { collection: collection({ flooringKind: '', manufacturer: '' }) });
    expect(one(build(p).blocks, 'title').text).toBe('Коммерческое предложение');
    expect(one(build(p).blocks, 'collectionHeading').text).toBe('Marmoleum Cocoa');
    expect(one(build(p).blocks, 'intro').text).toContain('к рассмотрению Marmoleum Cocoa,');
  });

  it('computes date, intro and collection heading while kp is null', () => {
    const { blocks, fileName } = build(project());
    expect(one(blocks, 'date')).toMatchObject({ date: '«5» ноября 2026 г.', client: 'ООО «Ромашка»' });
    expect(one(blocks, 'intro').text).toBe(
      'Предлагаю Вам к рассмотрению натуральный линолеум с какао, а также сопутствующие материалы к нему.',
    );
    expect(one(blocks, 'collectionHeading').text).toBe('Натуральный линолеум с какао — Marmoleum Cocoa');
    expect(fileName).toBe('КП_ООО «Ромашка»_от_05.11.26');
  });

  it('recomputes null fields of an opened kp and keeps edited ones', () => {
    const base = project();
    const kp = { ...createInitialKp(base.collection), title: 'Свой заголовок', date: '«1» мая 2026 г.' };
    const { blocks } = build(project({ clientSex: 'm', clientName: 'Олег' }, { kp }));
    expect(one(blocks, 'title').text).toBe('Свой заголовок');
    expect(one(blocks, 'date').date).toBe('«1» мая 2026 г.');
    expect(one(blocks, 'greeting').text).toBe('Уважаемый Олег!'); // null in kp: follows the form
  });

  it('formats dates and file names', () => {
    expect(formatKpDate(new Date(2027, 0, 31))).toBe('«31» января 2027 г.');
    expect(buildFileName('  АО "Вектор" / Юг ', new Date(2027, 0, 3))).toBe('КП_АО Вектор Юг_от_03.01.27');
    expect(buildFileName('', new Date(2027, 0, 3))).toBe('КП_от_03.01.27');
  });
});

describe('buildKpDocument: content from the collection', () => {
  it('keeps the document order', () => {
    const types = build(project()).blocks.map((block) => block.type);
    expect([...new Set(types)]).toEqual([
      'date', 'title', 'greeting', 'intro', 'collectionHeading', 'mainImage', 'paragraph', 'articleRow',
      'paletteLink', 'featuresHead', 'featureRow', 'calcNote', 'priceHead', 'priceRow', 'priceFoot', 'total',
      'comment',
    ]);
  });

  it('has unique stable ids', () => {
    const ids = build(project()).blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(build(project()).blocks.map((block) => block.id)).toEqual(ids);
  });

  it('splits the description into paragraphs and list items', () => {
    const paragraphs = all(build(project()).blocks, 'paragraph');
    expect(paragraphs.map(({ html, list, number }) => ({ html, list, number }))).toEqual([
      { html: 'Первый абзац.', list: 'none', number: undefined },
      { html: 'раз', list: 'bullet', number: undefined },
      { html: 'два', list: 'bullet', number: undefined },
      { html: 'один', list: 'number', number: 1 },
      { html: 'два', list: 'number', number: 2 },
    ]);
  });

  it('keeps loose text and inline markup, drops empty paragraphs', () => {
    expect(splitDescription('Текст <b>жирный</b> и 1 &lt; 2<p> </p><p>Абзац<br>строка</p>')).toEqual([
      { html: 'Текст <b>жирный</b> и 1 &lt; 2', list: 'none' },
      { html: 'Абзац<br>строка', list: 'none' },
    ]);
    expect(splitDescription('  ')).toEqual([]);
  });

  it('takes the first 8 articles in rows of 4 until they are picked', () => {
    const rows = all(build(project()).blocks, 'articleRow');
    expect(rows.map((row) => row.articles.map((article) => article.code))).toEqual([
      ['350', '351', '352', '353'],
      ['354', '355', '356', '357'],
    ]);
    expect(rows[1]?.keepWithNext).toBe(true); // the palette link stays under the last row
    expect(one(build(project()).blocks, 'paletteLink').url).toBe('https://ooogelingen.ru/m_cocoa.htm');
  });

  it('uses the articles saved in kp', () => {
    const base = project();
    const kp = { ...createInitialKp(base.collection), selectedArticles: [{ code: '359', image: 'x', caption: 'Мой' }] };
    const rows = all(build(project({}, { kp })).blocks, 'articleRow');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.articles).toEqual([{ code: '359', image: 'x', caption: 'Мой' }]);
  });

  it('marks the features head as repeated and keeps rows joined by rowSpan together', () => {
    const features = [
      { cells: [{ html: 'Класс', rowSpan: 2 }, { html: '33' }] },
      { cells: [{ html: '42' }] },
      { cells: [{ html: 'Вес' }, { html: '3 кг' }] },
    ];
    const { blocks } = build(project({}, { collection: collection({ features }) }));
    expect(one(blocks, 'featuresHead')).toMatchObject({
      title: 'Технические характеристики Marmoleum Cocoa:',
      keepWithNext: true,
      repeatOnBreak: true,
      group: 'features',
    });
    expect(all(blocks, 'featureRow').map((row) => row.keepWithNext)).toEqual([true, false, false]);
  });

  it('omits what the collection lacks and still builds without a collection', () => {
    const bare = collection({ mainImage: null, articles: [], features: [], descriptionHtml: '' });
    const types = build(project({}, { collection: bare })).blocks.map((block) => block.type);
    expect(types).not.toContain('mainImage');
    expect(types).not.toContain('articleRow');
    expect(types).not.toContain('featuresHead');

    const none = build(project({ link: '' }, { collection: null }));
    expect(one(none.blocks, 'title').text).toBe('Коммерческое предложение');
    expect(none.blocks.map((block) => block.type)).not.toContain('paletteLink');
    expect(none.warnings.join(' ')).toContain('Страница коллекции не загружена');
  });

  it('passes parser warnings through', () => {
    const p = project({}, { collection: collection({ warnings: ['Не найдено главное фото'] }) });
    expect(build(p).warnings).toContain('Не найдено главное фото');
  });

  it('builds from the Marmoleum Cocoa fixture', () => {
    const html = readFileSync('shared/parsers/__fixtures__/ooogelingen.ru/m_cocoa.htm', 'utf8');
    const parsed = parseCollection(html, 'https://ooogelingen.ru/m_cocoa.htm');
    const { blocks } = build(project({}, { collection: parsed }));
    expect(one(blocks, 'title').text).toBe('Коммерческое предложение на поставку натурального линолеума с какао Forbo');
    expect(all(blocks, 'paragraph').length).toBeGreaterThan(0);
    expect(all(blocks, 'articleRow').length).toBeGreaterThan(0);
    expect(all(blocks, 'featureRow')).toHaveLength(parsed.features.filter((row) => row.cells.length > 0).length);
  });
});

describe('buildKpDocument: price tables', () => {
  it('leaves out rows without a name and continues numbering in the extra table', () => {
    const { blocks } = build(project());
    const rows = all(blocks, 'priceRow');
    expect(rows.map((row) => [row.table, row.no, row.name])).toEqual([
      ['main', '1.', 'Marmoleum Cocoa 3581'],
      ['extra', '2.', 'Клей 522'],
    ]);
    expect(rows[0]).toMatchObject({ qty: '120,00', unit: 'м²', priceRub: money('2 500,00'), sumRub: money('300 000,00') });
    expect(all(blocks, 'priceFoot').map((foot) => foot.total)).toEqual([money('300 000,00'), money('12 001,50')]);
    expect(one(blocks, 'total').total).toBe(money('312 001,50'));
  });

  it('repeats table heads and keeps the last row with the total line', () => {
    const p = project({ mainItems: [item('a', 'Один', 1, 1), item('b', 'Два', 1, 1)], extraItems: [] });
    const { blocks } = build(p);
    expect(one(blocks, 'priceHead')).toMatchObject({ keepWithNext: true, repeatOnBreak: true, group: 'price-main' });
    expect(all(blocks, 'priceRow').map((row) => row.keepWithNext)).toEqual([false, true]);
    expect(one(blocks, 'calcNote').keepWithNext).toBe(true);
  });

  it('has no calculation blocks when every row is unnamed', () => {
    const p = project({ mainItems: [item('a', ' ', 1, 1)], extraItems: [] });
    const types = build(p).blocks.map((block) => block.type);
    for (const type of ['calcNote', 'priceHead', 'priceRow', 'priceFoot', 'total']) expect(types).not.toContain(type);
  });

  it('shows the euro column per table and only with a valid rate', () => {
    const withEuro = build(project({ mainCurrency: 'rubAndEuro' })).blocks;
    expect(all(withEuro, 'priceHead').map((head) => head.showEuro)).toEqual([true, false]);
    expect(all(withEuro, 'priceRow')[0]).toMatchObject({ showEuro: true, priceEur: '25,00' });

    const noRate = build(project({ mainCurrency: 'rubAndEuro', euroRate: null }));
    expect(all(noRate.blocks, 'priceHead').map((head) => head.showEuro)).toEqual([false, false]);
    expect(noRate.warnings.join(' ')).toContain('Курс евро не задан');
  });
});

describe('buildKpDocument: delivery comment', () => {
  const comments = (p: Project) => all(build(p).blocks, 'comment').map((block) => block.text);

  it('default: the standard line', () => {
    expect(comments(project())).toEqual([DEFAULT_DELIVERY_COMMENT]);
  });

  it('none: no comment', () => {
    expect(comments(project({ delivery: { mode: 'none', custom: ['не показывать'] } }))).toEqual([]);
  });

  it('custom: own lines, empty ones dropped', () => {
    const delivery = { mode: 'custom' as const, custom: [' Доставка включена. ', '', 'Срок 3 недели.'] };
    expect(comments(project({ delivery }))).toEqual(['Доставка включена.', 'Срок 3 недели.']);
  });
});

describe('buildKpDocument: manager', () => {
  it('uses the signature of a listed manager without warnings', () => {
    const doc = build(project());
    expect(doc.signature).toEqual({ managerId: 'm1', url: 'api/data/signatures/ivan.jpg' });
    expect(doc.warnings).toEqual([]);
  });

  it('removed manager: stored signature by id and a warning', () => {
    const doc = build(project(), null);
    expect(doc.signature).toEqual({ managerId: 'm1', url: null });
    expect(doc.warnings).toEqual(['Менеджер «Иван Логинов» удалён из списка: используется сохранённая подпись.']);
  });

  it('no manager chosen: common footer and a hint', () => {
    const doc = build(project({ managerId: '', managerName: '' }), null);
    expect(doc.signature).toEqual({ managerId: null, url: null });
    expect(doc.warnings.join(' ')).toContain('Выберите менеджера');
  });
});
