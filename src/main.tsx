import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes.tsx';
import './styles/document.css';
import './styles/form.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element is missing in index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
