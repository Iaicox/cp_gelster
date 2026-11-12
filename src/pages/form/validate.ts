import { isValidRate } from '../../../shared/calc.ts';
import { siteOf } from '../../../shared/parsers/index.ts';
import type { Item, ProjectForm } from '../../../shared/schema.ts';

export type FormErrors = {
  link: string | null;
  euroRate: string | null;
};

export const LINK_ERROR = 'Ссылка должна вести на страницу коллекции https://gelster.ru или https://ooogelingen.ru';
export const LINK_EMPTY = 'Вставьте ссылку на коллекцию';
export const RATE_ERROR = 'Для таблицы «рубли и евро» нужен курс евро больше нуля';

/** Errors that block «Создать КП». An empty link is reported only when `submitting`. */
export function validateForm(form: ProjectForm, submitting = false): FormErrors {
  const link = form.link.trim();
  const needsRate = form.mainCurrency === 'rubAndEuro' || form.extraCurrency === 'rubAndEuro';
  return {
    link: link === '' ? (submitting ? LINK_EMPTY : null) : siteOf(link) ? null : LINK_ERROR,
    euroRate: needsRate && !isValidRate(form.euroRate) ? RATE_ERROR : null,
  };
}

export function hasErrors(errors: FormErrors): boolean {
  return errors.link !== null || errors.euroRate !== null;
}

/** A named row with an empty quantity or price counts as zero in the KP: highlight it in the form. */
export function itemWarnings(item: Item): { qty: boolean; price: boolean } {
  const named = item.name.trim() !== '';
  return { qty: named && item.qty === null, price: named && item.priceRub === null };
}
