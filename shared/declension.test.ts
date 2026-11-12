import { describe, expect, it } from 'vitest';
import { buildKpTitle, GENITIVE_BY_NOMINATIVE, toGenitive } from './declension.ts';

describe('toGenitive', () => {
  it('declines dictionary words and keeps the others', () => {
    expect(toGenitive('Натуральный линолеум с какао')).toBe('натурального линолеума с какао');
    expect(toGenitive('Грязезащитный ковер')).toBe('грязезащитного ковра');
    expect(toGenitive('Модульная  ковровая плитка')).toBe('модульной ковровой плитки');
    expect(toGenitive('Плинтус для мармолеума и ПВХ-покрытий')).toBe('плинтуса для мармолеума и ПВХ-покрытий');
    expect(toGenitive('Кварц-виниловая плитка')).toBe('кварц-виниловой плитки');
  });

  it('keeps the legacy pairs where one form is another word nominative', () => {
    expect(toGenitive('накладка')).toBe('накладки');
    expect(toGenitive('накладки')).toBe('накладок');
    expect(toGenitive('решетки')).toBe('решеток');
  });

  it('has the whole legacy dictionary', () => {
    // 86 entries in result.php, «спортивный» twice.
    expect(GENITIVE_BY_NOMINATIVE.size).toBe(85);
    expect(GENITIVE_BY_NOMINATIVE.get('спортивный')).toBe('спортивного');
  });

  it('empty phrase stays empty', () => {
    expect(toGenitive('   ')).toBe('');
  });
});

describe('buildKpTitle', () => {
  it('builds the legacy title: genitive kind in lower case + manufacturer', () => {
    expect(buildKpTitle('Натуральный линолеум с какао', 'Forbo')).toBe(
      'Коммерческое предложение на поставку натурального линолеума с какао Forbo',
    );
    expect(buildKpTitle('Грязезащитный ковер', 'forbo')).toBe(
      'Коммерческое предложение на поставку грязезащитного ковра Forbo',
    );
  });

  it('leaves out an empty kind or manufacturer', () => {
    expect(buildKpTitle('Натуральный линолеум', '')).toBe('Коммерческое предложение на поставку натурального линолеума');
    expect(buildKpTitle('', 'Forbo')).toBe('Коммерческое предложение на поставку Forbo');
    expect(buildKpTitle('  ', '')).toBe('Коммерческое предложение');
  });
});
