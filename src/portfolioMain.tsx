import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { PortfolioLab } from './components/PortfolioLab';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-[#0b0f19]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/15"
            aria-label="Volver a la web principal"
          >
            ← Volver a la web principal
          </a>
          <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Portfolio Lab · Paso 9C</span>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <PortfolioLab />
        </div>
      </div>
    </div>
  </React.StrictMode>
);
