import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Collection, KpEdits, Project } from '../../shared/schema.ts';
import { createInitialKp } from '../kp/model.ts';
import { clearImages, getImage } from '../storage/images.ts';
import { clearProjects, createProject, getProject, saveProject } from '../storage/projects.ts';
import { KpPage } from './KpPage.tsx';

const api = vi.hoisted(() => ({
  fetchCollection: vi.fn(),
  listManagers: vi.fn(),
  fetchImage: vi.fn(),
  fetchSignature: vi.fn(),
}));

vi.mock('../api/client.ts', () => api);

const SITE = 'https://ooogelingen.ru';
const CODES = ['350', '351', '352', '353', '354', '355'];

const COLLECTION: Collection = {
  sourceUrl: `${SITE}/m_cocoa.htm`,
  site: 'ooogelingen',
  fetchedAt: '2026-11-01T00:00:00.000Z',
  name: 'Marmoleum Cocoa',
  flooringKind: 'Натуральный линолеум с какао',
  manufacturer: 'Forbo',
  descriptionHtml: '<p>Первый абзац.</p><p>Второй абзац.</p>',
  mainImage: `${SITE}/main.jpg`,
  articles: CODES.map((code) => ({ code, image: `${SITE}/${code}.jpg` })),
  features: [
    { cells: [{ html: 'Толщина' }, { html: '2,5 мм' }] },
    { cells: [{ html: 'Ширина' }, { html: '2 м' }] },
    { cells: [{ html: 'Вес' }, { html: '3 кг' }] },
  ],
  warnings: [],
};

function project(kp: Partial<KpEdits> | null = null, form: Partial<Project['form']> = {}): Project {
  const base = createProject();
  return {
    ...base,
    form: {
      ...base.form,
      client: 'Ромашка',
      clientName: 'Анна',
      clientSex: 'f',
      link: COLLECTION.sourceUrl,
      mainItems: [{ id: 'i1', name: 'Линолеум', qty: 10, unit: 'м²', priceRub: 100 }],
      ...form,
    },
    collection: COLLECTION,
    kp: kp === null ? null : { ...createInitialKp(COLLECTION), ...kp },
  };
}

const chosen = (codes: string[]) =>
  codes.map((code) => ({ code, image: `${SITE}/${code}.jpg`, caption: `Арт. ${code}` }));

async function openKp(p: Project) {
  await saveProject(p);
  const router = createMemoryRouter([{ path: '/kp/:id', element: <KpPage /> }], { initialEntries: [`/kp/${p.id}`] });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(document.querySelector('.kp-pages[data-ready="true"]')).not.toBeNull());
}

async function stored(id: string): Promise<KpEdits> {
  const kp = (await getProject(id))?.kp;
  if (!kp) throw new Error('kp is not saved');
  return kp;
}

/** Codes of the articles on the pages, row by row. */
function articleRows(): string[][] {
  return Array.from(document.querySelectorAll('.kp-pages .table-items tr'))
    .filter((_, i) => i % 2 === 1)
    .map((row) => Array.from(row.querySelectorAll('th')).map((th) => th.textContent?.replace('Арт. ', '') ?? ''));
}

/** Edits a text box the way the browser leaves it after typing, then leaves it. */
async function edit(box: HTMLElement, html: string) {
  box.focus();
  box.innerHTML = html;
  fireEvent.blur(box);
  await waitFor(() => expect(document.querySelector('.kp-pages[data-ready="true"]')).not.toBeNull());
}

beforeEach(async () => {
  await clearProjects();
  await clearImages();
  api.listManagers.mockResolvedValue([]);
  api.fetchImage.mockImplementation((url: string) => Promise.resolve(new Blob([url], { type: 'image/png' })));
  api.fetchSignature.mockRejectedValue(new Error('нет'));
  api.fetchCollection.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('KpPage: article picker', () => {
  it('opens on the first opening; «Выбрать все» and «Подтвердить» put the articles in rows of 4 and store the pictures', async () => {
    const user = userEvent.setup();
    const p = project();
    await openKp(p);
    const dialog = await screen.findByRole('dialog', { name: 'Выберите артикулы' });
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(6);
    expect(within(dialog).getAllByRole('checkbox').some((box) => (box as HTMLInputElement).checked)).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));
    expect((within(dialog).getByRole('alert')).textContent).toContain('Вы не выбрали ни одного артикула');

    await user.click(within(dialog).getByRole('button', { name: 'Выбрать все' }));
    await user.click(within(dialog).getByRole('button', { name: 'Отменить выбор' }));
    expect(within(dialog).getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Выбрать все' }));
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(articleRows()).toEqual([CODES.slice(0, 4), CODES.slice(4)]));
    expect((await stored(p.id)).selectedArticles.map((a) => a.code)).toEqual(CODES);
    for (const code of CODES) expect(await getImage(`${SITE}/${code}.jpg`)).not.toBeNull();
    expect(await getImage(`${SITE}/main.jpg`)).not.toBeNull();

    // Once picked, the picker does not open by itself again.
    cleanup();
    await openKp((await getProject(p.id)) as Project);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Добавить артикулы» keeps the chosen ones (and their captions) and appends the new ones', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: [{ code: '352', image: `${SITE}/352.jpg`, caption: 'Мой 352' }] });
    await openKp(p);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Добавить артикулы' }));
    const dialog = screen.getByRole('dialog', { name: 'Добавьте артикулы' });
    const locked = within(dialog).getByRole('checkbox', { name: /352/ });
    expect((locked as HTMLInputElement).checked).toBe(true);
    expect((locked as HTMLInputElement).disabled).toBe(true);
    await user.click(within(dialog).getByRole('checkbox', { name: /350/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /355/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));

    await waitFor(async () =>
      expect((await stored(p.id)).selectedArticles.map((a) => a.caption)).toEqual(['Мой 352', 'Арт. 350', 'Арт. 355']),
    );
    await waitFor(() => expect(articleRows()).toEqual([['Мой 352', '350', '355']]));
  });

  it('«Перевыбрать артикулы» starts from nothing and replaces the choice; «Закрыть» changes nothing', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350', '351', '352']) });
    await openKp(p);

    await user.click(screen.getByRole('button', { name: 'Перевыбрать артикулы' }));
    let dialog = screen.getByRole('dialog', { name: 'Выберите артикулы' });
    await user.click(within(dialog).getByRole('checkbox', { name: /353/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect((await stored(p.id)).selectedArticles.map((a) => a.code)).toEqual(['350', '351', '352']);

    await user.click(screen.getByRole('button', { name: 'Перевыбрать артикулы' }));
    dialog = screen.getByRole('dialog', { name: 'Выберите артикулы' });
    expect(within(dialog).getAllByRole('checkbox').filter((box) => (box as HTMLInputElement).checked)).toEqual([]);
    await user.click(within(dialog).getByRole('checkbox', { name: /354/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /351/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));
    await waitFor(async () => expect((await stored(p.id)).selectedArticles.map((a) => a.code)).toEqual(['351', '354']));
    await waitFor(() => expect(articleRows()).toEqual([['351', '354']]));
  });
});

describe('KpPage: editing in place', () => {
  it('cleans an edited paragraph: no script, no handlers, the whitelisted markup stays', async () => {
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    const first = screen.getAllByRole('textbox', { name: 'Абзац описания' })[0] as HTMLElement;
    await edit(
      first,
      'Новый <b onclick="alert(1)">текст</b><script>alert(2)</script><img src="x" onerror="alert(3)"><span style="color:red">!</span>',
    );

    const html = (await stored(p.id)).descriptionHtml;
    expect(html).toBe('<p>Новый <b>текст</b>!</p><p>Второй абзац.</p>');
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Абзац описания' })[0]?.innerHTML).toBe('Новый <b>текст</b>!'));
    expect(document.querySelector('.kp-pages script, .kp-pages [onclick], .kp-pages [onerror]')).toBeNull();
  });

  it('pastes plain text only', async () => {
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    const first = screen.getAllByRole('textbox', { name: 'Абзац описания' })[0] as HTMLElement;
    first.focus();
    const range = document.createRange();
    range.selectNodeContents(first);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const data = new Map([
      ['text/plain', ' и вставка'],
      ['text/html', '<b> и вставка</b><script>alert(1)</script>'],
    ]);
    fireEvent.paste(first, { clipboardData: { getData: (type: string) => data.get(type) ?? '' } });
    expect(first.innerHTML).toBe('Первый абзац. и вставка');
    fireEvent.blur(first);
    await waitFor(async () => expect((await stored(p.id)).descriptionHtml).toContain('<p>Первый абзац. и вставка</p>'));
  });

  it('Enter splits a paragraph into several on blur; «×» deletes a paragraph', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    const first = screen.getAllByRole('textbox', { name: 'Абзац описания' })[0] as HTMLElement;
    // What Chrome leaves after Enter in a contenteditable block: the new lines are <div>s.
    await edit(first, 'Первая строка<div>Вторая строка</div><div><br></div><div>Третья</div>');
    expect((await stored(p.id)).descriptionHtml).toBe(
      '<p>Первая строка</p><p>Вторая строка</p><p>Третья</p><p>Второй абзац.</p>',
    );
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Абзац описания' })).toHaveLength(4));

    await user.click(screen.getAllByRole('button', { name: 'Удалить абзац' })[1] as HTMLElement);
    await waitFor(async () =>
      expect((await stored(p.id)).descriptionHtml).toBe('<p>Первая строка</p><p>Третья</p><p>Второй абзац.</p>'),
    );
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Абзац описания' })).toHaveLength(3));
  });

  it('an edited auto field is kept; «вернуть авто» brings the derived text back', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    expect(screen.queryByRole('button', { name: 'Обращение: вернуть авто' })).toBeNull();
    await edit(screen.getByRole('textbox', { name: 'Обращение' }), 'Добрый день, <i>Анна</i>!');
    expect((await stored(p.id)).greeting).toBe('Добрый день, Анна!');
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Обращение' })).textContent).toContain('Добрый день, Анна!'));

    await user.click(screen.getByRole('button', { name: 'Обращение: вернуть авто' }));
    await waitFor(async () => expect((await stored(p.id)).greeting).toBeNull());
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Обращение' })).textContent).toContain('Уважаемая Анна!'));
    expect(screen.queryByRole('button', { name: 'Обращение: вернуть авто' })).toBeNull();
  });

  it('after the client changes in the form an untouched greeting follows, an edited one stays', async () => {
    const untouched = project({ selectedArticles: chosen(['350']) }, { clientName: 'Олег', clientSex: 'm' });
    await openKp(untouched);
    expect((screen.getByRole('textbox', { name: 'Обращение' })).textContent).toContain('Уважаемый Олег!');
    cleanup();

    const edited = project(
      { selectedArticles: chosen(['350']), greeting: 'Здравствуйте, коллеги!' },
      { clientName: 'Олег', clientSex: 'm' },
    );
    await openKp(edited);
    expect((screen.getByRole('textbox', { name: 'Обращение' })).textContent).toContain('Здравствуйте, коллеги!');
  });

  it('«×» deletes a row of the features; cells and captions are edited; price numbers are not editable', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    const table = () => document.querySelector('.kp-pages .table-features') as HTMLTableElement;
    expect(table().tBodies[0]?.rows).toHaveLength(3);

    await user.click(screen.getAllByRole('button', { name: 'Удалить строку' })[1] as HTMLElement);
    await waitFor(() => expect(table().tBodies[0]?.rows).toHaveLength(2));
    expect(Array.from((table().tBodies[0]?.rows ?? [])).map((row) => row.cells.length)).toEqual([2, 2]);
    expect(table().tHead?.rows[0]?.cells[0]?.colSpan).toBe(2);
    expect((await stored(p.id)).features.map((row) => row.cells[0]?.html)).toEqual(['Толщина', 'Вес']);

    await edit(screen.getAllByRole('textbox', { name: 'Ячейка характеристик' })[1] as HTMLElement, '<u>3 мм</u><script>x()</script>');
    expect((await stored(p.id)).features[0]?.cells[1]?.html).toBe('<u>3 мм</u>');

    await edit(screen.getByRole('textbox', { name: 'Подпись артикула 350' }), 'Какао <b>350</b>');
    expect((await stored(p.id)).selectedArticles[0]?.caption).toBe('Какао 350');

    const prices = document.querySelector('.kp-pages .table-main_materials') as HTMLElement;
    expect(prices.querySelector('[contenteditable]')).toBeNull();
  });
});

describe('KpPage: main photo and palette line (docs/spec.md, section 8.1)', () => {
  const photo = () => document.querySelector('.kp-pages .mainContent-img img');
  const palette = () => document.querySelector('.kp-pages .linkToOtherItems');
  // jsdom does not decode pictures: without this the photo is reported as not loaded and is not drawn.
  const decode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
  beforeEach(() => {
    HTMLImageElement.prototype.decode = () => Promise.resolve();
  });
  afterEach(() => {
    if (decode) Object.defineProperty(HTMLImageElement.prototype, 'decode', decode);
    else delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
  });

  it('«×» removes the main photo for good, «Вернуть фото» brings it back', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    await waitFor(() => expect(photo()).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Вернуть фото' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Удалить главное фото' }));
    await waitFor(() => expect(photo()).toBeNull());
    expect((await stored(p.id)).mainImageHidden).toBe(true);
    expect((await getProject(p.id))?.collection?.mainImage).toBe(`${SITE}/main.jpg`);

    // After a reload the photo is still away.
    cleanup();
    await openKp((await getProject(p.id)) as Project);
    expect(photo()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Вернуть фото' }));
    await waitFor(() => expect(photo()).not.toBeNull());
    await waitFor(() => expect(document.querySelector('.kp-pages[data-ready="true"]')).not.toBeNull());
    expect((await stored(p.id)).mainImageHidden).toBe(false);
    expect(screen.queryByRole('button', { name: 'Вернуть фото' })).toBeNull();
  });

  it('no «Вернуть фото» when the collection has no photo', async () => {
    const p = { ...project({ selectedArticles: chosen(['350']), mainImageHidden: true }), collection: { ...COLLECTION, mainImage: null } };
    await openKp(p);
    expect(screen.queryByRole('button', { name: 'Вернуть фото' })).toBeNull();
  });

  it('the palette text is edited and goes back to auto; «×» removes the line, the toolbar brings it back', async () => {
    const user = userEvent.setup();
    const p = project({ selectedArticles: chosen(['350']) });
    await openKp(p);
    const box = () => screen.getByRole('textbox', { name: 'Текст перед ссылкой на палитру' });
    expect(box().textContent).toBe('Всю палитру можно посмотреть по ссылке:');
    expect(palette()?.querySelector('a')?.getAttribute('href')).toBe(COLLECTION.sourceUrl);
    expect(palette()?.querySelector('a [contenteditable]')).toBeNull();

    await edit(box(), 'Остальные <b>цвета</b>:');
    expect((await stored(p.id)).paletteText).toBe('Остальные цвета:');
    await waitFor(() => expect(box().textContent).toBe('Остальные цвета:'));
    await user.click(screen.getByRole('button', { name: 'Ссылка на палитру: вернуть авто' }));
    await waitFor(async () => expect((await stored(p.id)).paletteText).toBeNull());
    await waitFor(() => expect(box().textContent).toBe('Всю палитру можно посмотреть по ссылке:'));

    expect(screen.queryByRole('button', { name: 'Вернуть ссылку на палитру' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Удалить ссылку на палитру' }));
    await waitFor(() => expect(palette()).toBeNull());
    expect((await stored(p.id)).paletteHidden).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Вернуть ссылку на палитру' }));
    await waitFor(() => expect(palette()).not.toBeNull());
    expect((await stored(p.id)).paletteHidden).toBe(false);
  });

  it('an older project without the new kp fields opens with the photo and the palette line', async () => {
    const p = project({ selectedArticles: chosen(['350']) });
    const kp: Partial<KpEdits> = { ...p.kp };
    delete kp.mainImageHidden;
    delete kp.paletteText;
    delete kp.paletteHidden;
    await openKp({ ...p, kp: kp as KpEdits });
    await waitFor(() => expect(photo()).not.toBeNull());
    expect(palette()).not.toBeNull();
  });
});

describe('KpPage: «Обновить с сайта»', () => {
  it('re-reads description, features and articles, keeps the other edits, then offers the picker', async () => {
    const user = userEvent.setup();
    const p = project({
      selectedArticles: chosen(['350', '351']),
      greeting: 'Свой привет',
      descriptionHtml: '<p>Правленый абзац.</p>',
      features: [],
      mainImageHidden: true,
      paletteText: 'Свои слова:',
      paletteHidden: true,
    });
    await openKp(p);
    api.fetchCollection.mockResolvedValue({ ...COLLECTION, descriptionHtml: '<p>С сайта.</p>' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByRole('button', { name: 'Обновить с сайта' }));
    expect(confirm.mock.calls[0]?.[0]).toContain('выбор артикулов будут сброшены');
    await screen.findByRole('dialog', { name: 'Выберите артикулы' });
    const kp = await stored(p.id);
    expect(kp.descriptionHtml).toBe('<p>С сайта.</p>');
    expect(kp.features).toHaveLength(3);
    expect(kp.selectedArticles).toEqual([]);
    expect(kp.greeting).toBe('Свой привет');
    // The photo comes back with the site's content; the palette line is the manager's edit and stays.
    expect(kp.mainImageHidden).toBe(false);
    expect(kp.paletteText).toBe('Свои слова:');
    expect(kp.paletteHidden).toBe(true);
    await act(async () => {});
  });
});
