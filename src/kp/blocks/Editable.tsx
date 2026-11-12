/**
 * In-place editing of the KP text (docs/spec.md, section 8 «Редактирование»). A text is `contenteditable` only on
 * the real pages: the hidden page that is measured has no editor in its context and renders the same markup
 * read-only. While the manager types nothing is recomputed; on blur the content is cleaned and committed.
 * Paste inserts plain text only. Controls («×», «вернуть авто») are absolutely positioned, so they never change
 * the height of a page, and they are not printed.
 */
import { createContext, createElement, useContext, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { sanitizeHtml } from '../../../shared/parsers/index.ts';
import type { KpChange } from '../edit.ts';

export type KpEditor = {
  /** Applies the change; false when it changed nothing. */
  apply: (change: KpChange) => boolean;
};

export const KpEditorContext = createContext<KpEditor | null>(null);

export function useKpEditor(): KpEditor | null {
  return useContext(KpEditorContext);
}

/** A page is rendered many times while it is measured: each distinct string is sanitized once. */
const cleaned = new Map<string, string>();

/** Stored HTML is sanitized again before it is shown: a project may come from an imported file. */
export function clean(html: string): string {
  let safe = cleaned.get(html);
  if (safe === undefined) {
    safe = sanitizeHtml(html);
    cleaned.set(html, safe);
  }
  return safe;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

/** Plain text of an edited element: no markup at all, whitespace (including no-break spaces) collapsed. */
export function readText(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function trimBreaks(html: string): string {
  return html.replace(/^(?:<br>)+|(?:<br>)+$/g, '').trim();
}

function isBlank(html: string): boolean {
  const probe = document.createElement('div');
  probe.innerHTML = html;
  return (probe.textContent ?? '').trim() === '';
}

/** Cleaned HTML of an edited element (whitelist of the spec, no scripts, no handlers). */
export function readHtml(element: HTMLElement): string {
  const html = trimBreaks(sanitizeHtml(element.innerHTML));
  return isBlank(html) ? '' : html;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);

/**
 * A paragraph after editing: every line block the browser made on Enter (`<div>`, `<p>`) becomes a piece of its
 * own, the text before the first block is the first piece. Empty pieces are dropped.
 */
export function readBlocks(element: HTMLElement): string[] {
  const pieces: string[] = [];
  let loose = document.createElement('div');
  const flush = () => {
    const html = readHtml(loose);
    if (html !== '') pieces.push(html);
    loose = document.createElement('div');
  };
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName)) {
      flush();
      pieces.push(...readBlocks(node as HTMLElement));
    } else {
      loose.append(node.cloneNode(true));
    }
  }
  flush();
  return pieces;
}

function insertPlainText(text: string): void {
  // execCommand keeps the browser's undo history; the range fallback covers environments without it.
  if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, text)) return;
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || !range) return;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

type Tag = 'span' | 'p' | 'div' | 'td' | 'th';

type Props = {
  tag: Tag;
  /** Current content as HTML (plain texts are passed escaped). */
  html: string;
  /** Accessible name of the text box. */
  label: string;
  /**
   * Reads the edited element and commits it; returns false when nothing changed (the element then gets its
   * previous content back). Absent: the text is not editable.
   */
  commit?: ((element: HTMLElement) => boolean) | undefined;
  /** Enter makes a new line block (paragraphs); otherwise Enter finishes editing. */
  multiline?: boolean;
  className?: string | undefined;
  colSpan?: number | undefined;
  rowSpan?: number | undefined;
};

export function Editable({ tag, html, label, commit, multiline = false, className, colSpan, rowSpan }: Props) {
  const editor = useKpEditor();
  if (!editor || !commit) {
    return createElement(tag, { className, colSpan, rowSpan, dangerouslySetInnerHTML: { __html: html } });
  }
  return createElement(tag, {
    // New content → a new element: React never has to reconcile with what the browser did to the old one.
    key: html,
    className: className ? `${className} kp-editable` : 'kp-editable',
    colSpan,
    rowSpan,
    contentEditable: true,
    role: 'textbox',
    'aria-label': label,
    'aria-multiline': multiline,
    spellCheck: true,
    dangerouslySetInnerHTML: { __html: html },
    onBlur: (event: { currentTarget: HTMLElement }) => {
      const element = event.currentTarget;
      if (!commit(element)) element.innerHTML = html;
    },
    onPaste: (event: ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      insertPlainText(event.clipboardData.getData('text/plain'));
    },
    onDrop: (event: { preventDefault: () => void }) => event.preventDefault(), // dropped HTML would bypass paste
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        event.currentTarget.innerHTML = html;
        event.currentTarget.blur();
      } else if (event.key === 'Enter' && !multiline && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  });
}

/** A small control that appears on hover or keyboard focus of its host; never printed. */
export function Control({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="kp-control no-print"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
