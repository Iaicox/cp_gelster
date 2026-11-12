import type { Item, ProjectForm } from './schema.ts';

/** Rounds to 2 decimals half away from zero, without the 1.005 → 1.00 binary float trap. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  // 1.005 * 100 = 100.49999999999999; trimming to 15 significant digits restores the intended 100.5.
  return (sign * Math.round(Number((Math.abs(value) * 100).toPrecision(15)))) / 100 || 0;
}

/** Empty quantity or price counts as zero (the form highlights it). */
function num(value: number | null): number {
  return value ?? 0;
}

/** A usable euro rate is a finite number strictly greater than zero; anything else means "no euro column data". */
export function isValidRate(rate: number | null | undefined): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

/** Row sum in roubles: round2(qty × priceRub). */
export function lineSumRub(item: Pick<Item, 'qty' | 'priceRub'>): number {
  return round2(num(item.qty) * num(item.priceRub));
}

/** Price in euro: round2(priceRub / rate); null when the rate is missing or not positive. */
export function priceEur(priceRub: number | null, rate: number | null): number | null {
  return isValidRate(rate) ? round2(num(priceRub) / rate) : null;
}

/** Row sum in euro: round2(qty × price in euro), so "price × qty = sum" adds up in the row. */
export function lineSumEur(item: Pick<Item, 'qty' | 'priceRub'>, rate: number | null): number | null {
  const price = priceEur(item.priceRub, rate);
  return price === null ? null : round2(num(item.qty) * price);
}

export type CalcRow = {
  /** Position number in the KP (extra materials continue the main numbering). */
  no: number;
  item: Item;
  sumRub: number;
  priceEur: number | null;
  sumEur: number | null;
};

export type CalcTable = {
  rows: CalcRow[];
  /** Sum of the rounded row sums. */
  totalRub: number;
  /** Sum of the rounded euro row sums; null without a valid rate. */
  totalEur: number | null;
};

/** Items without a name never reach the KP. */
export function visibleItems(items: readonly Item[]): Item[] {
  return items.filter((item) => item.name.trim() !== '');
}

/** One price table. `firstNo` is the number of the first row. */
export function calcTable(items: readonly Item[], rate: number | null, firstNo = 1): CalcTable {
  const rows = visibleItems(items).map((item, index) => ({
    no: firstNo + index,
    item,
    sumRub: lineSumRub(item),
    priceEur: priceEur(item.priceRub, rate),
    sumEur: lineSumEur(item, rate),
  }));
  const totalRub = round2(rows.reduce((sum, row) => sum + row.sumRub, 0));
  const totalEur = isValidRate(rate) ? round2(rows.reduce((sum, row) => sum + (row.sumEur ?? 0), 0)) : null;
  return { rows, totalRub, totalEur };
}

export type CalcResult = { main: CalcTable; extra: CalcTable; totalRub: number };

/** Both tables of the KP plus the grand total in roubles; extra numbering continues after the main rows. */
export function calcForm(form: Pick<ProjectForm, 'mainItems' | 'extraItems' | 'euroRate'>): CalcResult {
  const main = calcTable(form.mainItems, form.euroRate, 1);
  const extra = calcTable(form.extraItems, form.euroRate, main.rows.length + 1);
  return { main, extra, totalRub: round2(main.totalRub + extra.totalRub) };
}

const NBSP = ' ';

/**
 * Formats a number as «1 234,56»: two decimals, comma, thousands separated by a no-break space
 * (so a number never wraps inside a narrow table cell). Null/empty → ''.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const rounded = round2(value);
  const [whole = '0', fraction = '00'] = Math.abs(rounded).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? '-' : ''}${grouped},${fraction}`;
}
