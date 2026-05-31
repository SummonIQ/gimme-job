import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DesktopApp } from './views/desktop-app';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Desktop renderer root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
