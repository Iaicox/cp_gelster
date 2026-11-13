import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.ts';
import { ManagersPage } from './ManagersPage.tsx';

const api = vi.hoisted(() => ({
  canManageManagers: vi.fn(() => true),
  listManagers: vi.fn(),
  login: vi.fn(),
  addManager: vi.fn(),
  deleteManager: vi.fn(),
}));

vi.mock('../api/client.ts', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../api/client.ts')>()).ApiError,
  ...api,
}));

const IVAN = { id: 'ivan', name: 'Иван Петров', signature: 'api/data/signatures/ivan.jpg' };

function renderPage() {
  const router = createMemoryRouter([{ path: '/managers', element: <ManagersPage /> }], {
    initialEntries: ['/managers'],
  });
  return render(<RouterProvider router={router} />);
}

async function logIn(user: ReturnType<typeof userEvent.setup>, password = 'secret') {
  await user.type(screen.getByLabelText('Пароль'), password);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

beforeEach(() => {
  api.canManageManagers.mockReturnValue(true);
  api.listManagers.mockResolvedValue([IVAN]);
  api.login.mockResolvedValue(undefined);
  api.addManager.mockReset();
  api.deleteManager.mockReset();
  api.deleteManager.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ManagersPage', () => {
  it('without a password the list is read-only', async () => {
    renderPage();
    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(screen.getByLabelText('Пароль')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Удалить/ })).toBeNull();
    expect(screen.queryByText('Добавить менеджера')).toBeNull();
  });

  it.each([
    [401, 'Неверный пароль'],
    [429, 'заблокирован на 15 минут'],
    [503, 'Пароль администратора не задан'],
  ])('login error %i has its own message', async (status, text) => {
    api.login.mockRejectedValue(new ApiError('server text', status));
    const user = userEvent.setup();
    renderPage();
    await logIn(user, 'wrong');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(text);
    expect(api.login).toHaveBeenCalledWith('wrong');
    expect(screen.queryByRole('button', { name: /Удалить/ })).toBeNull();
    expect(screen.getByLabelText('Пароль')).toBeTruthy();
  });

  it('the three messages are different', async () => {
    const { managersErrorText } = await import('./ManagersPage.tsx');
    const texts = [401, 429, 503].map((s) => managersErrorText(new ApiError('x', s)));
    expect(new Set(texts).size).toBe(3);
  });

  it('after login adds a manager with the password, name and file', async () => {
    const added = { id: 'olga', name: 'Ольга', signature: 'api/data/signatures/olga.png' };
    api.addManager.mockResolvedValue(added);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user);
    await screen.findByText('Добавить менеджера');
    expect(screen.queryByLabelText('Пароль')).toBeNull();

    const file = new File([new Uint8Array([0x89, 0x50])], 'olga.png', { type: 'image/png' });
    await user.type(screen.getByLabelText('Имя'), '  Ольга ');
    await user.upload(screen.getByLabelText('Подпись (JPG или PNG)'), file);
    expect(screen.getByAltText('Предпросмотр подписи').getAttribute('src')).toBe('blob:preview');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(api.addManager).toHaveBeenCalledWith('secret', 'Ольга', file);
    expect(await screen.findByText('Ольга')).toBeTruthy();
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', '');
  });

  it('refuses a signature that is not JPG or PNG', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await logIn(user);
    await screen.findByText('Добавить менеджера');
    await user.type(screen.getByLabelText('Имя'), 'Ольга');
    await user.upload(screen.getByLabelText('Подпись (JPG или PNG)'), new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(screen.getByText('Загружаемый файл должен быть в формате JPG или PNG.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Добавить' })).toHaveProperty('disabled', true);
  });

  async function openForm(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user);
    await screen.findByText('Добавить менеджера');
  }

  const PNG = () => new File([new Uint8Array([0x89, 0x50])], 'olga.png', { type: 'image/png' });
  const PDF = () => new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
  const form = () => {
    const found = screen.getByRole('heading', { name: 'Добавить менеджера' }).closest('form');
    if (!found) throw new Error('no add-manager form');
    return found;
  };
  const dropZone = () => screen.getByText('Перетащите картинку сюда или вставьте из буфера (Ctrl+V)');

  it('a dropped PNG shows a preview, is sent, and the form is cleared', async () => {
    const added = { id: 'olga', name: 'Ольга', signature: 'api/data/signatures/olga.png' };
    api.addManager.mockResolvedValue(added);
    const user = userEvent.setup();
    await openForm(user);
    await user.type(screen.getByLabelText('Имя'), 'Ольга');
    const file = PNG();
    fireEvent.dragOver(dropZone(), { dataTransfer: { files: [file], dropEffect: 'none' } });
    expect(dropZone().className).toContain('drag-over');
    fireEvent.drop(dropZone(), { dataTransfer: { files: [file] } });
    expect(dropZone().className).not.toContain('drag-over');
    expect(screen.getByAltText('Предпросмотр подписи').getAttribute('src')).toBe('blob:preview');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(api.addManager).toHaveBeenCalledWith('secret', 'Ольга', file);
    await screen.findByText('Ольга');
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', '');
    expect(screen.queryByAltText('Предпросмотр подписи')).toBeNull();
    expect(screen.getByRole('button', { name: 'Добавить' })).toHaveProperty('disabled', true);
  });

  it('a pasted image from clipboardData.files is used', async () => {
    api.addManager.mockResolvedValue({ id: 'olga', name: 'Ольга', signature: 'x.png' });
    const user = userEvent.setup();
    await openForm(user);
    await user.type(screen.getByLabelText('Имя'), 'Ольга');
    const file = PNG();
    const event = createEvent.paste(screen.getByLabelText('Имя'), { clipboardData: { files: [file], items: [] } });
    fireEvent(screen.getByLabelText('Имя'), event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByAltText('Предпросмотр подписи')).toBeTruthy();
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Ольга');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(api.addManager).toHaveBeenCalledWith('secret', 'Ольга', file);
    await screen.findByText('Ольга');
    expect(screen.queryByAltText('Предпросмотр подписи')).toBeNull();
  });

  it('a pasted screenshot without a name comes from items and is named signature.png', async () => {
    api.addManager.mockResolvedValue({ id: 'olga', name: 'Ольга', signature: 'x.png' });
    const user = userEvent.setup();
    await openForm(user);
    await user.type(screen.getByLabelText('Имя'), 'Ольга');
    const blob = new File([new Uint8Array([0x89, 0x50])], '', { type: 'image/png' });
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => blob },
    ];
    fireEvent.paste(form(), { clipboardData: { files: [], items } });
    expect(screen.getByAltText('Предпросмотр подписи')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    const sent = api.addManager.mock.calls[0]?.[2] as File;
    expect(sent.name).toBe('signature.png');
    expect(sent.type).toBe('image/png');
  });

  it('pasting text into the name field works as usual', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(screen.getByLabelText('Имя'));
    await user.paste('Ольга Смирнова');
    expect(screen.getByLabelText('Имя')).toHaveProperty('value', 'Ольга Смирнова');
    expect(screen.queryByAltText('Предпросмотр подписи')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['dropped', () => fireEvent.drop(dropZone(), { dataTransfer: { files: [PDF()] } })],
    ['pasted', () => fireEvent.paste(form(), { clipboardData: { files: [PDF()], items: [] } })],
  ])('a %s PDF is refused with the format message', async (_how, act) => {
    const user = userEvent.setup();
    await openForm(user);
    await user.type(screen.getByLabelText('Имя'), 'Ольга');
    act();
    expect(screen.getByRole('alert').textContent).toBe('Загружаемый файл должен быть в формате JPG или PNG.');
    expect(screen.queryByAltText('Предпросмотр подписи')).toBeNull();
    expect(screen.getByRole('button', { name: 'Добавить' })).toHaveProperty('disabled', true);
  });

  it('while the form is shown a drop on the window is cancelled; not after unmount', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user);
    await screen.findByText('Добавить менеджера');
    const drop = new Event('drop', { cancelable: true });
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    const over = new Event('dragover', { cancelable: true });
    window.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    view.unmount();
    const later = new Event('drop', { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('deletes after confirmation, with the password', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user);
    const list = await screen.findByRole('list', { name: 'Список менеджеров' });
    await user.click(within(list).getByRole('button', { name: 'Удалить Иван Петров' }));
    expect(api.deleteManager).not.toHaveBeenCalled();
    await user.click(within(list).getByRole('button', { name: 'Удалить Иван Петров' }));
    expect(api.deleteManager).toHaveBeenCalledWith('secret', 'ivan');
    await waitFor(() => expect(screen.queryByText('Иван Петров')).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('a 401 on a change asks for the password again', async () => {
    api.deleteManager.mockRejectedValue(new ApiError('x', 401));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user);
    await user.click(await screen.findByRole('button', { name: 'Удалить Иван Петров' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Неверный пароль');
    expect(screen.getByLabelText('Пароль')).toBeTruthy();
    expect(screen.getByText('Иван Петров')).toBeTruthy();
  });

  it('serverless mode: no login, a clear message, list still shown', async () => {
    api.canManageManagers.mockReturnValue(false);
    renderPage();
    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/без сервера/);
    expect(screen.queryByLabelText('Пароль')).toBeNull();
  });

  it('the password is not kept anywhere but memory', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await screen.findByText('Иван Петров');
    await logIn(user, 'secret');
    await screen.findByText('Добавить менеджера');
    expect(JSON.stringify({ ...localStorage })).not.toContain('secret');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret');
    view.unmount();
    renderPage();
    expect(await screen.findByLabelText('Пароль')).toBeTruthy();
  });
});
