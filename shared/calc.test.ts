import { describe, expect, it } from 'vitest';
import { calcForm, calcTable, formatMoney, lineSumEur, lineSumRub, priceEur, round2 } from './calc.ts';
import type { Item } from './schema.ts';

function item(name: string, qty: number | null, priceRub: number | null, id = name): Item {
  return { id, name, qty, unit: 'м²', priceRub };
}

describe('round2', () => {
  it('rounds half away from zero without float artefacts', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(1.004)).toBe(1);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1e-9)).toBe(0);
  });

  it('turns non-finite values into 0', () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('row sums', () => {
  it('sum in roubles is round2(qty × price)', () => {
    expect(lineSumRub(item('a', 12.5, 1234.56))).toBe(15432);
    expect(lineSumRub(item('a', 0.125, 3))).toBe(0.38);
  });

  it('empty qty or price counts as zero', () => {
    expect(lineSumRub(item('a', null, 100))).toBe(0);
    expect(lineSumRub(item('a', 3, null))).toBe(0);
  });

  it('price in euro is round2(priceRub / rate), sum in euro uses the rounded price', () => {
    expect(priceEur(1000, 92.6968)).toBe(10.79);
    expect(lineSumEur(item('a', 3, 1000), 92.6968)).toBe(32.37);
    expect(priceEur(null, 90)).toBe(0);
  });

  it('rate 0, negative, NaN or empty gives no euro values instead of dividing by zero', () => {
    for (const rate of [0, -5, Number.NaN, null]) {
      expect(priceEur(1000, rate)).toBeNull();
      expect(lineSumEur(item('a', 1, 1000), rate)).toBeNull();
    }
  });
});

describe('calcTable / calcForm', () => {
  it('totals are sums of rounded rows; rows without a name are skipped', () => {
    const table = calcTable([item('a', 1, 0.005), item('  ', 10, 10), item('b', 1, 0.005)], 2);
    expect(table.rows.map((row) => row.item.name)).toEqual(['a', 'b']);
    expect(table.rows.map((row) => row.sumRub)).toEqual([0.01, 0.01]);
    expect(table.totalRub).toBe(0.02);
    expect(table.rows.map((row) => row.priceEur)).toEqual([0, 0]);
    expect(table.totalEur).toBe(0);
  });

  it('euro total is the sum of rounded euro rows', () => {
    const table = calcTable([item('a', 3, 1000), item('b', 7, 333)], 92.6968);
    // 3 × 10.79 = 32.37; 7 × 3.59 = 25.13
    expect(table.rows.map((row) => row.sumEur)).toEqual([32.37, 25.13]);
    expect(table.totalEur).toBe(57.5);
  });

  it('without a valid rate the euro total is null, roubles still count', () => {
    const table = calcTable([item('a', 2, 100)], 0);
    expect(table.totalRub).toBe(200);
    expect(table.totalEur).toBeNull();
    expect(table.rows[0]?.priceEur).toBeNull();
  });

  it('numbering of extra materials continues after the main ones', () => {
    const result = calcForm({
      mainItems: [item('a', 1, 10), item('', 1, 10), item('b', 2, 10)],
      extraItems: [item('c', 1, 5), item('d', null, null)],
      euroRate: null,
    });
    expect(result.main.rows.map((row) => row.no)).toEqual([1, 2]);
    expect(result.extra.rows.map((row) => row.no)).toEqual([3, 4]);
    expect(result.totalRub).toBe(35);
  });

  it('empty form gives zero totals', () => {
    const result = calcForm({ mainItems: [], extraItems: [], euroRate: 90 });
    expect(result.main.rows).toEqual([]);
    expect(result.extra.rows.map((row) => row.no)).toEqual([]);
    expect(result.totalRub).toBe(0);
    expect(result.main.totalEur).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats as «1 234,56» with a no-break space', () => {
    expect(formatMoney(1234.56)).toBe('1 234,56');
    expect(formatMoney(1234567.891)).toBe('1 234 567,89');
    expect(formatMoney(0)).toBe('0,00');
    expect(formatMoney(5)).toBe('5,00');
    expect(formatMoney(999.999)).toBe('1 000,00');
    expect(formatMoney(-1234.5)).toBe('-1 234,50');
  });

  it('empty values give an empty string', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney(Number.NaN)).toBe('');
  });
});
