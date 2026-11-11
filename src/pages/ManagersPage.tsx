import { Link } from 'react-router';
import { PageShell } from './PageShell.tsx';

export function ManagersPage() {
  return (
    <PageShell>
      <h1 className="intro">Менеджеры</h1>
      <p>Список менеджеров появится в следующих задачах.</p>
      <p>
        <Link to="/">К форме</Link>
      </p>
    </PageShell>
  );
}
