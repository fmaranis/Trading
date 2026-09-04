import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SecureAppGate } from './auth/SecureAppGate';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecureAppGate>
      <App />
    </SecureAppGate>
  </StrictMode>,
);
