import { describe, expect, it } from 'vitest';
import { paginate, type PaginateBlock, type Placed } from './paginate.ts';

type TestBlock = PaginateBlock & { height: number };

function block(id: string, height: number, flags: Partial<PaginateBlock> = {}): TestBlock {
  return { id, height, keepWithNext: false, repeatOnBreak: false, ...flags };
}

/** Fake measurement: a page holds 100 units; a repeated head costs its height like any other block. */
function fits(items: readonly Placed<TestBlock>[]): boolean {
  return items.reduce((sum, item) => sum + item.block.height, 0) <= 100;
}

/** Pages as lists of ids; a repeated head is marked with «*», an overflowing page with «!». */
function layout(blocks: TestBlock[]): string[] {
  return paginate(blocks, fits).map(
    (page) => page.items.map((item) => item.block.id + (item.repeated ? '*' : '')).join(' ') + (page.overflow ? ' !' : ''),
  );
}

describe('paginate', () => {
  it('returns no pages for an empty document', () => {
    expect(paginate([], fits)).toEqual([]);
  });

  it('keeps everything on one page while it fits', () => {
    expect(layout([block('a', 40), block('b', 60)])).toEqual(['a b']);
  });

  it('moves the block that does not fit to a new page', () => {
    expect(layout([block('a', 40), block('b', 50), block('c', 30), block('d', 80)])).toEqual(['a b', 'c', 'd']);
  });

  it('moves keepWithNext blocks together with their successor', () => {
    const blocks = [block('a', 50), block('h1', 20, { keepWithNext: true }), block('h2', 20, { keepWithNext: true }), block('p', 30)];
    expect(layout(blocks)).toEqual(['a', 'h1 h2 p']);
  });

  it('breaks the keep rule when the chain does not fit on one page', () => {
    const blocks = [block('a', 30), block('h', 60, { keepWithNext: true }), block('p', 70)];
    expect(layout(blocks)).toEqual(['a h', 'p']);
  });

  it('does not emit an empty page when the whole page is a keep chain', () => {
    const blocks = [block('h', 60, { keepWithNext: true }), block('p', 70)];
    expect(layout(blocks)).toEqual(['h', 'p']);
  });

  it('repeats the table head on the next page', () => {
    const blocks = [
      block('a', 30),
      block('head', 10, { group: 't', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 30, { group: 't' }),
      block('r2', 30, { group: 't' }),
      block('r3', 30, { group: 't' }),
      block('r4', 30, { group: 't' }),
      block('after', 30),
    ];
    expect(layout(blocks)).toEqual(['a head r1 r2', 'head* r3 r4 after']);
  });

  it('moves the head itself, without a copy, when its first row does not fit', () => {
    const blocks = [
      block('a', 80),
      block('head', 10, { group: 't', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 30, { group: 't' }),
    ];
    expect(layout(blocks)).toEqual(['a', 'head r1']);
  });

  it('takes the last row along with the table foot and repeats the head', () => {
    const blocks = [
      block('head', 10, { group: 't', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 40, { group: 't' }),
      block('r2', 40, { group: 't', keepWithNext: true }),
      block('foot', 20, { group: 't' }),
    ];
    expect(layout(blocks)).toEqual(['head r1', 'head* r2 foot']);
  });

  it('does not repeat the head of another table', () => {
    const blocks = [
      block('head1', 10, { group: 't1', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 80, { group: 't1' }),
      block('head2', 10, { group: 't2', repeatOnBreak: true, keepWithNext: true }),
      block('q1', 50, { group: 't2' }),
      block('q2', 50, { group: 't2' }),
    ];
    expect(layout(blocks)).toEqual(['head1 r1', 'head2 q1', 'head2* q2']);
  });

  it('puts a block taller than the page alone on a page with the overflow mark', () => {
    expect(layout([block('a', 30), block('huge', 150), block('b', 30)])).toEqual(['a', 'huge !', 'b']);
    expect(layout([block('huge', 150)])).toEqual(['huge !']);
  });

  it('drops the repeated head when a row fits only without it, and restores it afterwards', () => {
    const blocks = [
      block('head', 10, { group: 't', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 80, { group: 't' }),
      block('tall', 95, { group: 't' }),
      block('r3', 20, { group: 't' }),
    ];
    expect(layout(blocks)).toEqual(['head r1', 'tall', 'head* r3']);
  });

  it('starts the page after an overflowing row with the head again', () => {
    const blocks = [
      block('head', 10, { group: 't', repeatOnBreak: true, keepWithNext: true }),
      block('r1', 20, { group: 't' }),
      block('huge', 150, { group: 't' }),
      block('r3', 20, { group: 't' }),
    ];
    expect(layout(blocks)).toEqual(['head r1', 'huge !', 'head* r3']);
  });

  it('places every block exactly once, in order', () => {
    const blocks = Array.from({ length: 40 }, (_, i) => block(`b${i}`, 7 + ((i * 13) % 45), { keepWithNext: i % 5 === 0 }));
    const placed = paginate(blocks, fits).flatMap((page) => page.items.filter((item) => !item.repeated).map((item) => item.block.id));
    expect(placed).toEqual(blocks.map((b) => b.id));
  });

  it('never leaves a page that fails the measurement, except overflow pages', () => {
    const blocks = Array.from({ length: 40 }, (_, i) => block(`b${i}`, 7 + ((i * 29) % 120), { keepWithNext: i % 3 === 0 }));
    for (const page of paginate(blocks, fits)) {
      expect(page.items.length).toBeGreaterThan(0);
      expect(fits(page.items)).toBe(!page.overflow);
    }
  });
});
