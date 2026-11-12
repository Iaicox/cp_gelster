/**
 * One A4 sheet: 210 × 297 mm, the company header (52.5 mm) and the manager's signature strip (17.5 mm) as
 * <img> elements (backgrounds are not printed by default), the content between them.
 */
import type { CSSProperties } from 'react';
import type { KpAssets, KpImage } from './assets.ts';
import { PageContent } from './blocks/PageContent.tsx';
import type { KpBlock } from './model.ts';
import type { Placed } from './paginate.ts';

type Props = {
  items: readonly Placed<KpBlock>[];
  assets: KpAssets;
  /** The only block is taller than the page: the excess is clipped the same way on screen and in print. */
  overflow?: boolean;
};

const PAGE_WIDTH_MM = 210;
const MIN_FOOTER_MM = 17.5;

/**
 * Height reserved for the signature strip. The strip is as wide as the page; most signature files are taller
 * than the nominal 17.5 mm (about 33 mm), and the text must not run over the manager's name.
 */
export function footerHeightMm(signature: Pick<KpImage, 'width' | 'height'>): number {
  if (signature.width <= 0 || signature.height <= 0) return MIN_FOOTER_MM;
  const natural = (PAGE_WIDTH_MM * signature.height) / signature.width;
  return Math.max(MIN_FOOTER_MM, Math.round(natural * 10) / 10);
}

export function Page({ items, assets, overflow = false }: Props) {
  const style = { '--kp-footer': `${footerHeightMm(assets.signature)}mm` } as CSSProperties;
  return (
    <section className="kp-page" style={style} data-overflow={overflow ? 'true' : undefined}>
      <div className="kp-page-header">
        <img src="header.jpg" alt="Гельстер" />
      </div>
      <div className="kp-page-content">
        <div className="kp-page-flow">
          <PageContent items={items} assets={assets} />
        </div>
      </div>
      <div className="kp-page-signature">
        <img src={assets.signature.src} alt="" />
      </div>
    </section>
  );
}

/** Whether the content of a rendered page is not taller than the space between the header and the signature. */
export function pageFits(page: ParentNode): boolean {
  const content = page.querySelector<HTMLElement>('.kp-page-content');
  const flow = page.querySelector<HTMLElement>('.kp-page-flow');
  if (!content || !flow) return true;
  const style = getComputedStyle(content);
  const available = content.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0');
  // Half a pixel of tolerance: mm and pt sizes do not land on whole pixels.
  return flow.getBoundingClientRect().height <= available + 0.5;
}
