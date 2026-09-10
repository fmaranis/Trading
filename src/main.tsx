import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SecureAppGate } from './auth/SecureAppGate';
import App from './App.tsx';
import { installJsonDownloadCompatibility } from './utils/jsonDownloadCompat';
import './index.css';

installJsonDownloadCompatibility();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecureAppGate>
      <App />
    </SecureAppGate>
  </StrictMode>,
);
