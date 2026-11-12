/** Content of one page: the same component renders the real page and the hidden page that is measured. */
import type { ReactNode } from 'react';
import type { KpAssets } from '../assets.ts';
import type { KpBlock } from '../model.ts';
import type { Placed } from '../paginate.ts';
import { Html } from './Html.tsx';
import { ArticlesTable, FeaturesTable, PriceTable, TotalTable } from './Tables.tsx';
import { toSegments, type Segment } from './segments.ts';

type Paragraph = Extract<KpBlock, { type: 'paragraph' }>;

/** Paragraphs and list items; neighbouring items of one kind share a list. */
function TextColumn({ paragraphs }: { paragraphs: Paragraph[] }) {
  const parts: ReactNode[] = [];
  let run: Paragraph[] = [];
  const flush = () => {
    const first = run[0];
    if (!first) return;
    const items = run.map((item) => <Html key={item.id} tag="li" html={item.html} />);
    parts.push(
      first.list === 'number' ? (
        <ol key={first.id} start={first.number}>
          {items}
        </ol>
      ) : (
        <ul key={first.id}>{items}</ul>
      ),
    );
    run = [];
  };
  for (const paragraph of paragraphs) {
    if (paragraph.list === 'none') {
      flush();
      parts.push(<Html key={paragraph.id} tag="p" html={paragraph.html} />);
    } else {
      if (run[0] && run[0].list !== paragraph.list) flush();
      run.push(paragraph);
    }
  }
  flush();
  return <div className="mainText">{parts}</div>;
}

/** «Вид покрытия — Название»: the kind in italics, the name in the brand colour, as in the legacy KP. */
function CollectionHeading({ text }: { text: string }) {
  const dash = text.indexOf(' — ');
  return (
    <div className="collection-name-block">
      <span className="kind-of-flooring">
        {dash < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, dash)}&nbsp;&mdash;&nbsp;<span className="collection-name">{text.slice(dash + 3)}</span>
          </>
        )}
      </span>
    </div>
  );
}

function Single({ block, assets }: { block: Extract<Segment, { kind: 'single' }>['block']; assets: KpAssets }) {
  switch (block.type) {
    case 'date':
      return (
        <div className="date">
          <span className="dateToday">{block.date}</span>
          {block.client === '' ? null : <span className="client">для {block.client}</span>}
        </div>
      );
    case 'title':
      return (
        <div className="intro">
          <div className="intro-heading">
            <span>{block.text}</span>
          </div>
        </div>
      );
    case 'greeting':
      return (
        <div className="intro kp-greeting">
          <div className="intro-footing">
            <span>{block.text}</span>
          </div>
        </div>
      );
    case 'intro':
      return (
        <div className="mainContent-heading">
          <p>{block.text}</p>
        </div>
      );
    case 'collectionHeading':
      return <CollectionHeading text={block.text} />;
    case 'mainImage': {
      const image = assets.images[block.src];
      return image ? (
        <div className="mainContent-img">
          <img src={image.src} width={image.width} height={image.height} alt="" />
        </div>
      ) : null;
    }
    case 'paletteLink':
      return (
        <div className="linkToOtherItems">
          <span>
            Всю палитру можно посмотреть по ссылке: <a href={block.url}>{block.url}</a>
          </span>
        </div>
      );
    case 'calcNote':
      return <h3 className="preliminary-calc">{block.text}</h3>;
    case 'total':
      return <TotalTable block={block} />;
    case 'comment':
      return <span className="comment">&mdash; {block.text}</span>;
    default:
      return null; // table parts are rendered by their table segment
  }
}

export function PageContent({ items, assets }: { items: readonly Placed<KpBlock>[]; assets: KpAssets }) {
  return (
    <>
      {toSegments(items).map((segment) => (
        <div key={segment.key} className={segment.gapBefore ? 'kp-segment kp-gap' : 'kp-segment'}>
          {segment.kind === 'text' ? <TextColumn paragraphs={segment.paragraphs} /> : null}
          {segment.kind === 'articles' ? <ArticlesTable segment={segment} assets={assets} /> : null}
          {segment.kind === 'features' ? <FeaturesTable segment={segment} /> : null}
          {segment.kind === 'price' ? <PriceTable segment={segment} /> : null}
          {segment.kind === 'single' ? <Single block={segment.block} assets={assets} /> : null}
        </div>
      ))}
    </>
  );
}
