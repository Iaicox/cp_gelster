import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { CurrencyMode, Manager, Project, ProjectForm } from '../../shared/schema.ts';
import { canFetchRates, fetchRates, fetchSignature, listManagers } from '../api/client.ts';
import {
  applyImport,
  buildExport,
  downloadExport,
  exportAllProjects,
  exportFileName,
  findConflicts,
  parseExportFile,
  type ConflictChoice,
  type ParsedImport,
} from '../storage/exportFile.ts';
import { saveImage, signatureKey } from '../storage/images.ts';
import {
  createProject,
  deleteProject,
  getCurrentProjectId,
  getProject,
  listProjects,
  saveProject,
  setCurrentProjectId,
} from '../storage/projects.ts';
import { ItemsTable } from './form/ItemsTable.tsx';
import { NumberInput } from './form/NumberInput.tsx';
import { ImportConflicts, ProjectsPanel, projectTitle } from './form/ProjectsPanel.tsx';
import { hasErrors, validateForm } from './form/validate.ts';
import { PageShell } from './PageShell.tsx';

/** Delay of the autosave after the last change. */
export const AUTOSAVE_MS = 300;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function upsert(list: Project[], project: Project): Project[] {
  const rest = list.filter((p) => p.id !== project.id);
  return [project, ...rest];
}

type Notice = { kind: 'status' | 'alert'; text: string };

export function FormPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [managersError, setManagersError] = useState<string | null>(null);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [importing, setImporting] = useState<{ parsed: ParsedImport; conflicts: Project[] } | null>(null);

  // Latest project for handlers that finish after an await (ЦБ, signature) and the not yet saved change.
  const currentRef = useRef<Project | null>(null);
  const pending = useRef<Project | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((project: Project) => {
    currentRef.current = project;
    setCurrent(project);
    setCurrentProjectId(project.id);
    setSubmitted(false);
    setRateError(null);
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const project = pending.current;
    pending.current = null;
    if (!project) return;
    try {
      await saveProject(project);
    } catch (error) {
      setNotice({ kind: 'alert', text: `Проект не сохранён: ${messageOf(error)}` });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listProjects();
        const remembered = getCurrentProjectId();
        // A new project is not saved until the first change, so an empty visit leaves nothing behind.
        const chosen = list.find((p) => p.id === remembered) ?? list[0] ?? createProject();
        if (cancelled) return;
        setProjects(list.some((p) => p.id === chosen.id) ? list : [chosen, ...list]);
        show(chosen);
      } catch (error) {
        if (!cancelled) setLoadError(`Хранилище браузера недоступно: ${messageOf(error)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  useEffect(() => {
    let cancelled = false;
    listManagers().then(
      (list) => !cancelled && setManagers(list),
      (error: unknown) => !cancelled && setManagersError(messageOf(error)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Save what is pending when the page is closed or left.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  function change(update: (form: ProjectForm) => ProjectForm) {
    const project = currentRef.current;
    if (!project) return;
    const next: Project = { ...project, form: update(project.form), updatedAt: new Date().toISOString() };
    currentRef.current = next;
    setCurrent(next);
    setProjects((list) => upsert(list, next));
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }

  function set<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    change((form) => ({ ...form, [key]: value }));
  }

  async function selectProject(id: string) {
    await flush();
    const project = (await getProject(id)) ?? projects.find((p) => p.id === id);
    if (project) show(project);
  }

  async function newProject() {
    await flush();
    const project = createProject();
    setProjects((list) => [project, ...list]);
    show(project);
  }

  async function removeProject(project: Project) {
    if (!window.confirm(`Удалить проект «${projectTitle(project)}»? Восстановить его будет нельзя.`)) return;
    if (pending.current?.id === project.id) {
      clearTimeout(timer.current);
      pending.current = null;
    }
    try {
      await deleteProject(project.id);
    } catch (error) {
      setNotice({ kind: 'alert', text: `Проект не удалён: ${messageOf(error)}` });
      return;
    }
    const rest = projects.filter((p) => p.id !== project.id);
    if (currentRef.current?.id === project.id) {
      const next = rest[0] ?? createProject();
      setProjects(rest.length ? rest : [next]);
      show(next);
    } else {
      setProjects(rest);
    }
  }

  async function exportOne() {
    const project = currentRef.current;
    if (!project) return;
    await flush();
    try {
      const file = await buildExport([project]);
      downloadExport(file, exportFileName(file, true));
    } catch (error) {
      setNotice({ kind: 'alert', text: `Экспорт не удался: ${messageOf(error)}` });
    }
  }

  async function exportAll() {
    await flush();
    try {
      const file = await exportAllProjects();
      downloadExport(file, exportFileName(file, false));
    } catch (error) {
      setNotice({ kind: 'alert', text: `Экспорт не удался: ${messageOf(error)}` });
    }
  }

  async function importFile(file: File) {
    setNotice(null);
    let parsed: ParsedImport;
    try {
      parsed = parseExportFile(await file.text());
    } catch (error) {
      setNotice({ kind: 'alert', text: messageOf(error) });
      return;
    }
    await flush();
    const conflicts = await findConflicts(parsed);
    if (conflicts.length > 0) setImporting({ parsed, conflicts });
    else await runImport(parsed, {});
  }

  async function runImport(parsed: ParsedImport, choices: Record<string, ConflictChoice>) {
    setImporting(null);
    try {
      const result = await applyImport(parsed, choices);
      const list = await listProjects();
      const open = currentRef.current;
      const fresh = open ? list.find((p) => p.id === open.id) : undefined;
      if (fresh) show(fresh);
      setProjects(open && !fresh ? [open, ...list] : list);
      setNotice({
        kind: 'status',
        text: `Импорт завершён: добавлено ${result.added}, заменено ${result.replaced}, копий ${result.copied}, пропущено ${result.skipped}.`,
      });
    } catch (error) {
      setNotice({ kind: 'alert', text: `Импорт не удался: ${messageOf(error)}` });
    }
  }

  function chooseManager(id: string) {
    const manager = managers?.find((m) => m.id === id);
    change((form) => ({ ...form, managerId: id, managerName: manager?.name ?? '' }));
    if (!manager) return;
    // The signature goes into the image store: the KP keeps it even if the manager is removed later.
    fetchSignature(manager.signature)
      .then((blob) => saveImage(signatureKey(manager.id), blob))
      .catch(() =>
        setNotice({ kind: 'alert', text: 'Подпись менеджера не загрузилась: в КП будет общий подвал без подписи.' }),
      );
  }

  async function loadRate() {
    setRateBusy(true);
    setRateError(null);
    try {
      const rates = await fetchRates();
      set('euroRate', rates.eur);
    } catch (error) {
      setRateError(`Курс ЦБ не получен (${messageOf(error)}). Введите курс вручную.`);
    } finally {
      setRateBusy(false);
    }
  }

  async function createKp() {
    const project = currentRef.current;
    if (!project) return;
    if (hasErrors(validateForm(project.form, true))) {
      setSubmitted(true);
      return;
    }
    await flush();
    navigate(`/kp/${project.id}`);
  }

  const top = (
    <div className="form-top">
      <h1 className="intro">Заполните форму КП</h1>
      <Link to="/managers" className="managers-link">
        Менеджеры
      </Link>
    </div>
  );

  if (loadError || !current) {
    return (
      <PageShell>
        <div className="form-page">
          {top}
          {loadError ? <p role="alert">{loadError}</p> : <p>Загрузка проектов…</p>}
        </div>
      </PageShell>
    );
  }

  const form = current.form;
  const errors = validateForm(form, submitted);
  const managerMissing = form.managerId !== '' && managers !== null && !managers.some((m) => m.id === form.managerId);

  return (
    <PageShell>
      <div className="form-page">
        {top}

        {notice && (
          <p className={notice.kind === 'alert' ? 'notice error' : 'notice'} role={notice.kind}>
            {notice.text}
          </p>
        )}
        {importing && (
          <ImportConflicts
            conflicts={importing.conflicts}
            onConfirm={(choices) => void runImport(importing.parsed, choices)}
            onCancel={() => setImporting(null)}
          />
        )}

        <div className="form-layout">
          <ProjectsPanel
            projects={projects}
            currentId={current.id}
            onSelect={(id) => void selectProject(id)}
            onCreate={() => void newProject()}
            onDelete={(p) => void removeProject(p)}
            onExportOne={() => void exportOne()}
            onExportAll={() => void exportAll()}
            onImportFile={(file) => void importFile(file)}
          />

          <form className="kp-form" key={current.id} onSubmit={(e) => e.preventDefault()} noValidate>
            <label className="field">
              <span>Менеджер</span>
              <select aria-label="Менеджер" value={form.managerId} onChange={(e) => chooseManager(e.target.value)}>
                <option value="">— выберите —</option>
                {managers?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                {managerMissing && <option value={form.managerId}>{`${form.managerName} (удалён из списка)`}</option>}
              </select>
            </label>
            {managersError && (
              <p className="hint error" role="alert">{`Список менеджеров не загружен: ${managersError}`}</p>
            )}
            {managerMissing && <p className="hint">Менеджер удалён из списка; в КП останется сохранённая подпись.</p>}

            <label className="field">
              <span>Название компании</span>
              <input
                type="text"
                className="beginingForm"
                placeholder="Название компании или ИП"
                value={form.client}
                onChange={(e) => set('client', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Имя контактного лица</span>
              <input
                type="text"
                className="beginingForm"
                placeholder="Имя контактного лица"
                value={form.clientName}
                onChange={(e) => set('clientName', e.target.value)}
              />
            </label>
            <div className="field" role="radiogroup" aria-label="Пол контактного лица">
              <span>Пол контактного лица</span>
              <label>
                <input type="radio" checked={form.clientSex === 'm'} onChange={() => set('clientSex', 'm')} /> Муж.
              </label>
              <label>
                <input type="radio" checked={form.clientSex === 'f'} onChange={() => set('clientSex', 'f')} /> Жен.
              </label>
            </div>
            <label className="field">
              <span>Ссылка на коллекцию</span>
              <input
                type="url"
                className={errors.link ? 'beginingForm invalid' : 'beginingForm'}
                aria-invalid={errors.link !== null}
                placeholder="https://ooogelingen.ru/…"
                value={form.link}
                onChange={(e) => set('link', e.target.value)}
              />
            </label>
            {errors.link && (
              <p className="hint error" role="alert">
                {errors.link}
              </p>
            )}
            <div className="field">
              <label htmlFor="euroRate">Курс евро</label>
              <NumberInput
                id="euroRate"
                className="beginingForm"
                placeholder="Например, 98,25"
                value={form.euroRate}
                invalid={errors.euroRate !== null}
                onValueChange={(value) => set('euroRate', value)}
              />
              {canFetchRates() && (
                <button type="button" title="Курс ЦБ на сегодня" disabled={rateBusy} onClick={() => void loadRate()}>
                  ЦБ
                </button>
              )}
            </div>
            {errors.euroRate && (
              <p className="hint error" role="alert">
                {errors.euroRate}
              </p>
            )}
            {rateError && (
              <p className="hint error" role="alert">
                {rateError}
              </p>
            )}

            <CurrencyChoice
              legend="Валюта основных материалов"
              value={form.mainCurrency}
              onChange={(v) => set('mainCurrency', v)}
            />
            <CurrencyChoice
              legend="Валюта дополнительных материалов"
              value={form.extraCurrency}
              onChange={(v) => set('extraCurrency', v)}
            />

            <ItemsTable
              legend="Основные материалы"
              label="Основные"
              items={form.mainItems}
              firstNo={1}
              onChange={(items) => set('mainItems', items)}
            />
            <ItemsTable
              legend="Дополнительные материалы и работы"
              label="Дополнительные"
              items={form.extraItems}
              firstNo={form.mainItems.length + 1}
              onChange={(items) => set('extraItems', items)}
            />

            <DeliveryChoice value={form.delivery} onChange={(v) => set('delivery', v)} />

            <p>
              <button type="button" className="primary" onClick={() => void createKp()}>
                Создать КП
              </button>
            </p>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function CurrencyChoice({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: CurrencyMode;
  onChange: (value: CurrencyMode) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <label>
        <input type="radio" checked={value === 'rub'} onChange={() => onChange('rub')} /> Рубли
      </label>
      <label>
        <input type="radio" checked={value === 'rubAndEuro'} onChange={() => onChange('rubAndEuro')} /> Рубли и евро
      </label>
    </fieldset>
  );
}

function DeliveryChoice({
  value,
  onChange,
}: {
  value: ProjectForm['delivery'];
  onChange: (value: ProjectForm['delivery']) => void;
}) {
  const setMode = (mode: ProjectForm['delivery']['mode']) => onChange({ ...value, mode });
  const setCustom = (custom: string[]) => onChange({ ...value, custom });
  return (
    <fieldset className="choice">
      <legend>Комментарий по доставке</legend>
      <label>
        <input type="radio" checked={value.mode === 'default'} onChange={() => setMode('default')} /> Доставка
        рассчитывается отдельно
      </label>
      <label>
        <input type="radio" checked={value.mode === 'none'} onChange={() => setMode('none')} /> Нет комментария
      </label>
      <label>
        <input type="radio" checked={value.mode === 'custom'} onChange={() => setMode('custom')} /> Свой
        комментарий
      </label>
      {value.mode === 'custom' && (
        <div className="custom-comments">
          {value.custom.map((text, index) => (
            <div className="item-row" key={index}>
              <input
                type="text"
                className="comment-text"
                aria-label={`Комментарий ${index + 1}`}
                value={text}
                onChange={(e) => setCustom(value.custom.map((t, i) => (i === index ? e.target.value : t)))}
              />
              <button
                type="button"
                className="row-button"
                aria-label={`Удалить комментарий ${index + 1}`}
                onClick={() => setCustom(value.custom.filter((_, i) => i !== index))}
              >
                –
              </button>
            </div>
          ))}
          <button
            type="button"
            className="row-button"
            aria-label="Добавить комментарий"
            onClick={() => setCustom([...value.custom, ''])}
          >
            +
          </button>
        </div>
      )}
    </fieldset>
  );
}
