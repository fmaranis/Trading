import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { PortfolioLab } from './components/PortfolioLab';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <PortfolioLab />
      </div>
    </div>
  </React.StrictMode>
);
