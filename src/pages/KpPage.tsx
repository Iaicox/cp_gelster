/**
 * KP preview (docs/spec.md, section 8): loads the project, fetches the collection page when there is no
 * snapshot (or the link in the form has changed and the manager agrees), shows warnings and the A4 pages,
 * prints to PDF. Articles are chosen in the picker; texts are edited in place and saved into project.kp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Collection, Manager, Project } from '../../shared/schema.ts';
import { fetchCollection, listManagers } from '../api/client.ts';
import { printKp } from '../export/print.ts';
import { ArticlePicker, type PickerMode } from '../kp/ArticlePicker.tsx';
import { imageUrlsOf, loadKpAssets, type KpAssets } from '../kp/assets.ts';
import { KpEditorContext, type KpEditor } from '../kp/blocks/Editable.tsx';
import { applyChange } from '../kp/edit.ts';
import { buildKpDocument, createInitialKp } from '../kp/model.ts';
import { PagedDocument } from '../kp/PagedDocument.tsx';
import { downloadBlob } from '../storage/exportFile.ts';
import { getProject, saveProject } from '../storage/projects.ts';
import '../styles/kp.css';

const APP_TITLE = 'Генератор КП Гельстер';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Puts a freshly parsed collection into the project (first load, another link, «Обновить с сайта»): the
 * description, the features and the choice of articles (with their captions) start anew. The edited date,
 * title, greeting, intro, collection heading and the comments are kept.
 */
export function withCollection(project: Project, collection: Collection): Project {
  const fresh = createInitialKp(collection);
  const old = project.kp;
  const kp = old
    ? {
        ...old,
        descriptionHtml: fresh.descriptionHtml,
        featuresTitle: fresh.featuresTitle,
        features: fresh.features,
        selectedArticles: fresh.selectedArticles,
      }
    : fresh;
  return { ...project, collection, kp, updatedAt: new Date().toISOString() };
}

/** No article chosen yet while the collection has some: the picker opens by itself. */
function wantsPicker(project: Project): boolean {
  return (project.collection?.articles.length ?? 0) > 0 && (project.kp?.selectedArticles.length ?? 0) === 0;
}

type Loaded = {
  project: Project;
  /** null: the list could not be loaded. */
  managers: Manager[] | null;
};

export function KpPage() {
  const { id = '' } = useParams();
  // A new id is a new screen: all state starts from scratch.
  return <KpScreen key={id} id={id} />;
}

function KpScreen({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded | 'loading' | 'missing'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [assets, setAssets] = useState<{ assets: KpAssets; warnings: string[] } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  /** The latest project: edits arrive from event handlers and must not work on a stale copy. */
  const projectRef = useRef<Project | null>(null);

  /** Shows and saves the next state of the project. */
  const update = useCallback((next: Project) => {
    projectRef.current = next;
    setLoaded((old) => (typeof old === 'string' ? old : { ...old, project: next }));
    saveProject(next).catch((cause: unknown) => setError(`Правка не сохранилась: ${messageOf(cause)}`));
  }, []);

  const editor = useMemo<KpEditor>(
    () => ({
      apply(change) {
        const project = projectRef.current;
        if (!project) return false;
        const next = applyChange(project, change);
        if (next === project) return false;
        update({ ...next, updatedAt: new Date().toISOString() });
        return true;
      },
    }),
    [update],
  );

  /** Downloads and parses the page of `project.form.link`, saves the project. Throws ApiError. */
  async function reload(project: Project): Promise<Project> {
    const link = project.form.link.trim();
    // The snapshot remembers the link it was requested by, not the address after redirects: the form link is
    // compared with it to notice that the manager has put in another collection.
    const collection = { ...(await fetchCollection(link)), sourceUrl: link };
    const next = withCollection(project, collection);
    await saveProject(next);
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let stored: Project | null;
      let managers: Manager[] | null;
      try {
        [stored, managers] = await Promise.all([getProject(id), listManagers().catch(() => null)]);
      } catch (cause) {
        if (!cancelled) setError(`Хранилище браузера недоступно: ${messageOf(cause)}`);
        stored = null;
        managers = null;
      }
      if (cancelled) return;
      if (!stored) {
        setLoaded('missing');
        return;
      }
      let project = stored;
      const link = project.form.link.trim();
      const snapshot = project.collection;
      const wanted =
        link !== '' &&
        (snapshot === null ||
          (snapshot.sourceUrl !== link &&
            window.confirm(
              'Ссылка на коллекцию в форме изменилась. Загрузить страницу заново?\n' +
                'Описание, характеристики и выбор артикулов будут сброшены.',
            )));
      try {
        if (wanted) {
          setBusy(true);
          project = await reload(project);
        } else if (project.kp === null && snapshot !== null) {
          // First opening of the preview with a ready snapshot (an imported project, for example).
          project = { ...project, kp: createInitialKp(snapshot), updatedAt: new Date().toISOString() };
          await saveProject(project);
        }
      } catch (cause) {
        if (!cancelled) setError(`Страница коллекции не загрузилась: ${messageOf(cause)}`);
      }
      if (cancelled) return;
      setBusy(false);
      projectRef.current = project;
      setLoaded({ project, managers });
      if (wantsPicker(project)) setPicker('reselect');
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doc = useMemo(() => {
    if (typeof loaded === 'string') return null;
    const { project, managers } = loaded;
    const manager = managers?.find((m) => m.id === project.form.managerId) ?? null;
    return buildKpDocument(project, manager, { managersUnavailable: managers === null });
  }, [loaded]);

  // Images are reloaded only when their set changes, not on every rebuild of the document.
  const assetsKey = doc ? JSON.stringify([imageUrlsOf(doc), doc.signature]) : null;
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let release = () => {};
    void loadKpAssets(doc).then((result) => {
      if (cancelled) {
        result.release();
        return;
      }
      release = result.release;
      setAssets({ assets: result.assets, warnings: result.warnings });
    });
    return () => {
      cancelled = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsKey]);

  // The print dialog offers the document title as the PDF file name.
  const fileName = doc?.fileName;
  useEffect(() => {
    if (fileName) document.title = fileName;
    return () => {
      document.title = APP_TITLE;
    };
  }, [fileName]);

  async function refresh() {
    if (typeof loaded === 'string') return;
    const question =
      'Перечитать страницу коллекции с сайта?\n' +
      'Описание, характеристики и выбор артикулов будут сброшены, остальные правки сохранятся.';
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const project = await reload(projectRef.current ?? loaded.project);
      projectRef.current = project;
      setLoaded({ ...loaded, project });
      if (wantsPicker(project)) setPicker('reselect');
    } catch (cause) {
      setError(`Страница коллекции не загрузилась: ${messageOf(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  /** DOCX of the document as it is now; the library is loaded on the first click. */
  async function saveDocx() {
    if (!doc || !assets) return;
    setDocxBusy(true);
    setError(null);
    try {
      const { buildDocx, loadDocxAssets } = await import('../export/docx.ts');
      downloadBlob(await buildDocx(doc, await loadDocxAssets(assets.assets)), `${doc.fileName}.docx`);
    } catch (cause) {
      setError(`DOCX не сохранился: ${messageOf(cause)}`);
    } finally {
      setDocxBusy(false);
    }
  }

  if (loaded === 'loading' || loaded === 'missing' || !doc) {
    return (
      <div className="kp-screen">
        <div className="kp-empty" role={loaded === 'missing' ? 'alert' : 'status'}>
          <p>{loaded === 'missing' ? (error ?? 'Проект не найден в этом браузере.') : 'Загружаем проект…'}</p>
          {loaded === 'missing' ? <Link to="/">К форме</Link> : null}
        </div>
      </div>
    );
  }

  const warnings = [...doc.warnings, ...(assets?.warnings ?? [])];
  const canRefresh = loaded.project.form.link.trim() !== '';
  const articles = loaded.project.collection?.articles ?? [];
  const selected = loaded.project.kp?.selectedArticles ?? [];

  function confirmArticles(chosen: typeof selected) {
    setPicker(null);
    const project = projectRef.current;
    if (!project) return;
    const kp = project.kp ?? createInitialKp(project.collection);
    update({ ...project, kp: { ...kp, selectedArticles: chosen }, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="kp-screen">
      <div className="kp-toolbar no-print">
        <div className="kp-toolbar-inner">
          <Link to="/" className="kp-button">
            К форме
          </Link>
          <button type="button" onClick={() => void refresh()} disabled={busy || !canRefresh}>
            {busy ? 'Загружаем…' : 'Обновить с сайта'}
          </button>
          <button type="button" onClick={() => setPicker('add')} disabled={busy || articles.length === 0}>
            Добавить артикулы
          </button>
          <button type="button" onClick={() => setPicker('reselect')} disabled={busy || articles.length === 0}>
            Перевыбрать артикулы
          </button>
          <span className="kp-toolbar-spacer" />
          <span className="kp-hint" id="kp-print-hint">
            Если появились поля: Печать → Поля → По умолчанию
          </span>
          <button
            type="button"
            className="primary"
            aria-describedby="kp-print-hint"
            disabled={pageCount === 0}
            onClick={() => printKp(doc.fileName)}
          >
            Сохранить в PDF
          </button>
          <button type="button" disabled={pageCount === 0 || docxBusy} onClick={() => void saveDocx()}>
            {docxBusy ? 'Готовим DOCX…' : 'Сохранить в DOCX'}
          </button>
        </div>
      </div>

      {error !== null || warnings.length > 0 ? (
        <div className="kp-notes no-print" role={error !== null ? 'alert' : 'status'}>
          <div className="kp-notes-title">Проверьте перед отправкой</div>
          <ul>
            {error !== null ? <li className="kp-error">{error}</li> : null}
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assets ? (
        <KpEditorContext value={editor}>
          <PagedDocument
            blocks={doc.blocks}
            assets={assets.assets}
            onPaginated={(pages) => setPageCount(pages.length)}
          />
        </KpEditorContext>
      ) : (
        <div className="kp-pages">
          <div className="kp-status no-print">Загружаем картинки…</div>
        </div>
      )}

      {picker !== null ? (
        <ArticlePicker
          articles={articles}
          selected={selected}
          mode={picker}
          onConfirm={confirmArticles}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
