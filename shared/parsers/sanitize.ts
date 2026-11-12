import DOMPurify from 'dompurify';

/** Tags allowed in the description, feature cells and edited KP text (docs/spec.md, section 5). */
export const ALLOWED_TAGS = ['p', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 'a', 'br', 'sup', 'sub'] as const;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
/** Inline wrappers that are dropped when they end up empty (e.g. `<sup>` that only held an icon). */
const DROP_IF_EMPTY = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'SUP', 'SUB', 'P', 'LI']);

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier(): ReturnType<typeof DOMPurify> {
  // Created lazily so the module can be imported where `window` appears later (tests, workers).
  purifier ??= DOMPurify(window);
  return purifier;
}

function absolutize(href: string, baseUrl: string | undefined): string | null {
  try {
    const url = baseUrl ? new URL(href, baseUrl) : new URL(href);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function cleanTree(root: ParentNode, baseUrl: string | undefined): void {
  for (const link of Array.from(root.querySelectorAll('a'))) {
    const href = link.getAttribute('href');
    const absolute = href === null ? null : absolutize(href.trim(), baseUrl);
    if (absolute === null) link.removeAttribute('href');
    else link.setAttribute('href', absolute);
  }
  // Deepest first, so a wrapper that only held empty wrappers is removed too.
  for (const element of Array.from(root.querySelectorAll('*')).reverse()) {
    if (DROP_IF_EMPTY.has(element.tagName) && element.textContent?.trim() === '' && !element.querySelector('br')) {
      element.remove();
    }
  }
}

/**
 * Cleans HTML from a site or from `contenteditable` to the tag whitelist: no scripts, no `on*` handlers, no
 * attributes except `href`; links become absolute (relative to `baseUrl`) and only http(s), mailto and tel survive.
 * Whitespace runs are collapsed: the source pages are pretty-printed.
 */
export function sanitizeHtml(html: string, baseUrl?: string): string {
  const fragment = getPurifier().sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: ['href'],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });
  cleanTree(fragment, baseUrl);
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML
    .replace(/\s+/g, ' ')
    .replace(/\s*(<\/?(?:p|ul|ol|li)>)\s*/g, '$1')
    .replace(/\s*<br>\s*/g, '<br>')
    .trim();
}

/** Plain text of an HTML fragment with collapsed whitespace (for names, headings, codes). */
export function textOf(node: Node | null | undefined): string {
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
