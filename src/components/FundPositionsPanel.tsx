import React, { useMemo, useState } from 'react';
import { Landmark, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { assessFundTaxReview, EXAMPLE_FUND_POSITIONS, EXAMPLE_STAGED_CAPITAL_PLAN, FundPosition, monthlyStagedAmount } from '../investment/decision';

const STORAGE_KEY = 'custodia_fund_positions_v1';
const PLAN_KEY = 'custodia_staged_capital_plan_v1';

function loadFunds(): FundPosition[] {
  if (typeof window === 'undefined') return EXAMPLE_FUND_POSITIONS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EXAMPLE_FUND_POSITIONS;
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : EXAMPLE_FUND_POSITIONS; } catch { return EXAMPLE_FUND_POSITIONS; }
}
function loadPlan() {
  if (typeof window === 'undefined') return EXAMPLE_STAGED_CAPITAL_PLAN;
  try { return { ...EXAMPLE_STAGED_CAPITAL_PLAN, ...JSON.parse(window.localStorage.getItem(PLAN_KEY) ?? '{}') }; } catch { return EXAMPLE_STAGED_CAPITAL_PLAN; }
}

export const FundPositionsPanel: React.FC = () => {
  const [funds, setFunds] = useState<FundPosition[]>(loadFunds);
  const [plan, setPlan] = useState(loadPlan);
  const monthly = useMemo(() => monthlyStagedAmount(plan), [plan]);
  const persistFunds = (next: FundPosition[]) => { setFunds(next); if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const persistPlan = (next: typeof plan) => { setPlan(next); if (typeof window !== 'undefined') window.localStorage.setItem(PLAN_KEY, JSON.stringify(next)); };
  const update = (id: string, patch: Partial<FundPosition>) => persistFunds(funds.map(f => f.id === id ? { ...f, ...patch } : f));
  const reset = () => { persistFunds(EXAMPLE_FUND_POSITIONS); persistPlan(EXAMPLE_STAGED_CAPITAL_PLAN); };

  return <section className="space-y-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-cyan-300"/><h3 className="font-bold">Fondos de inversión · caso editable</h3></div><p className="mt-1 text-[11px] text-slate-400">Estas posiciones se cargan como ejemplo inicial y después funcionan como datos manuales: puedes modificarlas o borrarlas. No son órdenes ni posiciones conectadas a MyInvestor.</p></div><button onClick={reset} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><RotateCcw className="h-3.5 w-3.5"/>Restaurar ejemplo</button></div>

    <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[900px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Fondo / ISIN</th><th className="p-2 text-right">Invertido</th><th className="p-2">Fecha</th><th className="p-2 text-right">Valor actual manual</th><th className="p-2">Fiscalidad salida</th><th className="p-2"></th></tr></thead><tbody>{funds.map(f => { const tax = assessFundTaxReview(f); return <tr key={f.id} className="border-t border-slate-800"><td className="p-2"><b>{f.name}</b><div className="font-mono text-[10px] text-slate-500">{f.isin} · {f.category}</div></td><td className="p-2"><input className="w-28 rounded border border-slate-700 bg-slate-900 p-1 text-right font-mono" type="number" min="0" value={f.investedEur} onChange={e => update(f.id,{investedEur:Math.max(0,Number(e.target.value)||0)})}/></td><td className="p-2"><input className="rounded border border-slate-700 bg-slate-900 p-1" type="date" value={f.acquisitionDate} onChange={e=>update(f.id,{acquisitionDate:e.target.value})}/></td><td className="p-2 text-right"><input className="w-28 rounded border border-slate-700 bg-slate-900 p-1 text-right font-mono" type="number" min="0" placeholder="N/D" value={f.currentValueEur ?? ''} onChange={e=>update(f.id,{currentValueEur:e.target.value===''?null:Math.max(0,Number(e.target.value)||0)})}/>{tax.unrealizedGainEur != null && <div className={`text-[10px] ${tax.unrealizedGainEur>=0?'text-emerald-300':'text-amber-300'}`}>{tax.unrealizedGainEur>=0?'+':''}{tax.unrealizedGainEur.toFixed(2)} € vs aportado</div>}</td><td className="p-2"><div className="font-semibold text-cyan-200">{f.transferable ? 'TRASPASO antes que reembolso, si procede' : 'Revisar régimen fiscal'}</div><div className="max-w-sm text-[10px] text-slate-500">{tax.note}</div></td><td className="p-2"><button onClick={()=>persistFunds(funds.filter(x=>x.id!==f.id))} className="rounded border border-slate-700 p-2 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5"/></button></td></tr>; })}</tbody></table></div>
    <button onClick={()=>persistFunds([...funds,{id:`manual_${Date.now()}`,isin:'',name:'Nuevo fondo',category:'OTHER',investedEur:0,acquisitionDate:new Date().toISOString().slice(0,10),currentValueEur:null,transferable:false}])} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400"><Plus className="h-3.5 w-3.5"/>Añadir fondo</button>

    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3"><div className="font-bold">Capital pendiente · inversión escalonada</div><div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs"><label>Disponible (€)<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2" type="number" min="0" value={plan.availableEur} onChange={e=>persistPlan({...plan,availableEur:Math.max(0,Number(e.target.value)||0)})}/></label><label>Plazo aproximado (meses)<input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2" type="number" min="1" max="120" value={plan.horizonMonths} onChange={e=>persistPlan({...plan,horizonMonths:Math.max(1,Number(e.target.value)||1)})}/></label><div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Referencia mensual uniforme</div><b className="text-lg">{monthly.toFixed(2)} €/mes</b></div></div><p className="mt-2 text-[10px] text-slate-500">La cifra mensual es solo una referencia de escalonado. El motor puede recomendar mantener efectivo o variar la aportación según cartera, riesgo y evidencia; no obliga a invertir todo ni de golpe.</p></div>

    <div className="text-[10px] text-slate-500">Para fondos, no se inventa un precio con un ETF proxy. Hasta disponer de una fuente de valor liquidativo histórica/actual validada, el valor actual queda manual y la app debe marcar cualquier análisis cuantitativo específico del fondo como DATA_MISSING.</div>
  </section>;
};
