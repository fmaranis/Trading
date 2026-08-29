import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CashBenchmarkService,
  StrategyConsensusEngine,
  type AssetUniverseScanResult,
  type StrategyConsensusAssessment,
  UserPortfolioService
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; }

function signalClass(direction: string): string {
  if (direction === 'FAVORABLE') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  if (direction === 'UNFAVORABLE') return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}
function newMoneyClass(action: string): string {
  if (action === 'BUY') return 'text-emerald-200';
  if (action === 'AVOID') return 'text-amber-200';
  return 'text-sky-200';
}
function newMoneyLabel(action: string): string {
  if (action === 'BUY') return 'APTO PARA NUEVO DINERO';
  if (action === 'AVOID') return 'NO APORTAR AHORA';
  return 'VIGILAR / ESPERAR';
}
function existingLabel(action: string): string {
  if (action === 'ADD') return 'MANTENER / PODRÍA AUMENTAR';
  if (action === 'REDUCE_REVIEW') return 'REVISAR REDUCCIÓN';
  return 'MANTENER';
}

export const StrategyConsensusPanel: React.FC<Props> = ({ scan }) => {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener('trading:portfolio-updated', refresh as EventListener);
    return () => window.removeEventListener('trading:portfolio-updated', refresh as EventListener);
  }, []);

  const benchmark = CashBenchmarkService.load();
  const portfolio = useMemo(() => UserPortfolioService.load(), [revision, scan]);
  const ownedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const holding of portfolio.holdings) {
      const candidate = scan.candidates.find(c => c.asset.ticker.toUpperCase() === holding.ticker.toUpperCase());
      if (candidate) ids.add(candidate.asset.assetId);
    }
    for (const fund of portfolio.funds ?? []) {
      const candidate = scan.candidates.find(c => c.asset.isin?.toUpperCase() === fund.isin.toUpperCase() || c.asset.ticker.toUpperCase() === fund.isin.toUpperCase());
      if (candidate) ids.add(candidate.asset.assetId);
    }
    return ids;
  }, [portfolio, scan]);

  const assessments = useMemo(() => {
    const ids = new Set<string>(scan.selected.map(c => c.asset.assetId));
    for (const id of ownedIds) ids.add(id);
    return Array.from(ids).map(id => StrategyConsensusEngine.assess(scan, id, benchmark)).filter(Boolean) as StrategyConsensusAssessment[];
  }, [scan, benchmark, ownedIds]);

  return <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl"><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-cyan-300"/><h2 className="font-bold text-white">Por qué el motor recomienda cada cosa · consenso de señales</h2></div><p className="mt-1 text-[11px] text-slate-400">No es otro ranking aislado. Explica la decisión con tendencia larga, momentum, posible reversión en caídas, riesgo y comparación frente a dejar el dinero al {benchmark.toFixed(2)}%. Para posiciones existentes se exige más evidencia para vender que para rechazar una compra nueva.</p></div>
      <div className="rounded-lg border border-cyan-500/25 bg-slate-950 px-3 py-2 text-[10px] text-cyan-100">Regla de protección: una sobreponderación o 120 sesiones malas <b>no bastan para vender</b>.</div>
    </div>

    <div className="mt-4 space-y-3">{assessments.map(item => {
      const owned = ownedIds.has(item.assetId);
      return <article key={item.assetId} className={`rounded-xl border p-4 ${owned ? 'border-fuchsia-500/30 bg-fuchsia-500/5' : 'border-slate-800 bg-slate-950/60'}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><b className="font-mono text-white">{item.ticker}</b>{owned && <span className="rounded-full border border-fuchsia-500/30 px-2 py-0.5 text-[9px] font-bold text-fuchsia-200">YA EN TU CARTERA</span>}{item.buyTheDipCandidate && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-200">POSIBLE BUY-THE-DIP</span>}{item.structuralDowntrend && <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-200">CAÍDA ESTRUCTURAL</span>}</div><div className="mt-1 text-[10px] text-slate-500">{item.name}</div></div>
          <div className="grid min-w-[300px] grid-cols-2 gap-2 text-[10px]"><div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Dinero nuevo</div><b className={newMoneyClass(item.newMoneyAction)}>{newMoneyLabel(item.newMoneyAction)}</b></div><div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Si ya la tienes</div><b className={item.existingPositionAction === 'REDUCE_REVIEW' ? 'text-amber-200' : 'text-emerald-200'}>{existingLabel(item.existingPositionAction)}</b></div></div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{item.votes.map(vote => <div key={vote.id} className={`rounded-lg border p-2 text-[10px] ${signalClass(vote.direction)}`}><div className="flex items-center justify-between gap-1"><b>{vote.label}</b>{vote.score > 0 ? <TrendingUp className="h-3 w-3"/> : vote.score < 0 ? <TrendingDown className="h-3 w-3"/> : null}</div><div className="mt-1 opacity-80">{vote.detail}</div></div>)}</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="text-[10px] text-slate-400">{item.explanation}</div><div className="shrink-0 rounded-full border border-slate-700 px-3 py-1 text-[10px]">Votos: <b className="text-emerald-300">{item.favorableVotes} favorables</b> · <b className="text-rose-300">{item.unfavorableVotes} desfavorables</b> · {item.neutralVotes} neutros</div></div>
      </article>;
    })}</div>
    <div className="mt-3 text-[10px] text-slate-500">El bloque mean-reversion no compra simplemente porque algo cae: exige que la tendencia larga no esté estructuralmente rota, que exista un drawdown moderado y señales de sobreventa. Este consenso es explicativo/veto por ahora; la siguiente prueba es comparar causalmente cada estrategia y el ensemble antes de darle autoridad sobre el motor principal.</div>
  </section>;
};
