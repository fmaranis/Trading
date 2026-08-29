import React, { useMemo, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  FundPosition,
  InvestmentDecisionResult,
  monthlyStagedAmount,
  PortfolioDecisionEngine,
  StagedCapitalPlan,
  UserHolding,
  UserPortfolioService
} from '../investment/decision';
import { FundMarketDataCard } from './FundMarketDataCard';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
}

function portfolioActionLabel(action: string): string {
  switch (action) {
    case 'ADD': return 'CANDIDATO A AUMENTAR';
    case 'REDUCE': return 'DESVIACIÓN A REVISAR';
    case 'REVIEW_TRANSFER': return 'DESVIACIÓN A REVISAR';
    case 'DATA_MISSING': return 'SIN DATOS';
    default: return 'MANTENER';
  }
}
function portfolioActionClass(action: string): string {
  if (action === 'ADD') return 'text-emerald-300';
  if (action === 'REDUCE' || action === 'REVIEW_TRANSFER') return 'text-amber-300';
  if (action === 'DATA_MISSING') return 'text-rose-300';
  return 'text-slate-400';
}

export const UserPortfolioPanel: React.FC<Props> = ({ scan, decision }) => {
  const initial = useMemo(() => UserPortfolioService.load(), []);
  const [cash, setCash] = useState(initial.cashEur);
  const [holdings, setHoldings] = useState<UserHolding[]>(initial.holdings);
  const [funds, setFunds] = useState<FundPosition[]>(initial.funds ?? []);
  const [plan, setPlan] = useState<StagedCapitalPlan>(initial.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' });
  const [fundMarketValues, setFundMarketValues] = useState<Record<string, number | null>>({});
  const [savedRevision, setSavedRevision] = useState(0);

  const listedCandidates = useMemo(() => scan.candidates.filter(c => c.asset.instrumentType !== 'MUTUAL_FUND'), [scan]);
  const knownTickers = useMemo(() => listedCandidates.filter(c => c.status === 'ACCEPTED' && c.lastClose).map(c => c.asset.ticker), [listedCandidates]);
  const priceByTicker = useMemo(() => new Map(listedCandidates.filter(c => c.lastClose && c.lastClose > 0).map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])), [listedCandidates]);
  const listedHoldingsValue = useMemo(() => holdings.reduce((sum, h) => sum + h.shares * (priceByTicker.get(h.ticker.toUpperCase()) ?? 0), 0), [holdings, priceByTicker]);
  const portfolio = useMemo(() => ({ cashEur: Math.max(0, cash), holdings, funds, stagedCapitalPlan: plan, updatedAt: new Date().toISOString() }), [cash, holdings, funds, plan, savedRevision]);
  const portfolioDecision = useMemo(() => PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, fundMarketValues }), [portfolio, scan, decision, fundMarketValues]);
  const fundRegisteredValue = useMemo(() => funds.reduce((sum, f) => sum + (fundMarketValues[f.id] ?? f.currentValueEur ?? f.investedEur), 0), [funds, fundMarketValues]);
  const monthly = monthlyStagedAmount(plan);

  const updateHolding = (index: number, patch: Partial<UserHolding>) => setHoldings(prev => prev.map((h, i) => i === index ? { ...h, ...patch } : h));
  const updateFund = (id: string, patch: Partial<FundPosition>) => setFunds(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const addHolding = () => setHoldings(prev => [...prev, { ticker: knownTickers.find(t => !prev.some(h => h.ticker === t)) ?? '', shares: 1 }]);
  const addFund = () => setFunds(prev => [...prev, { id: `manual_${Date.now()}`, isin: '', name: 'Nuevo fondo', category: 'OTHER', investedEur: 0, acquisitionDate: new Date().toISOString().slice(0, 10), currentValueEur: null, units: null, transferable: false, broker: 'MyInvestor' }]);
  const removeHolding = (index: number) => setHoldings(prev => prev.filter((_, i) => i !== index));
  const removeFund = (id: string) => setFunds(prev => prev.filter(f => f.id !== id));
  const applyState = (next: ReturnType<typeof UserPortfolioService.load>) => {
    setCash(next.cashEur); setHoldings(next.holdings); setFunds(next.funds ?? []);
    setPlan(next.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' });
    setFundMarketValues({}); setSavedRevision(v => v + 1);
  };
  const save = () => applyState(UserPortfolioService.save({ cashEur: cash, holdings, funds, stagedCapitalPlan: plan }));
  const clear = () => { UserPortfolioService.clear(); applyState(UserPortfolioService.load()); };
  const restoreExample = () => applyState(UserPortfolioService.restoreExample());

  return <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-emerald-300"/><h3 className="font-bold">Mi cartera real</h3></div><p className="mt-1 text-[11px] text-slate-400">Aquí registras lo que ya tienes y el capital pendiente. Las órdenes reales se deciden en “Qué haría hoy”; este bloque solo compara tu cartera con la distribución teórica del motor.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={restoreExample} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><RotateCcw className="h-3.5 w-3.5"/>Restaurar ejemplo</button><div className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300">CARTERA UNIFICADA</div></div>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">ETFs/ETCs actuales</div><b>{listedHoldingsValue.toFixed(2)} €</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Fondos actuales</div><b>{fundRegisteredValue.toFixed(2)} €</b><div className="text-[9px] text-slate-600">VL automático cuando está disponible</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Efectivo libre</div><b>{cash.toFixed(2)} €</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Pendiente de invertir</div><b>{plan.availableEur.toFixed(2)} €</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Capital planificado</div><b>{portfolioDecision.totalPlannedCapitalEur.toFixed(2)} €</b></div>
    </div>

    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><b>Distribución teórica de tu cartera</b><div className="mt-1 text-[11px] text-slate-400">Diagnóstico de pesos: compara lo que ya posees con el objetivo cuantitativo. <b>No es una orden de compra o venta.</b> Una sobreponderación por sí sola ya no puede generar una venta.</div></div><div className="rounded-lg border border-violet-500/30 px-3 py-2 text-xs text-violet-200">Capital teóricamente asignable: <b>{portfolioDecision.recommendedNewInvestmentEur.toFixed(2)} €</b> · efectivo objetivo/residual: <b>{portfolioDecision.residualPlannedCashEur.toFixed(2)} €</b></div></div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-xs">{portfolioDecision.exposures.map(x => <div key={x.category} className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">{x.category}</div><div className="mt-1 flex justify-between"><span>Actual</span><b>{x.currentValueEur.toFixed(2)} €</b></div><div className="flex justify-between text-slate-400"><span>Objetivo teórico</span><span>{x.targetValueEur.toFixed(2)} €</span></div><div className={`mt-1 text-right font-mono ${x.gapEur > 0 ? 'text-emerald-300' : x.gapEur < 0 ? 'text-amber-300' : 'text-slate-500'}`}>{x.gapEur >= 0 ? '+' : ''}{x.gapEur.toFixed(2)} €</div></div>)}</div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs font-bold">Posiciones actuales · diagnóstico</div><div className="mt-2 space-y-2">{portfolioDecision.existingPositions.length === 0 && <div className="text-xs text-slate-600">No hay posiciones existentes.</div>}{portfolioDecision.existingPositions.map(x => <div key={`${x.instrumentType}_${x.id}`} className="rounded-lg border border-slate-800 p-2 text-xs"><div className="flex items-start justify-between gap-2"><div><b>{x.label}</b><div className="text-[10px] text-slate-500">{x.instrumentType === 'MUTUAL_FUND' ? 'Fondo' : 'ETF/ETC'} · {x.category} · {x.currentValueEur == null ? 'N/D' : `${x.currentValueEur.toFixed(2)} €`}</div></div><b className={portfolioActionClass(x.action)}>{portfolioActionLabel(x.action)}</b></div><div className="mt-1 text-[10px] text-slate-500">{x.reason}</div></div>)}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs font-bold">Capital nuevo · objetivo antes de gates</div><div className="mt-1 text-[9px] text-slate-600">Estas cantidades aún deben superar consenso de señales, efectivo, costes, títulos enteros y disponibilidad broker.</div><div className="mt-2 space-y-2">{portfolioDecision.contributions.length === 0 && <div className="text-xs text-slate-600">No hay déficits teóricos financiables con los datos actuales.</div>}{portfolioDecision.contributions.map(x => <div key={x.assetId} className="rounded-lg border border-slate-800 p-2 text-xs"><div className="flex items-start justify-between gap-2"><div><b>{x.ticker}</b><div className="text-[10px] text-slate-500">{x.name} · {x.instrumentType === 'MUTUAL_FUND' ? 'FONDO' : 'ETF/ETC'} · {x.category}</div></div><b className="font-mono text-violet-200">{x.amountEur.toFixed(2)} €</b></div></div>)}</div></div>
      </div>
      {portfolioDecision.warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">{portfolioDecision.warnings.join(' · ')}</div>}
    </div>

    <div className="grid gap-3 lg:grid-cols-[0.34fr_0.66fr]">
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div><label className="block text-[10px] uppercase text-slate-500">Efectivo libre actual</label><div className="mt-1 flex items-center gap-2"><input type="number" min="0" step="10" value={cash} onChange={e => setCash(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"/><span>€</span></div></div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"><div className="text-[10px] uppercase text-violet-300">Capital pendiente de invertir</div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">Disponible €<input type="number" min="0" value={plan.availableEur} onChange={e => setPlan({ ...plan, availableEur: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label><label className="text-[10px] text-slate-500">Plazo meses<input type="number" min="1" max="120" value={plan.horizonMonths} onChange={e => setPlan({ ...plan, horizonMonths: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label></div><div className="mt-2 text-[10px] text-slate-500">Referencia uniforme: {monthly.toFixed(2)} €/mes.</div></div>
        <div className="grid grid-cols-2 gap-2"><button onClick={save} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5"/>Guardar cartera</button><button onClick={clear} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Vaciar todo</button></div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><div><b className="text-sm">Fondos</b><div className="text-[10px] text-slate-500">Aquí se editan posición, participaciones y fiscalidad. El gráfico y análisis cuantitativo están en la zona común de recomendaciones.</div></div><button onClick={addFund} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Fondo</button></div><div className="mt-2 space-y-3">{funds.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin fondos registrados.</div>}{funds.map(f => <FundMarketDataCard key={f.id} fund={f} onChange={patch=>updateFund(f.id,patch)} onRemove={()=>removeFund(f.id)} onMarketValue={value=>setFundMarketValues(prev=>prev[f.id]===value?prev:{...prev,[f.id]:value})}/>)}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><div><b className="text-sm">ETFs / ETCs</b><div className="text-[10px] text-slate-500">Aquí solo se registran títulos que ya posees.</div></div><button onClick={addHolding} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Activo</button></div><datalist id="portfolio-known-tickers">{knownTickers.map(t => <option key={t} value={t}/>)}</datalist><div className="mt-2 space-y-2">{holdings.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin ETFs/ETCs registrados.</div>}{holdings.map((holding, index) => <div key={`${index}_${holding.ticker}`} className="grid grid-cols-[1fr_110px_32px] gap-2"><input list="portfolio-known-tickers" value={holding.ticker} onChange={e => updateHolding(index, { ticker: e.target.value.toUpperCase() })} placeholder="Ticker…" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-xs"/><input type="number" min="0" step="1" value={holding.shares} onChange={e => updateHolding(index, { shares: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-right font-mono text-xs" title="Títulos"/><button onClick={() => removeHolding(index)} className="rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button></div>)}</div></div>
      </div>
    </div>
  </section>;
};
