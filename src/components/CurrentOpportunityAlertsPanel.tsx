import React, { useMemo } from 'react';
import { BellRing, BarChart3, CheckCircle2, Repeat2, ShieldAlert, Sparkles } from 'lucide-react';
import {
  CashBenchmarkService,
  CurrentOpportunityAlertEngine,
  PortfolioDecisionEngine,
  PortfolioRotationReviewEngine,
  resolveSecurityIsin,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type CurrentOpportunityAlert,
  type InvestmentDecisionResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { AlertAutomationStatusPanel } from './AlertAutomationStatusPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function levelLabel(level: CurrentOpportunityAlert['level']): string {
  if (level === 'HIGH_CONVICTION') return 'ALTA CONVICCIÓN';
  if (level === 'GOOD_ENTRY') return 'BUENA OPORTUNIDAD';
  return 'ENTRADA VÁLIDA';
}
function levelClass(level: CurrentOpportunityAlert['level']): string {
  if (level === 'HIGH_CONVICTION') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  if (level === 'GOOD_ENTRY') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
  return 'border-slate-700 bg-slate-900 text-slate-200';
}

export const CurrentOpportunityAlertsPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const cashBenchmark = CashBenchmarkService.load();
  const portfolio = UserPortfolioService.load();
  const alerts = useMemo(() => CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmark), [scan, decision.asOfDate, cashBenchmark]);
  const portfolioDecision = useMemo(() => PortfolioDecisionEngine.evaluate({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct: cashBenchmark
  }), [scan, decision, positionHealth, cashBenchmark, portfolio.updatedAt]);
  const rotation = useMemo(() => PortfolioRotationReviewEngine.evaluate({
    portfolio,
    scan,
    positionHealth,
    cashBenchmarkAnnualPct: cashBenchmark,
    horizonYears: decision.horizonYears
  }), [scan, positionHealth, cashBenchmark, decision.horizonYears, portfolio.updatedAt]);

  const contributionByAsset = useMemo(() => new Map(portfolioDecision.contributions.map(row => [row.assetId, row])), [portfolioDecision]);
  const fundedAlerts = alerts.filter(alert => contributionByAsset.has(alert.assetId));
  const unfundedAlerts = alerts.filter(alert => !contributionByAsset.has(alert.assetId));
  const structuralSales = positionHealth?.positions.filter(position => position.action === 'REDUCE' || position.action === 'EXIT') ?? [];
  const buyAmount = portfolioDecision.recommendedNewInvestmentEur;
  const hasBuys = buyAmount > 0.01 && fundedAlerts.length > 0;
  const hasSales = structuralSales.length > 0;
  const hasRotation = rotation.status === 'ROTATE_NOW';
  const availableCapital = Math.max(0, portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur);

  const headline = hasBuys && hasSales
    ? 'HOY: REORDENAR CARTERA'
    : hasSales
      ? `HOY: REDUCIR / SALIR DE ${structuralSales.length} POSICIÓN${structuralSales.length === 1 ? '' : 'ES'}`
      : hasBuys
        ? `HOY: INVERTIR ${buyAmount.toFixed(2)} €`
        : hasRotation
          ? `HOY: ROTAR ${rotation.amountEur?.toFixed(2) ?? 'N/D'} €`
          : 'HOY: NO MOVER DINERO';

  const headlineDetail = hasBuys || hasSales || hasRotation
    ? 'Estas son las operaciones que superan los filtros actuales. Cada compra tiene un objetivo final y lo ya registrado en cartera se descuenta de ese objetivo.'
    : 'Ninguna compra, venta o rotación supera hoy todos los filtros. Mantener liquidez también es una decisión válida.';

  return <section className={`rounded-2xl border p-5 ${hasBuys || hasSales || hasRotation ? 'border-emerald-400/35 bg-emerald-500/5' : 'border-amber-500/20 bg-slate-900'}`}>
    <div className={`rounded-2xl border p-5 ${hasBuys || hasSales || hasRotation ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">{hasBuys ? <Sparkles className="h-5 w-5 text-emerald-300"/> : hasSales ? <ShieldAlert className="h-5 w-5 text-amber-300"/> : <BellRing className="h-5 w-5 text-amber-300"/>}<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Decisión de hoy</div></div>
          <h2 className={`mt-2 text-xl font-black sm:text-2xl ${hasBuys || hasSales || hasRotation ? 'text-emerald-100' : 'text-amber-100'}`}>{headline}</h2>
          <p className="mt-2 max-w-3xl text-xs text-slate-300">{headlineDetail}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-right"><div className="text-[9px] uppercase text-slate-500">Dinero nuevo disponible</div><div className="mt-1 font-mono text-lg font-black text-white">{availableCapital.toFixed(2)} €</div><div className="text-[9px] text-slate-500">Pendiente recomendado: {buyAmount.toFixed(2)} €</div></div>
      </div>
    </div>

    {hasBuys && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">Comprar</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fundedAlerts.map((alert, index) => {
        const contribution = contributionByAsset.get(alert.assetId)!;
        const candidate = scan.candidates.find(row => row.asset.assetId === alert.assetId);
        const isin = resolveSecurityIsin(alert.ticker, candidate?.asset.isin);
        const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? alert.ticker) : alert.ticker;
        return <article key={alert.assetId} className={`rounded-xl border p-4 ${levelClass(alert.level)}`}>
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(inspectKey)} className="block w-full rounded-lg text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase opacity-70">#{index + 1} · COMPRAR AHORA · {levelLabel(alert.level)}</div>
            <div className="mt-2 flex items-start justify-between gap-2"><div><div className="font-mono text-xl font-black">{alert.ticker}</div><div className="max-w-[260px] truncate text-[10px] opacity-70">{alert.name}</div>{isin && <div className="mt-1 font-mono text-[10px] font-bold text-cyan-200">ISIN {isin}</div>}</div>{alert.level === 'HIGH_CONVICTION' && <ShieldAlert className="h-5 w-5 shrink-0"/>}</div>
            <div className="mt-3 rounded-lg border border-emerald-400/30 bg-slate-950/35 p-3"><div className="text-[9px] uppercase opacity-60">Pendiente para completar el objetivo</div><div className="mt-1 font-mono text-2xl font-black">{contribution.amountEur.toFixed(2)} €</div>{contribution.targetAssetValueEur != null && <div className="mt-1 text-[9px] opacity-70">Objetivo total {contribution.targetAssetValueEur.toFixed(2)} € · ya en cartera {(contribution.currentAssetValueEur ?? 0).toFixed(2)} €</div>}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Consenso <b>{alert.consensusScore >= 0 ? '+' : ''}{alert.consensusScore}</b></span><span>Favorables <b>{alert.favorableVotes}/5</b></span><span>Momentum 120d <b>{alert.momentum120Pct?.toFixed(1) ?? 'N/D'}%</b></span><span>vs cash <b>{alert.excessVsCashPctPoints != null ? `${alert.excessVsCashPctPoints >= 0 ? '+' : ''}${alert.excessVsCashPctPoints.toFixed(1)} pp` : 'N/D'}</b></span></div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-cyan-200"><BarChart3 className="h-3.5 w-3.5"/>Toca esta recomendación para abrir ficha, código/ISIN, gráfica y señales →</div>}
          </button>
          <details className="mt-3 text-[10px]"><summary className="cursor-pointer font-bold opacity-80">Por qué comprar</summary><div className="mt-2 space-y-1 opacity-70">{alert.reasons.map(reason => <div key={reason}>• {reason}</div>)}<div>• {contribution.reason}</div></div></details>
          <a href="#register-real-purchase" className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5"/>Registrar compra ejecutada</a>
        </article>;
      })}</div>
    </div>}

    {hasSales && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-amber-300">Reducir / salir</div>
      <div className="grid gap-3 md:grid-cols-2">{structuralSales.map(position => {
        const pct = position.suggestedReductionPct ?? (position.action === 'EXIT' ? 100 : 50);
        const estimatedAmount = position.currentValueEur == null ? null : position.currentValueEur * pct / 100;
        return <article key={position.key} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(position.tickerOrIsin)} className="block w-full text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase">{position.action === 'EXIT' ? 'SALIR DE LA POSICIÓN' : `REDUCIR APROX. ${pct}%`}</div>
            <div className="mt-1 font-mono text-lg font-black">{position.tickerOrIsin}</div><div className="text-[10px] opacity-70">{position.label}</div>
            {estimatedAmount != null && <div className="mt-3 font-mono text-xl font-black">≈ {estimatedAmount.toFixed(2)} €</div>}
            <div className="mt-2 text-[10px] text-amber-100/80">{position.reason}</div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold"><BarChart3 className="h-3.5 w-3.5"/>Abrir ficha, gráfica y señales →</div>}
          </button>
        </article>;
      })}</div>
    </div>}

    {hasRotation && <div className="mt-4 rounded-xl border border-violet-400/35 bg-violet-500/10 p-4">
      <div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-violet-300"/><b className="text-xs uppercase tracking-wider text-violet-200">Cambiar dinero de una posición a otra</b></div>
      <div className="mt-2 font-mono text-base font-black text-violet-100">{rotation.sourceLabel} → {rotation.targetTicker} · {rotation.amountEur?.toFixed(2) ?? 'N/D'} €</div>
      <div className="mt-2 text-xs text-slate-300">{rotation.reason}</div>
      {onInspectAsset && rotation.targetTicker && <button type="button" onClick={() => onInspectAsset(rotation.targetTicker!)} className="mt-3 flex items-center gap-1 rounded-lg border border-violet-400/30 px-3 py-2 text-[10px] font-bold text-violet-100"><BarChart3 className="h-3.5 w-3.5"/>Ver destino</button>}
    </div>}

    {!hasBuys && !hasSales && !hasRotation && <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">El motor no encuentra hoy una operación que justifique mover dinero. No se fuerza una compra por tener liquidez disponible.</div>}

    {unfundedAlerts.length > 0 && <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <summary className="cursor-pointer text-xs font-bold text-slate-300">Otras oportunidades válidas que hoy no reciben dinero ({unfundedAlerts.length})</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{unfundedAlerts.slice(0, 6).map(alert => <div key={alert.assetId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-300"><b className="font-mono text-cyan-200">{alert.ticker}</b> · {levelLabel(alert.level)}<div className="mt-1 text-slate-500">Cumple el gate de oportunidad, pero no tiene un importe pendiente ejecutable con el objetivo actual, la cartera existente y los límites de riesgo/concentración.</div>{onInspectAsset && <button type="button" onClick={() => onInspectAsset(alert.ticker)} className="mt-2 text-cyan-300 underline underline-offset-2">Ver estudio</button>}</div>)}</div>
    </details>}

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-300">Alarmas y seguimiento automático</summary><div className="mt-3"><AlertAutomationStatusPanel /></div></details>
  </section>;
};
