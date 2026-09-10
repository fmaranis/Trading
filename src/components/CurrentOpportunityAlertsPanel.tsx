import React, { useMemo } from 'react';
import { BellRing, BarChart3, CheckCircle2, Eye, GitBranch, Repeat2, ShieldAlert, Sparkles } from 'lucide-react';
import {
  CashBenchmarkService,
  CurrentOpportunityAlertEngine,
  evaluatePortfolioDecision,
  resolveSecurityIsin,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type CurrentOpportunityAlert,
  type InvestmentDecisionResult,
  type PortfolioPositionDecision,
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

function levelClass(level: CurrentOpportunityAlert['level'] | undefined): string {
  if (level === 'HIGH_CONVICTION') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  if (level === 'GOOD_ENTRY') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
  return 'border-slate-700 bg-slate-900 text-slate-200';
}

function positionIdentity(scan: AssetUniverseScanResult, position: PortfolioPositionDecision) {
  const normalizedId = position.id.toUpperCase();
  const candidate = scan.candidates.find(row =>
    (position.assetId != null && row.asset.assetId === position.assetId)
    || row.asset.ticker.toUpperCase() === normalizedId
    || row.asset.isin?.toUpperCase() === normalizedId
  );
  const ticker = candidate?.asset.ticker ?? position.id;
  const isin = candidate?.asset.isin ?? null;
  const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? ticker) : ticker;
  return { ticker, isin, inspectKey };
}

function plannedSaleAmount(position: PortfolioPositionDecision): number | null {
  if (position.currentValueEur == null) return null;
  const pct = position.action === 'EXIT' ? 100 : (position.suggestedReductionPct ?? 50);
  return position.currentValueEur * Math.max(0, Math.min(100, pct)) / 100;
}

export const CurrentOpportunityAlertsPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const cashBenchmark = CashBenchmarkService.load();
  const portfolio = UserPortfolioService.load();
  const alerts = useMemo(() => CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmark), [scan, decision.asOfDate, cashBenchmark]);
  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct: cashBenchmark
  }), [scan, decision, positionHealth, cashBenchmark, portfolio.updatedAt]);

  const alertByAsset = useMemo(() => new Map(alerts.map(alert => [alert.assetId, alert])), [alerts]);
  const canonicalBuys = portfolioDecision.contributions.filter(row => row.amountEur > 0.01);
  const fundedAssetIds = new Set(canonicalBuys.map(row => row.assetId));
  const unfundedAlerts = alerts.filter(alert => !fundedAssetIds.has(alert.assetId));
  const canonicalSales = portfolioDecision.existingPositions.filter(position => position.action === 'REDUCE' || position.action === 'EXIT');
  const canonicalWatch = portfolioDecision.existingPositions.filter(position => position.action === 'WATCH');
  const canonicalRotations = canonicalSales.filter(position => position.rotationChallengerAssetId && position.rotationChallengerTicker);
  const buyAmount = portfolioDecision.recommendedNewInvestmentEur;
  const hasBuys = buyAmount > 0.01 && canonicalBuys.length > 0;
  const hasSales = canonicalSales.length > 0;
  const hasRotation = canonicalRotations.length > 0;
  const availableCapital = Math.max(0, portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur);

  const headline = hasBuys && hasSales
    ? 'HOY: REORDENAR CARTERA'
    : hasSales
      ? `HOY: REDUCIR / SALIR DE ${canonicalSales.length} POSICIÓN${canonicalSales.length === 1 ? '' : 'ES'}`
      : hasBuys
        ? `HOY: INVERTIR ${buyAmount.toFixed(2)} €`
        : 'HOY: NO MOVER DINERO';

  const headlineDetail = hasBuys || hasSales
    ? 'Todas las operaciones visibles salen del mismo resultado final de evaluatePortfolioDecision, después de CORE_GATE_V1 y CORE_ARCHITECTURE_V1.'
    : 'La cadena productiva final no financia ninguna compra ni autoriza una reducción o salida. Mantener liquidez también es una decisión válida.';

  return <section className={`rounded-2xl border p-4 sm:p-5 ${hasBuys || hasSales ? 'border-emerald-400/35 bg-emerald-500/5' : 'border-amber-500/20 bg-slate-900'}`}>
    <div className={`rounded-2xl border p-4 sm:p-5 ${hasBuys || hasSales ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">{hasBuys ? <Sparkles className="h-5 w-5 text-emerald-300"/> : hasSales ? <ShieldAlert className="h-5 w-5 text-amber-300"/> : <BellRing className="h-5 w-5 text-amber-300"/>}<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Decisión de hoy</div></div>
          <h2 className={`mt-2 text-xl font-black sm:text-2xl ${hasBuys || hasSales ? 'text-emerald-100' : 'text-amber-100'}`}>{headline}</h2>
          <p className="mt-2 max-w-3xl text-xs text-slate-300">{headlineDetail}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-left md:text-right"><div className="text-[9px] uppercase text-slate-500">Dinero nuevo disponible</div><div className="mt-1 font-mono text-lg font-black text-white">{availableCapital.toFixed(2)} €</div><div className="text-[9px] text-slate-500">Pendiente recomendado: {buyAmount.toFixed(2)} €</div></div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Comprar ahora · {canonicalBuys.length}</div>
          <div className="mt-2 flex flex-wrap gap-2">{canonicalBuys.length ? canonicalBuys.map(row => {
            const candidate = scan.candidates.find(candidateRow => candidateRow.asset.assetId === row.assetId);
            const isin = resolveSecurityIsin(row.ticker, candidate?.asset.isin);
            const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? row.ticker) : row.ticker;
            return <button key={row.assetId} type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(inspectKey)} className="touch-target rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[10px] font-black text-emerald-100 disabled:cursor-default">{row.ticker}</button>;
          }) : <span className="text-[10px] text-slate-500">Ninguna compra financiada por la cadena final.</span>}</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-amber-300">Vigilar cartera · {canonicalWatch.length}</div>
          <div className="mt-2 flex flex-wrap gap-2">{canonicalWatch.length ? canonicalWatch.slice(0, 8).map(position => {
            const identity = positionIdentity(scan, position);
            return <button key={position.id} type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(identity.inspectKey)} title={position.reason} className="touch-target flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 font-mono text-[10px] font-bold text-amber-100 disabled:cursor-default"><Eye className="h-3 w-3"/>{identity.ticker}</button>;
          }) : <span className="text-[10px] text-slate-500">Sin posiciones finales en WATCH.</span>}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-300">Cash tras el plan</div>
          <div className="mt-1 font-mono text-base font-black text-white">{portfolioDecision.residualPlannedCashEur.toFixed(2)} €</div>
          <div className="mt-1 text-[10px] text-slate-500">Objetivo de cash: {portfolioDecision.targetCashEur.toFixed(2)} €. No se fuerza otra compra para vaciar liquidez.</div>
        </div>
      </div>
    </div>

    {hasBuys && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">Comprar</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{canonicalBuys.map((contribution, index) => {
        const alert = alertByAsset.get(contribution.assetId);
        const candidate = scan.candidates.find(row => row.asset.assetId === contribution.assetId);
        const isin = resolveSecurityIsin(contribution.ticker, candidate?.asset.isin);
        const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? contribution.ticker) : contribution.ticker;
        const label = alert ? levelLabel(alert.level) : contribution.positionStage === 'ROTATION_ENTRY' ? 'ROTACIÓN CANÓNICA' : 'ASIGNACIÓN CORE';
        return <article key={contribution.assetId} className={`rounded-xl border p-4 ${levelClass(alert?.level)}`}>
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(inspectKey)} className="touch-target block w-full rounded-lg text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase opacity-70">#{index + 1} · COMPRAR AHORA · {label}</div>
            <div className="mt-2 flex items-start justify-between gap-2"><div><div className="font-mono text-xl font-black">{contribution.ticker}</div><div className="max-w-[260px] truncate text-[10px] opacity-70">{contribution.name}</div>{isin && <div className="mt-1 font-mono text-[10px] font-bold text-cyan-200">ISIN {isin}</div>}</div>{alert?.level === 'HIGH_CONVICTION' && <ShieldAlert className="h-5 w-5 shrink-0"/>}</div>
            <div className="mt-3 rounded-lg border border-emerald-400/30 bg-slate-950/35 p-3"><div className="text-[9px] uppercase opacity-60">Importe final autorizado</div><div className="mt-1 font-mono text-2xl font-black">{contribution.amountEur.toFixed(2)} €</div>{contribution.targetAssetValueEur != null && <div className="mt-1 text-[9px] opacity-70">Objetivo {contribution.targetAssetValueEur.toFixed(2)} € · ya en cartera {(contribution.currentAssetValueEur ?? 0).toFixed(2)} €</div>}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Timing <b>{contribution.timingState ?? 'N/D'}</b></span><span>Tramo <b>{contribution.positionStage ?? 'N/D'}</b></span><span>Consenso <b>{alert == null ? 'N/D' : `${alert.consensusScore >= 0 ? '+' : ''}${alert.consensusScore}`}</b></span><span>vs cash <b>{alert?.excessVsCashPctPoints != null ? `${alert.excessVsCashPctPoints >= 0 ? '+' : ''}${alert.excessVsCashPctPoints.toFixed(1)} pp` : 'N/D'}</b></span></div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-cyan-200"><BarChart3 className="h-3.5 w-3.5"/>Abrir ficha, gráfica y señales →</div>}
          </button>
          <details className="mt-3 text-[10px]"><summary className="touch-target flex cursor-pointer items-center font-bold opacity-80">Por qué y cómo se obtiene el importe</summary><div className="mt-2 space-y-1 opacity-70">{alert?.reasons.map(reason => <div key={reason}>• {reason}</div>)}<div>• {contribution.reason}</div></div></details>
          <a href="#register-real-purchase" className="touch-target mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5"/>Registrar compra ejecutada</a>
        </article>;
      })}</div>
    </div>}

    {hasSales && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-amber-300">Reducir / salir</div>
      <div className="grid gap-3 md:grid-cols-2">{canonicalSales.map(position => {
        const identity = positionIdentity(scan, position);
        const pct = position.action === 'EXIT' ? 100 : (position.suggestedReductionPct ?? 50);
        const estimatedAmount = plannedSaleAmount(position);
        return <article key={position.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(identity.inspectKey)} className="touch-target block w-full text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase">{position.action === 'EXIT' ? 'SALIR DE LA POSICIÓN' : `REDUCIR APROX. ${pct}%`}</div>
            <div className="mt-1 font-mono text-lg font-black">{identity.ticker}</div><div className="text-[10px] opacity-70">{position.label}</div>
            {estimatedAmount != null && <div className="mt-3 font-mono text-xl font-black">≈ {estimatedAmount.toFixed(2)} €</div>}
            <div className="mt-2 text-[10px] text-amber-100/80">{position.reason}</div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold"><BarChart3 className="h-3.5 w-3.5"/>Abrir ficha, gráfica y señales →</div>}
          </button>
        </article>;
      })}</div>
    </div>}

    {hasRotation && <div className="mt-4 rounded-xl border border-violet-400/35 bg-violet-500/10 p-4">
      <div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-violet-300"/><b className="text-xs uppercase tracking-wider text-violet-200">Rotación autorizada por la cadena final</b></div>
      <div className="mt-3 space-y-2">{canonicalRotations.map(position => {
        const identity = positionIdentity(scan, position);
        const amount = plannedSaleAmount(position);
        return <div key={`rotation-${position.id}`} className="rounded-lg border border-violet-400/20 bg-slate-950/40 p-3"><div className="font-mono text-sm font-black text-violet-100">{identity.ticker} → {position.rotationChallengerTicker}{amount == null ? '' : ` · ≈ ${amount.toFixed(2)} €`}</div><div className="mt-1 text-[10px] text-slate-400">{position.reason}</div>{onInspectAsset && position.rotationChallengerTicker && <button type="button" onClick={() => onInspectAsset(position.rotationChallengerTicker!)} className="touch-target mt-2 flex items-center gap-1 text-[10px] font-bold text-violet-200"><BarChart3 className="h-3.5 w-3.5"/>Ver destino</button>}</div>;
      })}</div>
    </div>}

    {!hasBuys && !hasSales && <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">El resultado final no encuentra hoy una operación que justifique mover dinero. No se fuerza una compra por tener liquidez disponible.</div>}

    {unfundedAlerts.length > 0 && <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-slate-300">Otras oportunidades válidas que hoy no reciben dinero ({unfundedAlerts.length})</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{unfundedAlerts.slice(0, 6).map(alert => <div key={alert.assetId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-300"><b className="font-mono text-cyan-200">{alert.ticker}</b> · {levelLabel(alert.level)}<div className="mt-1 text-slate-500">Cumple el gate de oportunidad, pero la decisión final no le asigna un importe ejecutable con la cartera y límites actuales.</div>{onInspectAsset && <button type="button" onClick={() => onInspectAsset(alert.ticker)} className="touch-target mt-2 text-cyan-300 underline underline-offset-2">Ver estudio</button>}</div>)}</div>
    </details>}

    <details className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
      <summary className="touch-target flex cursor-pointer items-center gap-2 text-xs font-bold text-cyan-100"><GitBranch className="h-4 w-4"/>Cómo se calculó esta decisión</summary>
      <div className="mt-3 text-[10px] leading-relaxed text-slate-400">
        <div className="mobile-scroll-x pb-1 font-semibold text-cyan-100"><span className="whitespace-nowrap">AssetUniverseScanner → Top64 dinámico → PortfolioCandidateGate → InvestmentDecisionEngine → evaluatePortfolioDecision → CORE_GATE_V1 → CORE_ARCHITECTURE_V1</span></div>
        <div className="mt-2">Política productiva de asignación: <b className="text-emerald-200">LEGACY</b>. Capital disponible {availableCapital.toFixed(2)} € · inversión final {buyAmount.toFixed(2)} € · cash objetivo {portfolioDecision.targetCashEur.toFixed(2)} € · cash tras plan {portfolioDecision.residualPlannedCashEur.toFixed(2)} €.</div>
        {portfolioDecision.warnings.length > 0 && <div className="mt-2 text-amber-200">Avisos: {portfolioDecision.warnings.join(' · ')}</div>}
      </div>
    </details>

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-slate-300">Alarmas y seguimiento automático</summary><div className="mt-3"><AlertAutomationStatusPanel /></div></details>
  </section>;
};