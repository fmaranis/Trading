import { createRoot } from 'react-dom/client';
import { InteractiveInvestmentDecisionCenter } from './components/InteractiveInvestmentDecisionCenter';
import { MarketProviderStatus } from './components/MarketProviderStatus';
import './index.css';

function DecisionApp() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="font-bold text-white">Custodia · Mercado y decisiones</div>
            <div className="text-[10px] text-slate-400">Datos REAL · oportunidades · cartera · evidencia explicable</div>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <a href="/portfolio.html" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/20">Cartera</a>
            <a href="/legacy.html" title="Herramientas experimentales para investigación; no forman parte del flujo principal de decisión." className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-slate-400 hover:bg-slate-800">Investigación · Experimental</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
        <MarketProviderStatus />
        <InteractiveInvestmentDecisionCenter />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-[11px] text-slate-600">
        Herramienta cuantitativa de apoyo a la decisión. Las oportunidades son señales para revisión, no órdenes automáticas ni garantías de rentabilidad.
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<DecisionApp />);
