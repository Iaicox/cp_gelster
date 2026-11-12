/**
 * Splits the blocks into pages and shows them. Every candidate page is rendered whole, by the same <Page>,
 * into a hidden container and measured there (docs/spec.md, section 8); the pure part is paginate().
 * Pages are recomputed when the blocks or the images change and once the fonts are loaded.
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { KpAssets } from './assets.ts';
import type { KpBlock } from './model.ts';
import { Page, pageFits } from './Page.tsx';
import { paginate, type Page as PageData } from './paginate.ts';

/** Every face used on a page: a font that arrives after the measurement would change the heights. */
const FONTS = [
  '11pt "PT Sans"', 'bold 11pt "PT Sans"', '11.5pt "PT Serif"', 'bold 11.5pt "PT Serif"',
  'italic 11.5pt "PT Serif"', 'italic bold 11.5pt "PT Serif"',
];

async function fontsReady(): Promise<void> {
  const fonts = document.fonts as FontFaceSet | undefined; // absent in jsdom
  if (!fonts) return;
  await Promise.all(FONTS.map((font) => fonts.load(font, 'Аб').catch(() => undefined)));
  await fonts.ready;
}

type Props = {
  blocks: readonly KpBlock[];
  assets: KpAssets;
  /** Called with the number of pages after every recomputation. */
  onPaginated?: (pages: PageData<KpBlock>[]) => void;
};

export function PagedDocument({ blocks, assets, onPaginated }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageData<KpBlock>[] | null>(null);
  const notify = useRef(onPaginated);
  useEffect(() => {
    notify.current = onPaginated;
  });

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    let cancelled = false;
    // An own container per run: the previous root is unmounted a moment later (see the cleanup).
    const holder = document.createElement('div');
    host.append(holder);
    const root = createRoot(holder);

    void fontsReady().then(() => {
      if (cancelled) return;
      // Outside of React's own render: flushSync may then render the candidate page synchronously.
      const result = paginate(blocks, (items) => {
        flushSync(() => root.render(<Page items={items} assets={assets} />));
        return pageFits(holder);
      });
      flushSync(() => root.render(null));
      setPages(result);
      notify.current?.(result);
    });

    return () => {
      cancelled = true;
      // Not during the commit that runs this cleanup.
      queueMicrotask(() => {
        root.unmount();
        holder.remove();
      });
    };
  }, [blocks, assets]);

  return (
    <>
      <div className="kp-pages" data-ready={pages ? 'true' : undefined}>
        {pages === null ? <p className="kp-status no-print">Раскладываем по страницам…</p> : null}
        {pages?.map((page, index) => (
          <div className="kp-sheet" key={index}>
            {page.overflow ? (
              <p className="kp-overflow no-print" role="alert">
                Страница {index + 1}: текст не помещается. Сократите его или разбейте на абзацы.
              </p>
            ) : null}
            <Page items={page.items} assets={assets} overflow={page.overflow} />
          </div>
        ))}
      </div>
      <div className="kp-measure" ref={measureRef} aria-hidden="true" />
    </>
  );
}
