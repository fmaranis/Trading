import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, Save, Trash2, WalletCards } from 'lucide-react';
import {
  analyzePortfolioRebalance,
  AssetUniverseScanResult,
  InvestmentDecisionResult,
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
  const [savedRevision, setSavedRevision] = useState(0);

  const knownTickers = useMemo(() => scan.candidates.filter(c => c.status === 'ACCEPTED' && c.lastClose).map(c => c.asset.ticker), [scan]);
  const prices = useMemo(() => Object.fromEntries(scan.candidates.filter(c => c.lastClose && c.lastClose > 0).map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])), [scan]);
  const portfolio = useMemo(() => ({ cashEur: Math.max(0, cash), holdings, updatedAt: new Date().toISOString() }), [cash, holdings, savedRevision]);
  const analysis = useMemo(() => analyzePortfolioRebalance(portfolio, decision.assets, prices, decision.cashWeight), [portfolio, decision, prices]);

  const updateHolding = (index: number, patch: Partial<UserHolding>) => setHoldings(prev => prev.map((h, i) => i === index ? { ...h, ...patch } : h));
  const addHolding = () => setHoldings(prev => [...prev, { ticker: knownTickers.find(t => !prev.some(h => h.ticker === t)) ?? knownTickers[0] ?? '', shares: 1 }]);
  const removeHolding = (index: number) => setHoldings(prev => prev.filter((_, i) => i !== index));
  const save = () => {
    const next = UserPortfolioService.save({ cashEur: cash, holdings });
    setCash(next.cashEur); setHoldings(next.holdings); setSavedRevision(v => v + 1);
  };
  const clear = () => {
    UserPortfolioService.clear(); setCash(0); setHoldings([]); setSavedRevision(v => v + 1);
  };

  return <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-emerald-300"/><h3 className="font-bold">Mi cartera real</h3></div><p className="mt-1 text-[11px] text-slate-400">Introduce lo que realmente tienes. La web compara tus títulos y efectivo con la cartera objetivo usando los últimos precios REAL disponibles.</p></div>
      <div className={`rounded-lg border px-3 py-1 text-xs font-bold ${analysis.rebalanceRecommended ? 'border-amber-500/30 text-amber-300' : 'border-emerald-500/30 text-emerald-300'}`}>{analysis.rebalanceRecommended ? 'REVISAR REBALANCEO' : 'SIN CAMBIO MATERIAL'}</div>
    </div>

    <div className="grid gap-3 lg:grid-cols-[0.35fr_0.65fr]">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <label className="block text-[10px] uppercase text-slate-500">Efectivo disponible</label>
        <div className="mt-1 flex items-center gap-2"><input type="number" min="0" step="10" value={cash} onChange={e => setCash(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono"/><span>€</span></div>
        <div className="mt-3 space-y-2">{holdings.map((holding, index) => <div key={`${index}_${holding.ticker}`} className="grid grid-cols-[1fr_90px_32px] gap-2">
          <select value={holding.ticker} onChange={e => updateHolding(index, { ticker: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs"><option value="">Ticker…</option>{knownTickers.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <input type="number" min="0" step="1" value={holding.shares} onChange={e => updateHolding(index, { shares: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-right font-mono text-xs" title="Títulos"/>
          <button onClick={() => removeHolding(index)} className="rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button>
        </div>)}</div>
        <button onClick={addHolding} className="mt-2 w-full rounded-lg border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300">+ Añadir posición</button>
        <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={save} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5"/>Guardar</button><button onClick={clear} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Vaciar</button></div>
        <div className="mt-2 text-[10px] text-slate-600">Se guarda solo en este navegador. No se envía al broker.</div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Valor conocido</div><b>{analysis.totalPortfolioValueEur.toFixed(2)} €</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Rotación teórica</div><b>{analysis.theoreticalTurnoverPct.toFixed(1)}%</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Coste estimado</div><b>{analysis.estimatedFeesEur.toFixed(2)} €</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Cash proyectado</div><b>{analysis.projectedCashEur.toFixed(2)} €</b></div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Activo</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Objetivo</th><th className="p-2 text-right">Desvío</th><th className="p-2 text-center">Revisión</th><th className="p-2 text-right">Títulos</th><th className="p-2 text-right">Coste/ingreso bruto</th></tr></thead><tbody>{analysis.lines.map(line => <tr key={line.ticker} className="border-t border-slate-800"><td className="p-2 font-mono"><b>{line.ticker}</b><div className="text-[10px] text-slate-600">{line.currentShares} títulos · {line.priceEur?.toFixed(2) ?? 'N/D'} €</div></td><td className="p-2 text-right">{line.currentWeightPct.toFixed(1)}%</td><td className="p-2 text-right">{line.targetWeightPct.toFixed(1)}%</td><td className={`p-2 text-right ${Math.abs(line.driftPctPoints) >= 5 ? 'text-amber-300' : 'text-slate-400'}`}>{line.driftPctPoints >= 0 ? '+' : ''}{line.driftPctPoints.toFixed(1)} pp</td><td className="p-2 text-center">{line.action === 'BUY' ? <span className="text-emerald-300"><ArrowDownToLine className="mr-1 inline h-3 w-3"/>COMPRAR</span> : line.action === 'SELL' ? <span className="text-amber-300"><ArrowUpFromLine className="mr-1 inline h-3 w-3"/>VENDER</span> : line.action === 'DATA_MISSING' ? <span className="text-rose-300">SIN DATOS</span> : <span className="text-slate-500">MANTENER</span>}</td><td className="p-2 text-right font-mono">{line.proposedShares || '—'}</td><td className="p-2 text-right">{line.estimatedNotionalEur ? `${line.estimatedNotionalEur.toFixed(2)} €` : '—'}</td></tr>)}</tbody></table></div>

        {analysis.warnings.length > 0 && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">No se puede valorar toda la cartera: {analysis.warnings.join(' · ')}.</div>}
        <div className="flex items-start gap-2 text-[10px] text-slate-500"><CircleDollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Las compras/ventas son una propuesta matemática de revisión con títulos enteros y comisión estimada; no son órdenes y no incluyen spread, deslizamiento ni fiscalidad de una venta.</div>
      </div>
    </div>
  </section>;
};
