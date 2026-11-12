import { useState, type InputHTMLAttributes } from 'react';

/** '' → null; «68,90» and «1 500» (any spaces) are accepted; negative or not a number → 'bad'. */
export function parseNumber(text: string): number | null | 'bad' {
  const clean = text.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (clean === '') return null;
  if (!/^\d*\.?\d*$/.test(clean) || clean === '.') return 'bad';
  const value = Number(clean);
  return Number.isFinite(value) ? value : 'bad';
}

export function formatNumber(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Highlight even when the text is a valid number (e.g. required but empty). */
  invalid?: boolean;
};

/**
 * Text field for a non-negative number with a comma or a dot. Keeps what the user typed («68,» while typing);
 * text that is not a number is kept on screen, highlighted, and stored as null.
 */
export function NumberInput({ value, onValueChange, invalid = false, className, ...rest }: Props) {
  const [text, setText] = useState(() => formatNumber(value));
  const [shown, setShown] = useState(value);
  // The value changed from outside (the «ЦБ» button): show it.
  if (value !== shown) {
    setShown(value);
    setText(formatNumber(value));
  }
  const bad = parseNumber(text) === 'bad';
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={[className, bad || invalid ? 'invalid' : ''].filter(Boolean).join(' ')}
      aria-invalid={bad || invalid}
      value={text}
      onChange={(event) => {
        const nextText = event.target.value;
        const parsed = parseNumber(nextText);
        const next = parsed === 'bad' ? null : parsed;
        setText(nextText);
        setShown(next);
        onValueChange(next);
      }}
    />
  );
}
