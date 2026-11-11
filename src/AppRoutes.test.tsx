import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './AppRoutes.tsx';

function render(path: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('client routes', () => {
  it.each([
    ['/', 'Заполните форму КП'],
    ['/kp/42', 'проекта 42'],
    ['/managers', 'Менеджеры'],
    ['/nowhere', 'Страница не найдена'],
  ])('%s renders its stub', (path, text) => {
    const html = render(path);
    expect(html).toContain(text);
    expect(html).toContain('src="/header.jpg"');
  });
});
