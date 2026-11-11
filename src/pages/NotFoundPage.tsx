import { Link } from 'react-router';
import { PageShell } from './PageShell.tsx';

export function NotFoundPage() {
  return (
    <PageShell>
      <h1 className="intro">Страница не найдена</h1>
      <p>
        <Link to="/">К форме</Link>
      </p>
    </PageShell>
  );
}
