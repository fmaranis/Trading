import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, History, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import {
  getMyInvestorAvailability,
  ManualMyInvestorAvailabilityService,
  PilotDecisionHistoryService,
  PortfolioExecutionHistoryService,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult,
  type PortfolioDecisionResult,
  type PortfolioExecutionPlan,
  type PortfolioPositionDecision,
  type PortfolioPositionHealthResult
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  portfolioDecision: PortfolioDecisionResult;
  executionPlan: PortfolioExecutionPlan;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function availabilityLabel(status: string): string {
  if (status === 'CONFIRMED_MYINVESTOR') return 'DISPONIBLE CONFIRMADO';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'NO DISPONIBLE';
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'DISPONIBLE ASUMIDO';
  return 'POR VERIFICAR';
}
function availabilityClass(status: string): string {
  if (status === 'CONFIRMED_MYINVESTOR') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'border-cyan-500/25 bg-cyan-500/5 text-cyan-200';
  return 'border-amber-500/25 bg-amber-500/5 text-amber-200';
}
function actionClass(action: string): string {
  if (action === 'ADD') return 'text-emerald-300';
  if (action === 'REDUCE' || action === 'EXIT') return 'text-rose-300';
  if (action === 'WATCH') return 'text-amber-300';
  return 'text-sky-300';
}
function positionKey(scan: AssetUniverseScanResult, position: PortfolioPositionDecision): string {
  const normalized = position.id.toUpperCase();
  const candidate = scan.candidates.find(row =>
    (position.assetId != null && row.asset.assetId === position.assetId)
    || row.asset.ticker.toUpperCase() === normalized
    || row.asset.isin?.toUpperCase() === normalized
  );
  return candidate?.asset.instrumentType === 'MUTUAL_FUND'
    ? (candidate.asset.isin ?? candidate.asset.ticker)
    : (candidate?.asset.ticker ?? position.id);
}

export const PilotOperationsPanel: React.FC<Props> = ({ scan, decision, portfolioDecision, executionPlan, positionHealth, onInspectAsset }) => {
  const [portfolioRevision, setPortfolioRevision] = useState(0);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => UserPortfolioService.subscribe(() => setPortfolioRevision(value => value + 1)), []);
  const portfolio = useMemo(() => UserPortfolioService.load(), [portfolioRevision]);

  const contributions = useMemo(() => portfolioDecision.contributions.map(row => {
    const candidate = scan.candidates.find(candidate => candidate.asset.assetId === row.assetId);
    const availability = candidate ? getMyInvestorAvailability(candidate.asset) : null;
    return { row, candidate, availability };
  }), [portfolioDecision, scan, availabilityRevision]);

  const pendingLines = executionPlan.lines.filter(line => line.status === 'PENDING');
  const buyLines = pendingLines.filter(line => line.action === 'BUY_ETF' || line.action === 'SUBSCRIBE_FUND');
  const sellLines = pendingLines.filter(line => line.action === 'SELL_ETF' || line.action === 'REDEEM_FUND');
  const transferLines = pendingLines.filter(line => line.action === 'TRANSFER_FUND');
  const reviewLines = pendingLines.filter(line => line.action === 'REVIEW');
  const executableBuyEur = buyLines.reduce((sum, line) => sum + Math.max(0, line.amountEur ?? 0), 0);
  const canonicalPositionActions = portfolioDecision.existingPositions.filter(position => position.action === 'WATCH' || position.action === 'REDUCE' || position.action === 'EXIT');
  const healthRows = positionHealth?.positions ?? [];

  const action = buyLines.length > 0 && (sellLines.length > 0 || transferLines.length > 0)
    ? 'MIXED'
    : sellLines.length > 0 || transferLines.length > 0
      ? 'REDUCE_EXIT'
      : buyLines.length > 0
        ? 'BUY'
        : 'HOLD_CASH';
  const headline = action === 'MIXED'
    ? 'REORDENAR CARTERA'
    : action === 'REDUCE_EXIT'
      ? 'REDUCIR / SALIR / TRASPASAR'
      : action === 'BUY'
        ? `INVERTIR ${executableBuyEur.toFixed(2)} €`
        : 'NO MOVER DINERO';

  useEffect(() => {
    PilotDecisionHistoryService.saveDaily({
      asOfDate: decision.asOfDate,
      action,
      headline,
      recommendedInvestmentEur: executableBuyEur,
      residualCashEur: portfolioDecision.residualPlannedCashEur,
      buys: buyLines.map(line => {
        const candidate = scan.candidates.find(row => row.asset.assetId === line.targetAssetId || row.asset.ticker.toUpperCase() === String(line.targetTicker ?? '').toUpperCase());
        const availability = candidate ? getMyInvestorAvailability(candidate.asset) : null;
        return {
          assetId: line.targetAssetId ?? line.targetTicker ?? line.id,
          ticker: line.targetTicker ?? line.targetName ?? line.id,
          amountEur: Math.max(0, line.amountEur ?? 0),
          availability: availability?.status ?? 'UNVERIFIED'
        };
      }),
      positionActions: canonicalPositionActions.map(position => ({
        key: position.id,
        tickerOrIsin: positionKey(scan, position),
        action: position.action as 'WATCH' | 'REDUCE' | 'EXIT',
        currentValueEur: position.currentValueEur,
        reason: position.reason
      })),
      portfolioFingerprint: `${decision.portfolioDatasetFingerprint}|${portfolio.updatedAt}|${executionPlan.decisionAsOf}`
    });
    setHistoryRevision(value => value + 1);
  }, [decision.asOfDate, decision.portfolioDatasetFingerprint, portfolio.updatedAt, executionPlan, portfolioDecision, scan, action, headline, executableBuyEur]);

  const history = useMemo(() => PilotDecisionHistoryService.load(), [historyRevision]);
  const executions = useMemo(() => PortfolioExecutionHistoryService.load().slice().reverse(), [portfolioRevision]);

  const operationalAssets = useMemo(() => {
    const keys = new Set<string>();
    const assets = [] as Array<{ assetId: string; ticker: string; isin?: string; name: string; status: string; note: string }>;
    const addCandidate = (candidate: AssetUniverseScanResult['candidates'][number] | undefined) => {
      if (!candidate || keys.has(candidate.asset.assetId)) return;
      keys.add(candidate.asset.assetId);
      const availability = getMyInvestorAvailability(candidate.asset);
      assets.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, isin: candidate.asset.isin, name: candidate.asset.name, status: availability.status, note: availability.note });
    };
    for (const item of contributions) addCandidate(item.candidate);
    for (const holding of portfolio.holdings) addCandidate(scan.candidates.find(candidate => candidate.asset.ticker.toUpperCase() === holding.ticker.toUpperCase()));
    for (const fund of portfolio.funds ?? []) addCandidate(scan.candidates.find(candidate => candidate.asset.isin?.toUpperCase() === fund.isin.toUpperCase() || candidate.asset.assetId === fund.id));
    return assets;
  }, [contributions, portfolio, scan, availabilityRevision]);

  const markAvailability = (key: string, value: 'AVAILABLE' | 'UNAVAILABLE') => {
    ManualMyInvestorAvailabilityService.set(key, value);
    setAvailabilityRevision(revision => revision + 1);
  };
  const resetAvailability = (key: string) => {
    ManualMyInvestorAvailabilityService.remove(key);
    setAvailabilityRevision(revision => revision + 1);
  };

  return <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 sm:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-bold text-white">Seguimiento operativo</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Este bloque no vuelve a decidir. Archiva la misma decisión/plan ejecutable mostrado arriba, el estado de posiciones y lo que finalmente registraste en cartera.</p></div>
      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-200">MISMA DECISIÓN · SOLO SEGUIMIENTO</span>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Plan archivado hoy</div><b className="mt-1 block text-white">{headline}</b></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Compras ejecutables</div><b className="mt-1 block font-mono text-emerald-200">{buyLines.length} · {executableBuyEur.toFixed(2)} €</b></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Salidas / traspasos</div><b className="mt-1 block text-amber-200">{sellLines.length} / {transferLines.length}</b></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">No ejecutables</div><b className="mt-1 block text-slate-300">{reviewLines.length} REVIEW</b></div>
    </div>

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4" open>
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-white">Seguimiento de posiciones reales</summary>
      <div className="mobile-scroll-x mt-3"><table className="w-full min-w-[760px] text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">Posición</th><th className="p-2 text-left">Salud</th><th className="p-2 text-right">Retorno</th><th className="p-2 text-right">MFE</th><th className="p-2 text-right">Giveback</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{healthRows.map(row => <tr key={row.key} className="border-t border-slate-800"><td className="p-2"><button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(row.tickerOrIsin)} className="touch-target font-mono font-bold text-cyan-200 disabled:text-slate-300">{row.tickerOrIsin}</button></td><td className={`p-2 font-black ${actionClass(row.action)}`}>{row.action}</td><td className="p-2 text-right font-mono">{row.currentReturnPct == null ? 'N/D' : `${row.currentReturnPct >= 0 ? '+' : ''}${row.currentReturnPct.toFixed(1)}%`}</td><td className="p-2 text-right font-mono">{row.mfePct == null ? 'N/D' : `${row.mfePct.toFixed(1)}%`}</td><td className="p-2 text-right font-mono">{row.givebackFromMfePctPoints == null ? 'N/D' : `${row.givebackFromMfePctPoints.toFixed(1)} pp`}</td><td className="max-w-[440px] p-2 text-slate-400">{row.reason}</td></tr>)}</tbody></table>{healthRows.length === 0 && <div className="p-3 text-center text-slate-500">Sin posiciones evaluadas.</div>}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-white">Disponibilidad operativa en MyInvestor ({operationalAssets.length})</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{operationalAssets.map(asset => {
        const key = (asset.isin || asset.ticker).toUpperCase();
        return <div key={asset.assetId} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex items-start justify-between gap-2"><div><b className="font-mono text-white">{asset.ticker}</b>{asset.isin && <div className="font-mono text-cyan-300">{asset.isin}</div>}<div className="text-slate-500">{asset.name}</div></div><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${availabilityClass(asset.status)}`}>{availabilityLabel(asset.status)}</span></div><div className="mt-2 text-slate-500">{asset.note}</div><div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><button type="button" onClick={() => markAvailability(key, 'AVAILABLE')} className="touch-target flex items-center justify-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-emerald-200"><CheckCircle2 className="h-3 w-3"/>Sí está</button><button type="button" onClick={() => markAvailability(key, 'UNAVAILABLE')} className="touch-target flex items-center justify-center gap-1 rounded border border-rose-500/30 px-2 py-1 text-rose-200"><XCircle className="h-3 w-3"/>No está</button><button type="button" onClick={() => resetAvailability(key)} className="touch-target rounded border border-slate-700 px-2 py-1 text-slate-400">Restablecer</button>{onInspectAsset && <button type="button" onClick={() => onInspectAsset(key)} className="touch-target flex items-center justify-center gap-1 rounded border border-cyan-500/30 px-2 py-1 text-cyan-200"><BarChart3 className="h-3 w-3"/>Gráfica</button>}</div></div>;
      })}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-white"><History className="h-4 w-4 text-violet-300"/>Historial diario de decisiones ({history.length})</summary>
      <div className="mt-3 space-y-2">{history.slice(0, 30).map(row => <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-white">{row.asOfDate}</b><span className={row.action === 'HOLD_CASH' ? 'font-black text-amber-200' : 'font-black text-emerald-200'}>{row.headline}</span></div><div className="mt-1 text-slate-500">Comprar {row.recommendedInvestmentEur.toFixed(2)} € · cash teórico {row.residualCashEur.toFixed(2)} € · {row.positionActions.length} posición(es) con WATCH/REDUCE/EXIT</div><div className="mt-1 text-slate-400">{row.buys.length ? row.buys.map(buy => `${buy.ticker} ${buy.amountEur.toFixed(0)} €`).join(' · ') : 'Sin compras ejecutables archivadas'}</div></div>)}{history.length === 0 && <div className="text-slate-500">El historial empieza cuando la app calcula la primera decisión canónica.</div>}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-white"><WalletCards className="h-4 w-4 text-emerald-300"/>Operaciones reales registradas ({executions.length})</summary>
      <div className="mt-3 space-y-2">{executions.slice(0, 20).map(row => <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex items-center justify-between gap-2"><b className="font-mono text-white">{row.appliedAt.slice(0, 10)}</b><b className="text-emerald-200">{row.action}</b></div><div className="mt-1 text-slate-400">{row.targetTicker ?? row.targetIsin ?? row.sourceLabel ?? 'Operación'}{row.amountEur != null ? ` · ${row.amountEur.toFixed(2)} €` : ''}{row.shares != null ? ` · ${row.shares} uds.` : ''}{row.feeEur > 0 ? ` · comisión ${row.feeEur.toFixed(2)} €` : ''}</div></div>)}{executions.length === 0 && <div className="text-slate-500">Todavía no hay operaciones ejecutadas registradas.</div>}</div>
    </details>
  </section>;
};
