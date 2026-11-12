import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Manager } from '../../shared/schema.ts';
import { addManager, ApiError, canManageManagers, deleteManager, listManagers, login } from '../api/client.ts';
import { PageShell } from './PageShell.tsx';

/** Message for a failed managers request: the status decides, the server text is the fallback. */
export function managersErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Неверный пароль.';
      case 429:
        return 'Слишком много неверных попыток: вход с этого компьютера заблокирован на 15 минут.';
      case 503:
        return 'Пароль администратора не задан на сервере: изменить список нельзя. Задайте пароль командой php api/tools/set-password.php.';
      case 0:
        return error.message;
      default:
        return error.message || `Ошибка сервера (HTTP ${error.status})`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

const ACCEPTED = ['image/jpeg', 'image/png'];

export function ManagersPage() {
  const manageable = canManageManagers();
  // The password lives only in this component's memory: it is gone after a reload or on leaving the page.
  const [password, setPassword] = useState<string | null>(null);
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listManagers().then(
      (list) => !cancelled && setManagers(list),
      (e: unknown) => !cancelled && setListError(managersErrorText(e)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /** Runs a request; a 401 means the password was changed or is wrong: ask for it again. */
  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(managersErrorText(e));
      if (e instanceof ApiError && e.status === 401) setPassword(null);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="managers-page">
        <h1 className="intro">Менеджеры</h1>
        <p>
          <Link to="/">К форме</Link>
        </p>

        {!manageable && (
          <p className="notice" role="status">
            Приложение работает без сервера: список менеджеров только для чтения, он берётся из файла managers.json
            рядом с приложением и правится вручную.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}

        {manageable && password === null && (
          <LoginForm busy={busy} onLogin={(value) => run(() => login(value)).then((ok) => ok && setPassword(value))} />
        )}

        {listError && (
          <p className="notice error" role="alert">{`Список менеджеров не загружен: ${listError}`}</p>
        )}
        {managers && (
          <ul className="managers-list" aria-label="Список менеджеров">
            {managers.map((m) => (
              <li key={m.id}>
                <span>{m.name}</span>
                <img src={m.signature} alt={`Подпись: ${m.name}`} className="signature-preview" />
                {password !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Удалить ${m.name}`}
                    onClick={() => {
                      if (!window.confirm(`Удалить менеджера «${m.name}» и его подпись?`)) return;
                      void run(async () => {
                        await deleteManager(password, m.id);
                        setManagers((list) => list?.filter((x) => x.id !== m.id) ?? null);
                      });
                    }}
                  >
                    Удалить
                  </button>
                )}
              </li>
            ))}
            {managers.length === 0 && <li>Список пуст</li>}
          </ul>
        )}

        {password !== null && (
          <AddManagerForm
            busy={busy}
            onAdd={(name, file) =>
              run(async () => {
                const added = await addManager(password, name, file);
                setManagers((list) => [...(list ?? []), added]);
              })
            }
          />
        )}
      </div>
    </PageShell>
  );
}

function LoginForm({ busy, onLogin }: { busy: boolean; onLogin: (password: string) => void }) {
  const [value, setValue] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value) onLogin(value);
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <p>Чтобы изменить список, введите пароль администратора.</p>
      <label>
        Пароль{' '}
        <input type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>{' '}
      <button type="submit" disabled={busy || value === ''}>
        Войти
      </button>
    </form>
  );
}

function AddManagerForm({ busy, onAdd }: { busy: boolean; onAdd: (name: string, file: File) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  // Releases the previous preview URL when it is replaced and on leaving the page.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(next: File | undefined) {
    setFileError(null);
    const ok = next !== undefined && ACCEPTED.includes(next.type);
    if (next && !ok) setFileError('Подпись — картинка JPG или PNG.');
    setFile(ok ? next : null);
    setPreview(ok ? URL.createObjectURL(next) : null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !file) return;
    if (await onAdd(trimmed, file)) {
      setName('');
      setFile(null);
      setPreview(null);
      setInputKey((k) => k + 1);
    }
  }

  return (
    <form className="add-manager" onSubmit={(e) => void submit(e)}>
      <h2>Добавить менеджера</h2>
      <label className="field">
        <span>Имя</span>
        <input type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Подпись (JPG или PNG)</span>
        <input
          key={inputKey}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {fileError && (
        <p className="hint error" role="alert">
          {fileError}
        </p>
      )}
      {preview && <img src={preview} alt="Предпросмотр подписи" className="signature-preview" />}
      <p>
        <button type="submit" disabled={busy || name.trim() === '' || file === null}>
          Добавить
        </button>
      </p>
    </form>
  );
}
