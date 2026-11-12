/**
 * Nominative → genitive dictionary moved from legacy/result.php (nominal_i / nominal_r), in the same order.
 * Lookup is by a whole lowercase word; words outside the dictionary stay as they are.
 */
const NOMINATIVE = [
  'линолеум', 'натуральный', 'универсальный', 'коммерческий', 'спортивный', 'акустический', 'противоскользящий',
  'противоскользящие', 'токопроводящий', 'сценический', 'гетерогенный', 'гомогенный', 'покрытие', 'покрытия',
  'мармолеум', 'плитка', 'плитка-пвх', 'пвх-плитка', 'подложка', 'настенное', 'пробковое', 'пробковая', 'спортивный',
  'паркет', 'резиновое', 'иглопробивной', 'ковролин', 'петлевой', 'петлевая', 'модульная', 'ковровая', 'плинтус',
  'напольный', 'широкий', 'белый', 'деревянный', 'гибкий', 'мягкий', 'высокий', 'эластичный', 'коннелюрный',
  'раздельный', 'толстый', 'цветной', 'хдф-плинтус', 'пвх-плинтус', 'накладки', 'накладка', 'завершающий', 'профиль',
  'химия', 'строительная', 'ровнитель', 'грубый', 'финишный', 'грунтовка', 'клей', 'разметка', 'спортивная', 'краска',
  'мастика', 'очиститель', 'потолки', 'подвесные', 'решетка', 'решетки', 'грязезащита', 'ковер', 'коврик', 'коврики',
  'мат', 'маты', 'ковры', 'финские', 'модульные', 'грязезащитный', 'грязезащитные', 'придверная', 'придверные',
  'алюминиевый', 'алюминиевые', 'металлическая', 'металлические', 'стальная', 'стальные', 'кварц-виниловая',
] as const;

const GENITIVE = [
  'линолеума', 'натурального', 'универсального', 'коммерческого', 'спортивного', 'акустического', 'противоскользящего',
  'противоскользящих', 'токопроводящего', 'сценического', 'гетерогенного', 'гомогенного', 'покрытия', 'покрытий',
  'мармолеума', 'плитки', 'плитки-пвх', 'пвх-плитки', 'подложки', 'настенного', 'пробкового', 'пробковой', 'спортивного',
  'паркета', 'резинового', 'иглопробивного', 'ковролина', 'петлевого', 'петлевой', 'модульной', 'ковровой', 'плинтуса',
  'напольного', 'широкого', 'белого', 'деревянного', 'гибкого', 'мягкого', 'высокого', 'эластичного', 'коннелюрного',
  'раздельного', 'толстого', 'цветного', 'хдф-плинтуса', 'пвх-плинтуса', 'накладок', 'накладки', 'завершающего',
  'профиля', 'химии', 'строительной', 'ровнителя', 'грубого', 'финишного', 'грунтовки', 'клея', 'разметки', 'спортивной',
  'краски', 'мастики', 'очистителя', 'потолков', 'подвесных', 'решетки', 'решеток', 'грязезащиты', 'ковра', 'коврика',
  'ковриков', 'мата', 'матов', 'ковров', 'финских', 'модульных', 'грязезащитного', 'грязезащитных', 'придверной',
  'придверных', 'алюминиевого', 'алюминиевых', 'металлической', 'металлических', 'стальной', 'стальных',
  'кварц-виниловой',
] as const;

/** First occurrence wins, as with indexOf() in the legacy code («спортивный» is listed twice with the same form). */
export const GENITIVE_BY_NOMINATIVE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  NOMINATIVE.forEach((word, i) => {
    if (!map.has(word)) map.set(word, GENITIVE[i] ?? word);
  });
  return map;
})();

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Puts every dictionary word of the phrase into the genitive; other words keep their original spelling. */
export function toGenitive(phrase: string): string {
  return collapse(phrase)
    .split(' ')
    .map((word) => GENITIVE_BY_NOMINATIVE.get(word.toLowerCase()) ?? word)
    .join(' ');
}

/** Capitalizes the first letter of each word (CSS `text-transform: capitalize` in the legacy KP). */
function capitalizeWords(text: string): string {
  return collapse(text).replace(/(^|\s)(\S)/g, (_m, space: string, letter: string) => space + letter.toUpperCase());
}

/**
 * Title of the KP, as legacy/result.php built it: «Коммерческое предложение на поставку <вид покрытия в родительном
 * падеже, строчными> <Производитель>». Empty kind and/or manufacturer are simply left out.
 */
export function buildKpTitle(flooringKind: string, manufacturer: string): string {
  const kind = toGenitive(flooringKind).toLowerCase();
  const maker = capitalizeWords(manufacturer);
  const subject = [kind, maker].filter((part) => part !== '').join(' ');
  return subject === '' ? 'Коммерческое предложение' : `Коммерческое предложение на поставку ${subject}`;
}
