import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, History, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import {
  evaluatePortfolioDecision,
  getMyInvestorAvailability,
  ManualMyInvestorAvailabilityService,
  PilotDecisionHistoryService,
  PortfolioExecutionHistoryService,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
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

export const PilotOperationsPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const [portfolioRevision, setPortfolioRevision] = useState(0);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => UserPortfolioService.subscribe(() => setPortfolioRevision(value => value + 1)), []);
  const portfolio = useMemo(() => UserPortfolioService.load(), [portfolioRevision]);
  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey
  }), [portfolio, scan, decision, positionHealth, availabilityRevision]);

  const contributions = useMemo(() => portfolioDecision.contributions.map(row => {
    const candidate = scan.candidates.find(candidate => candidate.asset.assetId === row.assetId);
    const availability = candidate ? getMyInvestorAvailability(candidate.asset) : null;
    return { row, candidate, availability };
  }), [portfolioDecision, scan, availabilityRevision]);
  const executableContributions = contributions.filter(item => item.availability?.status !== 'USER_CONFIRMED_UNAVAILABLE');
  const blockedContributions = contributions.filter(item => item.availability?.status === 'USER_CONFIRMED_UNAVAILABLE');
  const executableBuyEur = executableContributions.reduce((sum, item) => sum + Math.max(0, item.row.amountEur), 0);
  const healthRows = positionHealth?.positions ?? [];
  const sales = healthRows.filter(row => row.action === 'REDUCE' || row.action === 'EXIT');
  const watches = healthRows.filter(row => row.action === 'WATCH');
  const hasBuys = executableBuyEur > 0.01;
  const hasSales = sales.length > 0;
  const action = hasBuys && hasSales ? 'MIXED' : hasSales ? 'REDUCE_EXIT' : hasBuys ? 'BUY' : 'HOLD_CASH';
  const headline = action === 'MIXED'
    ? 'REORDENAR CARTERA'
    : action === 'REDUCE_EXIT'
      ? 'REDUCIR / SALIR'
      : action === 'BUY'
        ? `INVERTIR ${executableBuyEur.toFixed(2)} €`
        : blockedContributions.length > 0
          ? 'NO EJECUTAR: DESTINO BLOQUEADO EN MYINVESTOR'
          : 'NO MOVER DINERO';

  useEffect(() => {
    PilotDecisionHistoryService.saveDaily({
      asOfDate: decision.asOfDate,
      action,
      headline,
      recommendedInvestmentEur: executableBuyEur,
      residualCashEur: portfolioDecision.residualPlannedCashEur + blockedContributions.reduce((sum, item) => sum + item.row.amountEur, 0),
      buys: contributions.map(item => ({
        assetId: item.row.assetId,
        ticker: item.row.ticker,
        amountEur: item.row.amountEur,
        availability: item.availability?.status ?? 'UNVERIFIED'
      })),
      positionActions: healthRows
        .filter(row => row.action === 'WATCH' || row.action === 'REDUCE' || row.action === 'EXIT')
        .map(row => ({ key: row.key, tickerOrIsin: row.tickerOrIsin, action: row.action as 'WATCH' | 'REDUCE' | 'EXIT', currentValueEur: row.currentValueEur, reason: row.reason })),
      portfolioFingerprint: `${decision.portfolioDatasetFingerprint}|${portfolio.updatedAt}`
    });
    setHistoryRevision(value => value + 1);
  }, [decision.asOfDate, decision.portfolioDatasetFingerprint, portfolio.updatedAt, action, headline, executableBuyEur, portfolioDecision.residualPlannedCashEur, blockedContributions.length, contributions.length, healthRows.length]);

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

  return <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-bold text-white">V1 PILOT · control operativo</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">El motor queda congelado. Este bloque registra lo que recomendaba cada fecha, lo que ejecutaste realmente y el estado posterior de cada posición. No recalibra thresholds ni modifica señales.</p></div>
      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-200">ESTRATEGIA CONGELADA · SOLO BUGS</span>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">¿Tengo que hacer algo?</div><b className={`mt-1 block ${action === 'HOLD_CASH' ? 'text-amber-200' : 'text-emerald-200'}`}>{headline}</b></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">¿Cuánto?</div><b className="mt-1 block font-mono text-white">{executableBuyEur.toFixed(2)} €</b><div className="text-[9px] text-slate-500">cash previsto {portfolioDecision.residualPlannedCashEur.toFixed(2)} €</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">¿Qué vigilar?</div><b className="mt-1 block text-amber-200">{watches.length} WATCH</b><div className="text-[9px] text-slate-500">{sales.length} REDUCE/EXIT</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">MyInvestor</div><b className="mt-1 block text-cyan-200">{blockedContributions.length} bloqueada(s)</b><div className="text-[9px] text-slate-500">las marcadas NO DISPONIBLE no se presentan como ejecutables</div></div>
    </div>

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4" open>
      <summary className="cursor-pointer text-xs font-bold text-white">Seguimiento de posiciones reales</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">Posición</th><th className="p-2 text-left">Estado</th><th className="p-2 text-right">Retorno</th><th className="p-2 text-right">MFE</th><th className="p-2 text-right">Giveback</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{healthRows.map(row => <tr key={row.key} className="border-t border-slate-800"><td className="p-2"><button type="button" disabled={!onInspectAsset} onClick={() => onInspectAsset?.(row.tickerOrIsin)} className="font-mono font-bold text-cyan-200 disabled:text-slate-300">{row.tickerOrIsin}</button></td><td className={`p-2 font-black ${actionClass(row.action)}`}>{row.action}</td><td className="p-2 text-right font-mono">{row.currentReturnPct == null ? 'N/D' : `${row.currentReturnPct >= 0 ? '+' : ''}${row.currentReturnPct.toFixed(1)}%`}</td><td className="p-2 text-right font-mono">{row.mfePct == null ? 'N/D' : `${row.mfePct.toFixed(1)}%`}</td><td className="p-2 text-right font-mono">{row.givebackFromMfePctPoints == null ? 'N/D' : `${row.givebackFromMfePctPoints.toFixed(1)} pp`}</td><td className="max-w-[440px] p-2 text-slate-400">{row.reason}</td></tr>)}</tbody></table>{healthRows.length === 0 && <div className="p-3 text-center text-slate-500">Sin posiciones evaluadas.</div>}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="cursor-pointer text-xs font-bold text-white">Disponibilidad operativa en MyInvestor ({operationalAssets.length})</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{operationalAssets.map(asset => {
        const key = (asset.isin || asset.ticker).toUpperCase();
        return <div key={asset.assetId} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex items-start justify-between gap-2"><div><b className="font-mono text-white">{asset.ticker}</b>{asset.isin && <div className="font-mono text-cyan-300">{asset.isin}</div>}<div className="text-slate-500">{asset.name}</div></div><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${availabilityClass(asset.status)}`}>{availabilityLabel(asset.status)}</span></div><div className="mt-2 text-slate-500">{asset.note}</div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => markAvailability(key, 'AVAILABLE')} className="flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-emerald-200"><CheckCircle2 className="h-3 w-3"/>Sí está</button><button type="button" onClick={() => markAvailability(key, 'UNAVAILABLE')} className="flex items-center gap-1 rounded border border-rose-500/30 px-2 py-1 text-rose-200"><XCircle className="h-3 w-3"/>No está</button><button type="button" onClick={() => resetAvailability(key)} className="rounded border border-slate-700 px-2 py-1 text-slate-400">Restablecer</button>{onInspectAsset && <button type="button" onClick={() => onInspectAsset(key)} className="flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1 text-cyan-200"><BarChart3 className="h-3 w-3"/>Gráfica</button>}</div></div>;
      })}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-white"><History className="h-4 w-4 text-violet-300"/>Historial diario de decisiones ({history.length})</summary>
      <div className="mt-3 space-y-2">{history.slice(0, 30).map(row => <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-white">{row.asOfDate}</b><span className={row.action === 'HOLD_CASH' ? 'font-black text-amber-200' : 'font-black text-emerald-200'}>{row.headline}</span></div><div className="mt-1 text-slate-500">Comprar {row.recommendedInvestmentEur.toFixed(2)} € · cash {row.residualCashEur.toFixed(2)} € · {row.positionActions.length} posición(es) con WATCH/REDUCE/EXIT</div><div className="mt-1 text-slate-400">{row.buys.length ? row.buys.map(buy => `${buy.ticker} ${buy.amountEur.toFixed(0)} €`).join(' · ') : 'Sin compras propuestas'}</div></div>)}{history.length === 0 && <div className="text-slate-500">El historial empieza cuando la app calcula la primera decisión V1 PILOT.</div>}</div>
    </details>

    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-white"><WalletCards className="h-4 w-4 text-emerald-300"/>Operaciones reales registradas ({executions.length})</summary>
      <div className="mt-3 space-y-2">{executions.slice(0, 20).map(row => <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[10px]"><div className="flex items-center justify-between gap-2"><b className="font-mono text-white">{row.appliedAt.slice(0, 10)}</b><b className="text-emerald-200">{row.action}</b></div><div className="mt-1 text-slate-400">{row.targetTicker ?? row.targetIsin ?? row.sourceLabel ?? 'Operación'}{row.amountEur != null ? ` · ${row.amountEur.toFixed(2)} €` : ''}{row.shares != null ? ` · ${row.shares} uds.` : ''}{row.feeEur > 0 ? ` · comisión ${row.feeEur.toFixed(2)} €` : ''}</div></div>)}{executions.length === 0 && <div className="text-slate-500">Todavía no hay operaciones ejecutadas registradas.</div>}</div>
    </details>
  </section>;
};
