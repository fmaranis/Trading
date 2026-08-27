import { createRoot } from 'react-dom/client';
import { InteractiveInvestmentDecisionCenter } from './components/InteractiveInvestmentDecisionCenter';
import './index.css';

function DecisionApp() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="font-bold text-white">Custodia · Decisión de inversión</div>
            <div className="text-[10px] text-slate-400">Datos diarios reales · interfaz reactiva · asignación cuantitativa explicable</div>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <a href="/portfolio.html" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/20">Portfolio Lab</a>
            <a href="/legacy.html" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-slate-300 hover:bg-slate-800">Laboratorio avanzado</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
        <InteractiveInvestmentDecisionCenter />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-[11px] text-slate-600">
        Investigación cuantitativa experimental. La salida utiliza el último cierre diario disponible y no constituye una orden automática de mercado.
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<DecisionApp />);
