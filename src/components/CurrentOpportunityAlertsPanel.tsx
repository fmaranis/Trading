import React, { useMemo } from 'react';
import { BellRing, BarChart3, CheckCircle2, Eye, GitBranch, Repeat2, ShieldAlert, Sparkles } from 'lucide-react';
import {
  CashBenchmarkService,
  CurrentOpportunityAlertEngine,
  resolveSecurityIsin,
  type AssetUniverseScanResult,
  type ContributionRecommendation,
  type CurrentOpportunityAlert,
  type InvestmentDecisionResult,
  type PortfolioDecisionResult,
  type PortfolioExecutionLine,
  type PortfolioExecutionPlan,
  type PortfolioPositionDecision
} from '../investment/decision';
import { AlertAutomationStatusPanel } from './AlertAutomationStatusPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  portfolioDecision: PortfolioDecisionResult;
  executionPlan: PortfolioExecutionPlan;
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

function contributionLine(lines: PortfolioExecutionLine[], contribution: ContributionRecommendation): PortfolioExecutionLine | undefined {
  return lines.find(line =>
    line.targetAssetId === contribution.assetId
    || (!!line.targetTicker && line.targetTicker.toUpperCase() === contribution.ticker.toUpperCase())
  );
}

function positionLine(lines: PortfolioExecutionLine[], position: PortfolioPositionDecision): PortfolioExecutionLine | undefined {
  const keys = new Set([position.id, position.assetId].filter(Boolean).map(value => String(value).toUpperCase()));
  return lines.find(line => [line.sourceId, line.sourceIsin, line.targetTicker]
    .filter(Boolean)
    .some(value => keys.has(String(value).toUpperCase())));
}

export const CurrentOpportunityAlertsPanel: React.FC<Props> = ({ scan, decision, portfolioDecision, executionPlan, onInspectAsset }) => {
  const cashBenchmark = CashBenchmarkService.load();
  const alerts = useMemo(() => CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmark), [scan, decision.asOfDate, cashBenchmark]);
  const alertByAsset = useMemo(() => new Map(alerts.map(alert => [alert.assetId, alert])), [alerts]);

  const pendingLines = executionPlan.lines.filter(line => line.status === 'PENDING');
  const buyLines = pendingLines.filter(line => line.action === 'BUY_ETF' || line.action === 'SUBSCRIBE_FUND');
  const sellLines = pendingLines.filter(line => line.action === 'SELL_ETF' || line.action === 'REDEEM_FUND');
  const transferLines = pendingLines.filter(line => line.action === 'TRANSFER_FUND');
  const reviewLines = pendingLines.filter(line => line.action === 'REVIEW');

  const executableBuys = portfolioDecision.contributions
    .map(contribution => ({ contribution, line: contributionLine(buyLines, contribution) }))
    .filter((row): row is { contribution: ContributionRecommendation; line: PortfolioExecutionLine } => Boolean(row.line));
  const executableSales = portfolioDecision.existingPositions
    .map(position => ({ position, line: positionLine(sellLines, position) }))
    .filter((row): row is { position: PortfolioPositionDecision; line: PortfolioExecutionLine } => Boolean(row.line));
  const canonicalWatch = portfolioDecision.existingPositions.filter(position => position.action === 'WATCH');
  const deferredContributions = portfolioDecision.contributions.filter(contribution => !contributionLine(buyLines, contribution));
  const fundedAssetIds = new Set(portfolioDecision.contributions.map(row => row.assetId));
  const unfundedAlerts = alerts.filter(alert => !fundedAssetIds.has(alert.assetId));

  const executableBuyAmount = buyLines.reduce((sum, line) => sum + Math.max(0, line.amountEur ?? 0), 0);
  const theoreticalBuyAmount = portfolioDecision.recommendedNewInvestmentEur;
  const hasBuys = executableBuys.length > 0;
  const hasSales = executableSales.length > 0;
  const hasTransfers = transferLines.length > 0;
  const hasActions = hasBuys || hasSales || hasTransfers;
  const availableCapital = Math.max(0, portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur);

  const headline = (hasBuys && (hasSales || hasTransfers)) || (hasSales && hasTransfers)
    ? 'HOY: REORDENAR CARTERA'
    : hasTransfers
      ? `HOY: TRASPASAR / ROTAR ${transferLines.length} POSICIÓN${transferLines.length === 1 ? '' : 'ES'}`
      : hasSales
        ? `HOY: REDUCIR / SALIR DE ${executableSales.length} POSICIÓN${executableSales.length === 1 ? '' : 'ES'}`
        : hasBuys
          ? `HOY: INVERTIR ${executableBuyAmount.toFixed(2)} €`
          : 'HOY: NO MOVER DINERO';

  const headlineDetail = hasActions
    ? 'La orden visible ya incorpora la decisión canónica de cartera y los controles de ejecución disponibles: títulos enteros, costes y fiscalidad.'
    : reviewLines.length > 0
      ? 'El motor detecta movimientos teóricos, pero ninguno queda ejecutable hoy después de los controles de ejecución. Se muestran como REVIEW, no como órdenes.'
      : 'La cadena productiva final no deja ninguna orden ejecutable. Mantener liquidez también es una decisión válida.';

  return <section className={`rounded-2xl border p-4 sm:p-5 ${hasActions ? 'border-emerald-400/35 bg-emerald-500/5' : 'border-amber-500/20 bg-slate-900'}`}>
    <div className={`rounded-2xl border p-4 sm:p-5 ${hasActions ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">{hasBuys ? <Sparkles className="h-5 w-5 text-emerald-300"/> : hasSales || hasTransfers ? <ShieldAlert className="h-5 w-5 text-amber-300"/> : <BellRing className="h-5 w-5 text-amber-300"/>}<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Decisión ejecutable de hoy</div></div>
          <h2 className={`mt-2 text-xl font-black sm:text-2xl ${hasActions ? 'text-emerald-100' : 'text-amber-100'}`}>{headline}</h2>
          <p className="mt-2 max-w-3xl text-xs text-slate-300">{headlineDetail}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-left md:text-right"><div className="text-[9px] uppercase text-slate-500">Dinero nuevo disponible</div><div className="mt-1 font-mono text-lg font-black text-white">{availableCapital.toFixed(2)} €</div><div className="text-[9px] text-slate-500">Motor {theoreticalBuyAmount.toFixed(2)} € · ejecutable {executableBuyAmount.toFixed(2)} €</div></div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Comprar ahora · {executableBuys.length}</div>
          <div className="mt-2 flex flex-wrap gap-2">{executableBuys.length ? executableBuys.map(({ contribution }) => {
            const candidate = scan.candidates.find(candidateRow => candidateRow.asset.assetId === contribution.assetId);
            const isin = resolveSecurityIsin(contribution.ticker, candidate?.asset.isin);
            const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? contribution.ticker) : contribution.ticker;
            return <button key={contribution.assetId} type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(inspectKey)} className="touch-target rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[10px] font-black text-emerald-100 disabled:cursor-default">{contribution.ticker}</button>;
          }) : <span className="text-[10px] text-slate-500">Ninguna compra ejecutable hoy.</span>}</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-amber-300">Vigilar cartera · {canonicalWatch.length}</div>
          <div className="mt-2 flex flex-wrap gap-2">{canonicalWatch.length ? canonicalWatch.slice(0, 8).map(position => {
            const identity = positionIdentity(scan, position);
            return <button key={position.id} type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(identity.inspectKey)} title={position.reason} className="touch-target flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 font-mono text-[10px] font-bold text-amber-100 disabled:cursor-default"><Eye className="h-3 w-3"/>{identity.ticker}</button>;
          }) : <span className="text-[10px] text-slate-500">Sin posiciones finales en WATCH.</span>}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-300">Controles de ejecución</div>
          <div className="mt-1 font-mono text-base font-black text-white">{reviewLines.length} REVIEW</div>
          <div className="mt-1 text-[10px] text-slate-500">Cash teórico tras plan: {portfolioDecision.residualPlannedCashEur.toFixed(2)} €. Las líneas aplazadas no se presentan como órdenes.</div>
        </div>
      </div>
    </div>

    {hasBuys && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">Comprar ahora</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{executableBuys.map(({ contribution, line }, index) => {
        const alert = alertByAsset.get(contribution.assetId);
        const candidate = scan.candidates.find(row => row.asset.assetId === contribution.assetId);
        const isin = resolveSecurityIsin(contribution.ticker, candidate?.asset.isin);
        const inspectKey = candidate?.asset.instrumentType === 'MUTUAL_FUND' ? (isin ?? contribution.ticker) : contribution.ticker;
        const label = alert ? levelLabel(alert.level) : contribution.positionStage === 'ROTATION_ENTRY' ? 'ROTACIÓN CANÓNICA' : 'ASIGNACIÓN CORE';
        return <article key={contribution.assetId} className={`rounded-xl border p-4 ${levelClass(alert?.level)}`}>
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(inspectKey)} className="touch-target block w-full rounded-lg text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase opacity-70">#{index + 1} · COMPRAR AHORA · {label}</div>
            <div className="mt-2 flex items-start justify-between gap-2"><div><div className="font-mono text-xl font-black">{contribution.ticker}</div><div className="max-w-[260px] truncate text-[10px] opacity-70">{contribution.name}</div>{isin && <div className="mt-1 font-mono text-[10px] font-bold text-cyan-200">ISIN {isin}</div>}</div>{alert?.level === 'HIGH_CONVICTION' && <ShieldAlert className="h-5 w-5 shrink-0"/>}</div>
            <div className="mt-3 rounded-lg border border-emerald-400/30 bg-slate-950/35 p-3"><div className="text-[9px] uppercase opacity-60">Orden ejecutable</div><div className="mt-1 font-mono text-2xl font-black">{(line.amountEur ?? 0).toFixed(2)} €</div><div className="mt-1 text-[9px] opacity-70">Objetivo teórico del motor {contribution.amountEur.toFixed(2)} €{line.shares != null ? ` · ${line.shares} títulos` : ''}{line.estimatedFeeEur != null ? ` · comisión est. ${line.estimatedFeeEur.toFixed(2)} €` : ''}</div></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Timing <b>{contribution.timingState ?? 'N/D'}</b></span><span>Tramo <b>{contribution.positionStage ?? 'N/D'}</b></span><span>Consenso <b>{alert == null ? 'N/D' : `${alert.consensusScore >= 0 ? '+' : ''}${alert.consensusScore}`}</b></span><span>vs cash <b>{line.excessReturnVsCashPctPoints != null ? `${line.excessReturnVsCashPctPoints >= 0 ? '+' : ''}${line.excessReturnVsCashPctPoints.toFixed(1)} pp` : 'N/D'}</b></span></div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-cyan-200"><BarChart3 className="h-3.5 w-3.5"/>Abrir ficha, gráfica y señales →</div>}
          </button>
          <details className="mt-3 text-[10px]"><summary className="touch-target flex cursor-pointer items-center font-bold opacity-80">Por qué y cómo se obtiene el importe</summary><div className="mt-2 space-y-1 opacity-70">{alert?.reasons.map(reason => <div key={reason}>• {reason}</div>)}<div>• {contribution.reason}</div><div>• Ejecución: {line.instruction}</div></div></details>
          <a href="#register-real-purchase" className="touch-target mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5"/>Registrar compra ejecutada</a>
        </article>;
      })}</div>
    </div>}

    {hasSales && <div className="mt-4">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-amber-300">Reducir / salir ahora</div>
      <div className="grid gap-3 md:grid-cols-2">{executableSales.map(({ position, line }) => {
        const identity = positionIdentity(scan, position);
        const pct = position.action === 'EXIT' ? 100 : (position.suggestedReductionPct ?? 50);
        return <article key={position.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          <button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(identity.inspectKey)} className="touch-target block w-full text-left disabled:cursor-default">
            <div className="text-[9px] font-black uppercase">{position.action === 'EXIT' ? 'SALIR DE LA POSICIÓN' : `REDUCIR APROX. ${pct}%`}</div>
            <div className="mt-1 font-mono text-lg font-black">{identity.ticker}</div><div className="text-[10px] opacity-70">{position.label}</div>
            {line.amountEur != null && <div className="mt-3 font-mono text-xl font-black">≈ {line.amountEur.toFixed(2)} €{line.shares != null ? ` · ${line.shares} títulos` : ''}</div>}
            <div className="mt-2 text-[10px] text-amber-100/80">{line.instruction}</div>
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[10px] font-bold"><BarChart3 className="h-3.5 w-3.5"/>Abrir ficha, gráfica y señales →</div>}
          </button>
        </article>;
      })}</div>
    </div>}

    {hasTransfers && <div className="mt-4 rounded-xl border border-violet-400/35 bg-violet-500/10 p-4">
      <div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-violet-300"/><b className="text-xs uppercase tracking-wider text-violet-200">Traspaso / rotación ejecutable</b></div>
      <div className="mt-3 space-y-2">{transferLines.map(line => <div key={line.id} className="rounded-lg border border-violet-400/20 bg-slate-950/40 p-3"><div className="font-mono text-sm font-black text-violet-100">{line.sourceLabel ?? line.sourceIsin ?? 'Origen'} → {line.targetTicker ?? line.targetName ?? 'Destino'}{line.amountEur == null ? '' : ` · ≈ ${line.amountEur.toFixed(2)} €`}</div><div className="mt-1 text-[10px] text-slate-400">{line.instruction}</div>{onInspectAsset && line.targetTicker && <button type="button" onClick={() => onInspectAsset(line.targetTicker!)} className="touch-target mt-2 flex items-center gap-1 text-[10px] font-bold text-violet-200"><BarChart3 className="h-3.5 w-3.5"/>Ver destino</button>}</div>)}</div>
    </div>}

    {!hasActions && <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">No hay una orden ejecutable hoy. Si existe una idea teórica aplazada por coste, cash, datos o fiscalidad, queda abajo como REVIEW y no se confunde con una operación.</div>}

    {(reviewLines.length > 0 || deferredContributions.length > 0) && <details className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-amber-100">Movimientos del motor que no son orden ejecutable hoy · {reviewLines.length}</summary>
      <div className="mt-3 space-y-2">{reviewLines.map(line => <div key={line.id} className="rounded-lg border border-amber-500/15 bg-slate-950/50 p-3 text-[10px] text-slate-300"><b className="text-amber-100">REVIEW · {line.targetTicker ?? line.sourceLabel ?? line.sourceIsin ?? 'posición'}</b><div className="mt-1">{line.instruction}</div><div className="mt-1 text-slate-500">{line.rationale}</div></div>)}</div>
    </details>}

    {unfundedAlerts.length > 0 && <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-slate-300">Otras oportunidades válidas que no reciben capital ({unfundedAlerts.length})</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{unfundedAlerts.slice(0, 6).map(alert => <div key={alert.assetId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-300"><b className="font-mono text-cyan-200">{alert.ticker}</b> · {levelLabel(alert.level)}<div className="mt-1 text-slate-500">Cumple el gate de oportunidad, pero la decisión final no le asigna capital con la cartera y límites actuales.</div>{onInspectAsset && <button type="button" onClick={() => onInspectAsset(alert.ticker)} className="touch-target mt-2 text-cyan-300 underline underline-offset-2">Ver estudio</button>}</div>)}</div>
    </details>}

    <details className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
      <summary className="touch-target flex cursor-pointer items-center gap-2 text-xs font-bold text-cyan-100"><GitBranch className="h-4 w-4"/>Cómo se calculó esta decisión</summary>
      <div className="mt-3 text-[10px] leading-relaxed text-slate-400">
        <div className="mobile-scroll-x pb-1 font-semibold text-cyan-100"><span className="whitespace-nowrap">AssetUniverseScanner → Top64 dinámico → PortfolioCandidateGate → InvestmentDecisionEngine → evaluatePortfolioDecision → CORE_GATE_V1 → CORE_ARCHITECTURE_V1 → ejecución</span></div>
        <div className="mt-2">Política productiva: <b className="text-emerald-200">LEGACY</b>. Capital disponible {availableCapital.toFixed(2)} € · asignación teórica nueva {theoreticalBuyAmount.toFixed(2)} € · orden de compra ejecutable {executableBuyAmount.toFixed(2)} € · {reviewLines.length} REVIEW.</div>
        <div className="mt-1">Cash objetivo {portfolioDecision.targetCashEur.toFixed(2)} € · cash teórico tras plan {portfolioDecision.residualPlannedCashEur.toFixed(2)} €.</div>
        {portfolioDecision.warnings.length > 0 && <div className="mt-2 text-amber-200">Avisos de cartera: {portfolioDecision.warnings.join(' · ')}</div>}
        {executionPlan.warnings.length > 0 && <div className="mt-1 text-amber-200">Avisos de ejecución: {executionPlan.warnings.join(' · ')}</div>}
      </div>
    </details>

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-slate-300">Alarmas y seguimiento automático</summary><div className="mt-3"><AlertAutomationStatusPanel /></div></details>
  </section>;
};