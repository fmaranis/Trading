import React, { useMemo } from 'react';
import { GitBranch, ShieldCheck } from 'lucide-react';
import {
  CashBenchmarkService,
  evaluatePortfolioDecision,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
}

function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? 'N/D' : `${(value * 100).toFixed(0)}%`;
}

export const ProductDecisionTracePanel: React.FC<Props> = ({ scan, decision, positionHealth }) => {
  const cashBenchmark = CashBenchmarkService.load();
  const portfolio = UserPortfolioService.load();
  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct: cashBenchmark
  }), [portfolio.updatedAt, scan, decision, positionHealth, cashBenchmark]);

  const availableCapital = Math.max(0, portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur);

  return <section className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4 sm:p-5" aria-label="Trazabilidad de la decisión productiva">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-4xl">
        <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-cyan-300"/><b className="text-sm text-white">De dónde sale la recomendación</b></div>
        <div className="mt-2 overflow-x-auto pb-1 text-[10px] font-semibold text-cyan-100">
          <span className="whitespace-nowrap">AssetUniverseScanner → Top64 dinámico → PortfolioCandidateGate → InvestmentDecisionEngine → evaluatePortfolioDecision → CORE_GATE_V1 → CORE_ARCHITECTURE_V1</span>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Esta tarjeta no crea otra recomendación. Vuelve a leer la misma función productiva para explicar el sizing que aparece en “Comprar ahora”.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-black text-emerald-100"><ShieldCheck className="h-4 w-4"/>PRODUCCIÓN · LEGACY</div>
    </div>

    <div className="mt-4 grid gap-2 grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[9px] uppercase text-slate-500">Capital disponible</div><div className="mt-1 font-mono text-base font-black text-white">{availableCapital.toFixed(2)} €</div></div>
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[9px] uppercase text-slate-500">Comprar ahora</div><div className="mt-1 font-mono text-base font-black text-emerald-200">{portfolioDecision.recommendedNewInvestmentEur.toFixed(2)} €</div></div>
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[9px] uppercase text-slate-500">Cash objetivo</div><div className="mt-1 font-mono text-base font-black text-white">{portfolioDecision.targetCashEur.toFixed(2)} €</div></div>
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[9px] uppercase text-slate-500">Cash tras plan</div><div className="mt-1 font-mono text-base font-black text-white">{portfolioDecision.residualPlannedCashEur.toFixed(2)} €</div></div>
    </div>

    {portfolioDecision.contributions.length > 0 ? <div className="mt-4 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desglose del importe por activo</div>
      {portfolioDecision.contributions.map(row => <div key={row.assetId} className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="font-mono text-sm font-black text-white">{row.ticker} · {row.amountEur.toFixed(2)} €</div><div className="mt-1 text-[9px] text-slate-500">Origen del importe: <b className="text-cyan-200">evaluatePortfolioDecision</b> · política <b className="text-emerald-200">LEGACY</b></div></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-slate-400 sm:text-right">
            <span>Timing <b className="text-white">{row.timingState ?? 'N/D'}</b></span>
            <span>Tramo <b className="text-white">{row.positionStage ?? 'N/D'}</b></span>
            <span>Fracción inicial <b className="text-white">{pct(row.suggestedInitialFraction)}</b></span>
            <span>Cap cartera <b className="text-white">{row.portfolioShareCapPct == null ? 'N/D' : `${row.portfolioShareCapPct.toFixed(1)}%`}</b></span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 grid-cols-2 lg:grid-cols-4 text-[9px]">
          <div className="rounded-lg bg-slate-900/70 p-2"><span className="text-slate-500">Ya invertido</span><div className="font-mono font-bold text-white">{(row.currentAssetValueEur ?? 0).toFixed(2)} €</div></div>
          <div className="rounded-lg bg-slate-900/70 p-2"><span className="text-slate-500">Objetivo estratégico</span><div className="font-mono font-bold text-white">{row.targetAssetValueEur == null ? 'N/D' : `${row.targetAssetValueEur.toFixed(2)} €`}</div></div>
          <div className="rounded-lg bg-slate-900/70 p-2"><span className="text-slate-500">Objetivo ejecutable ahora</span><div className="font-mono font-bold text-white">{row.executableTargetAssetValueEur == null ? 'N/D' : `${row.executableTargetAssetValueEur.toFixed(2)} €`}</div></div>
          <div className="rounded-lg bg-slate-900/70 p-2"><span className="text-slate-500">Orden pendiente</span><div className="font-mono font-bold text-emerald-200">{row.amountEur.toFixed(2)} €</div></div>
        </div>
        <details className="mt-2"><summary className="touch-target flex cursor-pointer items-center text-[10px] font-bold text-cyan-200">Ver cálculo explicado</summary><p className="mt-1 text-[10px] leading-relaxed text-slate-400">{row.reason}</p></details>
      </div>)}
    </div> : <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-3 text-[10px] text-slate-500">La misma cadena productiva no financia ninguna compra ahora. No se inventa una asignación alternativa.</div>}
  </section>;
};
