import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../shared/schema.ts';
import { getImage, clearImages, signatureKey } from '../storage/images.ts';
import { clearProjects, createProject, getProject, listProjects, saveProject } from '../storage/projects.ts';
import { FormPage } from './FormPage.tsx';
import { RATE_ERROR, LINK_ERROR } from './form/validate.ts';

const api = vi.hoisted(() => ({
  canFetchRates: vi.fn(() => true),
  fetchRates: vi.fn(),
  listManagers: vi.fn(),
  fetchSignature: vi.fn(),
}));

vi.mock('../api/client.ts', () => api);

function KpStub() {
  const { id } = useParams();
  return <p>{`КП ${id ?? ''}`}</p>;
}

function renderForm() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <FormPage /> },
      { path: '/kp/:id', element: <KpStub /> },
    ],
    { initialEntries: ['/'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

async function ready() {
  return screen.findByPlaceholderText('Название компании или ИП');
}

function project(client: string, patch: Partial<Project['form']> = {}, updatedAt = '2026-11-01T00:00:00.000Z'): Project {
  const p = createProject();
  return { ...p, updatedAt, form: { ...p.form, client, ...patch } };
}

beforeEach(async () => {
  await clearProjects();
  await clearImages();
  localStorage.clear();
  api.canFetchRates.mockReturnValue(true);
  api.listManagers.mockResolvedValue([
    { id: 'ivan', name: 'Иван Петров', signature: 'api/data/signatures/ivan.jpg' },
    { id: 'olga', name: 'Ольга Смирнова', signature: 'api/data/signatures/olga.png' },
  ]);
  api.fetchSignature.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
  api.fetchRates.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FormPage: autosave', () => {
  it('saves changes and restores them after a reload', async () => {
    const user = userEvent.setup();
    const first = renderForm();
    await user.type(await ready(), 'ТСК Гельстер');
    await user.type(screen.getByPlaceholderText('Имя контактного лица'), 'Ольга');
    await user.click(screen.getByLabelText('Жен.'));
    await user.type(screen.getByLabelText('Основные: наименование, строка 1'), 'Линолеум');
    await user.type(screen.getByLabelText('Основные: количество, строка 1'), '150,5');
    await user.type(screen.getByLabelText('Основные: цена в рублях, строка 1'), '1200');
    await user.selectOptions(screen.getByLabelText('Основные: единица, строка 1'), 'пог.м');

    await waitFor(async () => {
      const [saved] = await listProjects();
      expect(saved?.form.mainItems[0]).toMatchObject({ name: 'Линолеум', qty: 150.5, priceRub: 1200, unit: 'пог.м' });
    });
    const [saved] = await listProjects();
    expect(saved?.form).toMatchObject({ client: 'ТСК Гельстер', clientName: 'Ольга', clientSex: 'f' });

    first.unmount();
    renderForm();
    expect(await ready()).toHaveProperty('value', 'ТСК Гельстер');
    expect(screen.getByPlaceholderText('Имя контактного лица')).toHaveProperty('value', 'Ольга');
    expect(screen.getByLabelText('Жен.')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('Основные: количество, строка 1')).toHaveProperty('value', '150,5');
    expect(screen.getByLabelText('Основные: единица, строка 1')).toHaveProperty('value', 'пог.м');
  });

  it('a pending change is saved on leaving the page before the autosave delay', async () => {
    const user = userEvent.setup();
    const view = renderForm();
    await user.type(await ready(), 'Быстро');
    view.unmount();
    await waitFor(async () => expect((await listProjects())[0]?.form.client).toBe('Быстро'));
  });

  it('reopens the project that was open, not just the newest', async () => {
    const old = project('Старый', {}, '2026-01-01T00:00:00.000Z');
    const recent = project('Новый', {}, '2026-11-01T00:00:00.000Z');
    await saveProject(old);
    await saveProject(recent);
    const user = userEvent.setup();
    const view = renderForm();
    expect(await ready()).toHaveProperty('value', 'Новый');
    await user.click(screen.getByLabelText('Старый'));
    await waitFor(() => expect(screen.getByPlaceholderText('Название компании или ИП')).toHaveProperty('value', 'Старый'));
    view.unmount();
    renderForm();
    expect(await ready()).toHaveProperty('value', 'Старый');
  });
});

describe('FormPage: projects', () => {
  it('search filters by company and contact person', async () => {
    await saveProject(project('ТСК Гельстер', { clientName: 'Михаил' }));
    await saveProject(project('Gelingen', { clientName: 'Анна' }));
    await saveProject(project('Ромашка', { clientName: 'Пётр' }));
    const user = userEvent.setup();
    renderForm();
    await ready();
    const list = screen.getByRole('list', { name: 'Список проектов' });
    expect(within(list).getAllByRole('radio')).toHaveLength(3);
    await user.type(screen.getByLabelText('Поиск по проектам'), 'гельст');
    expect(within(list).getAllByRole('radio')).toHaveLength(1);
    expect(within(list).getByText('ТСК Гельстер')).toBeTruthy();
    await user.clear(screen.getByLabelText('Поиск по проектам'));
    await user.type(screen.getByLabelText('Поиск по проектам'), 'анна');
    expect(within(list).getByText('Gelingen')).toBeTruthy();
    await user.clear(screen.getByLabelText('Поиск по проектам'));
    await user.type(screen.getByLabelText('Поиск по проектам'), 'нет такого');
    expect(within(list).queryAllByRole('radio')).toHaveLength(0);
    expect(within(list).getByText('Ничего не найдено')).toBeTruthy();
  });

  it('creates a new project and deletes one after confirmation', async () => {
    await saveProject(project('Первый'));
    const user = userEvent.setup();
    renderForm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Новый проект' }));
    expect(screen.getByPlaceholderText('Название компании или ИП')).toHaveProperty('value', '');
    await user.type(screen.getByPlaceholderText('Название компании или ИП'), 'Второй');
    await waitFor(async () => expect(await listProjects()).toHaveLength(2));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Удалить проект Первый' }));
    expect(await listProjects()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Удалить проект Первый' }));
    await waitFor(async () => expect((await listProjects()).map((p) => p.form.client)).toEqual(['Второй']));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Первый')).toBeNull();
  });

  it('a broken import file shows an error and changes nothing', async () => {
    await saveProject(project('Не трогать'));
    const user = userEvent.setup();
    renderForm();
    await ready();
    const file = new File(['{"format":"gelster-kp",'], 'broken.json', { type: 'application/json' });
    await user.upload(screen.getByTestId('import-file'), file);
    expect((await screen.findByRole('alert')).textContent).toMatch(/не JSON.*данные не изменены/);
    expect((await listProjects()).map((p) => p.form.client)).toEqual(['Не трогать']);
  });

  it('import with an existing id asks what to do', async () => {
    const existing = project('Было');
    await saveProject(existing);
    const file = new File(
      [
        JSON.stringify({
          format: 'gelster-kp',
          version: 1,
          exportedAt: '2026-11-12T00:00:00Z',
          projects: [{ ...existing, form: { ...existing.form, client: 'Стало' } }],
          images: {},
        }),
      ],
      'p.json',
      { type: 'application/json' },
    );
    const user = userEvent.setup();
    renderForm();
    await ready();
    await user.upload(screen.getByTestId('import-file'), file);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('заменить'));
    await user.click(within(dialog).getByRole('button', { name: 'Импортировать' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/заменено 1/);
    expect((await getProject(existing.id))?.form.client).toBe('Стало');
    expect(screen.getByPlaceholderText('Название компании или ИП')).toHaveProperty('value', 'Стало');
  });
});

describe('FormPage: fields', () => {
  it('only roubles price, units шт./м²/пог.м, no discount, VAT or euro price fields', async () => {
    renderForm();
    await ready();
    const units = screen.getByLabelText('Основные: единица, строка 1') as HTMLSelectElement;
    expect([...units.options].map((o) => o.value)).toEqual(['шт.', 'м²', 'пог.м']);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/рул\.|скидк|НДС/i);
    for (const input of document.querySelectorAll('input, select')) {
      const name = input.getAttribute('aria-label') ?? input.getAttribute('placeholder') ?? '';
      expect(name).not.toMatch(/евро|скидк|НДС/i);
    }
    expect(screen.getByLabelText('Основные: цена в рублях, строка 1')).toBeTruthy();
  });

  it('adds and deletes rows; extra numbering continues the main one', async () => {
    const user = userEvent.setup();
    renderForm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Основные: добавить строку' }));
    await user.click(screen.getByRole('button', { name: 'Основные: добавить строку' }));
    expect(screen.getAllByTestId('Основные-row')).toHaveLength(3);
    expect(screen.getByLabelText('Дополнительные: наименование, строка 4')).toBeTruthy();

    await user.type(screen.getByLabelText('Основные: наименование, строка 2'), 'Плинтус');
    await user.click(screen.getByRole('button', { name: 'Основные: удалить строку 1' }));
    expect(screen.getAllByTestId('Основные-row')).toHaveLength(2);
    expect(screen.getByLabelText('Основные: наименование, строка 1')).toHaveProperty('value', 'Плинтус');
    expect(screen.getByLabelText('Дополнительные: наименование, строка 3')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Дополнительные: удалить строку 3' }));
    expect(screen.queryAllByTestId('Дополнительные-row')).toHaveLength(0);
    await waitFor(async () => {
      const form = (await listProjects())[0]?.form;
      expect(form?.mainItems.map((i) => i.name)).toEqual(['Плинтус', '']);
      expect(form?.extraItems).toEqual([]);
    });
  });

  it('highlights empty quantity and price of a named row', async () => {
    const user = userEvent.setup();
    renderForm();
    await ready();
    const qty = screen.getByLabelText('Основные: количество, строка 1');
    const price = screen.getByLabelText('Основные: цена в рублях, строка 1');
    expect(qty.getAttribute('aria-invalid')).toBe('false');
    await user.type(screen.getByLabelText('Основные: наименование, строка 1'), 'Линолеум');
    expect(qty.getAttribute('aria-invalid')).toBe('true');
    expect(price.className).toContain('invalid');
    await user.type(qty, '10');
    expect(qty.getAttribute('aria-invalid')).toBe('false');
    await user.type(price, 'abc');
    expect(price.getAttribute('aria-invalid')).toBe('true');
  });

  it('rate is required and positive when a table shows euros', async () => {
    const user = userEvent.setup();
    const { router } = renderForm();
    await ready();
    expect(screen.queryByText(RATE_ERROR)).toBeNull();
    const extra = screen.getByRole('group', { name: 'Валюта дополнительных материалов' });
    await user.click(within(extra).getByLabelText('Рубли и евро'));
    expect(screen.getByText(RATE_ERROR)).toBeTruthy();
    const rate = screen.getByLabelText('Курс евро');
    expect(rate.getAttribute('aria-invalid')).toBe('true');

    await user.type(screen.getByPlaceholderText('https://ooogelingen.ru/…'), 'https://ooogelingen.ru/forbo_clean.htm');
    await user.type(rate, '0');
    expect(screen.getByText(RATE_ERROR)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Создать КП' }));
    expect(router.state.location.pathname).toBe('/');

    await user.clear(rate);
    await user.type(rate, '98,5');
    expect(screen.queryByText(RATE_ERROR)).toBeNull();
    await user.click(within(extra).getByLabelText('Рубли'));
    await user.clear(rate);
    expect(screen.queryByText(RATE_ERROR)).toBeNull();
  });

  it('link must point to gelster.ru or ooogelingen.ru; «Создать КП» opens #/kp/<id>', async () => {
    const user = userEvent.setup();
    const { router } = renderForm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Создать КП' }));
    expect(screen.getByText('Вставьте ссылку на коллекцию')).toBeTruthy();
    const link = screen.getByPlaceholderText('https://ooogelingen.ru/…');
    await user.type(link, 'https://gelster.ru.evil.com/x');
    expect(screen.getByText(LINK_ERROR)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Создать КП' }));
    expect(router.state.location.pathname).toBe('/');

    await user.clear(link);
    await user.type(link, 'https://www.gelster.ru/catalog/x');
    expect(screen.queryByText(LINK_ERROR)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Создать КП' }));
    const [saved] = await listProjects();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/kp/${saved?.id ?? 'none'}`));
    expect(saved?.form.link).toBe('https://www.gelster.ru/catalog/x');
  });

  it('«ЦБ» puts the CBR rate into the field', async () => {
    api.fetchRates.mockResolvedValue({ eur: 98.1234, usd: 90, date: '2026-11-12' });
    const user = userEvent.setup();
    renderForm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'ЦБ' }));
    await waitFor(() => expect(screen.getByLabelText('Курс евро')).toHaveProperty('value', '98,1234'));
    await waitFor(async () => expect((await listProjects())[0]?.form.euroRate).toBe(98.1234));
  });

  it('«ЦБ» failure asks to type the rate by hand', async () => {
    const { ApiError } = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
    api.fetchRates.mockRejectedValue(new ApiError('Сервер приложения недоступен', 502));
    const user = userEvent.setup();
    renderForm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'ЦБ' }));
    expect((await screen.findByText(/Курс ЦБ не получен/)).textContent).toMatch(/Введите курс вручную/);
  });

  it('no «ЦБ» button without a server', async () => {
    api.canFetchRates.mockReturnValue(false);
    renderForm();
    await ready();
    expect(screen.queryByRole('button', { name: 'ЦБ' })).toBeNull();
  });

  it('choosing a manager stores the name and the signature', async () => {
    const user = userEvent.setup();
    renderForm();
    await ready();
    await screen.findByRole('option', { name: 'Ольга Смирнова' });
    await user.selectOptions(screen.getByLabelText('Менеджер'), 'olga');
    expect(api.fetchSignature).toHaveBeenCalledWith('api/data/signatures/olga.png');
    await waitFor(async () => expect(await getImage(signatureKey('olga'))).not.toBeNull());
    await waitFor(async () =>
      expect((await listProjects())[0]?.form).toMatchObject({ managerId: 'olga', managerName: 'Ольга Смирнова' }),
    );
  });

  it('a manager removed from the list is still shown with a warning', async () => {
    await saveProject(project('X', { managerId: 'gone', managerName: 'Уволенный' }));
    renderForm();
    await ready();
    expect(await screen.findByRole('option', { name: 'Уволенный (удалён из списка)' })).toBeTruthy();
    expect(screen.getByText(/Менеджер удалён из списка/)).toBeTruthy();
  });
});
