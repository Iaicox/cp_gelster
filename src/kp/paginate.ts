/**
 * Pure page breaking (docs/spec.md, section 8). Knows nothing about the DOM: the caller passes `fits`, which
 * renders a whole candidate page with the real components and says whether it is not taller than the page.
 */

export type PaginateBlock = {
  id: string;
  keepWithNext: boolean;
  repeatOnBreak: boolean;
  /** Blocks of one table; the table head (repeatOnBreak) is repeated when the group continues on a new page. */
  group?: string;
};

export type Placed<B> = {
  block: B;
  /** A copy of a table head put at the top of a page where its table continues. */
  repeated: boolean;
};

export type Page<B> = {
  items: Placed<B>[];
  /** The only block of the page is taller than the page; the excess is clipped and a warning is shown. */
  overflow: boolean;
};

export function paginate<B extends PaginateBlock>(
  blocks: readonly B[],
  fits: (items: readonly Placed<B>[]) => boolean,
): Page<B>[] {
  const pages: Page<B>[] = [];
  const heads = new Map<string, B>();
  let current: Placed<B>[] = [];

  /** The head to repeat before `block` on a page that already holds `items`. */
  const headFor = (block: B, items: readonly Placed<B>[]): Placed<B>[] => {
    const head = block.group === undefined ? undefined : heads.get(block.group);
    if (!head || head === block || items.some((item) => item.block === head)) return [];
    return [{ block: head, repeated: true }];
  };

  for (const block of blocks) {
    if (block.repeatOnBreak && block.group !== undefined) heads.set(block.group, block);
    const placed: Placed<B> = { block, repeated: false };

    // A fresh page in the middle of a table (after an overflowing row) starts with the head again.
    const appended = [...current, ...(current.length === 0 ? headFor(block, []) : []), placed];
    if (fits(appended)) {
      current = appended;
      continue;
    }

    // Trailing keepWithNext blocks go to the next page together with the block that did not fit.
    let cut = current.length;
    while (cut > 0 && current[cut - 1]?.block.keepWithNext) cut -= 1;
    const moved = current.slice(cut);

    const candidates: { previous: Placed<B>[]; next: Placed<B>[] }[] = [];
    if (cut > 0 && moved.length > 0) {
      candidates.push({ previous: current.slice(0, cut), next: [...headFor(block, moved), ...moved, placed] });
    }
    if (current.length > 0) {
      // Fallbacks: break the keep-together rule, then drop the repeated head.
      candidates.push({ previous: current, next: [...headFor(block, []), placed] });
      candidates.push({ previous: current, next: [placed] });
    }
    const chosen = candidates.find((candidate) => fits(candidate.next));
    if (chosen) {
      pages.push({ items: chosen.previous, overflow: false });
      current = chosen.next;
    } else {
      // Taller than a page even alone: its own page, clipped.
      if (current.length > 0) pages.push({ items: current, overflow: false });
      pages.push({ items: [placed], overflow: true });
      current = [];
    }
  }
  if (current.length > 0) pages.push({ items: current, overflow: false });
  return pages;
}
