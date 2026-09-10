import { createRoot } from 'react-dom/client';
import { SecureAppGate } from './auth/SecureAppGate';
import { InteractiveInvestmentDecisionCenter } from './components/InteractiveInvestmentDecisionCenter';
import { ResearchValidationCenter } from './components/ResearchValidationCenter';
import { installReplaySessionStorageFallback } from './replaySessionStorageFallback';
import './index.css';

installReplaySessionStorageFallback();

function DecisionApp() {
  return (
    <SecureAppGate>
      <div className="min-h-screen bg-[#0b0f19] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f172a]/96 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="truncate font-bold text-white">Custodia · Mercado y decisiones</div>
              <div className="hidden text-[10px] text-slate-400 sm:block">Datos REAL · Top64 dinámico · cartera privada · ejecución manual</div>
              <div className="text-[9px] text-emerald-300 sm:hidden">Cadena productiva única · LEGACY</div>
            </div>
            <nav className="flex shrink-0 items-center gap-2 text-xs" aria-label="Navegación principal">
              <a href="#research-validation-center" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 font-semibold text-cyan-100 sm:hidden">Validación</a>
              <a href="/portfolio.html" title="Laboratorio cuantitativo separado de tu cartera real." className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-slate-300 hover:bg-slate-800">Lab</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <section id="decision-workspace" className="scroll-mt-20">
            <InteractiveInvestmentDecisionCenter />
          </section>
          <ResearchValidationCenter />
        </main>
        <footer className="mx-auto max-w-7xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 text-center text-[11px] text-slate-600">
          Herramienta cuantitativa de apoyo a la decisión. Las señales no garantizan rentabilidad y la ejecución real sigue siendo manual.
        </footer>
      </div>
    </SecureAppGate>
  );
}

createRoot(document.getElementById('root')!).render(<DecisionApp />);
