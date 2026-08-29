import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, RefreshCw, Trash2 } from 'lucide-react';
import {
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  getMyInvestorAvailability,
  InvestmentDecisionResult,
  ManualMyInvestorAvailabilityService,
  PortfolioDecisionEngine,
  PortfolioExecutionPlan,
  PortfolioExecutionPlanService,
  StrategyConsensusEngine,
  UserPortfolioService
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; decision: InvestmentDecisionResult; }
function actionLabel(action: string): string {
  switch (action) {
    case 'BUY_ETF': return 'COMPRAR ETF/ETC';
    case 'SELL_ETF': return 'VENDER ETF/ETC';
    case 'SUBSCRIBE_FUND': return 'SUSCRIBIR FONDO';
    case 'TRANSFER_FUND': return 'TRASPASAR FONDO';
    case 'REDEEM_FUND': return 'REEMBOLSAR FONDO';
    default: return 'REVISAR / NO OPERAR';
  }
}
function actionClass(action: string): string {
  if (action === 'BUY_ETF' || action === 'SUBSCRIBE_FUND') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (action === 'TRANSFER_FUND') return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
  if (action === 'SELL_ETF' || action === 'REDEEM_FUND') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-slate-300 border-slate-700 bg-slate-900';
}
function availabilityClass(status: string): string {
  if (status === 'CONFIRMED_MYINVESTOR') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}
function availabilityLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti en MyInvestor';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'Marcado por ti como no disponible';
  return 'Pendiente de comprobar en MyInvestor/Inversis';
}

export const PortfolioExecutionPlanPanel: React.FC<Props> = ({ scan, decision }) => {
  const [plan, setPlan] = useState<PortfolioExecutionPlan | null>(() => PortfolioExecutionPlanService.load());
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const pending = useMemo(() => plan?.lines.filter(line => line.status === 'PENDING').length ?? 0, [plan]);

  const generate = () => {
    const portfolio = UserPortfolioService.load();
    const portfolioDecision = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision });
    const cashBenchmarkAnnualPct = CashBenchmarkService.load();
    const raw = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: decision.asOfDate, portfolioDecision, cashBenchmarkAnnualPct });
    const lines = raw.lines.map(line => {
      if (!['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action) || !line.targetAssetId) return line;
      const consensus = StrategyConsensusEngine.assess(scan, line.targetAssetId, cashBenchmarkAnnualPct);
      if (!consensus || consensus.newMoneyAction === 'BUY') return line;
      const state = consensus.newMoneyAction === 'AVOID' ? 'desfavorable' : 'insuficiente';
      return {
        ...line,
        action: 'REVIEW' as const,
        instruction: `No ejecutar todavía ${line.targetTicker ?? line.targetName ?? line.targetAssetId}: el consenso de señales es ${state}.`,
        rationale: `${line.rationale} Consenso: ${consensus.favorableVotes} favorables, ${consensus.unfavorableVotes} desfavorables y ${consensus.neutralVotes} neutras. ${consensus.explanation}`
      };
    });
    const vetoed = lines.filter((line, i) => line.action === 'REVIEW' && raw.lines[i]?.action !== 'REVIEW').length;
    const next: PortfolioExecutionPlan = {
      ...raw,
      lines,
      warnings: vetoed > 0 ? [...raw.warnings, `STRATEGY_CONSENSUS_VETO:${vetoed}`] : raw.warnings
    };
    setPlan(PortfolioExecutionPlanService.save(next));
  };

  useEffect(() => { generate(); }, [scan, decision]);

  const setStatus = (id: string, status: 'DONE' | 'DISMISSED') => setPlan(PortfolioExecutionPlanService.updateStatus(id, status));
  const clear = () => { PortfolioExecutionPlanService.clear(); setPlan(null); };
  const assetForLine = (line: PortfolioExecutionPlan['lines'][number]) => scan.candidates.find(c => c.asset.assetId === line.targetAssetId || (!!line.targetIsin && c.asset.isin?.toUpperCase() === line.targetIsin.toUpperCase()) || (!!line.targetTicker && c.asset.ticker.toUpperCase() === line.targetTicker.toUpperCase()))?.asset;
  const confirmAvailability = (key: string, value: 'AVAILABLE' | 'UNAVAILABLE') => { ManualMyInvestorAvailabilityService.set(key, value); setAvailabilityRevision(v => v + 1); };
  const resetAvailability = (key: string) => { ManualMyInvestorAvailabilityService.remove(key); setAvailabilityRevision(v => v + 1); };
  void availabilityRevision;

  const actionable = plan?.lines.filter(line => line.status === 'PENDING' && ['BUY_ETF','SELL_ETF','SUBSCRIBE_FUND','TRANSFER_FUND','REDEEM_FUND'].includes(line.action)) ?? [];
  const reviews = plan?.lines.filter(line => line.status === 'PENDING' && line.action === 'REVIEW') ?? [];
  const headline = !plan ? 'CALCULANDO RECOMENDACIÓN' : actionable.length > 0 ? `${actionable.length} OPERACIÓN${actionable.length === 1 ? '' : 'ES'} PROPUESTA${actionable.length === 1 ? '' : 'S'} HOY` : 'HOY: MANTENER / NO FORZAR OPERACIONES';

  return <section id="pending-portfolio-operations" className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-cyan-300"/><h2 className="font-bold">Qué haría hoy · Recomendación accionable</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Se genera automáticamente con tu cartera, la decisión de mercado, el efectivo remunerado, costes, títulos enteros, disponibilidad broker y el consenso de señales. Una asignación teórica no se convierte por sí sola en una orden.</p></div>
      <div className="flex gap-2">{plan && <button onClick={clear} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><Trash2 className="h-3.5 w-3.5"/>Vaciar</button>}<button onClick={generate} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500"><RefreshCw className="h-3.5 w-3.5"/>Recalcular</button></div>
    </div>

    <div className={`mt-4 rounded-xl border p-4 ${actionable.length > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/5'}`}>
      <div className="text-[10px] uppercase text-slate-500">Conclusión</div><div className={`mt-1 text-lg font-black ${actionable.length > 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{headline}</div>
      {actionable.length > 0 && <div className="mt-2 text-xs text-slate-300">{actionable.map(line => `${actionLabel(line.action)} ${line.targetTicker ?? line.targetIsin ?? line.sourceLabel ?? ''}${line.amountEur != null ? ` · ${line.amountEur.toFixed(2)} €` : ''}`).join('  |  ')}</div>}
      {actionable.length === 0 && plan && <div className="mt-2 text-xs text-slate-400">No hay una compra/venta que supere simultáneamente los gates actuales. {reviews.length > 0 ? `${reviews.length} punto${reviews.length === 1 ? '' : 's'} quedan para revisión.` : 'El efectivo sigue siendo una alternativa válida.'}</div>}
    </div>

    {plan && <>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="rounded-full border border-slate-700 px-3 py-1">Decisión: {plan.decisionAsOf}</span><span className="rounded-full border border-cyan-500/25 px-3 py-1 text-cyan-300">{pending} pendientes</span><span className="rounded-full border border-emerald-500/25 px-3 py-1 text-emerald-200">Cuenta: {(plan.cashBenchmarkAnnualPct ?? 2.5).toFixed(2)}%</span></div>
      <div className="mt-4 space-y-3">
        {plan.lines.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No hay operaciones accionables con la cartera y la decisión actuales.</div>}
        {plan.lines.map((line, index) => {
          const targetAsset = assetForLine(line);
          const availability = targetAsset ? getMyInvestorAvailability(targetAsset) : null;
          const availabilityKey = targetAsset ? (targetAsset.isin ?? targetAsset.ticker) : (line.targetIsin ?? line.targetTicker ?? null);
          const needsTargetAvailability = ['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action) && Boolean(availabilityKey);
          return <article key={line.id} className={`rounded-xl border p-4 ${line.status === 'DONE' ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70' : 'border-slate-800 bg-slate-950/70'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{index + 1}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${actionClass(line.action)}`}>{actionLabel(line.action)}</span>{line.status === 'DONE' && <span className="text-[10px] font-bold text-emerald-300">HECHA</span>}</div><div className="mt-2 text-sm font-semibold text-white">{line.instruction}</div><div className="mt-1 text-[10px] text-slate-500">{line.rationale}</div></div>{line.status === 'PENDING' && <div className="flex shrink-0 gap-2"><button onClick={() => setStatus(line.id, 'DONE')} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-2 text-[10px] font-bold text-emerald-300"><Check className="h-3 w-3"/>Marcar hecha</button><button onClick={() => setStatus(line.id, 'DISMISSED')} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-500">Descartar</button></div>}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6 text-[10px]">{line.targetTicker && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Ticker</span><div className="font-mono text-slate-200">{line.targetTicker}</div></div>}{line.targetIsin && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">ISIN</span><div className="font-mono text-slate-200">{line.targetIsin}</div></div>}{line.amountEur != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Importe</span><div className="font-mono text-slate-200">{line.amountEur.toFixed(2)} €</div></div>}{line.estimatedFeeEur != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Comisión</span><div className="font-mono text-slate-200">{line.estimatedFeeEur.toFixed(2)} €</div></div>}{line.shares != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Títulos</span><div className="font-mono text-slate-200">{line.shares}</div></div>}{line.estimatedAnnualReturnProxyPct != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Proxy anual neto</span><div className={`font-mono ${Number(line.excessReturnVsCashPctPoints ?? 0) > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{line.estimatedAnnualReturnProxyPct.toFixed(2)}%</div><div className="text-[9px] text-slate-600">vs cuenta {(line.cashBenchmarkAnnualPct ?? plan.cashBenchmarkAnnualPct ?? 2.5).toFixed(2)}%</div></div>}</div>
            {needsTargetAvailability && availability && availabilityKey && <div className={`mt-3 rounded-lg border p-3 text-[10px] ${availabilityClass(availability.status)}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b>Disponibilidad:</b> {availabilityLabel(availability.status, availability.evidence)}<div className="mt-1 opacity-75">Referencia: <span className="font-mono">{availabilityKey}</span></div></div><div className="flex flex-wrap gap-2"><button onClick={() => confirmAvailability(availabilityKey, 'AVAILABLE')} className="rounded-md border border-emerald-500/40 px-2 py-1 font-bold text-emerald-200">Sí, está en MyInvestor</button><button onClick={() => confirmAvailability(availabilityKey, 'UNAVAILABLE')} className="rounded-md border border-rose-500/40 px-2 py-1 text-rose-200">No lo encuentro</button>{availability.evidence === 'USER_CONFIRMED_MYINVESTOR' && <button onClick={() => resetAvailability(availabilityKey)} className="rounded-md border border-slate-600 px-2 py-1 text-slate-300">Borrar confirmación</button>}</div></div></div>}
            {line.taxNote && <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-100"><b>Fondos / fiscalidad:</b> {line.taxNote}</div>}
          </article>;
        })}
      </div>
    </>}
  </section>;
};