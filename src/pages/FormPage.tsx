import { Link } from 'react-router';
import { PageShell } from './PageShell.tsx';

export function FormPage() {
  return (
    <PageShell>
      <h1 className="intro">Заполните форму КП</h1>
      <p>Форма появится в следующих задачах.</p>
      <p>
        <Link to="/managers">Менеджеры</Link>
      </p>
    </PageShell>
  );
}
