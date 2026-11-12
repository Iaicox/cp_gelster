import { createElement } from 'react';
import { sanitizeHtml } from '../../../shared/parsers/index.ts';

/** A page is rendered many times while it is measured: each distinct string is sanitized once. */
const cache = new Map<string, string>();

function clean(html: string): string {
  let safe = cache.get(html);
  if (safe === undefined) {
    safe = sanitizeHtml(html);
    cache.set(html, safe);
  }
  return safe;
}

type Props = {
  tag: 'p' | 'li' | 'td' | 'th';
  html: string;
  colSpan?: number | undefined;
  rowSpan?: number | undefined;
};

/** The only place of the KP that inserts HTML: always through DOMPurify with the whitelist of the spec. */
export function Html({ tag, html, colSpan, rowSpan }: Props) {
  return createElement(tag, { colSpan, rowSpan, dangerouslySetInnerHTML: { __html: clean(html) } });
}
