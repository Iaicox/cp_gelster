/** Content of one page: the same component renders the real page and the hidden page that is measured. */
import type { ReactNode } from 'react';
import type { KpAssets } from '../assets.ts';
import type { AutoField, KpBlock } from '../model.ts';
import type { Placed } from '../paginate.ts';
import { clean, Control, Editable, escapeHtml, readBlocks, readText, useKpEditor } from './Editable.tsx';
import { ArticlesTable, FeaturesTable, PriceTable, TotalTable } from './Tables.tsx';
import { toSegments, type Segment } from './segments.ts';

type Paragraph = Extract<KpBlock, { type: 'paragraph' }>;

/** A paragraph or list item: edited in place, removed by «×»; Enter splits it into several on blur. */
function ParagraphText({ paragraph }: { paragraph: Paragraph }) {
  const editor = useKpEditor();
  const { index } = paragraph;
  const text = (
    <Editable
      tag={paragraph.list === 'none' ? 'p' : 'div'}
      html={clean(paragraph.html)}
      label={paragraph.list === 'none' ? 'Абзац описания' : 'Пункт списка'}
      multiline
      commit={editor ? (element) => editor.apply({ kind: 'paragraph', index, pieces: readBlocks(element) }) : undefined}
    />
  );
  const remove = editor ? (
    <Control label="Удалить абзац" onClick={() => editor.apply({ kind: 'paragraph', index, pieces: [] })}>
      ×
    </Control>
  ) : null;
  return paragraph.list === 'none' ? (
    <div className="kp-edit-host">
      {text}
      {remove}
    </div>
  ) : (
    <li className="kp-edit-host">
      {text}
      {remove}
    </li>
  );
}

/** Paragraphs and list items; neighbouring items of one kind share a list. */
function TextColumn({ paragraphs }: { paragraphs: Paragraph[] }) {
  const parts: ReactNode[] = [];
  let run: Paragraph[] = [];
  const flush = () => {
    const first = run[0];
    if (!first) return;
    const items = run.map((item) => <ParagraphText key={item.id} paragraph={item} />);
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
      parts.push(<ParagraphText key={paragraph.id} paragraph={paragraph} />);
    } else {
      if (run[0] && run[0].list !== paragraph.list) flush();
      run.push(paragraph);
    }
  }
  flush();
  return <div className="mainText">{parts}</div>;
}

/** «Вид покрытия — Название»: the kind in italics, the name in the brand colour, as in the legacy KP. */
function headingHtml(text: string): string {
  const dash = text.indexOf(' — ');
  if (dash < 0) return escapeHtml(text);
  const kind = escapeHtml(text.slice(0, dash));
  return `${kind}&nbsp;&mdash;&nbsp;<span class="collection-name">${escapeHtml(text.slice(dash + 3))}</span>`;
}

const AUTO_LABELS: Record<AutoField, string> = {
  date: 'Дата',
  title: 'Заголовок',
  greeting: 'Обращение',
  intro: 'Вступление',
  collectionHeading: 'Заголовок коллекции',
};

type AutoTextProps = {
  field: AutoField;
  edited: boolean;
  tag: 'span' | 'p';
  html: string;
  className?: string | undefined;
};

/** A text derived from the form: once edited it is kept as is, «вернуть авто» brings the derived text back. */
function AutoText({ field, edited, tag, html, className }: AutoTextProps) {
  const editor = useKpEditor();
  return (
    <>
      <Editable
        tag={tag}
        className={className}
        html={html}
        label={AUTO_LABELS[field]}
        commit={editor ? (element) => editor.apply({ kind: 'auto', field, value: readText(element) }) : undefined}
      />
      {editor && edited ? (
        <Control
          label={`${AUTO_LABELS[field]}: вернуть авто`}
          onClick={() => editor.apply({ kind: 'auto', field, value: null })}
        >
          вернуть авто
        </Control>
      ) : null}
    </>
  );
}

function Comment({ block }: { block: Extract<KpBlock, { type: 'comment' }> }) {
  const editor = useKpEditor();
  const { index } = block;
  return (
    <span className="comment">
      &mdash;{' '}
      <Editable
        tag="span"
        html={escapeHtml(block.text)}
        label="Комментарий"
        commit={editor ? (element) => editor.apply({ kind: 'comment', index, text: readText(element) }) : undefined}
      />
    </span>
  );
}

function Single({ block, assets }: { block: Extract<Segment, { kind: 'single' }>['block']; assets: KpAssets }) {
  switch (block.type) {
    case 'date':
      return (
        <div className="date kp-edit-host">
          <AutoText field="date" edited={block.edited} tag="span" className="dateToday" html={escapeHtml(block.date)} />
          {block.client === '' ? null : <span className="client">для {block.client}</span>}
        </div>
      );
    case 'title':
      return (
        <div className="intro">
          <div className="intro-heading kp-edit-host">
            <AutoText field="title" edited={block.edited} tag="span" html={escapeHtml(block.text)} />
          </div>
        </div>
      );
    case 'greeting':
      return (
        <div className="intro kp-greeting">
          <div className="intro-footing kp-edit-host">
            <AutoText field="greeting" edited={block.edited} tag="span" html={escapeHtml(block.text)} />
          </div>
        </div>
      );
    case 'intro':
      return (
        <div className="mainContent-heading kp-edit-host">
          <AutoText field="intro" edited={block.edited} tag="p" html={escapeHtml(block.text)} />
        </div>
      );
    case 'collectionHeading':
      return (
        <div className="collection-name-block kp-edit-host">
          <AutoText
            field="collectionHeading"
            edited={block.edited}
            tag="span"
            className="kind-of-flooring"
            html={headingHtml(block.text)}
          />
        </div>
      );
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
      return <Comment block={block} />;
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
