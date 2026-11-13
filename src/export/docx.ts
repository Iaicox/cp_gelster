/**
 * DOCX for editing by hand (docs/spec.md, section 8): built from the KP document model with the `docx` library,
 * in the browser. Text is in named paragraph styles («КП Текст», «КП Заголовок» …), lists are Word lists, the
 * article, feature and price tables are real tables (rows never split, heads repeated), the company header and
 * the manager's signature are pictures in the page header and footer, anchored to the sheet. No text boxes,
 * frames or text as pictures. Page breaks are left to Word.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  VerticalAlignTable,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
  type IBaseCharacterStyleOptions,
  type IBaseParagraphStyleOptions,
  type IBorderOptions,
  type IRunOptions,
  type ParagraphChild,
} from 'docx';
import { sanitizeHtml } from '../../shared/parsers/index.ts';
import { fetchAppFile } from '../api/client.ts';
import type { FeatureCell } from '../../shared/schema.ts';
import type { KpAssets } from '../kp/assets.ts';
import { splitDescription, type KpBlock, type KpDocument, type ParagraphList } from '../kp/model.ts';
import { footerHeightMm } from '../kp/Page.tsx';

type ImageType = 'jpg' | 'png' | 'gif' | 'bmp';
export type DocxImage = { data: Uint8Array; type: ImageType; width: number; height: number };

/** Faces of one font family as TTF bytes. */
export type FontFaces = { regular: Uint8Array; bold?: Uint8Array; italic?: Uint8Array; boldItalic?: Uint8Array };

export type DocxAssets = {
  /** By the image URL used in the document; a missing image is left out of the file. */
  images: Record<string, DocxImage>;
  /** The company header (header.jpg) and the signature strip; null: the header or footer stays empty. */
  header: DocxImage | null;
  signature: DocxImage | null;
  /** Embedded into the file when present; otherwise the fonts are referenced by name only. */
  fonts: { serif: FontFaces; sans: FontFaces } | null;
};

/* ---- units ---- */

const TWIPS_PER_MM = 1440 / 25.4;
const TWIPS_PER_PX = 15; // 1 CSS px = 0.75 pt
const EMU_PER_PX = 9525;
const PX_PER_MM = 96 / 25.4;
const mm = (value: number) => Math.round(value * TWIPS_PER_MM);
const px = (value: number) => Math.round(value * TWIPS_PER_PX);

/** Sizes of the preview (document.css, kp.css). */
const PAGE = { width: 210, height: 297, header: 52.5, left: 18, right: 15 };
const CONTENT_WIDTH = mm(PAGE.width - PAGE.left - PAGE.right);
const ARTICLE_BOX_MM = 40;
const ARTICLE_COLUMN = mm(ARTICLE_BOX_MM + 2);

const SERIF = 'PT Serif';
const SANS = 'PT Sans';

/* ---- styles ---- */

/** Paragraph style ids; their names are what the manager sees in Word. */
export const STYLE = {
  text: 'KpText',
  listItem: 'KpListItem',
  date: 'KpDate',
  title: 'KpTitle',
  greeting: 'KpGreeting',
  intro: 'KpIntro',
  collectionHeading: 'KpCollectionHeading',
  image: 'KpImage',
  caption: 'KpCaption',
  link: 'KpLink',
  calcNote: 'KpCalcNote',
  tableHead: 'KpTableHead',
  cell: 'KpCell',
  cellCenter: 'KpCellCenter',
  cellNumber: 'KpCellNumber',
  sum: 'KpSum',
  comment: 'KpComment',
  gap: 'KpGap',
  frame: 'KpPageFrame',
} as const;

const CHAR = { rub: 'KpRub', euro: 'KpEuro', collectionName: 'KpCollectionName' } as const;

const font = (name: string) => ({ ascii: name, hAnsi: name, cs: name, eastAsia: name });

const PARAGRAPH_STYLES: (IBaseParagraphStyleOptions & { id: string; name: string })[] = [
  {
    id: STYLE.text,
    name: 'КП Текст',
    quickFormat: true,
    run: { font: font(SERIF), size: 23 },
    paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: px(35) }, spacing: { before: 0, after: 0 } },
  },
  {
    id: STYLE.listItem,
    name: 'КП Пункт списка',
    basedOn: STYLE.text,
    quickFormat: true,
    paragraph: { indent: { firstLine: 0 } },
  },
  {
    id: STYLE.intro,
    name: 'КП Вступление',
    basedOn: STYLE.text,
    next: STYLE.text,
    paragraph: { spacing: { after: px(20) } },
  },
  {
    id: STYLE.date,
    name: 'КП Дата',
    next: STYLE.title,
    run: { font: font(SANS), size: 24, bold: true },
  },
  {
    id: STYLE.title,
    name: 'КП Заголовок',
    next: STYLE.greeting,
    quickFormat: true,
    run: { font: font(SANS), size: 28, bold: true },
    paragraph: { alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: px(20), after: px(30) } },
  },
  {
    id: STYLE.greeting,
    name: 'КП Обращение',
    next: STYLE.intro,
    run: { font: font(SERIF), size: 28, bold: true },
    paragraph: { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: px(10) } },
  },
  {
    id: STYLE.collectionHeading,
    name: 'КП Заголовок коллекции',
    next: STYLE.text,
    run: { font: font(SERIF), size: 28, bold: true, italics: true },
    paragraph: { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: px(10) } },
  },
  {
    id: STYLE.image,
    name: 'КП Картинка',
    run: { font: font(SANS), size: 22 },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 } },
  },
  {
    id: STYLE.caption,
    name: 'КП Подпись артикула',
    run: { font: font(SANS), size: 22, bold: true },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: px(3) } },
  },
  {
    id: STYLE.link,
    name: 'КП Ссылка на палитру',
    run: { font: font(SERIF), size: 22 },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: px(10) } },
  },
  {
    id: STYLE.calcNote,
    name: 'КП Расчёт',
    run: { font: font(SERIF), size: 22, bold: true, color: 'E36C0A' },
    paragraph: { keepNext: true, indent: { left: px(40) }, spacing: { before: px(35), after: px(9) } },
  },
  {
    id: STYLE.tableHead,
    name: 'КП Шапка таблицы',
    run: { font: font(SANS), size: 22, bold: true },
    paragraph: { alignment: AlignmentType.CENTER },
  },
  { id: STYLE.cell, name: 'КП Ячейка', run: { font: font(SANS), size: 22 } },
  { id: STYLE.cellCenter, name: 'КП Ячейка по центру', basedOn: STYLE.cell, paragraph: { alignment: AlignmentType.CENTER } },
  { id: STYLE.cellNumber, name: 'КП Ячейка число', basedOn: STYLE.cell, paragraph: { alignment: AlignmentType.RIGHT } },
  {
    id: STYLE.sum,
    name: 'КП Итог',
    basedOn: STYLE.tableHead,
    paragraph: { alignment: AlignmentType.RIGHT },
  },
  {
    id: STYLE.comment,
    name: 'КП Комментарий',
    quickFormat: true,
    run: { font: font(SANS), size: 22 },
    paragraph: { indent: { left: px(30) } },
  },
  {
    // Between blocks: the 19px gaps of the preview. It also keeps two tables in a row from merging into one.
    id: STYLE.gap,
    name: 'КП Отступ',
    run: { size: 4 },
    paragraph: { spacing: { before: 0, after: 0, line: px(19), lineRule: 'exact' } },
  },
  {
    id: STYLE.frame,
    name: 'КП Бланк',
    run: { size: 2 },
    paragraph: { spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' } },
  },
];

const CHARACTER_STYLES: (IBaseCharacterStyleOptions & { id: string; name: string })[] = [
  { id: CHAR.rub, name: 'КП Рубли', run: { color: '0070C0' } },
  { id: CHAR.euro, name: 'КП Евро', run: { color: 'C00000' } },
  { id: CHAR.collectionName, name: 'КП Название коллекции', run: { color: '9E791D', italics: false } },
];

const LISTS = { bullet: 'kp-bullet', number: 'kp-number' } as const;
const LIST_INDENT = { left: px(20) + 283, hanging: 283 };

/* ---- inline markup → runs ---- */

type Format = Pick<IRunOptions, 'bold' | 'italics' | 'underline' | 'superScript' | 'subScript'>;
type Piece = { text: string; format: Format; link: string | null } | { br: true; format: Format; link: string | null };

function safeLink(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Walks the DOM of a fragment of sanitized HTML: b, i, u, sup, sub, a, br become formatted runs. */
function collectPieces(node: Node, format: Format, link: string | null, out: Piece[]): void {
  if (node.nodeType === 3) {
    // HTML whitespace collapses; a no-break space (U+00A0) does not.
    const text = (node.textContent ?? '').replace(/[ \t\n\r\f]+/g, ' ');
    if (text !== '') out.push({ text, format, link });
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  const next = { ...format };
  let nextLink = link;
  switch (element.tagName) {
    case 'BR':
      out.push({ br: true, format, link });
      return;
    case 'B':
    case 'STRONG':
      next.bold = true;
      break;
    case 'I':
    case 'EM':
      next.italics = true;
      break;
    case 'U':
      next.underline = {};
      break;
    case 'SUP':
      next.superScript = true;
      break;
    case 'SUB':
      next.subScript = true;
      break;
    case 'A':
      nextLink = safeLink(element.getAttribute('href')) ?? link;
      break;
    default:
      break;
  }
  for (const child of Array.from(element.childNodes)) collectPieces(child, next, nextLink, out);
}

function toRun(piece: Piece): TextRun {
  const style = piece.link ? { style: 'Hyperlink' } : {};
  return 'br' in piece ? new TextRun({ break: 1, ...piece.format }) : new TextRun({ text: piece.text, ...piece.format, ...style });
}

/** Runs of an HTML fragment; neighbouring pieces of one link share a hyperlink. */
export function inlineRuns(html: string): ParagraphChild[] {
  const body = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html').body;
  const pieces: Piece[] = [];
  for (const child of Array.from(body.childNodes)) collectPieces(child, {}, null, pieces);
  // Spaces at the edges of a paragraph and around line breaks are not shown by a browser either.
  const first = pieces[0];
  if (first && 'text' in first) first.text = first.text.trimStart();
  const last = pieces[pieces.length - 1];
  if (last && 'text' in last) last.text = last.text.trimEnd();
  const children: ParagraphChild[] = [];
  let i = 0;
  while (i < pieces.length) {
    const piece = pieces[i] as Piece;
    if ('text' in piece && piece.text === '') {
      i += 1;
      continue;
    }
    if (piece.link === null) {
      children.push(toRun(piece));
      i += 1;
      continue;
    }
    const link = piece.link;
    const runs: TextRun[] = [];
    while (i < pieces.length && (pieces[i] as Piece).link === link) runs.push(toRun(pieces[i++] as Piece));
    children.push(new ExternalHyperlink({ link, children: runs }));
  }
  return children;
}

const plain = (text: string) => [new TextRun(text)];

/* ---- lists ---- */

/** Keeps track of numbered lists: every numbered list in Word is a new instance, so it starts from 1. */
class ListCounter {
  private instance = 0;
  private previous: ParagraphList = 'none';

  numbering(list: ParagraphList, number?: number): { reference: string; level: number; instance?: number } | undefined {
    const previous = this.previous;
    this.previous = list;
    if (list === 'none') return undefined;
    if (list === 'bullet') return { reference: LISTS.bullet, level: 0 };
    if (previous !== 'number' || number === 1) this.instance += 1;
    return { reference: LISTS.number, level: 0, instance: this.instance };
  }

  /** Something other than a list item came between: the next numbered list starts anew. */
  reset(): void {
    this.previous = 'none';
  }
}

function textParagraph(
  html: string,
  list: ParagraphList,
  number: number | undefined,
  lists: ListCounter,
  styles: { plain: string; item: string },
  before: ParagraphChild[] = [],
): Paragraph {
  const numbering = lists.numbering(list, number);
  return new Paragraph({
    style: list === 'none' ? styles.plain : styles.item,
    ...(numbering ? { numbering } : {}),
    children: [...before, ...inlineRuns(html)],
  });
}

/* ---- images ---- */

/** Size in px (96 dpi) that fits into a box, keeping the proportions. */
function fit(image: DocxImage, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (image.width <= 0 || image.height <= 0) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
}

function imageRun(image: DocxImage, size: { width: number; height: number }, name: string): ImageRun {
  return new ImageRun({ type: image.type, data: image.data, transformation: size, altText: { name, description: name, title: name } });
}

/**
 * The main photo, a third of the column wide (as .mainContent-img). Floating: at the left of the paragraph it is
 * anchored in, the text flows around it. Without a paragraph to float in it is an ordinary inline picture.
 */
function mainPhoto(image: DocxImage, floating: boolean): ImageRun {
  const widthMm = (PAGE.width - PAGE.left - PAGE.right) / 3 - 15 / PX_PER_MM;
  const width = Math.round(widthMm * PX_PER_MM);
  const size = fit(image, width, width * 4);
  if (!floating) return imageRun(image, size, 'Фото коллекции');
  const gap = 15 * EMU_PER_PX;
  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: size,
    altText: { name: 'Фото коллекции', description: 'Фото коллекции', title: 'Фото коллекции' },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: 0 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
      wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.RIGHT },
      margins: { top: 0, left: 0, right: gap, bottom: gap },
      allowOverlap: false,
      lockAnchor: false,
    },
  });
}

/** A picture across the whole sheet, at its top or bottom edge, behind the text of the page. */
function sheetStrip(image: DocxImage, edge: 'top' | 'bottom', name: string): Paragraph {
  const width = Math.round(PAGE.width * PX_PER_MM);
  const height = image.width > 0 ? Math.round((width * image.height) / image.width) : Math.round(17.5 * PX_PER_MM);
  return new Paragraph({
    style: STYLE.frame,
    children: [
      new ImageRun({
        type: image.type,
        data: image.data,
        transformation: { width, height },
        altText: { name, description: name, title: name },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition:
            edge === 'top'
              ? { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }
              : { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.BOTTOM },
          behindDocument: true,
          allowOverlap: true,
          lockAnchor: true,
          wrap: { type: TextWrappingType.NONE },
        },
      }),
    ],
  });
}

/* ---- tables ---- */

const LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const DOUBLE: IBorderOptions = { style: BorderStyle.DOUBLE, size: 4, color: 'BBBBBB' };
const borders = (line: IBorderOptions) => ({
  top: line,
  bottom: line,
  left: line,
  right: line,
  insideHorizontal: line,
  insideVertical: line,
});
const CELL_MARGINS = { top: px(3), bottom: px(3), left: px(5), right: px(5) };

function cell(children: Paragraph[], options: { columnSpan?: number; rowSpan?: number; width?: number } = {}): TableCell {
  return new TableCell({
    children: children.length > 0 ? children : [new Paragraph({ style: STYLE.cell })],
    verticalAlign: VerticalAlignTable.CENTER,
    ...(options.columnSpan && options.columnSpan > 1 ? { columnSpan: options.columnSpan } : {}),
    ...(options.rowSpan && options.rowSpan > 1 ? { rowSpan: options.rowSpan } : {}),
    ...(options.width ? { width: { size: options.width, type: WidthType.DXA } } : {}),
  });
}

const para = (style: string, children: ParagraphChild[]) => new Paragraph({ style, children });

function table(rows: TableRow[], columnWidths: number[], line: IBorderOptions, centered = false): Table {
  return new Table({
    rows,
    columnWidths,
    width: { size: columnWidths.reduce((sum, w) => sum + w, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: borders(line),
    margins: CELL_MARGINS,
    ...(centered ? { alignment: AlignmentType.CENTER } : {}),
  });
}

type Of<T extends KpBlock['type']> = Extract<KpBlock, { type: T }>;

function articlesTable(rows: Of<'articleRow'>[], assets: DocxAssets): Table {
  const columns = Math.max(1, ...rows.map((row) => row.articles.length));
  const box = Math.round(ARTICLE_BOX_MM * PX_PER_MM);
  const tableRows = rows.map(
    (row) =>
      new TableRow({
        cantSplit: true,
        children: Array.from({ length: columns }, (_, index) => {
          const article = row.articles[index];
          if (!article) return cell([], { width: ARTICLE_COLUMN });
          const image = assets.images[article.image];
          return cell(
            [
              para(STYLE.image, image ? [imageRun(image, fit(image, box, box), article.caption || article.code)] : []),
              para(STYLE.caption, plain(article.caption)),
            ],
            { width: ARTICLE_COLUMN },
          );
        }),
      }),
  );
  return table(tableRows, Array<number>(columns).fill(ARTICLE_COLUMN), LINE, true);
}

/** A feature cell: its paragraphs and list items (already sanitized HTML). */
function featureCellParagraphs(featureCell: FeatureCell, lists: ListCounter): Paragraph[] {
  const style = featureCell.header ? STYLE.tableHead : STYLE.cell;
  const parts = splitDescription(featureCell.html);
  lists.reset();
  return parts.map((part) => textParagraph(part.html, part.list, part.number, lists, { plain: style, item: style }));
}

function featuresTable(head: Of<'featuresHead'> | null, rows: Of<'featureRow'>[], lists: ListCounter): Table {
  const columns = Math.max(head?.columns ?? 1, ...rows.map((row) => row.cells.reduce((sum, c) => sum + (c.colSpan ?? 1), 0)));
  const width = Math.floor(CONTENT_WIDTH / columns);
  const tableRows: TableRow[] = [];
  if (head) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [cell([para(STYLE.tableHead, plain(head.title))], { columnSpan: columns })],
      }),
    );
  }
  for (const row of rows) {
    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: row.cells.map((c) =>
          cell(featureCellParagraphs(c, lists), { columnSpan: c.colSpan ?? 1, rowSpan: c.rowSpan ?? 1 }),
        ),
      }),
    );
  }
  return table(tableRows, Array<number>(columns).fill(width), DOUBLE);
}

const rub = () => new TextRun({ text: 'руб.', style: CHAR.rub });

function priceTable(head: Of<'priceHead'> | null, rows: Of<'priceRow'>[], foot: Of<'priceFoot'> | null): Table | null {
  const any = head ?? rows[0] ?? foot;
  if (!any) return null;
  const { showEuro } = any;
  const fixed = showEuro ? [px(35), px(90), px(55), px(90), px(90), px(110)] : [px(35), px(90), px(55), px(90), px(110)];
  const nameWidth = CONTENT_WIDTH - fixed.reduce((sum, w) => sum + w, 0);
  const widths = [fixed[0] as number, nameWidth, ...fixed.slice(1)];
  const headCell = (children: ParagraphChild[]) => cell([para(STYLE.tableHead, children)]);
  const tableRows: TableRow[] = [];
  if (head) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          headCell(plain('№')),
          headCell(plain(head.title)),
          headCell(plain('Кол-во')),
          headCell([new TextRun('Ед.'), new TextRun({ break: 1, text: 'изм.' })]),
          ...(showEuro ? [headCell([new TextRun('Цена в '), new TextRun({ text: 'евро', style: CHAR.euro })])] : []),
          headCell([new TextRun('Цена в '), rub()]),
          headCell([new TextRun('Сумма, в '), rub(), new TextRun({ break: 1, text: 'с НДС' })]),
        ],
      }),
    );
  }
  for (const row of rows) {
    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          headCell(plain(row.no)),
          cell([para(STYLE.cell, plain(row.name))]),
          cell([para(STYLE.cellCenter, plain(row.qty))]),
          cell([para(STYLE.cellCenter, plain(row.unit))]),
          ...(showEuro ? [cell([para(STYLE.cellNumber, plain(row.priceEur))])] : []),
          cell([para(STYLE.cellNumber, plain(row.priceRub))]),
          cell([para(STYLE.cellNumber, plain(row.sumRub))]),
        ],
      }),
    );
  }
  if (foot) {
    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell([para(STYLE.sum, [new TextRun('Итого в '), rub(), new TextRun(', с НДС:')])], {
            columnSpan: widths.length - 1,
          }),
          cell([para(STYLE.sum, plain(foot.total))]),
        ],
      }),
    );
  }
  return table(tableRows, widths, LINE);
}

function totalTable(block: Of<'total'>): Table {
  const last = px(110);
  return table(
    [
      new TableRow({
        cantSplit: true,
        children: [
          cell([para(STYLE.sum, [new TextRun('Общая сумма по позициям в '), rub(), new TextRun(', с НДС:')])]),
          cell([para(STYLE.sum, plain(block.total))]),
        ],
      }),
    ],
    [CONTENT_WIDTH - last, last],
    LINE,
  );
}

/* ---- body ---- */

type BodyItem = Paragraph | Table;

const NBSP = String.fromCharCode(0xa0);

/** «Вид покрытия — Название»: the name in the brand colour, as in the preview. */
function headingRuns(text: string): ParagraphChild[] {
  const dash = text.indexOf(' — ');
  if (dash < 0) return plain(text);
  return [
    new TextRun(`${text.slice(0, dash)}${NBSP}—${NBSP}`),
    new TextRun({ text: text.slice(dash + 3), style: CHAR.collectionName }),
  ];
}

function body(doc: KpDocument, assets: DocxAssets): BodyItem[] {
  const items: BodyItem[] = [];
  const lists = new ListCounter();
  const blocks = doc.blocks;
  /** The main photo waits for the paragraph it floats in. */
  let photo: DocxImage | null = null;
  let previous: KpBlock['type'] | null = null;

  const gap = () => items.push(new Paragraph({ style: STYLE.gap }));
  const flushPhoto = () => {
    if (photo) items.push(new Paragraph({ style: STYLE.image, children: [mainPhoto(photo, false)] }));
    photo = null;
  };

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i] as KpBlock;
    if (block.type !== 'paragraph') lists.reset();
    if (block.type !== 'paragraph' && block.type !== 'mainImage') flushPhoto();
    // A table must not touch another table (Word merges them) and gets the preview's gap above.
    const isTable = ['articleRow', 'featuresHead', 'featureRow', 'priceHead', 'priceRow', 'priceFoot', 'total'].includes(block.type);
    if (isTable && previous !== null && previous !== 'calcNote' && block.group !== (blocks[i - 1] as KpBlock).group) gap();
    else if (block.type === 'comment' && previous !== null && previous !== 'comment') gap();

    switch (block.type) {
      case 'date':
        // The client stands at the right edge, as in the preview: a right tab stop (styles cannot hold tab stops).
        items.push(
          new Paragraph({
            style: STYLE.date,
            tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
            children: [
              new TextRun(block.date),
              ...(block.client === '' ? [] : [new TextRun({ children: [new Tab(), `для ${block.client}`] })]),
            ],
          }),
        );
        break;
      case 'title':
        items.push(para(STYLE.title, plain(block.text)));
        break;
      case 'greeting':
        items.push(para(STYLE.greeting, plain(block.text)));
        break;
      case 'intro':
        items.push(para(STYLE.intro, plain(block.text)));
        break;
      case 'collectionHeading':
        items.push(para(STYLE.collectionHeading, headingRuns(block.text)));
        break;
      case 'mainImage': {
        const image = assets.images[block.src];
        if (image) photo = image;
        break;
      }
      case 'paragraph': {
        const before: ParagraphChild[] = photo ? [mainPhoto(photo, true)] : [];
        photo = null;
        items.push(
          textParagraph(block.html, block.list, block.number, lists, { plain: STYLE.text, item: STYLE.listItem }, before),
        );
        break;
      }
      case 'articleRow': {
        const rows: Of<'articleRow'>[] = [];
        while (i < blocks.length && (blocks[i] as KpBlock).type === 'articleRow') rows.push(blocks[i++] as Of<'articleRow'>);
        items.push(articlesTable(rows, assets));
        previous = 'articleRow';
        continue;
      }
      case 'paletteLink': {
        const link = safeLink(block.url);
        const lead = new TextRun(`${block.text} `);
        items.push(
          para(STYLE.link, [
            lead,
            link ? new ExternalHyperlink({ link, children: [new TextRun({ text: block.url, style: 'Hyperlink' })] }) : new TextRun(block.url),
          ]),
        );
        break;
      }
      case 'featuresHead':
      case 'featureRow': {
        const head = block.type === 'featuresHead' ? block : null;
        if (head) i += 1;
        const rows: Of<'featureRow'>[] = [];
        while (i < blocks.length && (blocks[i] as KpBlock).type === 'featureRow') rows.push(blocks[i++] as Of<'featureRow'>);
        items.push(featuresTable(head, rows, lists));
        lists.reset();
        previous = 'featureRow';
        continue;
      }
      case 'calcNote':
        items.push(para(STYLE.calcNote, plain(block.text)));
        break;
      case 'priceHead':
      case 'priceRow':
      case 'priceFoot': {
        const group = block.group;
        let head: Of<'priceHead'> | null = null;
        let foot: Of<'priceFoot'> | null = null;
        const rows: Of<'priceRow'>[] = [];
        while (i < blocks.length && (blocks[i] as KpBlock).group === group) {
          const part = blocks[i++] as KpBlock;
          if (part.type === 'priceHead') head = part;
          else if (part.type === 'priceRow') rows.push(part);
          else if (part.type === 'priceFoot') foot = part;
        }
        const built = priceTable(head, rows, foot);
        if (built) items.push(built);
        previous = 'priceFoot';
        continue;
      }
      case 'total':
        items.push(totalTable(block));
        break;
      case 'comment':
        items.push(para(STYLE.comment, plain(`— ${block.text}`)));
        break;
    }
    previous = block.type;
    i += 1;
  }
  flushPhoto();
  // Word wants a paragraph after the last table of a document.
  if (items.length === 0 || items[items.length - 1] instanceof Table) items.push(new Paragraph({ style: STYLE.text }));
  return items;
}

function embeddedFonts(fonts: DocxAssets['fonts']) {
  if (!fonts) return undefined;
  // The library takes Buffer in its types and works with any Uint8Array (it is a browser build too).
  const family = (name: string, faces: FontFaces) => ({
    name,
    data: faces.regular as Buffer,
    ...(faces.bold ? { bold: faces.bold as Buffer } : {}),
    ...(faces.italic ? { italic: faces.italic as Buffer } : {}),
    ...(faces.boldItalic ? { boldItalic: faces.boldItalic as Buffer } : {}),
  });
  return [family(SERIF, fonts.serif), family(SANS, fonts.sans)];
}

/** The document object (for tests); buildDocx() packs it. */
export function buildDocxDocument(doc: KpDocument, assets: DocxAssets): Document {
  const footerMm = footerHeightMm(assets.signature ?? { width: 0, height: 0 });
  const fonts = embeddedFonts(assets.fonts);
  return new Document({
    title: doc.fileName,
    creator: 'Генератор КП Гельстер',
    ...(fonts ? { fonts } : {}),
    styles: {
      default: {
        document: { run: { font: font(SERIF), size: 23 } },
      },
      paragraphStyles: PARAGRAPH_STYLES,
      characterStyles: CHARACTER_STYLES,
    },
    numbering: {
      config: [
        {
          reference: LISTS.bullet,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: LIST_INDENT } },
            },
          ],
        },
        {
          reference: LISTS.number,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: LIST_INDENT } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: mm(PAGE.width), height: mm(PAGE.height) },
            margin: {
              top: mm(PAGE.header) + px(20),
              bottom: mm(footerMm) + px(15),
              left: mm(PAGE.left),
              right: mm(PAGE.right),
              header: mm(5),
              footer: mm(5),
            },
          },
        },
        headers: {
          default: new Header({
            children: [assets.header ? sheetStrip(assets.header, 'top', 'Гельстер') : new Paragraph({ style: STYLE.frame })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              assets.signature ? sheetStrip(assets.signature, 'bottom', 'Подпись менеджера') : new Paragraph({ style: STYLE.frame }),
            ],
          }),
        },
        children: body(doc, assets),
      },
    ],
  });
}

export function buildDocx(doc: KpDocument, assets: DocxAssets): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(doc, assets));
}

/* ---- loading in the browser ---- */

export function imageTypeOf(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

/** Bytes of an image Word can show; another format (WebP, for one) is redrawn as PNG. */
async function readImage(src: string, size?: { width: number; height: number }): Promise<DocxImage> {
  const data = await fetchAppFile(src);
  const type = imageTypeOf(data);
  const bitmap = !size || type === null ? await createImageBitmap(new Blob([data as BlobPart])) : null;
  const width = size?.width ?? bitmap?.width ?? 0;
  const height = size?.height ?? bitmap?.height ?? 0;
  if (type !== null) {
    bitmap?.close();
    return { data, type, width, height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap as ImageBitmap, 0, 0);
  bitmap?.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error(`${src}: не удалось перевести в PNG`);
  return { data: new Uint8Array(await png.arrayBuffer()), type: 'png', width, height };
}

const FONT_FILES = {
  regular: 'Regular',
  bold: 'Bold',
  italic: 'Italic',
  boldItalic: 'BoldItalic',
} as const;

async function loadFamily(prefix: string): Promise<FontFaces> {
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([face, suffix]) => [face, await fetchAppFile(`fonts/${prefix}-Web-${suffix}.ttf`)] as const),
  );
  return Object.fromEntries(entries) as FontFaces;
}

/**
 * Everything the DOCX needs, from what the KP page has already loaded: the images came from the image store
 * or through the API client (kp/assets.ts); they are read back from their object URLs. A missing picture or
 * font does not stop the export: the file is built without it.
 */
export async function loadDocxAssets(kp: KpAssets): Promise<DocxAssets> {
  const images: Record<string, DocxImage> = {};
  await Promise.all(
    Object.entries(kp.images).map(async ([url, image]) => {
      try {
        images[url] = await readImage(image.src, image);
      } catch {
        // left out, as on the page
      }
    }),
  );
  const optional = <T>(promise: Promise<T>) => promise.catch(() => null);
  const [header, signature, serif, sans] = await Promise.all([
    optional(readImage('header.jpg')),
    optional(readImage(kp.signature.src, kp.signature.width > 0 ? kp.signature : undefined)),
    optional(loadFamily('PT_Serif')),
    optional(loadFamily('PT_Sans')),
  ]);
  return { images, header, signature, fonts: serif && sans ? { serif, sans } : null };
}
