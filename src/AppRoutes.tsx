import { Route, Routes } from 'react-router';
import { FormPage } from './pages/FormPage.tsx';
import { KpPage } from './pages/KpPage.tsx';
import { ManagersPage } from './pages/ManagersPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FormPage />} />
      <Route path="/kp/:id" element={<KpPage />} />
      <Route path="/managers" element={<ManagersPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
