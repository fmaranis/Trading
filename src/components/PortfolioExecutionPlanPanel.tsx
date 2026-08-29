import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ClipboardList, RefreshCw, Trash2 } from 'lucide-react';
import {
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  getMyInvestorAvailability,
  InvestmentDecisionResult,
  isPortfolioEquityTicker,
  ManualMyInvestorAvailabilityService,
  PortfolioCandidateGate,
  PortfolioDecisionEngine,
  PortfolioExecutionPlan,
  PortfolioExecutionPlanService,
  PortfolioStateExecutionService,
  type PortfolioPositionHealthResult,
  type PortfolioStateExecutionReceipt,
  StrategyConsensusEngine,
  UserPortfolioService
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}
function actionLabel(action: string, ticker?: string | null): string {
  const equity = isPortfolioEquityTicker(ticker);
  switch (action) {
    case 'BUY_ETF': return equity ? 'COMPRAR ACCIÓN' : 'COMPRAR ETF/ETC';
    case 'SELL_ETF': return equity ? 'VENDER ACCIÓN' : 'VENDER ETF/ETC';
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
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'border-cyan-500/25 bg-cyan-500/5 text-cyan-100';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}
function availabilityLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti en MyInvestor';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'Se asume disponible en MyInvestor salvo que indiques lo contrario';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'Marcado por ti como no disponible';
  return 'Disponibilidad no verificada';
}
function gateReasonLabel(reason: string): string {
  if (reason === 'DOES_NOT_BEAT_CASH') return 'No supera la cuenta remunerada';
  if (reason === 'CASH_COMPARISON_UNAVAILABLE') return 'Sin comparación suficiente frente a cash';
  if (reason === 'STRUCTURAL_DOWNTREND') return 'Tendencia estructural bajista';
  if (reason === 'CONSENSUS_WATCH') return 'Consenso: vigilar';
  if (reason === 'CONSENSUS_AVOID') return 'Consenso: evitar nuevas compras';
  if (reason === 'CONSENSUS_UNAVAILABLE') return 'Consenso no disponible';
  return reason.replaceAll('_', ' ').toLowerCase();
}

export const PortfolioExecutionPlanPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const [plan, setPlan] = useState<PortfolioExecutionPlan | null>(() => PortfolioExecutionPlanService.load());
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [lastExecution, setLastExecution] = useState<PortfolioStateExecutionReceipt | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const pending = useMemo(() => plan?.lines.filter(line => line.status === 'PENDING').length ?? 0, [plan]);
  const opportunityGate = useMemo(() => PortfolioCandidateGate.apply(scan, CashBenchmarkService.load(), 1000), [scan, decision.asOfDate]);
  const opportunityRows = useMemo(() => opportunityGate.entries
    .filter(entry => entry.status === 'ELIGIBLE')
    .sort((a, b) => (b.rankingScore ?? -Infinity) - (a.rankingScore ?? -Infinity))
    .map(entry => ({ entry, candidate: scan.candidates.find(c => c.asset.assetId === entry.assetId)! }))
    .filter(row => Boolean(row.candidate)), [opportunityGate, scan]);
  const strongRejectedRows = useMemo(() => opportunityGate.entries
    .filter(entry => entry.status === 'REJECTED')
    .map(entry => ({ entry, candidate: scan.candidates.find(c => c.asset.assetId === entry.assetId) }))
    .filter((row): row is { entry: typeof opportunityGate.entries[number]; candidate: NonNullable<typeof row.candidate> } => Boolean(row.candidate && row.candidate.status === 'ACCEPTED'))
    .sort((a, b) => (b.candidate.score ?? -Infinity) - (a.candidate.score ?? -Infinity))
    .slice(0, 6), [opportunityGate, scan]);

  const generate = () => {
    const portfolio = UserPortfolioService.load();
    const portfolioDecision = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, positionHealth: positionHealth?.byKey });
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
    const next: PortfolioExecutionPlan = { ...raw, lines, warnings: vetoed > 0 ? [...raw.warnings, `STRATEGY_CONSENSUS_VETO:${vetoed}`] : raw.warnings };
    setPlan(PortfolioExecutionPlanService.save(next));
  };

  useEffect(() => {
    generate();
    return UserPortfolioService.subscribe(() => generate());
  }, [scan, decision, positionHealth]);

  const applyLine = (line: PortfolioExecutionPlan['lines'][number]) => {
    setExecutionError(null);
    try {
      const receipt = PortfolioStateExecutionService.execute(line);
      setLastExecution(receipt);
      generate();
    } catch (error: any) { setExecutionError(error?.message || String(error)); }
  };
  const dismiss = (id: string) => setPlan(PortfolioExecutionPlanService.updateStatus(id, 'DISMISSED'));
  const clear = () => { PortfolioExecutionPlanService.clear(); setPlan(null); };
  const assetForLine = (line: PortfolioExecutionPlan['lines'][number]) => scan.candidates.find(c => c.asset.assetId === line.targetAssetId || (!!line.targetIsin && c.asset.isin?.toUpperCase() === line.targetIsin.toUpperCase()) || (!!line.targetTicker && c.asset.ticker.toUpperCase() === line.targetTicker.toUpperCase()))?.asset;
  const markUnavailable = (key: string) => { ManualMyInvestorAvailabilityService.set(key, 'UNAVAILABLE'); setAvailabilityRevision(v => v + 1); };
  const resetAvailability = (key: string) => { ManualMyInvestorAvailabilityService.remove(key); setAvailabilityRevision(v => v + 1); };
  void availabilityRevision;

  const actionable = plan?.lines.filter(line => line.status === 'PENDING' && ['BUY_ETF','SELL_ETF','SUBSCRIBE_FUND','TRANSFER_FUND','REDEEM_FUND'].includes(line.action)) ?? [];
  const reviews = plan?.lines.filter(line => line.status === 'PENDING' && line.action === 'REVIEW') ?? [];
  const headline = !plan ? 'CALCULANDO RECOMENDACIÓN' : actionable.length > 0 ? `${actionable.length} OPERACIÓN${actionable.length === 1 ? '' : 'ES'} PROPUESTA${actionable.length === 1 ? '' : 'S'} HOY` : 'HOY: MANTENER / NO FORZAR OPERACIONES';

  return <section id="pending-portfolio-operations" className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-cyan-300"/><h2 className="font-bold">Qué haría hoy</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">La operación final aplica cash + consenso + diversificación + costes. Debajo también puedes ver todos los candidatos que sí superan cash + consenso aunque no entren finalmente en la cartera objetivo.</p></div>
      <div className="flex gap-2">{plan && <button onClick={clear} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><Trash2 className="h-3.5 w-3.5"/>Vaciar plan</button>}<button onClick={generate} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500"><RefreshCw className="h-3.5 w-3.5"/>Recalcular</button></div>
    </div>

    {lastExecution && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100"><div className="font-bold">Cartera actualizada</div><div className="mt-1">{lastExecution.description}</div><div className="mt-1 font-mono text-[10px] text-emerald-200">Liquidez: {lastExecution.liquidityBeforeEur.toFixed(2)} € → {lastExecution.liquidityAfterEur.toFixed(2)} €</div></div>}
    {executionError && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100"><b>No se ha aplicado la operación.</b> {executionError}</div>}

    <div className={`mt-4 rounded-xl border p-4 ${actionable.length > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/5'}`}>
      <div className="text-[10px] uppercase text-slate-500">Ahora</div><div className={`mt-1 text-lg font-black ${actionable.length > 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{headline}</div>
      {actionable.length > 0 && <div className="mt-2 text-xs text-slate-300">{actionable.map(line => `${actionLabel(line.action, line.targetTicker)} ${line.targetTicker ?? line.targetIsin ?? line.sourceLabel ?? ''}${line.amountEur != null ? ` · ${line.amountEur.toFixed(2)} €` : ''}`).join('  |  ')}</div>}
      {actionable.length === 0 && plan && <div className="mt-2 text-xs text-slate-400">No hay una compra/venta que supere simultáneamente todos los gates de ejecución. {reviews.length > 0 ? `${reviews.length} punto${reviews.length === 1 ? '' : 's'} quedan como explicación/revisión.` : 'El efectivo sigue siendo una alternativa válida.'}</div>}
    </div>

    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-sm font-bold text-white">Oportunidades actuales del motor</div><div className="mt-1 text-[10px] text-slate-500">Superan el 2,5% de referencia y el consenso BUY. Que aparezcan aquí no obliga a incluirlas todas en la cartera: el asignador todavía controla diversificación y riesgo.</div></div><span className="text-[10px] text-emerald-300">{opportunityRows.length} elegibles</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{opportunityRows.slice(0, 9).map(({ entry, candidate }, index) => {
        const inAllocator = scan.selected.some(selected => selected.asset.assetId === entry.assetId);
        const inspectKey = candidate.asset.instrumentType === 'MUTUAL_FUND' ? (candidate.asset.isin ?? candidate.asset.ticker) : candidate.asset.ticker;
        return <button type="button" key={entry.assetId} onClick={() => onInspectAsset?.(inspectKey)} disabled={!onInspectAsset} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-left transition hover:border-cyan-500/40 disabled:cursor-default">
          <div className="flex items-start justify-between gap-2"><div><span className="mr-2 text-[9px] text-slate-600">#{index + 1}</span><b className="font-mono text-white">{candidate.asset.ticker}</b><div className="mt-1 max-w-[220px] truncate text-[9px] text-slate-500">{candidate.asset.name}</div></div><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${inAllocator ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-violet-500/30 bg-violet-500/10 text-violet-200'}`}>{inAllocator ? 'ASIGNADOR' : 'OPORTUNIDAD'}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-slate-400"><span>Score <b className="font-mono text-white">{candidate.score?.toFixed(2) ?? 'N/D'}</b></span><span>120d <b className="font-mono text-emerald-300">{candidate.momentum120Pct?.toFixed(1) ?? 'N/D'}%</b></span><span>Consenso <b className="font-mono text-white">{entry.consensusScore != null && entry.consensusScore >= 0 ? '+' : ''}{entry.consensusScore ?? 'N/D'}</b></span><span>vs cash <b className="font-mono text-cyan-300">{entry.excessVsCashPctPoints != null ? `${entry.excessVsCashPctPoints >= 0 ? '+' : ''}${entry.excessVsCashPctPoints.toFixed(1)} pp` : 'N/D'}</b></span></div>
          {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[9px] font-bold text-cyan-300"><BarChart3 className="h-3.5 w-3.5"/>Ver gráfica y señales</div>}
        </button>;
      })}{opportunityRows.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">Hoy ningún candidato supera simultáneamente cash + consenso BUY.</div>}</div>
      {opportunityRows.length > 9 && <div className="mt-2 text-[9px] text-slate-500">Se muestran las 9 primeras de {opportunityRows.length}; el radar completo permanece en Estudio y señales.</div>}

      {strongRejectedRows.length > 0 && <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3"><summary className="cursor-pointer text-[10px] font-bold text-amber-200">Valores con métricas altas que el motor no compra ahora</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{strongRejectedRows.map(({ entry, candidate }) => {
        const inspectKey = candidate.asset.instrumentType === 'MUTUAL_FUND' ? (candidate.asset.isin ?? candidate.asset.ticker) : candidate.asset.ticker;
        return <button type="button" key={entry.assetId} onClick={() => onInspectAsset?.(inspectKey)} disabled={!onInspectAsset} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left hover:border-amber-500/30"><div className="flex items-center justify-between gap-2"><b className="font-mono text-white">{candidate.asset.ticker}</b><span className="font-mono text-[9px] text-slate-400">score {candidate.score?.toFixed(2) ?? 'N/D'}</span></div><div className="mt-1 text-[9px] text-amber-200">{gateReasonLabel(entry.reason)}</div><div className="mt-1 text-[9px] text-slate-500">120d {candidate.momentum120Pct?.toFixed(1) ?? 'N/D'}% · consenso {entry.consensusScore ?? 'N/D'}</div></button>;
      })}</div></details>}
    </div>

    {plan && <>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="rounded-full border border-slate-700 px-3 py-1">Datos: {plan.decisionAsOf}</span><span className="rounded-full border border-cyan-500/25 px-3 py-1 text-cyan-300">{pending} pendientes</span><span className="rounded-full border border-emerald-500/25 px-3 py-1 text-emerald-200">Cash ref.: {(plan.cashBenchmarkAnnualPct ?? 2.5).toFixed(2)}%</span></div>
      <div className="mt-4 space-y-3">
        {plan.lines.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No hay operaciones accionables con la cartera y la decisión actuales.</div>}
        {plan.lines.map((line, index) => {
          const targetAsset = assetForLine(line);
          const availability = targetAsset ? getMyInvestorAvailability(targetAsset) : null;
          const availabilityKey = targetAsset ? (targetAsset.isin ?? targetAsset.ticker) : (line.targetIsin ?? line.targetTicker ?? null);
          const needsTargetAvailability = ['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action) && Boolean(availabilityKey);
          const unavailable = needsTargetAvailability && availability?.status === 'USER_CONFIRMED_UNAVAILABLE';
          const canApply = ['BUY_ETF','SELL_ETF','SUBSCRIBE_FUND','TRANSFER_FUND','REDEEM_FUND'].includes(line.action) && !unavailable;
          const displayTicker = line.targetTicker ?? targetAsset?.ticker ?? null;
          const inspectKey = line.instrumentType === 'MUTUAL_FUND' ? (line.targetIsin ?? line.sourceIsin ?? line.targetTicker ?? null) : (line.targetTicker ?? line.targetIsin ?? null);
          return <article key={line.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{index + 1}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${actionClass(line.action)}`}>{actionLabel(line.action, displayTicker)}</span></div><div className="mt-2 text-sm font-semibold text-white">{line.instruction}</div><details className="mt-2"><summary className="cursor-pointer text-[10px] text-slate-500">Por qué</summary><div className="mt-1 text-[10px] text-slate-500">{line.rationale}</div></details></div>{line.status === 'PENDING' && <div className="flex shrink-0 flex-wrap gap-2">{inspectKey && onInspectAsset && <button type="button" onClick={() => onInspectAsset(inspectKey)} className="flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-[10px] font-bold text-cyan-200"><BarChart3 className="h-3 w-3"/>Ver gráfica</button>}{canApply && <button onClick={() => applyLine(line)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white"><Check className="h-3 w-3"/>Aplicar a mi cartera</button>}<button onClick={() => dismiss(line.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-500">Descartar</button></div>}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">{line.targetTicker && <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono">Ticker {line.targetTicker}</span>}{line.targetIsin && <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-cyan-200">ISIN {line.targetIsin}</span>}{line.amountEur != null && <span className="rounded-lg bg-slate-900 px-2 py-1">{line.amountEur.toFixed(2)} €</span>}{line.shares != null && <span className="rounded-lg bg-slate-900 px-2 py-1">{line.shares} títulos</span>}{line.estimatedFeeEur != null && <span className="rounded-lg bg-slate-900 px-2 py-1">comisión {line.estimatedFeeEur.toFixed(2)} €</span>}</div>
            {needsTargetAvailability && availability && availabilityKey && <div className={`mt-3 rounded-lg border p-3 text-[10px] ${availabilityClass(availability.status)}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b>MyInvestor:</b> {availabilityLabel(availability.status, availability.evidence)}<div className="mt-1 opacity-75">Código de búsqueda: <span className="font-mono">{availabilityKey}</span>{availability.evidence === 'USER_POLICY_DEFAULT' && <span> · asunción operativa, no verificación oficial</span>}</div></div><div className="flex flex-wrap gap-2">{availability.status === 'USER_CONFIRMED_UNAVAILABLE' ? <button onClick={() => resetAvailability(availabilityKey)} className="rounded-md border border-cyan-500/40 px-2 py-1 font-bold text-cyan-200">Volver a asumir disponible</button> : <button onClick={() => markUnavailable(availabilityKey)} className="rounded-md border border-rose-500/40 px-2 py-1 text-rose-200">No está disponible</button>}</div></div></div>}
            {unavailable && <div className="mt-2 text-[10px] font-bold text-rose-300">Operación bloqueada porque marcaste este instrumento como no disponible en MyInvestor.</div>}
            {line.taxNote && <details className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-100"><summary className="cursor-pointer font-bold">Fondos / fiscalidad</summary><div className="mt-1">{line.taxNote}</div></details>}
          </article>;
        })}
      </div>
    </>}
  </section>;
};
