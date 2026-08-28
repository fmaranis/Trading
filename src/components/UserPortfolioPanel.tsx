import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react';
import {
  analyzePortfolioRebalance,
  assessFundTaxReview,
  AssetUniverseScanResult,
  FundPosition,
  InvestmentDecisionResult,
  monthlyStagedAmount,
  StagedCapitalPlan,
  UserHolding,
  UserPortfolioService
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
}

export const UserPortfolioPanel: React.FC<Props> = ({ scan, decision }) => {
  const initial = useMemo(() => UserPortfolioService.load(), []);
  const [cash, setCash] = useState(initial.cashEur);
  const [holdings, setHoldings] = useState<UserHolding[]>(initial.holdings);
  const [funds, setFunds] = useState<FundPosition[]>(initial.funds ?? []);
  const [plan, setPlan] = useState<StagedCapitalPlan>(initial.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' });
  const [savedRevision, setSavedRevision] = useState(0);

  const knownTickers = useMemo(() => scan.candidates.filter(c => c.status === 'ACCEPTED' && c.lastClose).map(c => c.asset.ticker), [scan]);
  const prices = useMemo(() => Object.fromEntries(scan.candidates.filter(c => c.lastClose && c.lastClose > 0).map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])), [scan]);
  const portfolio = useMemo(() => ({ cashEur: Math.max(0, cash), holdings, funds, stagedCapitalPlan: plan, updatedAt: new Date().toISOString() }), [cash, holdings, funds, plan, savedRevision]);
  const analysis = useMemo(() => analyzePortfolioRebalance(portfolio, decision.assets, prices, decision.cashWeight), [portfolio, decision, prices]);

  const fundRegisteredValue = useMemo(() => funds.reduce((sum, f) => sum + (f.currentValueEur ?? f.investedEur), 0), [funds]);
  const totalRegistered = analysis.totalPortfolioValueEur + fundRegisteredValue + plan.availableEur;
  const monthly = monthlyStagedAmount(plan);

  const updateHolding = (index: number, patch: Partial<UserHolding>) => setHoldings(prev => prev.map((h, i) => i === index ? { ...h, ...patch } : h));
  const updateFund = (id: string, patch: Partial<FundPosition>) => setFunds(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const addHolding = () => setHoldings(prev => [...prev, { ticker: knownTickers.find(t => !prev.some(h => h.ticker === t)) ?? '', shares: 1 }]);
  const addFund = () => setFunds(prev => [...prev, {
    id: `manual_${Date.now()}`, isin: '', name: 'Nuevo fondo', category: 'OTHER', investedEur: 0,
    acquisitionDate: new Date().toISOString().slice(0, 10), currentValueEur: null, transferable: false, broker: 'MyInvestor'
  }]);
  const removeHolding = (index: number) => setHoldings(prev => prev.filter((_, i) => i !== index));
  const removeFund = (id: string) => setFunds(prev => prev.filter(f => f.id !== id));

  const applyState = (next: ReturnType<typeof UserPortfolioService.load>) => {
    setCash(next.cashEur);
    setHoldings(next.holdings);
    setFunds(next.funds ?? []);
    setPlan(next.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' });
    setSavedRevision(v => v + 1);
  };
  const save = () => applyState(UserPortfolioService.save({ cashEur: cash, holdings, funds, stagedCapitalPlan: plan }));
  const clear = () => { UserPortfolioService.clear(); applyState(UserPortfolioService.load()); };
  const restoreExample = () => applyState(UserPortfolioService.restoreExample());

  return <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-emerald-300"/><h3 className="font-bold">Mi cartera real</h3></div><p className="mt-1 text-[11px] text-slate-400">Una sola cartera: fondos, ETFs/otros activos, efectivo y capital pendiente. Las diferencias fiscales y de ejecución se gestionan internamente.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={restoreExample} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><RotateCcw className="h-3.5 w-3.5"/>Restaurar ejemplo</button><div className={`rounded-lg border px-3 py-2 text-xs font-bold ${analysis.rebalanceRecommended ? 'border-amber-500/30 text-amber-300' : 'border-emerald-500/30 text-emerald-300'}`}>{analysis.rebalanceRecommended ? 'REVISAR REBALANCEO ETF' : 'SIN CAMBIO ETF MATERIAL'}</div></div>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Valor ETF + efectivo</div><b>{analysis.totalPortfolioValueEur.toFixed(2)} €</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Fondos registrados</div><b>{fundRegisteredValue.toFixed(2)} €</b><div className="text-[9px] text-slate-600">usa valor actual manual; si falta, coste aportado</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Pendiente de invertir</div><b>{plan.availableEur.toFixed(2)} €</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Capital registrado</div><b>{totalRegistered.toFixed(2)} €</b><div className="text-[9px] text-slate-600">no equivale a valoración exacta si falta VL</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Referencia escalonada</div><b>{monthly.toFixed(2)} €/mes</b><div className="text-[9px] text-slate-600">durante {plan.horizonMonths} meses</div></div>
    </div>

    <div className="grid gap-3 lg:grid-cols-[0.38fr_0.62fr]">
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div><label className="block text-[10px] uppercase text-slate-500">Efectivo libre actual</label><div className="mt-1 flex items-center gap-2"><input type="number" min="0" step="10" value={cash} onChange={e => setCash(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"/><span>€</span></div></div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"><div className="text-[10px] uppercase text-violet-300">Capital pendiente de invertir</div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">Disponible €<input type="number" min="0" value={plan.availableEur} onChange={e => setPlan({ ...plan, availableEur: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label><label className="text-[10px] text-slate-500">Plazo meses<input type="number" min="1" max="120" value={plan.horizonMonths} onChange={e => setPlan({ ...plan, horizonMonths: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs"/></label></div><div className="mt-2 text-[10px] text-slate-500">{monthly.toFixed(2)} €/mes es solo una referencia uniforme; el motor podrá variar aportaciones o mantener parte en efectivo.</div></div>
        <div className="grid grid-cols-2 gap-2"><button onClick={save} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5"/>Guardar cartera</button><button onClick={clear} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Vaciar todo</button></div>
        <div className="text-[10px] text-slate-600">Se guarda solo en este navegador. No se envía al broker.</div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between"><div><b className="text-sm">Fondos de inversión</b><div className="text-[10px] text-slate-500">Dentro de la misma cartera, pero con fiscalidad de fondo y posible traspaso.</div></div><button onClick={addFund} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Fondo</button></div>
          <div className="mt-2 space-y-2">{funds.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin fondos registrados.</div>}{funds.map(f => { const tax = assessFundTaxReview(f); return <div key={f.id} className="rounded-lg border border-slate-800 p-3"><div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_32px]"><div><input value={f.name} onChange={e=>updateFund(f.id,{name:e.target.value})} className="w-full rounded border border-slate-700 bg-slate-900 p-1 text-xs font-semibold"/><input value={f.isin} onChange={e=>updateFund(f.id,{isin:e.target.value.toUpperCase()})} placeholder="ISIN" className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 font-mono text-[10px]"/></div><label className="text-[9px] text-slate-500">Aportado €<input type="number" min="0" value={f.investedEur} onChange={e=>updateFund(f.id,{investedEur:Math.max(0,Number(e.target.value)||0)})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-right text-xs"/></label><label className="text-[9px] text-slate-500">Fecha<input type="date" value={f.acquisitionDate} onChange={e=>updateFund(f.id,{acquisitionDate:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-xs"/></label><label className="text-[9px] text-slate-500">Valor actual €<input type="number" min="0" placeholder="N/D" value={f.currentValueEur ?? ''} onChange={e=>updateFund(f.id,{currentValueEur:e.target.value===''?null:Math.max(0,Number(e.target.value)||0)})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-right text-xs"/></label><button onClick={()=>removeFund(f.id)} className="rounded border border-slate-700 text-slate-500 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button></div><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]"><select value={f.category} onChange={e=>updateFund(f.id,{category:e.target.value as FundPosition['category']})} className="rounded border border-slate-700 bg-slate-900 p-1"><option value="GLOBAL_EQUITY">Global</option><option value="EMERGING_EQUITY">Emergentes</option><option value="OTHER">Otro</option></select><label className="flex items-center gap-1 text-slate-400"><input type="checkbox" checked={f.transferable} onChange={e=>updateFund(f.id,{transferable:e.target.checked})}/>Traspasable</label><span className={tax.unrealizedGainEur == null ? 'text-slate-500' : tax.unrealizedGainEur >= 0 ? 'text-emerald-300' : 'text-amber-300'}>{tax.unrealizedGainEur == null ? 'Plusvalía N/D' : `${tax.unrealizedGainEur >= 0 ? '+' : ''}${tax.unrealizedGainEur.toFixed(2)} € vs aportado`}</span><span className="text-cyan-300">{f.transferable ? 'Si se cambia: revisar TRASPASO antes que reembolso' : 'Fiscalidad de salida pendiente de verificar'}</span></div></div>; })}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between"><div><b className="text-sm">ETFs / activos con ticker</b><div className="text-[10px] text-slate-500">Títulos enteros, precio REAL del scanner y comisión estimada de broker.</div></div><button onClick={addHolding} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1 text-[10px] text-slate-400"><Plus className="h-3 w-3"/>Activo</button></div>
          <datalist id="portfolio-known-tickers">{knownTickers.map(t => <option key={t} value={t}/>)}</datalist>
          <div className="mt-2 space-y-2">{holdings.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">Sin ETFs/activos registrados.</div>}{holdings.map((holding, index) => <div key={`${index}_${holding.ticker}`} className="grid grid-cols-[1fr_110px_32px] gap-2"><input list="portfolio-known-tickers" value={holding.ticker} onChange={e => updateHolding(index, { ticker: e.target.value.toUpperCase() })} placeholder="Ticker…" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-xs"/><input type="number" min="0" step="1" value={holding.shares} onChange={e => updateHolding(index, { shares: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-right font-mono text-xs" title="Títulos"/><button onClick={() => removeHolding(index)} className="rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button></div>)}</div>
        </div>
      </div>
    </div>

    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs"><div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Valor ETF conocido</div><b>{analysis.knownHoldingsValueEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Rotación ETF teórica</div><b>{analysis.theoreticalTurnoverPct.toFixed(1)}%</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Coste ETF estimado</div><b>{analysis.estimatedFeesEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Cash ETF proyectado</div><b>{analysis.projectedCashEur.toFixed(2)} €</b></div></div>
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Activo ticker</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Objetivo</th><th className="p-2 text-right">Desvío</th><th className="p-2 text-center">Revisión</th><th className="p-2 text-right">Títulos</th><th className="p-2 text-right">Coste/ingreso bruto</th></tr></thead><tbody>{analysis.lines.map(line => <tr key={line.ticker} className="border-t border-slate-800"><td className="p-2 font-mono"><b>{line.ticker}</b><div className="text-[10px] text-slate-600">{line.currentShares} títulos · {line.priceEur?.toFixed(2) ?? 'N/D'} €</div></td><td className="p-2 text-right">{line.currentWeightPct.toFixed(1)}%</td><td className="p-2 text-right">{line.targetWeightPct.toFixed(1)}%</td><td className={`p-2 text-right ${Math.abs(line.driftPctPoints) >= 5 ? 'text-amber-300' : 'text-slate-400'}`}>{line.driftPctPoints >= 0 ? '+' : ''}{line.driftPctPoints.toFixed(1)} pp</td><td className="p-2 text-center">{line.action === 'BUY' ? <span className="text-emerald-300"><ArrowDownToLine className="mr-1 inline h-3 w-3"/>COMPRAR</span> : line.action === 'SELL' ? <span className="text-amber-300"><ArrowUpFromLine className="mr-1 inline h-3 w-3"/>VENDER</span> : line.action === 'DATA_MISSING' ? <span className="text-rose-300">SIN DATOS</span> : <span className="text-slate-500">MANTENER</span>}</td><td className="p-2 text-right font-mono">{line.proposedShares || '—'}</td><td className="p-2 text-right">{line.estimatedNotionalEur ? `${line.estimatedNotionalEur.toFixed(2)} €` : '—'}</td></tr>)}</tbody></table></div>
      {analysis.warnings.length > 0 && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">No se puede valorar toda la parte con ticker: {analysis.warnings.join(' · ')}.</div>}
      <div className="flex items-start gap-2 text-[10px] text-slate-500"><CircleDollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span><b>Una cartera, reglas distintas por producto.</b> Los ETFs se revisan con títulos enteros y comisión. Los fondos conservan coste/fecha fiscal y, si procede, se compara traspaso frente a reembolso antes de materializar plusvalías. El rebalanceo cuantitativo mostrado abajo todavía corresponde a la parte con ticker; no se inventa un precio ni un ETF proxy para valorar fondos.</span></div>
    </div>
  </section>;
};
