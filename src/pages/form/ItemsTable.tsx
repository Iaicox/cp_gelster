import { UNITS, type Item, type Unit } from '../../../shared/schema.ts';
import { newItem } from '../../storage/projects.ts';
import { NumberInput } from './NumberInput.tsx';
import { itemWarnings } from './validate.ts';

type Props = {
  legend: string;
  /** Prefix of accessible names: «Основные», «Дополнительные». */
  label: string;
  items: Item[];
  /** Number of the first row: extra materials continue the numbering of the main ones. */
  firstNo: number;
  onChange: (items: Item[]) => void;
};

/** Rows of materials: name, quantity, unit, price in roubles (never in euros). */
export function ItemsTable({ legend, label, items, firstNo, onChange }: Props) {
  function update(index: number, patch: Partial<Item>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <fieldset className="items">
      <legend>{legend}</legend>
      {items.map((item, index) => {
        const no = firstNo + index;
        const warn = itemWarnings(item);
        return (
          <div className="item-row" key={item.id} data-testid={`${label}-row`}>
            <span className="list-counter">{`${no}.`}</span>
            <input
              type="text"
              className="list-name"
              placeholder="Наименование"
              aria-label={`${label}: наименование, строка ${no}`}
              value={item.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
            <NumberInput
              className="list-number"
              placeholder="Кол-во"
              aria-label={`${label}: количество, строка ${no}`}
              value={item.qty}
              invalid={warn.qty}
              onValueChange={(qty) => update(index, { qty })}
            />
            <select
              aria-label={`${label}: единица, строка ${no}`}
              value={item.unit}
              onChange={(e) => update(index, { unit: e.target.value as Unit })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <NumberInput
              className="list-price"
              placeholder="Цена в рублях"
              title="Цена всегда в рублях, даже при «рубли и евро»: евро считаются по курсу"
              aria-label={`${label}: цена в рублях, строка ${no}`}
              value={item.priceRub}
              invalid={warn.price}
              onValueChange={(priceRub) => update(index, { priceRub })}
            />
            <button
              type="button"
              className="row-button"
              aria-label={`${label}: удалить строку ${no}`}
              title="Удалить строку"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              –
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="row-button"
        aria-label={`${label}: добавить строку`}
        title="Добавить строку"
        onClick={() => onChange([...items, newItem(items.at(-1)?.unit ?? 'м²')])}
      >
        +
      </button>
    </fieldset>
  );
}
