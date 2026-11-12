import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize.ts';

describe('sanitizeHtml', () => {
  it('keeps the whitelist and drops everything else, keeping the text', () => {
    const html =
      '<div class="x"><p style="color:red">a <b>b</b> <strong>c</strong> <i>d</i> <em>e</em> <u>f</u> m<sup>2</sup> ' +
      'H<sub>2</sub>O<br>g</p><ul><li>1</li></ul><ol><li>2</li></ol><h3>h</h3><span>s</span>' +
      '<table><tr><td>t</td></tr></table></div>';
    expect(sanitizeHtml(html)).toBe(
      '<p>a <b>b</b> <strong>c</strong> <i>d</i> <em>e</em> <u>f</u> m<sup>2</sup> H<sub>2</sub>O<br>g</p>' +
        '<ul><li>1</li></ul><ol><li>2</li></ol>hst',
    );
  });

  it('removes scripts, handlers and dangerous links', () => {
    const html =
      '<p onclick="x()">t<script>alert(1)</script><style>p{}</style><img src=x onerror=alert(1)>' +
      '<a href="javascript:alert(1)">j</a><a href=" JaVaScRiPt:alert(1)">k</a><a href="data:text/html,x">d</a>' +
      '<svg><script>1</script></svg></p>';
    expect(sanitizeHtml(html, 'https://gelster.ru/')).toBe('<p>t<a>j</a><a>k</a><a>d</a></p>');
  });

  it('makes links absolute and keeps only http(s), mailto, tel', () => {
    const html =
      '<a href="page.htm">1</a><a href="https://example.org/a">2</a><a href="mailto:a@b.ru">3</a>' +
      '<a href="tel:+7">4</a><a href="ftp://example.org">5</a><a target="_blank" rel="x" href="/b">6</a>';
    expect(sanitizeHtml(html, 'https://ooogelingen.ru/dir/index.htm')).toBe(
      '<a href="https://ooogelingen.ru/dir/page.htm">1</a><a href="https://example.org/a">2</a>' +
        '<a href="mailto:a@b.ru">3</a><a href="tel:+7">4</a><a>5</a><a href="https://ooogelingen.ru/b">6</a>',
    );
  });

  it('without a base relative links lose href', () => {
    expect(sanitizeHtml('<a href="page.htm">x</a>')).toBe('<a>x</a>');
  });

  it('drops wrappers left empty and collapses whitespace', () => {
    expect(sanitizeHtml('Класс<sup><img src="i.svg"></sup>\n   <b> </b><p>\n  a\n  b </p>')).toBe('Класс<p>a b</p>');
  });
});
