/**
 * DOCX editability (docs/spec.md, section 8), checked in the XML inside the file: named paragraph styles, Word
 * lists, real tables with cantSplit and repeated heads, pictures in cells and in the header and footer, embedded
 * fonts, and no text boxes or frames.
 */
import { readFileSync } from 'node:fs';
import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseCollection } from '../../shared/parsers/index.ts';
import type { Manager, Project } from '../../shared/schema.ts';
import { buildKpDocument, createInitialKp } from '../kp/model.ts';
import { buildDocxDocument, imageTypeOf, inlineRuns, type DocxAssets, type DocxImage, type FontFaces } from './docx.ts';

const MANAGER: Manager = { id: 'michael_smu', name: 'Михаил Смущенко', signature: 'api/data/signatures/michael_smu.jpg' };
const LINK = 'https://ooogelingen.ru/m_cocoa.htm';

function project(): Project {
  const html = readFileSync('shared/parsers/__fixtures__/ooogelingen.ru/m_cocoa.htm', 'utf8');
  const collection = parseCollection(html, LINK, '2026-11-01T00:00:00.000Z');
  const kp = createInitialKp(collection);
  const selectedArticles = collection.articles.slice(0, 5).map((a) => ({ ...a, caption: `Арт. ${a.code}` }));
  return {
    id: 'p1',
    version: 1,
    updatedAt: '2026-11-01T00:00:00.000Z',
    form: {
      managerId: MANAGER.id,
      managerName: MANAGER.name,
      client: 'Gelingen',
      clientName: 'Михаил',
      clientSex: 'm',
      link: LINK,
      euroRate: 100,
      mainCurrency: 'rubAndEuro',
      extraCurrency: 'rub',
      mainItems: [
        { id: 'a', name: 'Линолеум', qty: 150, unit: 'м²', priceRub: 100 },
        { id: 'b', name: 'Плинтус', qty: 40, unit: 'пог.м', priceRub: 300 },
      ],
      extraItems: [{ id: 'c', name: 'Укладка', qty: 1, unit: 'шт.', priceRub: 20000 }],
      delivery: { mode: 'custom', custom: ['Самовывоз со склада.', 'Оплата по счёту.'] },
    },
    collection,
    kp: {
      ...kp,
      selectedArticles,
      descriptionHtml:
        '<p>Абзац с <b>жирным</b>, <i>курсивом</i>, <u>подчёркнутым</u>, м<sup>2</sup>, H<sub>2</sub>O и ' +
        '<a href="https://gelster.ru/">ссылкой</a>.<br>Вторая строка.</p>' +
        '<ul><li>пункт раз</li><li>пункт два</li></ul><ol><li>первый</li><li>второй</li></ol>',
    },
  };
}

const jpeg = (file: string, width: number, height: number): DocxImage => ({
  data: new Uint8Array(readFileSync(file)),
  type: 'jpg',
  width,
  height,
});

function family(prefix: string): FontFaces {
  const read = (suffix: string) => new Uint8Array(readFileSync(`public/fonts/${prefix}-Web-${suffix}.ttf`));
  return { regular: read('Regular'), bold: read('Bold'), italic: read('Italic'), boldItalic: read('BoldItalic') };
}

function assets(doc: ReturnType<typeof buildKpDocument>, withFonts: boolean): DocxAssets {
  const images: Record<string, DocxImage> = {};
  for (const block of doc.blocks) {
    if (block.type === 'mainImage') images[block.src] = jpeg('public/footer.jpg', 794, 126);
    if (block.type === 'articleRow') for (const a of block.articles) images[a.image] = jpeg('public/footer.jpg', 794, 126);
  }
  return {
    images,
    header: jpeg('public/header.jpg', 2480, 620),
    signature: jpeg('api/seed/signatures/michael_smu.jpg', 1157, 97),
    fonts: withFonts ? { serif: family('PT_Serif'), sans: family('PT_Sans') } : null,
  };
}

async function build(withFonts = false) {
  const doc = buildKpDocument(project(), MANAGER, { now: new Date(2026, 10, 12) });
  const buffer = await Packer.toBuffer(buildDocxDocument(doc, assets(doc, withFonts)));
  const files = unzipSync(new Uint8Array(buffer));
  const text = (name: string) => {
    const file = files[name];
    if (!file) throw new Error(`${name} is not in the file`);
    return strFromU8(file);
  };
  return { doc, files, text, xml: text('word/document.xml') };
}

const count = (xml: string, pattern: RegExp) => (xml.match(pattern) ?? []).length;
const tables = (xml: string) => xml.split('<w:tbl>').slice(1).map((part) => part.split('</w:tbl>')[0] ?? '');

describe('buildDocx', () => {
  it('puts every paragraph of the body into a named style defined in styles.xml', async () => {
    const { xml, text } = await build();
    const styles = text('word/styles.xml');
    const paragraphs = xml.match(/<w:p>|<w:p [^>]*>/g) ?? [];
    const styled = xml.match(/<w:pStyle w:val="([^"]+)"\/>/g) ?? [];
    expect(paragraphs.length).toBeGreaterThan(20);
    expect(styled.length).toBe(paragraphs.length);
    for (const id of new Set(styled.map((s) => /w:val="([^"]+)"/.exec(s)?.[1]))) {
      expect(styles).toContain(`w:styleId="${id}"`);
    }
    expect(styles).toContain('<w:name w:val="КП Текст"/>');
    expect(styles).toContain('<w:name w:val="КП Заголовок"/>');
    expect(styles).toContain('<w:name w:val="КП Комментарий"/>');
    // PT Serif 11.5 pt is the text of the document.
    expect(styles).toMatch(/w:styleId="KpText".*?<w:rFonts w:ascii="PT Serif"[^>]*\/>.*?<w:sz w:val="23"\/>/s);
    // The look is in the styles: a body run carries no font or size of its own.
    expect(xml).not.toContain('<w:rFonts');
    expect(xml).not.toContain('<w:sz ');
  });

  it('makes list items Word lists, a new numbered list starting anew', async () => {
    const { xml, text } = await build();
    const numbering = text('word/numbering.xml');
    expect(numbering).toContain('w:val="bullet"');
    expect(numbering).toContain('w:val="decimal"');
    const items = xml.split('<w:p>').filter((p) => p.includes('<w:numPr>'));
    expect(items.map((p) => /<w:t[^>]*>([^<]*)<\/w:t>/.exec(p)?.[1])).toEqual(['пункт раз', 'пункт два', 'первый', 'второй']);
    expect(xml).not.toContain('•');
  });

  it('turns inline markup into formatted runs and a hyperlink', async () => {
    const { xml, text } = await build();
    expect(xml).toMatch(/<w:b\/>.*?<w:t[^>]*>жирным<\/w:t>/s);
    expect(xml).toMatch(/<w:i\/>.*?<w:t[^>]*>курсивом<\/w:t>/s);
    expect(xml).toMatch(/<w:u w:val="single"\/>.*?<w:t[^>]*>подчёркнутым<\/w:t>/s);
    expect(xml).toMatch(/<w:vertAlign w:val="superscript"\/>.*?<w:t[^>]*>2<\/w:t>/s);
    expect(xml).toMatch(/<w:vertAlign w:val="subscript"\/>.*?<w:t[^>]*>2<\/w:t>/s);
    expect(xml).toMatch(/<w:br\/>.*?Вторая строка\./s);
    expect(xml).toMatch(/<w:hyperlink [^>]*r:id="[^"]+"[^>]*>.*?ссылкой/s);
    expect(text('word/_rels/document.xml.rels')).toContain('Target="https://gelster.ru/"');
  });

  it('builds the article, feature and price tables as real tables: rows never split, heads repeat', async () => {
    const { doc, xml } = await build();
    const all = tables(xml);
    const features = doc.blocks.filter((b) => b.type === 'featureRow').length;
    // articles, features, main prices, extra prices, the grand total
    expect(all).toHaveLength(5);
    const [articles = '', featureTable = '', main = '', extra = '', total = ''] = all;
    expect(count(articles, /<w:tr>|<w:tr /g)).toBe(2); // 5 articles: rows of 4 and 1
    expect(count(articles, /<w:drawing>/g)).toBe(5);
    expect(articles).toContain('Арт. ');
    expect(count(featureTable, /<w:tr>|<w:tr /g)).toBe(features + 1);
    expect(count(main, /<w:tr>|<w:tr /g)).toBe(2 + 2);
    expect(count(extra, /<w:tr>|<w:tr /g)).toBe(1 + 2);
    expect(count(total, /<w:tr>|<w:tr /g)).toBe(1);
    for (const table of all) {
      const rows = count(table, /<w:tr>|<w:tr /g);
      expect(count(table, /<w:cantSplit\/>/g)).toBe(rows);
    }
    for (const table of [featureTable, main, extra]) {
      expect(count(table, /<w:tblHeader\/>/g)).toBe(1);
      expect(table.indexOf('<w:tblHeader/>')).toBeLessThan(table.indexOf('</w:tr>'));
    }
    // Euro column in the main table only; numbers are plain text.
    expect(main).toContain('евро');
    expect(extra).not.toContain('евро');
    expect(main).toContain('15\u00a0000,00');
  });

  it('floats the main photo beside the first paragraph, other pictures inline', async () => {
    const { xml } = await build();
    expect(count(xml, /<wp:anchor /g)).toBe(1);
    const anchor = xml.slice(xml.indexOf('<wp:anchor '), xml.indexOf('</wp:anchor>'));
    expect(anchor).toContain('<wp:wrapSquare');
    expect(anchor).toContain('relativeFrom="column"');
    expect(count(xml, /<wp:inline /g)).toBe(5);
  });

  it('places the header and the signature as pictures in the page header and footer, anchored to the sheet', async () => {
    const { xml, text, files } = await build();
    const rels = text('word/_rels/document.xml.rels');
    const headerName = /Type="[^"]*\/header" Target="([^"]+)"/.exec(rels)?.[1];
    const footerName = /Type="[^"]*\/footer" Target="([^"]+)"/.exec(rels)?.[1];
    expect(headerName).toBeTruthy();
    expect(footerName).toBeTruthy();
    for (const name of [headerName, footerName]) {
      const part = text(`word/${name}`);
      expect(part).toContain('<wp:anchor ');
      expect(part).toContain('behindDoc="1"');
      expect(part).toMatch(/<wp:positionH relativeFrom="page">/);
      expect(part).toMatch(/<wp:positionV relativeFrom="page">/);
      // Across the whole sheet: 210 mm = 7 560 000 EMU, within a pixel.
      const width = Number(/<wp:extent cx="(\d+)"/.exec(part)?.[1]);
      expect(Math.abs(width - 7_560_000)).toBeLessThan(9525);
    }
    expect(Object.keys(files).filter((name) => name.startsWith('word/media/')).length).toBeGreaterThanOrEqual(3);
    // A4, margins of the preview.
    expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
    expect(xml).toMatch(/<w:pgMar [^>]*w:left="1020"/);
    expect(xml).toMatch(/<w:pgMar [^>]*w:right="850"/);
  });

  it('has no text boxes, frames or VML shapes anywhere', async () => {
    const { files } = await build();
    for (const [name, bytes] of Object.entries(files)) {
      if (!name.endsWith('.xml')) continue;
      const part = strFromU8(bytes);
      expect(part, name).not.toContain('txbxContent');
      expect(part, name).not.toContain('<w:framePr');
      expect(part, name).not.toContain('<v:');
      expect(part, name).not.toContain('wps:wsp');
    }
  });

  it('embeds PT Serif and PT Sans as obfuscated fonts that decode back to the TTF files', async () => {
    const { files, text } = await build(true);
    const fontTable = text('word/fontTable.xml');
    const settings = text('word/settings.xml');
    expect(settings).toContain('<w:embedTrueTypeFonts/>');
    for (const name of ['PT Serif', 'PT Sans']) {
      const entry = new RegExp(`<w:font w:name="${name}">(.*?)</w:font>`, 's').exec(fontTable)?.[1] ?? '';
      for (const face of ['embedRegular', 'embedBold', 'embedItalic', 'embedBoldItalic']) expect(entry).toContain(`<w:${face} `);
    }
    // ECMA-376 obfuscation: the first 32 bytes XOR the reversed GUID key. Decoded, the file is the TTF again.
    const rels = text('word/_rels/fontTable.xml.rels');
    const regular = /<w:font w:name="PT Serif">.*?<w:embedRegular r:id="([^"]+)" w:fontKey="\{([^}]+)\}"/s.exec(fontTable);
    const target = new RegExp(`Id="${regular?.[1]}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? '';
    const odttf = files[`word/${target}`];
    expect(odttf).toBeDefined();
    const key = (regular?.[2] ?? '').replace(/-/g, '').match(/../g)?.map((h) => parseInt(h, 16)).reverse() ?? [];
    const decoded = Uint8Array.from(odttf ?? [], (byte, i) => (i < 32 ? byte ^ (key[i % 16] ?? 0) : byte));
    expect(Buffer.from(decoded).equals(readFileSync('public/fonts/PT_Serif-Web-Regular.ttf'))).toBe(true);
  });

  it('keeps the main photo inline in a paragraph of its own when there is no description', async () => {
    const base = project();
    const kp = { ...(base.kp as NonNullable<Project['kp']>), descriptionHtml: '' };
    const doc = buildKpDocument({ ...base, kp }, MANAGER, { now: new Date(2026, 10, 12) });
    const buffer = await Packer.toBuffer(buildDocxDocument(doc, assets(doc, false)));
    const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml'] ?? new Uint8Array());
    expect(count(xml, /<wp:anchor /g)).toBe(0);
    expect(xml).toMatch(/<w:pStyle w:val="KpImage"\/><\/w:pPr><w:r><w:drawing><wp:inline /);
  });

  it('a gelster.ru page gets its banner as the main photo floating beside the description', async () => {
    const url = 'https://gelster.ru/marmoleum_cocoa.htm';
    const html = readFileSync('shared/parsers/__fixtures__/gelster.ru/marmoleum_cocoa.htm', 'utf8');
    const collection = parseCollection(html, url, '2026-11-01T00:00:00.000Z');
    const base = project();
    const kp = { ...createInitialKp(collection), selectedArticles: [] };
    const doc = buildKpDocument({ ...base, form: { ...base.form, link: url }, collection, kp }, MANAGER, {
      now: new Date(2026, 10, 12),
    });
    const photo = 'https://gelster.ru/img/collections/marmoleum/m_cocoa/catalog-in-new_03.jpg';
    const at = doc.blocks.findIndex((block) => block.type === 'mainImage');
    expect(doc.blocks[at]).toMatchObject({ type: 'mainImage', src: photo });
    expect(doc.blocks[at + 1]?.type).toBe('paragraph');
    const buffer = await Packer.toBuffer(buildDocxDocument(doc, assets(doc, false)));
    const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml'] ?? new Uint8Array());
    expect(count(xml, /<wp:anchor /g)).toBe(1);
  });

  it('puts the client at a right tab stop of the date line', async () => {
    const { xml } = await build();
    expect(xml).toMatch(/<w:tab w:val="right" w:pos="10035"\/>.*?<w:tab\/><w:t[^>]*>для Gelingen<\/w:t>/s);
    expect(xml).not.toContain('\t');
  });

  it('merges feature cells with rowSpan and colSpan as Word does', async () => {
    const base = project();
    const kp = base.kp as NonNullable<Project['kp']>;
    const features = [
      { cells: [{ html: 'Размер', header: true, rowSpan: 2 }, { html: '2 м' }] },
      { cells: [{ html: '3 м' }] },
      { cells: [{ html: '<p>Класс</p><ul><li>34</li><li>43</li></ul>', colSpan: 2 }] },
    ];
    const doc = buildKpDocument({ ...base, kp: { ...kp, features } }, MANAGER, { now: new Date(2026, 10, 12) });
    const buffer = await Packer.toBuffer(buildDocxDocument(doc, { images: {}, header: null, signature: null, fonts: null }));
    const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml'] ?? new Uint8Array());
    const table = tables(xml)[1] ?? ''; // after the articles
    expect(table).toContain('<w:vMerge w:val="restart"/>');
    expect(table).toContain('<w:vMerge w:val="continue"/>');
    expect(table).toContain('<w:gridSpan w:val="2"/>');
    expect(count(table, /<w:numPr>/g)).toBe(2);
  });

  it('builds a file without fonts, pictures and a signature too', async () => {
    const doc = buildKpDocument({ ...project(), collection: null, kp: null }, null, { now: new Date(2026, 10, 12) });
    const buffer = await Packer.toBuffer(buildDocxDocument(doc, { images: {}, header: null, signature: null, fonts: null }));
    const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml'] ?? new Uint8Array());
    expect(xml).toContain('Уважаемый Михаил!');
    expect(xml).not.toContain('<w:drawing>');
  });
});

describe('inlineRuns', () => {
  it('drops unsafe links and keeps their text', async () => {
    const { Document, Paragraph } = await import('docx');
    const children = inlineRuns('<a href="javascript:alert(1)">тут</a> и <a href="https://gelster.ru/a">там</a>');
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ children })] }] }));
    const files = unzipSync(new Uint8Array(buffer));
    const xml = strFromU8(files['word/document.xml'] ?? new Uint8Array());
    expect(count(xml, /<w:hyperlink /g)).toBe(1);
    expect(xml).toContain('тут');
    expect(strFromU8(files['word/_rels/document.xml.rels'] ?? new Uint8Array())).not.toContain('javascript');
  });
});

describe('imageTypeOf', () => {
  it('recognises JPEG, PNG, GIF and BMP, nothing else', () => {
    expect(imageTypeOf(Uint8Array.of(0xff, 0xd8, 0xff))).toBe('jpg');
    expect(imageTypeOf(Uint8Array.of(0x89, 0x50, 0x4e, 0x47))).toBe('png');
    expect(imageTypeOf(Uint8Array.of(0x47, 0x49, 0x46, 0x38))).toBe('gif');
    expect(imageTypeOf(Uint8Array.of(0x42, 0x4d, 0, 0))).toBe('bmp');
    expect(imageTypeOf(new TextEncoder().encode('RIFF....WEBP'))).toBeNull();
  });
});
