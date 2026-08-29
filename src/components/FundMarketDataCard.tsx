import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { FundMarketDataService, type FundMarketDataResult } from '../investment/data/marketData/fundMarketData';
import { assessFundTaxReview, type FundPosition, valueFundFromNav } from '../investment/decision';

interface Props {
  fund: FundPosition;
  onChange: (patch: Partial<FundPosition>) => void;
  onRemove: () => void;
  onMarketValue: (value: number | null) => void;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export const FundMarketDataCard: React.FC<Props> = ({ fund, onChange, onRemove, onMarketValue }) => {
  const [market, setMarket] = useState<FundMarketDataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(fund.isin)) {
      setMarket(null); setError(fund.isin ? 'ISIN no válido' : null); onMarketValue(null); return;
    }
    setLoading(true); setError(null);
    try {
      const result = await FundMarketDataService.history(fund.isin, oneYearAgo());
      setMarket(result);
    } catch (e: any) {
      setMarket(null); setError(e?.message || 'No se pudieron cargar los datos del fondo'); onMarketValue(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [fund.isin]);

  const valuation = useMemo(() => valueFundFromNav(fund, market?.points ?? [], market?.latestNav), [fund, market]);
  useEffect(() => { onMarketValue(valuation.currentValueEur); }, [valuation.currentValueEur]);
  const tax = assessFundTaxReview({ ...fund, currentValueEur: valuation.currentValueEur ?? fund.currentValueEur ?? null });
  const providerLabel = market?.provider === 'yahoo_finance_fund_alias' ? 'Yahoo Finance · fondo verificado' : market?.provider === 'eodhd' ? 'EODHD' : 'proveedor pendiente';

  return <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
    <div className="grid gap-2 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_36px]">
      <div><input value={fund.name} onChange={e=>onChange({name:e.target.value})} className="w-full rounded border border-slate-700 bg-slate-900 p-1 text-xs font-semibold"/><input value={fund.isin} onChange={e=>onChange({isin:e.target.value.toUpperCase()})} placeholder="ISIN" className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 font-mono text-[10px]"/></div>
      <label className="text-[9px] text-slate-500">Aportado €<input type="number" min="0" value={fund.investedEur} onChange={e=>onChange({investedEur:Math.max(0,Number(e.target.value)||0)})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-right text-xs"/></label>
      <label className="text-[9px] text-slate-500">Fecha entrada<input type="date" value={fund.acquisitionDate} onChange={e=>onChange({acquisitionDate:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-xs"/></label>
      <label className="text-[9px] text-slate-500">Participaciones <span className="text-slate-700">(opcional)</span><input type="number" min="0" step="0.000001" placeholder="para valor exacto" value={fund.units ?? ''} onChange={e=>onChange({units:e.target.value===''?null:Math.max(0,Number(e.target.value)||0)})} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-right text-xs"/></label>
      <button onClick={onRemove} className="rounded border border-slate-700 text-slate-500 hover:text-rose-300"><Trash2 className="mx-auto h-3.5 w-3.5"/></button>
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
      <select value={fund.category} onChange={e=>onChange({category:e.target.value as FundPosition['category']})} className="rounded border border-slate-700 bg-slate-900 p-1"><option value="GLOBAL_EQUITY">Global</option><option value="EMERGING_EQUITY">Emergentes</option><option value="OTHER">Otro</option></select>
      <label className="flex items-center gap-1 text-slate-400"><input type="checkbox" checked={fund.transferable} onChange={e=>onChange({transferable:e.target.checked})}/>Traspasable</label>
      <span className="text-slate-500">Broker: {fund.broker ?? 'N/D'}</span>
    </div>

    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
      <div className="rounded-lg bg-slate-950 p-2"><div className="text-[9px] text-slate-500">Último VL disponible</div><b>{valuation.latestNav == null ? 'N/D' : `${valuation.latestNav.toFixed(4)} €`}</b><div className="text-[9px] text-slate-600">{market?.latestDate ?? '—'}</div></div>
      <div className="rounded-lg bg-slate-950 p-2"><div className="text-[9px] text-slate-500">VL entrada usado</div><b>{valuation.entryNav == null ? 'N/D' : `${valuation.entryNav.toFixed(4)} €`}</b></div>
      <div className="rounded-lg bg-slate-950 p-2"><div className="text-[9px] text-slate-500">Valor posición</div><b>{valuation.currentValueEur == null ? 'N/D' : `${valuation.currentValueEur.toFixed(2)} €`}</b><div className="text-[9px] text-slate-600">{valuation.precision === 'EXACT_WITH_UNITS' ? 'exacto con participaciones' : valuation.precision === 'ESTIMATED_FROM_ENTRY_NAV' ? 'estimado desde VL de entrada' : 'sin valoración'}</div></div>
      <div className="rounded-lg bg-slate-950 p-2"><div className="text-[9px] text-slate-500">Resultado desde entrada</div><b className={(valuation.gainEur ?? 0) >= 0 ? 'text-emerald-300' : 'text-amber-300'}>{valuation.gainEur == null ? 'N/D' : `${valuation.gainEur >= 0 ? '+' : ''}${valuation.gainEur.toFixed(2)} €`}</b><div className="text-[9px] text-slate-600">{valuation.gainPct == null ? '—' : `${valuation.gainPct >= 0 ? '+' : ''}${valuation.gainPct.toFixed(2)}%`}</div></div>
      <div className="rounded-lg bg-slate-950 p-2"><div className="text-[9px] text-slate-500">Fiscalidad salida</div><b className="text-cyan-300">{fund.transferable ? 'TRASPASO primero' : 'Revisar'}</b><div className="text-[9px] text-slate-600">{tax.transferDefersTax ? 'diferimiento si el traspaso es elegible' : 'sin diferimiento confirmado'}</div></div>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-[10px] text-slate-500">
      <div>{loading ? 'Actualizando VL REAL…' : error ? `Mercado: ${error}` : `${providerLabel} · ${market?.symbol ?? fund.isin} · valoración REAL disponible para la cartera`}</div>
      <button onClick={()=>void load()} disabled={loading} className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 hover:text-slate-300"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}/>Actualizar</button>
    </div>
    {valuation.precision === 'ESTIMATED_FROM_ENTRY_NAV' && <div className="mt-2 text-[10px] text-amber-200">La posición se estima suponiendo que el importe aportado se convirtió al VL del primer día disponible desde la fecha indicada. Introduce las participaciones reales de MyInvestor para obtener el valor exacto.</div>}
  </div>;
};