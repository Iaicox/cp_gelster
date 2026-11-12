/**
 * Groups the blocks of one page into what is rendered as one element: consecutive paragraphs → one text
 * column, consecutive article rows → one table, blocks of one table group → one <table>.
 */
import type { KpBlock } from '../model.ts';
import type { Placed } from '../paginate.ts';

type Of<T extends KpBlock['type']> = Extract<KpBlock, { type: T }>;

export type Segment =
  | { kind: 'single'; block: Exclude<KpBlock, Of<'paragraph' | 'articleRow'>> }
  | { kind: 'text'; paragraphs: Of<'paragraph'>[] }
  | { kind: 'articles'; rows: Of<'articleRow'>[] }
  | { kind: 'features'; head: Of<'featuresHead'> | null; rows: Of<'featureRow'>[] }
  | { kind: 'price'; head: Of<'priceHead'> | null; rows: Of<'priceRow'>[]; foot: Of<'priceFoot'> | null };

export type PageSegment = Segment & {
  key: string;
  /** A 19px gap above, as the `.br` spacers of the legacy page. */
  gapBefore: boolean;
};

function kindOf(block: KpBlock): Segment['kind'] {
  switch (block.type) {
    case 'paragraph':
      return 'text';
    case 'articleRow':
      return 'articles';
    case 'featuresHead':
    case 'featureRow':
      return 'features';
    case 'priceHead':
    case 'priceRow':
    case 'priceFoot':
      return 'price';
    default:
      return 'single';
  }
}

/** Which segments are separated from the previous one by a gap (never the first on a page, never after the note). */
function wantsGap(segment: Segment, previous: Segment | undefined): boolean {
  if (!previous) return false;
  if (previous.kind === 'single' && previous.block.type === 'calcNote') return false;
  if (segment.kind === 'features' || segment.kind === 'price') return true;
  return segment.kind === 'single' && (segment.block.type === 'total' || segment.block.type === 'comment');
}

export function toSegments(items: readonly Placed<KpBlock>[]): PageSegment[] {
  const segments: PageSegment[] = [];
  let groupOfLast: string | undefined;

  for (const { block, repeated } of items) {
    const kind = kindOf(block);
    const last = segments[segments.length - 1];
    const joins = last !== undefined && last.kind === kind && kind !== 'single' && groupOfLast === block.group;

    if (joins && last.kind === 'text' && block.type === 'paragraph') last.paragraphs.push(block);
    else if (joins && last.kind === 'articles' && block.type === 'articleRow') last.rows.push(block);
    else if (joins && last.kind === 'features' && block.type === 'featureRow') last.rows.push(block);
    else if (joins && last.kind === 'price' && block.type === 'priceRow') last.rows.push(block);
    else if (joins && last.kind === 'price' && block.type === 'priceFoot') last.foot = block;
    else {
      let segment: Segment;
      if (block.type === 'paragraph') segment = { kind: 'text', paragraphs: [block] };
      else if (block.type === 'articleRow') segment = { kind: 'articles', rows: [block] };
      else if (block.type === 'featuresHead') segment = { kind: 'features', head: block, rows: [] };
      else if (block.type === 'featureRow') segment = { kind: 'features', head: null, rows: [block] };
      else if (block.type === 'priceHead') segment = { kind: 'price', head: block, rows: [], foot: null };
      else if (block.type === 'priceRow') segment = { kind: 'price', head: null, rows: [block], foot: null };
      else if (block.type === 'priceFoot') segment = { kind: 'price', head: null, rows: [], foot: block };
      else segment = { kind: 'single', block };
      segments.push({ ...segment, key: block.id + (repeated ? '-repeat' : ''), gapBefore: wantsGap(segment, last) });
    }
    groupOfLast = block.group;
  }
  return segments;
}
