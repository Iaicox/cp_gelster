import { Link, useParams } from 'react-router';
import { PageShell } from './PageShell.tsx';

export function KpPage() {
  const { id } = useParams();
  return (
    <PageShell>
      <h1 className="intro">Коммерческое предложение</h1>
      <p>{`Предпросмотр КП для проекта ${id ?? ''} появится в следующих задачах.`}</p>
      <p>
        <Link to="/">К форме</Link>
      </p>
    </PageShell>
  );
}
