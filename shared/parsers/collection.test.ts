import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CollectionSchema, type Collection } from '../schema.ts';
import { NotACollectionError, parseCollection, siteOf } from './index.ts';

const FIXTURES = 'shared/parsers/__fixtures__/'; // vitest runs from the repository root

function load(path: string): string {
  return readFileSync(FIXTURES + path, 'utf8');
}

type Expected = {
  file: string;
  url: string;
  name: string;
  flooringKind: string;
  manufacturer: string;
  codes: string[];
  featureRows: number;
  mainImage: string | null;
  /** Warnings beyond the expected missing manufacturer / articles / features. */
  warnings: string[];
};

const CASES: Expected[] = [
  {
    file: 'ooogelingen.ru/m_cocoa.htm',
    url: 'https://ooogelingen.ru/m_cocoa.htm',
    name: 'Marmoleum Cocoa',
    flooringKind: 'Натуральный линолеум с какао',
    manufacturer: 'Forbo',
    codes: ['3580', '3581', '3583', '3582', '3584'],
    featureRows: 13,
    mainImage: 'https://ooogelingen.ru/style/collection/marmoleum/foto1_cocao.jpg',
    warnings: [],
  },
  {
    file: 'ooogelingen.ru/coral_classic.htm',
    url: 'https://ooogelingen.ru/coral_classic.htm',
    name: 'Coral Classic',
    flooringKind: 'Грязезащитный ковер',
    manufacturer: 'Forbo',
    codes: '4701 4721 4727 4730 4744 4750 4752 4754 4756 4751 4764 4766 4759 4758 4774 4753'.split(' '),
    featureRows: 14,
    mainImage: 'https://ooogelingen.ru/style/collection/coral/foto_1_coral_classic.jpg',
    warnings: [],
  },
  {
    file: 'ooogelingen.ru/plint_DSL.htm',
    url: 'https://ooogelingen.ru/plint_DSL.htm',
    name: 'Dollken DSL',
    flooringKind: 'Плинтус для мармолеума и ПВХ-покрытий',
    manufacturer: '',
    codes: ['1091', '1083', '1084', '1063', '1064'],
    featureRows: 2,
    mainImage: 'https://ooogelingen.ru/style/collection/plintus_dollken/foto1_Dollken_DSL.jpg',
    warnings: ['Не найден производитель: заголовок КП составлен без него'],
  },
  {
    file: 'ooogelingen.ru/glue_marm.htm',
    url: 'https://ooogelingen.ru/glue_marm.htm',
    name: 'Клей Forbo 418',
    flooringKind: 'Клей для натурального линолеума (мармолеума)',
    manufacturer: '',
    codes: [],
    featureRows: 0,
    mainImage: 'https://ooogelingen.ru/style/collection/glue/foto1_nat_linol.jpg',
    warnings: [
      'Не найден производитель: заголовок КП составлен без него',
      'Не найдены артикулы',
      'Не найдены технические характеристики',
    ],
  },
  {
    file: 'gelster.ru/marmoleum_cocoa.htm',
    url: 'https://gelster.ru/marmoleum_cocoa.htm',
    name: 'Marmoleum Cocoa',
    flooringKind: 'Натуральный линолеум',
    manufacturer: '',
    codes: ['3584', '3580', '3581', '3582', '3583'],
    featureRows: 15,
    mainImage: 'https://gelster.ru/img/collections/marmoleum/m_cocoa/catalog-in-new_03.jpg',
    warnings: ['Не найден производитель: заголовок КП составлен без него'],
  },
  {
    file: 'gelster.ru/coral-class.htm',
    url: 'https://gelster.ru/coral-class.htm',
    name: 'Forbo Coral Classic',
    flooringKind: 'Грязезащитный ковер',
    manufacturer: '',
    codes: '4701 4721 4727 4730 4744 4750 4752 4754 4756 4751 4764 4766 4759 4758 4774 4753'.split(' '),
    featureRows: 15,
    mainImage: 'https://gelster.ru/img/collections/entrance-flooring/forbo-entrance-flooring/coral-classic/images/catalog-in-kovrolin_03.jpg',
    warnings: ['Не найден производитель: заголовок КП составлен без него'],
  },
  {
    file: 'gelster.ru/dollken_al.htm',
    url: 'https://gelster.ru/dollken_al.htm',
    name: 'Dollken Al 40/3',
    flooringKind: 'Завершающий профиль',
    manufacturer: '',
    codes: ['0110'],
    featureRows: 2,
    mainImage: 'https://gelster.ru/img/Katalog/Dollken-plintus/Al403/catalog-in-DOLLKEN_03.jpg',
    warnings: ['Не найден производитель: заголовок КП составлен без него'],
  },
];

/** Every URL inside the output (images and links) must be absolute https. */
function allUrls(collection: Collection): string[] {
  const urls = collection.articles.map((article) => article.image);
  if (collection.mainImage) urls.push(collection.mainImage);
  const html = [collection.descriptionHtml, ...collection.features.flatMap((row) => row.cells.map((c) => c.html))];
  for (const fragment of html) for (const match of fragment.matchAll(/href="([^"]*)"/g)) urls.push(match[1] ?? '');
  return urls;
}

function allHtml(collection: Collection): string {
  return [collection.descriptionHtml, ...collection.features.flatMap((row) => row.cells.map((c) => c.html))].join('\n');
}

describe.each(CASES)('parseCollection: $file', (expected) => {
  const collection = parseCollection(load(expected.file), expected.url, '2026-11-12T00:00:00.000Z');

  it('matches the schema and keeps the source', () => {
    expect(CollectionSchema.parse(collection)).toEqual(collection);
    expect(collection.sourceUrl).toBe(expected.url);
    expect(collection.site).toBe(siteOf(expected.url));
    expect(collection.fetchedAt).toBe('2026-11-12T00:00:00.000Z');
  });

  it('name, flooring kind, manufacturer', () => {
    expect(collection.name).toBe(expected.name);
    expect(collection.flooringKind).toBe(expected.flooringKind);
    expect(collection.manufacturer).toBe(expected.manufacturer);
  });

  it('articles: count and codes', () => {
    expect(collection.articles).toHaveLength(expected.codes.length);
    expect(collection.articles.map((article) => article.code)).toEqual(expected.codes);
  });

  it('features: row count, two cells per row', () => {
    expect(collection.features).toHaveLength(expected.featureRows);
    for (const row of collection.features) {
      expect(row.cells).toHaveLength(2);
      expect(row.cells[0]?.html).not.toBe('');
    }
  });

  it('description is present and clean', () => {
    expect(collection.descriptionHtml).toMatch(/^<p>/);
    const html = allHtml(collection);
    expect(html).not.toMatch(/<script|<style|<img|<div|<iframe/i);
    expect(html).not.toMatch(/\son\w+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/\s(class|style|id|src)=/i);
  });

  it('all URLs are absolute', () => {
    expect(collection.mainImage).toBe(expected.mainImage);
    for (const url of allUrls(collection)) expect(url).toMatch(/^https:\/\/[^/]+\//);
    const host = new URL(expected.url).host;
    for (const article of collection.articles) expect(new URL(article.image).host).toBe(host);
  });

  it('warnings name only the missing fields', () => {
    expect(collection.warnings).toEqual(expected.warnings);
  });
});

describe('parseCollection: details', () => {
  it('ooogelingen: description includes the hidden «читать далее» part, links are absolute', () => {
    const collection = parseCollection(load('ooogelingen.ru/m_cocoa.htm'), 'https://ooogelingen.ru/m_cocoa.htm');
    expect(collection.descriptionHtml).toContain('Невероятно шелковистая');
    expect(collection.descriptionHtml).toContain('выпускается всего в 5 цветовых решениях');
    expect(collection.descriptionHtml).toContain('<a href="https://www.youtube.com/watch?v=Dgwarg1bnIc&amp;t=3s">');
    expect(collection.features[3]?.cells[0]?.html).toBe('Вес 1 м<sup>2</sup>');
  });

  it('gelster: hidden description part is joined, the «читать далее» button is not', () => {
    const collection = parseCollection(load('gelster.ru/marmoleum_cocoa.htm'), 'https://gelster.ru/marmoleum_cocoa.htm');
    expect(collection.descriptionHtml).toContain('Эту коллекцию натурального линолеума Форбо');
    expect(collection.descriptionHtml).not.toContain('читать далее');
    expect(collection.descriptionHtml.match(/<p>/g)).toHaveLength(4);
    expect(collection.articles[0]).toEqual({
      code: '3584',
      title: 'white chocolate',
      image: 'https://gelster.ru/img/collections/marmoleum/m_cocoa/3584.jpg',
    });
    // Transposed head (names row + values row) becomes pairs; the info icon inside <sup> disappears.
    expect(collection.features[0]?.cells.map((cell) => cell.html)).toEqual(['Ширина рулона', '2,00 м']);
    expect(collection.features[3]?.cells.map((cell) => cell.html)).toEqual(['Класс применения', '34/43']);
  });

  it('gelster: line breaks inside a feature value are kept', () => {
    const collection = parseCollection(load('gelster.ru/coral-class.htm'), 'https://gelster.ru/coral-class.htm');
    expect(collection.features[3]?.cells[1]?.html).toBe('27,5 x 1,05 м<br>27,5 x 1,55 м<br>27,5 x 2,05 м<br>0,55 x 0,90 м<br>0,90 x 1,50 м<br>1,35 x 2,05 м<br>2,05 x 3,00 м');
  });

  it('gelster: main photo is the .big-background banner, not the .collection-review video cover', () => {
    const html = `<h1 class="name">x</h1><div class="gallery">
      <div class="collection-review" style="background-image: url(./img/video.jpg)"></div>
      <div
        class="big-background"
        style="
          background-image: url(./img/a/main.jpg);
        "
      ></div></div>`;
    const collection = parseCollection(html, 'https://gelster.ru/x.htm');
    expect(collection.mainImage).toBe('https://gelster.ru/img/a/main.jpg');
    expect(collection.warnings).not.toContain('Не найдено главное фото');
  });

  it.each([
    ['background-image: url("img/q.jpg")', 'https://gelster.ru/img/q.jpg'],
    ["background-image:url( 'img/q.jpg' );", 'https://gelster.ru/img/q.jpg'],
    ['background: #fff url(/img/q.jpg) no-repeat center / cover', 'https://gelster.ru/img/q.jpg'],
    ['BACKGROUND-IMAGE: URL(https://cdn.gelster.ru/q.jpg)', 'https://cdn.gelster.ru/q.jpg'],
  ])('gelster: main photo from style %s', (style, expected) => {
    const html = `<h1 class="name">x</h1><div class="big-background" style="${style.replaceAll('"', '&quot;')}"></div>`;
    expect(parseCollection(html, 'https://gelster.ru/x.htm').mainImage).toBe(expected);
  });

  it('gelster: lazy-loading attribute is the fallback when style has no url', () => {
    const html = '<h1 class="name">x</h1><div class="big-background" style="height: 10px" data-bg="./img/lazy.jpg"></div>';
    expect(parseCollection(html, 'https://gelster.ru/x.htm').mainImage).toBe('https://gelster.ru/img/lazy.jpg');
  });

  it('gelster: page without .big-background has no photo and a warning', () => {
    const html = '<h1 class="name">x</h1><div class="collection-review" style="background-image: url(v.jpg)"></div>';
    const collection = parseCollection(html, 'https://gelster.ru/x.htm');
    expect(collection.mainImage).toBeNull();
    expect(collection.warnings).toContain('Не найдено главное фото');
  });

  it('URLs resolve against the final address (X-Final-Url), www included', () => {
    const collection = parseCollection(load('ooogelingen.ru/m_cocoa.htm'), 'https://www.ooogelingen.ru/sub/m_cocoa.htm');
    expect(collection.articles[0]?.image).toBe('https://www.ooogelingen.ru/sub/Forbo/Marmoleum/Cocoa/3580.jpg');
  });

  it('gelster: kind falls back to the second-to-last breadcrumb', () => {
    const html = `<ul class="breadcrumbs"><li>Каталог</li><li>Коммерческий линолеум</li><li>Acczent</li></ul>
      <h1 class="name">acczent</h1><h2>acczent</h2>`;
    const collection = parseCollection(html, 'https://gelster.ru/acczent.htm');
    expect(collection.name).toBe('Acczent');
    expect(collection.flooringKind).toBe('Коммерческий линолеум');
  });

  it('partial page: missing fields are empty with warnings, nothing throws', () => {
    const html = '<h1>Something</h1><p>no collection markup</p>';
    const collection = parseCollection(html, 'https://ooogelingen.ru/x.htm');
    expect(collection).toMatchObject({ name: 'Something', flooringKind: '', manufacturer: '', descriptionHtml: '' });
    expect(collection.articles).toEqual([]);
    expect(collection.mainImage).toBeNull();
    expect(collection.warnings).toEqual([
      'Не найден вид покрытия: заголовок КП составлен без него',
      'Не найден производитель: заголовок КП составлен без него',
      'Не найдено описание коллекции',
      'Не найдено главное фото',
      'Не найдены артикулы',
      'Не найдены технические характеристики',
    ]);
  });

  it('throws only when there is no name, no articles and no description', () => {
    expect(() => parseCollection('<html><body><p>404</p></body></html>', 'https://gelster.ru/none.htm')).toThrow(
      NotACollectionError,
    );
    expect(() => parseCollection('', 'https://ooogelingen.ru/none.htm')).toThrow(/не похожа на коллекцию/);
  });

  it('rejects other sites and non-https addresses', () => {
    expect(() => parseCollection('<h1>x</h1>', 'https://example.com/a.htm')).toThrow(/только страницы/);
    expect(() => parseCollection('<h1>x</h1>', 'http://gelster.ru/a.htm')).toThrow(/только страницы/);
    expect(siteOf('https://gelster.ru.evil.com/a.htm')).toBeNull();
    expect(siteOf('https://WWW.Gelster.ru/a.htm')).toBe('gelster');
    expect(siteOf('not a url')).toBeNull();
  });

  it('page scripts and handlers never reach the output', () => {
    const html = `<article class="entry"><h1>X</h1><h2>Линолеум</h2>
      <div class="entry-text"><p onclick="alert(1)">Текст<script>alert(2)</script>
      <a href="javascript:alert(3)">ссылка</a> <a href="/page.htm" onmouseover="x()">ещё</a>
      <img src="x" onerror="alert(4)"><iframe src="https://evil"></iframe></p></div></article>
      <div class="collection-container"><div class="col-auto"><img src="Forbo/A/1.jpg"><span>1</span></div></div>
      <table class="caracter-table"><tr><th>Заголовок</th></tr>
      <tr><td><b onclick="x()">Имя</b></td><td colspan="2"><a href="vbscript:x">Значение</a></td></tr></table>`;
    const collection = parseCollection(html, 'https://ooogelingen.ru/a/b.htm');
    expect(collection.descriptionHtml).toBe(
      '<p>Текст <a>ссылка</a> <a href="https://ooogelingen.ru/page.htm">ещё</a></p>',
    );
    expect(collection.features).toEqual([
      { cells: [{ html: '<b>Имя</b>' }, { html: '<a>Значение</a>', colSpan: 2 }] },
    ]);
    expect(collection.articles).toEqual([{ code: '1', image: 'https://ooogelingen.ru/a/Forbo/A/1.jpg' }]);
    expect(collection.manufacturer).toBe('');
  });
});
