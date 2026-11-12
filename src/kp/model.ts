/**
 * KP document model (docs/spec.md, section 8): a flat list of blocks in document order. The preview, the
 * pagination and the DOCX export are all built from it. Pure: no React, no storage, no network.
 */
import { calcForm, formatMoney, isValidRate, type CalcTable } from '../../shared/calc.ts';
import { buildKpTitle } from '../../shared/declension.ts';
import type { Collection, FeatureCell, KpEdits, Manager, Project } from '../../shared/schema.ts';

/** How many articles get into the KP until the manager picks them (the article picker is a separate card). */
export const DEFAULT_ARTICLES = 8;
export const ARTICLES_PER_ROW = 4;
export const DEFAULT_DELIVERY_COMMENT = 'Доставка до объекта рассчитывается отдельно.';

export type PriceTableId = 'main' | 'extra';
export type ParagraphList = 'none' | 'bullet' | 'number';

type BlockBase = {
  /** Stable between rebuilds: derived from the block's place in the source data, not from a counter. */
  id: string;
  /** The block must not be the last one on a page: it moves to the next page together with its successor. */
  keepWithNext: boolean;
  /** Table head: repeated at the top of the next page when its table is split. */
  repeatOnBreak: boolean;
  /** Blocks of one table share a group; on a page they are rendered as a single <table>. */
  group?: string;
};

export type KpBlock = BlockBase &
  (
    | { type: 'date'; date: string; client: string }
    | { type: 'title'; text: string }
    | { type: 'greeting'; text: string }
    | { type: 'intro'; text: string }
    | { type: 'collectionHeading'; text: string }
    | { type: 'mainImage'; src: string }
    | { type: 'paragraph'; html: string; list: ParagraphList; /** 1-based, for numbered items. */ number?: number }
    | { type: 'articleRow'; articles: { code: string; image: string; caption: string }[] }
    | { type: 'paletteLink'; url: string }
    | { type: 'featuresHead'; title: string }
    | { type: 'featureRow'; cells: FeatureCell[] }
    | { type: 'calcNote'; text: string }
    | { type: 'priceHead'; table: PriceTableId; title: string; showEuro: boolean }
    | {
        type: 'priceRow';
        table: PriceTableId;
        showEuro: boolean;
        no: string;
        name: string;
        qty: string;
        unit: string;
        priceEur: string;
        priceRub: string;
        sumRub: string;
      }
    | { type: 'priceFoot'; table: PriceTableId; showEuro: boolean; total: string }
    | { type: 'total'; total: string }
    | { type: 'comment'; text: string }
  );

export type KpBlockType = KpBlock['type'];

export type KpDocument = {
  /** «КП_<компания>_от_дд.мм.гг», without extension: document.title for printing and the DOCX name. */
  fileName: string;
  blocks: KpBlock[];
  /**
   * Whose signature closes every page. The page looks for the bytes in the image store under the manager id
   * first, then loads `url`; when both are missing it shows the common footer.jpg.
   */
  signature: { managerId: string | null; url: string | null };
  /** Shown above the pages, never printed. */
  warnings: string[];
};

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

/** «12» ноября 2026 г. */
export function formatKpDate(date: Date): string {
  return `«${date.getDate()}» ${MONTHS_GENITIVE[date.getMonth()] ?? ''} ${date.getFullYear()} г.`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** File name of the KP; characters that are not allowed in file names are replaced. */
export function buildFileName(client: string, date: Date): string {
  const company = client
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stamp = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${pad2(date.getFullYear() % 100)}`;
  return ['КП', company, 'от', stamp].filter((part) => part !== '').join('_');
}

function capitalizeWords(text: string): string {
  return text.replace(/(^|\s)(\S)/g, (_m, space: string, letter: string) => space + letter.toUpperCase());
}

export function buildGreeting(clientName: string, sex: 'm' | 'f'): string {
  const name = clientName.trim();
  return `Уважаем${sex === 'm' ? 'ый' : 'ая'}${name === '' ? '' : ` ${name}`}!`;
}

/** Without a flooring kind the collection name stands in its place. */
export function buildIntro(collection: Pick<Collection, 'flooringKind' | 'name'> | null): string {
  const subject = collection?.flooringKind.trim().toLowerCase() || collection?.name.trim() || 'напольное покрытие';
  return `Предлагаю Вам к рассмотрению ${subject}, а также сопутствующие материалы к нему.`;
}

/** «Натуральный линолеум с какао — Marmoleum Cocoa». */
export function buildCollectionHeading(collection: Pick<Collection, 'flooringKind' | 'name'> | null): string {
  if (!collection) return '';
  return [collection.flooringKind.trim(), capitalizeWords(collection.name.trim())]
    .filter((part) => part !== '')
    .join(' — ');
}

/**
 * Edits of a KP that has just been opened for the first time: everything derived from the form stays null
 * ("auto"), the rest is copied from the collection snapshot.
 */
export function createInitialKp(collection: Collection | null): KpEdits {
  const name = collection ? capitalizeWords(collection.name.trim()) : '';
  return {
    date: null,
    title: null,
    greeting: null,
    intro: null,
    collectionHeading: null,
    descriptionHtml: collection?.descriptionHtml ?? '',
    selectedArticles: (collection?.articles ?? []).slice(0, DEFAULT_ARTICLES).map((article) => ({
      code: article.code,
      image: article.image,
      caption: [article.code, article.title ?? ''].filter((part) => part.trim() !== '').join(' '),
    })),
    featuresTitle: `Технические характеристики${name === '' ? '' : ` ${name}`}:`,
    features: collection?.features ?? [],
    comments: [],
  };
}

type ParagraphData = { html: string; list: ParagraphList; number?: number };

/**
 * Splits the (already sanitized) description into paragraphs and list items: the unit of pagination is a
 * paragraph. Loose text and inline markup between block elements become plain paragraphs.
 */
export function splitDescription(html: string): ParagraphData[] {
  if (html.trim() === '') return [];
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const result: ParagraphData[] = [];
  let loose = '';
  const flushLoose = () => {
    if (loose.trim() !== '') result.push({ html: loose.trim(), list: 'none' });
    loose = '';
  };
  const isBlank = (element: Element) => (element.textContent ?? '').trim() === '';

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === 3) {
      loose += (node.textContent ?? '').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    const tag = element.tagName;
    if (tag === 'P' || tag === 'DIV') {
      flushLoose();
      if (!isBlank(element)) result.push({ html: element.innerHTML.trim(), list: 'none' });
    } else if (tag === 'UL' || tag === 'OL') {
      flushLoose();
      let number = 0;
      for (const item of Array.from(element.children)) {
        if (item.tagName !== 'LI' || isBlank(item)) continue;
        number += 1;
        result.push(
          tag === 'OL'
            ? { html: item.innerHTML.trim(), list: 'number', number }
            : { html: item.innerHTML.trim(), list: 'bullet' },
        );
      }
    } else {
      loose += element.outerHTML;
    }
  }
  flushLoose();
  return result;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** Comments under the tables: three delivery modes of the form, then the comments added on the KP page. */
export function buildComments(delivery: Project['form']['delivery'], extra: readonly string[]): string[] {
  const fromForm =
    delivery.mode === 'default' ? [DEFAULT_DELIVERY_COMMENT] : delivery.mode === 'custom' ? delivery.custom : [];
  return [...fromForm, ...extra].map((text) => text.trim()).filter((text) => text !== '');
}

function priceBlocks(id: PriceTableId, title: string, table: CalcTable, showEuro: boolean): KpBlock[] {
  if (table.rows.length === 0) return [];
  const group = `price-${id}`;
  const blocks: KpBlock[] = [
    { id: `${group}-head`, type: 'priceHead', table: id, title, showEuro, group, keepWithNext: true, repeatOnBreak: true },
  ];
  for (const row of table.rows) {
    blocks.push({
      id: `${group}-row-${row.item.id}`,
      type: 'priceRow',
      table: id,
      showEuro,
      no: `${row.no}.`,
      name: row.item.name.trim(),
      qty: formatMoney(row.item.qty ?? 0),
      unit: row.item.unit,
      priceEur: formatMoney(row.priceEur),
      priceRub: formatMoney(row.item.priceRub ?? 0),
      sumRub: formatMoney(row.sumRub),
      group,
      // The last row keeps the «Итого» line company on the next page.
      keepWithNext: row === table.rows[table.rows.length - 1],
      repeatOnBreak: false,
    });
  }
  blocks.push({
    id: `${group}-foot`,
    type: 'priceFoot',
    table: id,
    showEuro,
    total: formatMoney(table.totalRub),
    group,
    keepWithNext: false,
    repeatOnBreak: false,
  });
  return blocks;
}

function featureBlocks(title: string, rows: KpEdits['features']): KpBlock[] {
  const filled = rows.filter((row) => row.cells.length > 0);
  if (filled.length === 0) return [];
  const group = 'features';
  const blocks: KpBlock[] = [
    { id: 'features-head', type: 'featuresHead', title, group, keepWithNext: true, repeatOnBreak: true },
  ];
  // Rows joined by a rowSpan cell cannot be torn apart: a row keeps with the next one while a span is open.
  let openSpan = 0;
  filled.forEach((row, index) => {
    const span = Math.max(1, ...row.cells.map((cell) => cell.rowSpan ?? 1));
    openSpan = Math.max(openSpan - 1, span - 1);
    blocks.push({
      id: `feature-${index}`,
      type: 'featureRow',
      cells: row.cells,
      group,
      keepWithNext: openSpan > 0 && index < filled.length - 1,
      repeatOnBreak: false,
    });
  });
  return blocks;
}

export type BuildOptions = {
  /** "Today" for the automatic date and the file name; injected in tests. */
  now?: Date;
};

/**
 * Builds the document. `manager` is the entry of the current managers list for `form.managerId`, or null when
 * it is not there (removed, or the list could not be loaded).
 */
export function buildKpDocument(project: Project, manager: Manager | null, options: BuildOptions = {}): KpDocument {
  const now = options.now ?? new Date();
  const { form, collection } = project;
  const kp = project.kp ?? createInitialKp(collection);
  const warnings: string[] = [...(collection?.warnings ?? [])];
  const blocks: KpBlock[] = [];
  const plain = { keepWithNext: false, repeatOnBreak: false };
  const heading = { keepWithNext: true, repeatOnBreak: false };

  blocks.push({ id: 'date', type: 'date', date: kp.date ?? formatKpDate(now), client: form.client.trim(), ...plain });
  blocks.push({
    id: 'title',
    type: 'title',
    text: kp.title ?? buildKpTitle(collection?.flooringKind ?? '', collection?.manufacturer ?? ''),
    ...heading,
  });
  blocks.push({
    id: 'greeting',
    type: 'greeting',
    text: kp.greeting ?? buildGreeting(form.clientName, form.clientSex),
    ...heading,
  });
  blocks.push({ id: 'intro', type: 'intro', text: kp.intro ?? buildIntro(collection), ...plain });

  const collectionHeading = kp.collectionHeading ?? buildCollectionHeading(collection);
  if (collectionHeading !== '') {
    blocks.push({ id: 'collectionHeading', type: 'collectionHeading', text: collectionHeading, ...heading });
  }
  if (collection?.mainImage) {
    // The photo floats beside the text that follows it, so it never ends a page.
    blocks.push({ id: 'mainImage', type: 'mainImage', src: collection.mainImage, ...heading });
  }
  splitDescription(kp.descriptionHtml).forEach((paragraph, index) => {
    blocks.push({ id: `paragraph-${index}`, type: 'paragraph', ...paragraph, ...plain });
  });

  const articleRows = chunk(kp.selectedArticles, ARTICLES_PER_ROW);
  articleRows.forEach((articles, index) => {
    blocks.push({ id: `articles-${index}`, type: 'articleRow', articles, ...plain });
  });
  const paletteUrl = form.link.trim() || collection?.sourceUrl || '';
  if (paletteUrl !== '') {
    const last = blocks[blocks.length - 1];
    // The link is a caption of the palette: it stays under the last row of articles.
    if (last?.type === 'articleRow') last.keepWithNext = true;
    blocks.push({ id: 'paletteLink', type: 'paletteLink', url: paletteUrl, ...plain });
  }

  blocks.push(...featureBlocks(kp.featuresTitle, kp.features));

  const calc = calcForm(form);
  const rateOk = isValidRate(form.euroRate);
  const wantsEuro =
    (form.mainCurrency === 'rubAndEuro' && calc.main.rows.length > 0) ||
    (form.extraCurrency === 'rubAndEuro' && calc.extra.rows.length > 0);
  if (wantsEuro && !rateOk) warnings.push('Курс евро не задан: столбец с ценой в евро не показан.');
  const tables = [
    ...priceBlocks('main', 'Основные материалы', calc.main, rateOk && form.mainCurrency === 'rubAndEuro'),
    ...priceBlocks('extra', 'Дополнительные материалы', calc.extra, rateOk && form.extraCurrency === 'rubAndEuro'),
  ];
  if (tables.length > 0) {
    blocks.push({ id: 'calcNote', type: 'calcNote', text: 'Ниже приведены предварительные расчёты.', ...heading });
    blocks.push(...tables);
    blocks.push({ id: 'total', type: 'total', total: formatMoney(calc.totalRub), ...plain });
  }

  buildComments(form.delivery, kp.comments).forEach((text, index) => {
    blocks.push({ id: `comment-${index}`, type: 'comment', text, ...plain });
  });

  if (!collection) warnings.push('Страница коллекции не загружена: описание, артикулы и характеристики пустые.');
  if (form.managerId === '') warnings.push('Выберите менеджера в форме: на страницах стоит общая подпись.');
  else if (!manager) warnings.push(`Менеджер${form.managerName ? ` «${form.managerName}»` : ''} удалён из списка: используется сохранённая подпись.`);

  return {
    fileName: buildFileName(form.client, now),
    blocks,
    signature: { managerId: form.managerId === '' ? null : form.managerId, url: manager?.signature ?? null },
    warnings,
  };
}
