import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createAppRouter } from './AppRoutes.tsx';
import { initConfig } from './config.ts';
import './styles/document.css';
import './styles/form.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element is missing in index.html');

await initConfig();

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
