/**
 * The article picker (docs/spec.md, scenario 3; legacy/result.php «Выбери артикулы»): every article of the
 * collection with its picture, code and a check box. Opens by itself on the first opening of the KP and by
 * «Добавить артикулы» / «Перевыбрать артикулы».
 * - 'add': the articles already in the KP are ticked and locked, the newly ticked ones are added after them;
 * - 'reselect': nothing is ticked, the ticked articles replace the choice (captions edited earlier are kept).
 * Thumbnails come from the image store or the network; on «Подтвердить» the bytes of the chosen pictures are put
 * into the store, so the KP and the export take them from there.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { Collection, KpEdits } from '../../shared/schema.ts';
import { fetchImage } from '../api/client.ts';
import { getImage, saveImage } from '../storage/images.ts';

export type PickerMode = 'add' | 'reselect';
type Article = Collection['articles'][number];
type Selected = KpEdits['selectedArticles'];

/** How many pictures are downloaded at once (each goes through the PHP proxy). */
const PARALLEL = 6;

/** Result of the picker: the new list of articles in the KP. */
export function pickArticles(
  articles: readonly Article[],
  current: Selected,
  ticked: ReadonlySet<string>,
  mode: PickerMode,
): Selected {
  const captions = new Map(current.map((article) => [article.code, article.caption]));
  const chosen = articles
    .filter((article) => ticked.has(article.code))
    .filter((article) => mode === 'reselect' || !captions.has(article.code))
    .map((article) => ({
      code: article.code,
      image: article.image,
      caption: captions.get(article.code) ?? `Арт. ${article.code}`,
    }));
  return mode === 'add' ? [...current, ...chosen] : chosen;
}

type Thumbs = { urls: Record<string, string>; failed: Set<string> };

/** Object URLs of the thumbnails; `downloaded` keeps the bytes that came from the network, not from the store. */
function useThumbnails(articles: readonly Article[], downloaded: Map<string, Blob>): Thumbs {
  const [thumbs, setThumbs] = useState<Thumbs>({ urls: {}, failed: new Set() });
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const queue = [...new Set(articles.map((article) => article.image))];
    const worker = async () => {
      for (let url = queue.shift(); url !== undefined && !cancelled; url = queue.shift()) {
        const image = url;
        try {
          let blob = await getImage(image);
          if (!blob) {
            blob = await fetchImage(image);
            downloaded.set(image, blob);
          }
          if (cancelled) return;
          const src = URL.createObjectURL(blob);
          created.push(src);
          setThumbs((old) => ({ ...old, urls: { ...old.urls, [image]: src } }));
        } catch {
          if (!cancelled) setThumbs((old) => ({ ...old, failed: new Set(old.failed).add(image) }));
        }
      }
    };
    void Promise.all(Array.from({ length: PARALLEL }, worker));
    return () => {
      cancelled = true;
      created.forEach((src) => URL.revokeObjectURL(src));
    };
  }, [articles, downloaded]);
  return thumbs;
}

type Props = {
  articles: readonly Article[];
  selected: Selected;
  mode: PickerMode;
  onConfirm: (selected: Selected) => void;
  onClose: () => void;
};

export function ArticlePicker({ articles, selected, mode, onConfirm, onClose }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [downloaded] = useState(() => new Map<string, Blob>());
  const thumbs = useThumbnails(articles, downloaded);
  const locked = new Set(mode === 'add' ? selected.map((article) => article.code) : []);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(locked));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function toggle(code: string, on: boolean) {
    setError(null);
    setTicked((old) => {
      const next = new Set(old);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  async function confirm() {
    const result = pickArticles(articles, selected, ticked, mode);
    if (result.length === 0) {
      setError('Вы не выбрали ни одного артикула.');
      return;
    }
    setSaving(true);
    // A full store must not stop the choice: the KP then loads the pictures from the network.
    await Promise.all(
      result.map(({ image }) => {
        const blob = downloaded.get(image);
        return blob ? saveImage(image, blob).catch(() => undefined) : undefined;
      }),
    );
    onConfirm(result);
  }

  return (
    <div className="kp-picker-backdrop no-print">
      <div
        className="kp-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="kp-picker-bar">
          <h2 id={titleId}>{mode === 'add' ? 'Добавьте артикулы' : 'Выберите артикулы'}</h2>
          <button type="button" onClick={() => setTicked(new Set(articles.map((article) => article.code)))}>
            Выбрать все
          </button>
          <button type="button" onClick={() => setTicked(new Set(locked))}>
            Отменить выбор
          </button>
          <span className="kp-toolbar-spacer" />
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="primary" disabled={saving} onClick={() => void confirm()}>
            Подтвердить
          </button>
        </div>
        {error !== null ? (
          <p className="kp-picker-error" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="kp-picker-grid">
          {articles.map((article) => {
            const src = thumbs.urls[article.image];
            return (
              <li key={article.code}>
                <label>
                  <span className="kp-picker-thumb">
                    {src ? (
                      <img src={src} alt="" />
                    ) : (
                      <span className="kp-picker-noimage">
                        {thumbs.failed.has(article.image) ? 'нет картинки' : 'загрузка…'}
                      </span>
                    )}
                  </span>
                  <span className="kp-picker-code">
                    <input
                      type="checkbox"
                      checked={ticked.has(article.code)}
                      disabled={locked.has(article.code)}
                      onChange={(event) => toggle(article.code, event.currentTarget.checked)}
                    />
                    {article.code}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
