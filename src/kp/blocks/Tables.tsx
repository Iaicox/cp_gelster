/** Tables of the KP. Markup and class names repeat legacy/result.php so that document.css applies unchanged. */
import type { KpAssets } from '../assets.ts';
import type { KpBlock } from '../model.ts';
import { clean, Control, Editable, escapeHtml, readHtml, readText, useKpEditor } from './Editable.tsx';
import type { Segment } from './segments.ts';

type Of<K extends Segment['kind']> = Extract<Segment, { kind: K }>;

export function ArticlesTable({ segment, assets }: { segment: Of<'articles'>; assets: KpAssets }) {
  const editor = useKpEditor();
  return (
    <div className="clear table_items-wrapper">
      <table className="table-items">
        <tbody>
          {segment.rows.flatMap((row) => [
            <tr key={`${row.id}-img`}>
              {row.articles.map((article, index) => {
                const image = assets.images[article.image];
                return (
                  <td className="art_item" key={index}>
                    {image ? <img src={image.src} alt={article.caption} /> : null}
                  </td>
                );
              })}
            </tr>,
            <tr key={`${row.id}-text`}>
              {row.articles.map((article, index) => (
                <th key={index}>
                  <Editable
                    tag="span"
                    html={escapeHtml(article.caption)}
                    label={`Подпись артикула ${article.code}`}
                    commit={
                      editor
                        ? (element) => editor.apply({ kind: 'caption', index: row.first + index, text: readText(element) })
                        : undefined
                    }
                  />
                </th>
              ))}
            </tr>,
          ])}
        </tbody>
      </table>
    </div>
  );
}

export function FeaturesTable({ segment }: { segment: Of<'features'> }) {
  const editor = useKpEditor();
  return (
    <table className="table-features">
      {segment.head ? (
        <thead>
          <tr>
            <th colSpan={segment.head.columns}>
              <Editable
                tag="span"
                html={escapeHtml(segment.head.title)}
                label="Заголовок характеристик"
                commit={editor ? (element) => editor.apply({ kind: 'featuresTitle', text: readText(element) }) : undefined}
              />
            </th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {segment.rows.map((row) => (
          <tr key={row.id}>
            {row.cells.map((cell, index) => {
              const Cell = cell.header ? 'th' : 'td';
              return (
                // The cell holds the text box and, in the first cell, the «×» of the row.
                <Cell key={index} className="kp-edit-host" colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
                  <Editable
                    tag="div"
                    html={clean(cell.html)}
                    label="Ячейка характеристик"
                    commit={
                      editor
                        ? (element) =>
                            editor.apply({ kind: 'featureCell', row: row.row, cell: index, html: readHtml(element) })
                        : undefined
                    }
                  />
                  {editor && index === 0 ? (
                    <Control label="Удалить строку" onClick={() => editor.apply({ kind: 'deleteFeatureRow', row: row.row })}>
                      ×
                    </Control>
                  ) : null}
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Rub() {
  return <span className="rub">руб.</span>;
}

export function PriceTable({ segment }: { segment: Of<'price'> }) {
  const any = segment.head ?? segment.rows[0] ?? segment.foot;
  if (!any) return null;
  const { table, showEuro } = any;
  return (
    <table className={table === 'main' ? 'table-main_materials' : 'table-addit_materials'}>
      {segment.head ? (
        <thead>
          <tr>
            <th>№</th>
            <th>{segment.head.title}</th>
            <th>Кол-во</th>
            <th>
              Ед.
              <br />
              изм.
            </th>
            {showEuro ? (
              <th>
                Цена в <span className="euro">евро</span>
              </th>
            ) : null}
            <th>
              Цена в <Rub />
            </th>
            <th>
              Сумма, в <Rub />
              <br />с НДС
            </th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {segment.rows.map((row) => (
          <tr key={row.id}>
            <th>{row.no}</th>
            <td>{row.name}</td>
            <td>{row.qty}</td>
            <td>{row.unit}</td>
            {showEuro ? <td>{row.priceEur}</td> : null}
            <td>{row.priceRub}</td>
            <td>{row.sumRub}</td>
          </tr>
        ))}
      </tbody>
      {segment.foot ? (
        <tfoot>
          <tr>
            <th className="sum" colSpan={showEuro ? 6 : 5}>
              Итого в <Rub />, с НДС:
            </th>
            <th className="sum">{segment.foot.total}</th>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export function TotalTable({ block }: { block: Extract<KpBlock, { type: 'total' }> }) {
  return (
    <table className="table-sum_tables">
      <thead>
        <tr>
          <th>
            Общая сумма по позициям в <Rub />, с НДС:
          </th>
          <th>{block.total}</th>
        </tr>
      </thead>
    </table>
  );
}
