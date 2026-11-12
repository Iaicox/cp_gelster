import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createAppRouter } from './AppRoutes.tsx';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  window.location.hash = '';
});

function renderAt(hash: string): HTMLElement {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.append(container);
  const router = createAppRouter();
  act(() => {
    root = createRoot(container as HTMLElement);
    root.render(<RouterProvider router={router} />);
  });
  return container;
}

describe('client routes (hash history)', () => {
  it.each([
    ['#/', 'Заполните форму КП'],
    ['', 'Заполните форму КП'],
    ['#/kp/42', 'проекта 42'],
    ['#/managers', 'Менеджеры'],
    ['#/nowhere', 'Страница не найдена'],
  ])('%s renders its stub', (hash, text) => {
    const el = renderAt(hash);
    expect(el.textContent).toContain(text);
  });

  it('reads the route from the hash, not from the path', () => {
    window.history.replaceState(null, '', '/some/subdir/index.html#/managers');
    const el = renderAt('#/managers');
    expect(el.querySelector('h1')?.textContent).toBe('Менеджеры');
    window.history.replaceState(null, '', '/');
  });

  it('links point into the hash and assets are relative', () => {
    const el = renderAt('#/');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('#/managers');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('header.jpg');
  });
});
