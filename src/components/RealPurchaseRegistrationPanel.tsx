import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, WalletCards } from 'lucide-react';
import {
  buildExecutedPurchaseLine,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  getMyInvestorAvailability,
  PortfolioDecisionEngine,
  PortfolioStateExecutionService,
  preferredBrokerSearchCode,
  resolveSecurityIsin,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult,
  type PortfolioExecutionLine,
  type PortfolioPositionHealthResult,
  type PortfolioStateExecutionReceipt
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
}

type Draft = { amount: string; shares: string; fee: string };

export const RealPurchaseRegistrationPanel: React.FC<Props> = ({ scan, decision, positionHealth }) => {
  const [portfolioRevision, setPortfolioRevision] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [lastExecution, setLastExecution] = useState<PortfolioStateExecutionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => UserPortfolioService.subscribe(() => setPortfolioRevision(value => value + 1)), []);

  const buyLines = useMemo(() => {
    const portfolio = UserPortfolioService.load();
    const cashBenchmarkAnnualPct = CashBenchmarkService.load();
    const portfolioDecision = PortfolioDecisionEngine.evaluate({
      portfolio,
      scan,
      decision,
      positionHealth: positionHealth?.byKey,
      cashBenchmarkAnnualPct
    });
    return buildPortfolioExecutionPlan({
      portfolio,
      scan,
      decisionAsOf: decision.asOfDate,
      portfolioDecision,
      cashBenchmarkAnnualPct
    }).lines.filter(line => line.status === 'PENDING' && ['BUY_ETF', 'SUBSCRIBE_FUND'].includes(line.action));
  }, [scan, decision, positionHealth, portfolioRevision]);

  const draftFor = (line: PortfolioExecutionLine): Draft => drafts[line.id] ?? {
    amount: line.amountEur == null ? '' : line.amountEur.toFixed(2),
    shares: line.shares == null ? '' : String(line.shares),
    fee: line.estimatedFeeEur == null ? '0' : line.estimatedFeeEur.toFixed(2)
  };

  const patchDraft = (line: PortfolioExecutionLine, patch: Partial<Draft>) => {
    setDrafts(previous => ({ ...previous, [line.id]: { ...draftFor(line), ...patch } }));
  };

  const register = (line: PortfolioExecutionLine) => {
    setError(null);
    try {
      const draft = draftFor(line);
      const actualLine = buildExecutedPurchaseLine(line, {
        amountEur: Number(draft.amount),
        shares: draft.shares.trim() === '' ? null : Number(draft.shares),
        feeEur: line.action === 'BUY_ETF' ? Number(draft.fee) : 0
      });
      const receipt = PortfolioStateExecutionService.execute(actualLine);
      setLastExecution(receipt);
      setDrafts(previous => { const next = { ...previous }; delete next[line.id]; return next; });
      setPortfolioRevision(value => value + 1);
    } catch (cause: any) {
      setError(cause?.message || String(cause));
    }
  };

  if (buyLines.length === 0) return null;

  return <section id="register-real-purchase" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
    <div className="flex items-start gap-2"><WalletCards className="mt-0.5 h-5 w-5 text-emerald-300"/><div><h2 className="font-bold text-white">Registrar compra ejecutada en mi cartera</h2><p className="mt-1 text-[11px] text-slate-400">La recomendación es solo el punto de partida. Cuando MyInvestor confirme la ejecución, corrige aquí el importe real; para acciones/ETF también los títulos y la comisión. En fondos puedes indicar las participaciones añadidas si ya aparecen en MyInvestor.</p></div></div>

    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">En fondos no registres una orden todavía pendiente. Espera a que MyInvestor la muestre ejecutada. Si todavía no conoces las participaciones, puedes dejarlas vacías: la app no conservará un número antiguo como si fuese exacto.</div>

    {lastExecution && <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100"><b>Cartera actualizada.</b> {lastExecution.description}</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100"><b>No se registró la compra.</b> {error}</div>}

    <div className="mt-4 space-y-3">{buyLines.map(line => {
      const candidate = scan.candidates.find(row => row.asset.assetId === line.targetAssetId || row.asset.ticker.toUpperCase() === String(line.targetTicker ?? '').toUpperCase());
      const isin = resolveSecurityIsin(line.targetTicker, line.targetIsin ?? candidate?.asset.isin);
      const searchCode = preferredBrokerSearchCode(line.targetTicker, isin);
      const availability = candidate ? getMyInvestorAvailability(candidate.asset) : null;
      const unavailable = availability?.status === 'USER_CONFIRMED_UNAVAILABLE';
      const draft = draftFor(line);
      const isFund = line.action === 'SUBSCRIBE_FUND';
      return <article key={line.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[10px] uppercase text-emerald-300">{isFund ? 'Fondo propuesto' : 'Compra propuesta'}</div><div className="mt-1 font-semibold text-white">{line.targetName ?? line.targetTicker}</div><div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px]"><span className="rounded bg-slate-900 px-2 py-1">Ticker {line.targetTicker ?? 'N/D'}</span><span className={`rounded px-2 py-1 ${isin ? 'bg-cyan-500/10 text-cyan-200' : 'bg-amber-500/10 text-amber-200'}`}>ISIN {isin ?? 'N/D'}</span><span className="rounded bg-slate-900 px-2 py-1">Buscar en MyInvestor: {searchCode || 'N/D'}</span></div></div><div className="text-right text-[10px] text-slate-500">Sugerido<br/><b className="font-mono text-sm text-white">{line.amountEur?.toFixed(2) ?? 'N/D'} €</b></div></div>

        <div className={`mt-3 grid gap-3 ${isFund ? 'sm:grid-cols-[1fr_180px_auto]' : 'sm:grid-cols-[1fr_130px_130px_auto]'} sm:items-end`}>
          <label className="text-[10px] text-slate-400">Importe real ejecutado €<input type="number" min="0" step="0.01" value={draft.amount} onChange={event => patchDraft(line, { amount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"/></label>
          {isFund ? <label className="text-[10px] text-slate-400">Participaciones añadidas <span className="text-slate-600">(opcional)</span><input type="number" min="0" step="0.000001" value={draft.shares} onChange={event => patchDraft(line, { shares: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"/></label> : <label className="text-[10px] text-slate-400">Títulos reales<input type="number" min="1" step="1" value={draft.shares} onChange={event => patchDraft(line, { shares: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"/></label>}
          {!isFund && <label className="text-[10px] text-slate-400">Comisión real €<input type="number" min="0" step="0.01" value={draft.fee} onChange={event => patchDraft(line, { fee: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"/></label>}
          <button type="button" disabled={unavailable} onClick={() => register(line)} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"><CheckCircle2 className="h-4 w-4"/>Añadir a mi cartera</button>
        </div>
        {unavailable && <div className="mt-2 text-[10px] text-rose-200">Este instrumento está marcado por ti como no disponible en MyInvestor y no se puede registrar desde la recomendación.</div>}
      </article>;
    })}</div>
  </section>;
};