import { useRef, useState } from 'react';
import type { Project } from '../../../shared/schema.ts';
import type { ConflictChoice } from '../../storage/exportFile.ts';

export function projectTitle(project: Project): string {
  return project.form.client.trim() || 'Без названия';
}

/** Case-insensitive search over the company and the contact person. */
export function filterProjects(projects: readonly Project[], query: string): Project[] {
  const q = query.trim().toLocaleLowerCase('ru');
  if (!q) return [...projects];
  return projects.filter((p) => `${p.form.client}\n${p.form.clientName}`.toLocaleLowerCase('ru').includes(q));
}

type Props = {
  projects: Project[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (project: Project) => void;
  onExportOne: () => void;
  onExportAll: () => void;
  onImportFile: (file: File) => void;
};

export function ProjectsPanel(props: Props) {
  const { projects, currentId, onSelect, onCreate, onDelete } = props;
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const shown = filterProjects(projects, query);

  return (
    <fieldset className="projects">
      <legend>Проекты</legend>
      <input
        type="search"
        className="projects-search"
        placeholder="Поиск по проектам"
        aria-label="Поиск по проектам"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="projects-list" aria-label="Список проектов">
        {shown.map((project) => (
          <li key={project.id} className="projects_list-item">
            <label>
              <input
                type="radio"
                name="project"
                checked={project.id === currentId}
                onChange={() => onSelect(project.id)}
              />{' '}
              {projectTitle(project)}
            </label>
            <button
              type="button"
              className="deleteProject"
              aria-label={`Удалить проект ${projectTitle(project)}`}
              title="Удалить проект"
              onClick={() => onDelete(project)}
            >
              ×
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted">Ничего не найдено</li>}
      </ul>
      <div className="projects-actions">
        <button type="button" onClick={onCreate}>
          Новый проект
        </button>
        <button type="button" onClick={props.onExportOne}>
          Экспорт проекта
        </button>
        <button type="button" onClick={props.onExportAll}>
          Экспорт всех проектов
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Импорт из файла
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="import-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) props.onImportFile(file);
          }}
        />
      </div>
    </fieldset>
  );
}

const CHOICE_LABELS: Record<ConflictChoice, string> = {
  replace: 'заменить',
  copy: 'импортировать как копию',
  skip: 'пропустить',
};

/** Asks what to do with each imported project whose id already exists here. */
export function ImportConflicts({
  conflicts,
  onConfirm,
  onCancel,
}: {
  conflicts: Project[];
  onConfirm: (choices: Record<string, ConflictChoice>) => void;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>(() =>
    Object.fromEntries(conflicts.map((p) => [p.id, 'skip' as const])),
  );
  return (
    <div className="import-conflicts" role="dialog" aria-label="Проекты уже есть">
      <p>Эти проекты уже есть в браузере. Что сделать с каждым?</p>
      {conflicts.map((project) => (
        <fieldset key={project.id}>
          <legend>{projectTitle(project)}</legend>
          {(Object.keys(CHOICE_LABELS) as ConflictChoice[]).map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name={`conflict-${project.id}`}
                checked={choices[project.id] === choice}
                onChange={() => setChoices((c) => ({ ...c, [project.id]: choice }))}
              />{' '}
              {CHOICE_LABELS[choice]}
            </label>
          ))}
        </fieldset>
      ))}
      <button type="button" onClick={() => onConfirm(choices)}>
        Импортировать
      </button>{' '}
      <button type="button" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}
