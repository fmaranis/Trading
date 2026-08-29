import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  FundPosition,
  InvestmentDecisionResult,
  monthlyStagedAmount,
  PortfolioDecisionEngine,
  StagedCapitalPlan,
  UserHolding,
  UserPortfolioService,
  type PortfolioPositionHealthResult,
  type UserPortfolioState
} from '../investment/decision';
import { FundMarketDataCard } from './FundMarketDataCard';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function blankPlan(): StagedCapitalPlan {
  return { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' };
}
function healthClass(action: string | undefined): string {
  if (action === 'ADD') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (action === 'REDUCE' || action === 'EXIT') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  if (action === 'WATCH') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  if (action === 'DATA_MISSING') return 'border-slate-600 bg-slate-800 text-slate-300';
  return 'border-sky-500/25 bg-sky-500/5 text-sky-200';
}
function healthLabel(action: string | undefined): string {
  if (!action) return 'EVALUANDO';
  if (action === 'ADD') return 'AÑADIR';
  if (action === 'REDUCE') return 'REDUCIR';
  if (action === 'EXIT') return 'SALIR';
  if (action === 'WATCH') return 'VIGILAR';
  if (action === 'DATA_MISSING') return 'DATOS PENDIENTES';
  return 'MANTENER';
}

export const UserPortfolioPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const initial = useMemo(() => UserPortfolioService.load(), []);
  const [cash, setCash] = useState(initial.cashEur);
  const [holdings, setHoldings] = useState<UserHolding[]>(initial.holdings);
  const [funds, setFunds] = useState<FundPosition[]>(initial.funds ?? []);
  const [plan, setPlan] = useState<StagedCapitalPlan>(initial.stagedCapitalPlan ?? blankPlan());
  const [fundMarketValues, setFundMarketValues] = useState<Record<string, number | null>>({});
  const [savedRevision, setSavedRevision] = useState(0);

  const applyState = (next: UserPortfolioState) => {
    setCash(next.cashEur);
    setHoldings(next.holdings);
    setFunds(next.funds ?? []);
    setPlan(next.stagedCapitalPlan ?? blankPlan());
    setFundMarketValues({});
    setSavedRevision(v => v + 1);
  };

  useEffect(() => UserPortfolioService.subscribe(applyState), []);

  const listedCandidates = useMemo(() => scan.candidates.filter(c => c.asset.instrumentType !== 'MUTUAL_FUND'), [scan]);
  const knownTickers = useMemo(() => listedCandidates.filter(c => c.status === 'ACCEPTED' && c.lastClose).map(c => c.asset.ticker), [listedCandidates]);
  const priceByTicker = useMemo(() => new Map(listedCandidates.filter(c => c.lastClose && c.lastClose > 0).map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])), [listedCandidates]);
  const listedHoldingsValue = useMemo(() => holdings.reduce((sum, h) => {
    const healthValue = positionHealth?.byKey[h.ticker.toUpperCase()]?.currentValueEur;
    return sum + (healthValue ?? h.shares * (priceByTicker.get(h.ticker.toUpperCase()) ?? 0));
  }, 0), [holdings, priceByTicker, positionHealth]);
  const fundRegisteredValue = useMemo(() => funds.reduce((sum, f) => sum + (fundMarketValues[f.id] ?? positionHealth?.byKey[f.id]?.currentValueEur ?? f.currentValueEur ?? f.investedEur), 0), [funds, fundMarketValues, positionHealth]);
  const investedEur = listedHoldingsValue + fundRegisteredValue;
  const liquidityEur = Math.max(0, cash) + Math.max(0, plan.availableEur);
  const totalEur = investedEur + liquidityEur;
  const portfolio = useMemo(() => ({ cashEur: Math.max(0, cash), holdings, funds, stagedCapitalPlan: plan, updatedAt: new Date().toISOString() }), [cash, holdings, funds, plan, savedRevision]);
  const portfolioDecision = useMemo(() => PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, fundMarketValues, positionHealth: positionHealth?.byKey }), [portfolio, scan, decision, fundMarketValues, positionHealth]);
  const monthly = monthlyStagedAmount(plan);

  const updateHolding = (index: number, patch: Partial<UserHolding>) => setHoldings(prev => prev.map((h, i) => i === index ? { ...h, ...patch } : h));
  const updateFund = (id: string, patch: Partial<FundPosition>) => setFunds(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const addHolding = () => setHoldings(prev => [...prev, { ticker: knownTickers.find(t => !prev.some(h => h.ticker === t)) ?? '', shares: 1 }]);
  const addFund = () => setFunds(prev => [...prev, { id: `manual_${Date.now()}`, isin: '', name: 'Nuevo fondo', category: 'OTHER', investedEur: 0, acquisitionDate: new Date().toISOString().slice(0, 10), currentValueEur: null, units: null, transferable: false, broker: 'MyInvestor' }]);
  const removeHolding = (index: number) => setHoldings(prev => prev.filter((_, i) => i !== index));
  const removeFund = (id: string) => setFunds(prev => prev.filter(f => f.id !== id));
  const save = () => applyState(UserPortfolioService.save({ cashEur: cash, holdings, funds, stagedCapitalPlan: plan }));
  const restoreRealBaseline = () => applyState(UserPortfolioService.restoreRealBaseline());

  return <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-emerald-300"/><h2 className="font-bold">Mi cartera real</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Cada posición se vigila por su propia tendencia y consenso. Toca una posición para abrir su gráfica, señales y código de búsqueda.</p>
      </div>
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[10px] font-bold text-emerald-200">ESTADO REAL · {portfolio.updatedAt.slice(0, 10)}</span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] uppercase text-slate-500">Invertido ahora</div><div className="mt-1 font-mono text-xl font-black text-white">{investedEur.toFixed(2)} €</div><div className="mt-1 text-[10px] text-slate-500">Fondos {fundRegisteredValue.toFixed(2)} € · cotizados {listedHoldingsValue.toFixed(2)} €</div></div>
      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4"><div className="text-[10px] uppercase text-cyan-300">Liquidez disponible</div><div className="mt-1 font-mono text-xl font-black text-cyan-100">{liquidityEur.toFixed(2)} €</div><div className="mt-1 text-[10px] text-slate-500">Efectivo {cash.toFixed(2)} € + capital pendiente {plan.availableEur.toFixed(2)} €</div></div>
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"><div className="text-[10px] uppercase text-violet-300">Capital total controlado</div><div className="mt-1 font-mono text-xl font-black text-violet-100">{totalEur.toFixed(2)} €</div><div className="mt-1 text-[10px] text-slate-500">Invertido + liquidez.</div></div>
    </div>

    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3"><div><b className="text-sm">Posiciones actuales</b><div className="text-[10px] text-slate-500">Salud independiente: añadir, mantener, vigilar, reducir o salir.</div></div><span className="text-[10px] text-slate-500">{funds.length + holdings.length} posiciones</span></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {funds.map(fund => {
          const health = positionHealth?.byKey[fund.id] ?? positionHealth?.byKey[fund.isin.toUpperCase()];
          const value = fundMarketValues[fund.id] ?? health?.currentValueEur ?? fund.currentValueEur ?? fund.investedEur;
          const inspectKey = fund.isin.trim().toUpperCase();
          return <button type="button" key={fund.id} disabled={!onInspectAsset || !inspectKey} onClick={() => inspectKey && onInspectAsset?.(inspectKey)} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left text-xs transition hover:border-cyan-500/40 hover:bg-slate-900 disabled:cursor-default disabled:hover:border-slate-800">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate">{fund.name}</b><div className="font-mono text-[9px] text-cyan-300">ISIN {fund.isin || fund.id}</div></div><b className="font-mono">{value.toFixed(2)} €</b></div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${healthClass(health?.action)}`}>{healthLabel(health?.action)}</span>{health?.consensusScore != null && <span className="text-[9px] text-slate-500">consenso {health.consensusScore >= 0 ? '+' : ''}{health.consensusScore}</span>}</div>
            <div className="mt-2 text-[9px] text-slate-500">Invertido {fund.investedEur.toFixed(2)} € · compra {fund.acquisitionDate}</div>
            <div className="mt-1 text-[9px] text-slate-400">{fund.units != null ? `${fund.units} participaciones registradas` : 'Participaciones no registradas'} · {fund.broker ?? 'broker N/D'}</div>
            {health?.reason && <div className="mt-1 text-[9px] text-slate-400">{health.reason}</div>}
            {onInspectAsset && inspectKey && <div className="mt-3 flex items-center gap-1 text-[9px] font-bold text-cyan-300"><BarChart3 className="h-3.5 w-3.5"/>Abrir gráfica, señales y ficha</div>}
          </button>;
        })}
        {holdings.map(holding => {
          const health = positionHealth?.byKey[holding.ticker.toUpperCase()];
          const value = health?.currentValueEur ?? holding.shares * (priceByTicker.get(holding.ticker.toUpperCase()) ?? 0);
          const candidate = listedCandidates.find(c => c.asset.ticker.toUpperCase() === holding.ticker.toUpperCase());
          return <button type="button" key={holding.ticker} disabled={!onInspectAsset} onClick={() => onInspectAsset?.(holding.ticker)} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left text-xs transition hover:border-cyan-500/40 hover:bg-slate-900 disabled:cursor-default disabled:hover:border-slate-800">
            <div className="flex items-start justify-between gap-2"><div><b className="font-mono text-white">{holding.ticker}</b><div className="text-[9px] text-slate-500">{holding.shares} títulos</div>{candidate?.asset.isin && <div className="font-mono text-[9px] text-cyan-300">ISIN {candidate.asset.isin}</div>}</div><b className="font-mono">{value.toFixed(2)} €</b></div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${healthClass(health?.action)}`}>{healthLabel(health?.action)}</span>{health?.consensusScore != null && <span className="text-[9px] text-slate-500">consenso {health.consensusScore >= 0 ? '+' : ''}{health.consensusScore}</span>}</div>
            {health?.reason && <div className="mt-1 text-[9px] text-slate-400">{health.reason}</div>}
            {onInspectAsset && <div className="mt-3 flex items-center gap-1 text-[9px] font-bold text-cyan-300"><BarChart3 className="h-3.5 w-3.5"/>Abrir gráfica, señales y ficha</div>}
          </button>;
        })}
        {funds.length + holdings.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No hay posiciones registradas.</div>}
      </div>
    </div>

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><b>Editar cartera y liquidez</b><div className="mt-1 text-[10px] text-slate-500">Puedes introducir cualquier ticker; si no está catalogado, la app intentará vigilarlo con su serie REAL individual.</div></div><ChevronDown className="h-4 w-4 text-slate-500"/></summary>
      <div className="mt-4 border-t border-slate-800 pt-4">
        <div className="grid gap-3 lg:grid-cols-[0.34fr_0.66fr]">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <label className="block text-[10px] uppercase text-slate-500">Efectivo ya disponible en cuenta<input type="number" min="0" step="10" value={cash} onChange={e => setCash(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm"/></label>
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"><div className="text-[10px] uppercase text-violet-300">Capital nuevo pendiente</div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">Disponible €<input type="number" min="0" value={plan.availableEur} onChange={e => setPlan({ ...plan, availableEur: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label><label className="text-[10px] text-slate-500">Plazo meses<input type="number" min="1" max="120" value={plan.horizonMonths} onChange={e => setPlan({ ...plan, horizonMonths: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label></div><div className="mt-2 text-[10px] text-slate-500">Referencia: {monthly.toFixed(2)} €/mes.</div></div>
            <button onClick={save} className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5"/>Guardar reconciliación</button>
            <button onClick={restoreRealBaseline} className="flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-500/25 px-3 py-2 text-xs text-emerald-200"><RotateCcw className="h-3.5 w-3.5"/>Restaurar cartera real registrada</button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><div><b className="text-sm">Fondos</b><div className="text-[10px] text-slate-500">Editar solo si tu cuenta real no coincide.</div></div><button onClick={addFund} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Fondo</button></div><div className="mt-2 space-y-3">{funds.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin fondos registrados.</div>}{funds.map(f => <FundMarketDataCard key={f.id} fund={f} onChange={patch=>updateFund(f.id,patch)} onRemove={()=>removeFund(f.id)} onMarketValue={value=>setFundMarketValues(prev=>prev[f.id]===value?prev:{...prev,[f.id]:value})}/>)}</div></div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><div><b className="text-sm">Activos cotizados</b><div className="text-[10px] text-slate-500">Ticker libre; el datalist solo ayuda, no limita.</div></div><button onClick={addHolding} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Activo</button></div><datalist id="portfolio-known-tickers">{knownTickers.map(t => <option key={t} value={t}/>)}</datalist><div className="mt-2 space-y-2">{holdings.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin activos cotizados registrados.</div>}{holdings.map((holding, index) => <div key={`${index}_${holding.ticker}`} className="grid grid-cols-[1fr_110px_32px] gap-2"><input list="portfolio-known-tickers" value={holding.ticker} onChange={e => updateHolding(index, { ticker: e.target.value.toUpperCase() })} placeholder="Ticker libre…" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-xs"/><input type="number" min="0" step="1" value={holding.shares} onChange={e => updateHolding(index, { shares: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-right font-mono text-xs" title="Títulos"/><button onClick={() => removeHolding(index)} className="rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button></div>)}</div></div>
          </div>
        </div>
      </div>
    </details>

    <details className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><b>Ver diagnóstico teórico</b><div className="mt-1 text-[10px] text-slate-500">Pesos y desviaciones. La salud individual tiene prioridad para REDUCIR/SALIR.</div></div><ChevronDown className="h-4 w-4 text-slate-500"/></summary>
      <div className="mt-4 border-t border-violet-500/15 pt-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-xs">{portfolioDecision.exposures.map(x => <div key={x.category} className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">{x.category}</div><div className="mt-1 flex justify-between"><span>Actual</span><b>{x.currentValueEur.toFixed(2)} €</b></div><div className="flex justify-between text-slate-400"><span>Objetivo</span><span>{x.targetValueEur.toFixed(2)} €</span></div><div className={`mt-1 text-right font-mono ${x.gapEur > 0 ? 'text-emerald-300' : x.gapEur < 0 ? 'text-amber-300' : 'text-slate-500'}`}>{x.gapEur >= 0 ? '+' : ''}{x.gapEur.toFixed(2)} €</div></div>)}</div>
        <div className="mt-3 text-[10px] text-slate-500">Capital teóricamente asignable: {portfolioDecision.recommendedNewInvestmentEur.toFixed(2)} € · objetivo/residual de cash: {portfolioDecision.residualPlannedCashEur.toFixed(2)} €.</div>
        {portfolioDecision.warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">{portfolioDecision.warnings.join(' · ')}</div>}
      </div>
    </details>
  </section>;
};
