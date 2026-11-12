import { createHashRouter, type RouteObject } from 'react-router';
import { FormPage } from './pages/FormPage.tsx';
import { KpPage } from './pages/KpPage.tsx';
import { ManagersPage } from './pages/ManagersPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

/** Client routes. They live in the URL hash (#/kp/42), so the web server needs no rewrite rules. */
export const routes: RouteObject[] = [
  { path: '/', element: <FormPage /> },
  { path: '/kp/:id', element: <KpPage /> },
  { path: '/managers', element: <ManagersPage /> },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createHashRouter(routes);
}
