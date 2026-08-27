import React, { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { AssetScanCandidate, AssetUniverseScanResult } from '../investment/decision';

type RangeYears = 1 | 3 | 5;
type HistoryRow = { date: string; [ticker: string]: string | number | null };

const SERIES_COLORS = ['#8b5cf6', '#22c55e', '#38bdf8', '#f59e0b', '#f43f5e', '#14b8a6', '#e879f9', '#a3e635'];

function cutoffDate(years: RangeYears): number {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.getTime();
}
function buildNormalizedHistory(scan: AssetUniverseScanResult, years: RangeYears): HistoryRow[] {
  const cutoff = cutoffDate(years);
  const byTicker = new Map<string, Map<string, number>>();
  const firstPrice = new Map<string, number>();
  const allDates = new Set<string>();
  for (const candidate of scan.selected.filter(c => c.response?.bars?.length)) {
    const ticker = candidate.asset.ticker;
    const bars = candidate.response!.bars.filter(b => Date.parse(b.timestamp) >= cutoff);
    if (!bars.length) continue;
    firstPrice.set(ticker, bars[0].close);
    const dateMap = new Map<string, number>();
    for (const bar of bars) { const date = bar.timestamp.slice(0, 10); dateMap.set(date, bar.close); allDates.add(date); }
    byTicker.set(ticker, dateMap);
  }
  return [...allDates].sort().map(date => {
    const row: HistoryRow = { date };
    for (const candidate of scan.selected) {
      const ticker = candidate.asset.ticker;
      const price = byTicker.get(ticker)?.get(date);
      const base = firstPrice.get(ticker);
      row[ticker] = price != null && base ? Number((price / base * 100).toFixed(2)) : null;
    }
    return row;
  });
}
function periodReturn(candidate: AssetScanCandidate | null, bars: number): number | null {
  const prices = candidate?.response?.bars.map(b => b.close) ?? [];
  if (prices.length <= bars) return null;
  const a = prices[prices.length - 1 - bars]; const b = prices[prices.length - 1];
  return a > 0 ? (b / a - 1) * 100 : null;
}
function formatReturn(v: number | null): string { return v == null ? 'N/D' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }
function selectionReason(scan: AssetUniverseScanResult, assetId: string): string {
  const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
  if (!candidate) return 'Sin detalle';
  if (candidate.asset.defensive) return 'Aporta defensa y diversificación; el selector reserva una exposición defensiva cuando existe.';
  const rank = scan.candidates.filter(c => c.status === 'ACCEPTED' && c.score != null).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)).findIndex(c => c.asset.assetId === assetId) + 1;
  return `Es el candidato priorizado de su categoría y ocupa el puesto ${rank} del ranking cuantitativo entre los activos válidos.`;
}
function exclusionReason(scan: AssetUniverseScanResult, assetId: string): string {
  const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
  if (!candidate) return 'Sin detalle';
  if (candidate.status === 'REJECTED') return candidate.reason ?? 'Datos rechazados';
  const sameCategorySelected = scan.selected.find(s => s.asset.category === candidate.asset.category);
  if (sameCategorySelected) return `La categoría ${candidate.asset.category} ya está representada por ${sameCategorySelected.asset.ticker}, que tuvo mayor prioridad de selección.`;
  return 'Quedó fuera por el límite del shortlist después de aplicar diversificación por categorías.';
}
function bestAlternative(scan: AssetUniverseScanResult, selected: AssetScanCandidate | null): AssetScanCandidate | null {
  if (!selected) return null;
  return scan.candidates.filter(c => c.status === 'ACCEPTED' && c.asset.category === selected.asset.category && c.asset.assetId !== selected.asset.assetId && c.score != null).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0] ?? null;
}

export const RecommendationEvidencePanel: React.FC<{ scan: AssetUniverseScanResult }> = ({ scan }) => {
  const [rangeYears, setRangeYears] = useState<RangeYears>(3);
  const [selectedAssetId, setSelectedAssetId] = useState(scan.selected[0]?.asset.assetId ?? '');
  const history = useMemo(() => buildNormalizedHistory(scan, rangeYears), [scan, rangeYears]);
  const selectedAsset = scan.selected.find(c => c.asset.assetId === selectedAssetId) ?? scan.selected[0] ?? null;
  const alternative = bestAlternative(scan, selectedAsset);
  const acceptedRanked = useMemo(() => scan.candidates.filter(c => c.status === 'ACCEPTED' && c.score != null).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)), [scan]);
  const excludedTop = acceptedRanked.filter(c => !scan.selected.some(s => s.asset.assetId === c.asset.assetId)).slice(0, 6);
  const selectedMetrics = selectedAsset ? [['1M', periodReturn(selectedAsset, 21)], ['3M', periodReturn(selectedAsset, 63)], ['6M', periodReturn(selectedAsset, 126)], ['1A', periodReturn(selectedAsset, 252)], ['3A', periodReturn(selectedAsset, 756)]] as const : [];

  return <section className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="font-bold text-white">Histórico y motivo de la recomendación</h2><p className="mt-1 max-w-3xl text-xs text-slate-400">Pulsa un ETF para ver su detalle. Las curvas parten de 100 para comparar la evolución relativa, no el precio nominal.</p></div><div className="flex gap-1 rounded-lg bg-slate-950 p-1 text-xs">{([1,3,5] as RangeYears[]).map(y => <button key={y} onClick={() => setRangeYears(y)} className={`rounded-md px-3 py-1.5 ${rangeYears===y?'bg-violet-600 text-white':'text-slate-400 hover:bg-slate-800'}`}>{y}A</button>)}</div></div>

    <div className="mt-4 flex flex-wrap gap-2">{scan.selected.map(c => <button key={c.asset.assetId} onClick={() => setSelectedAssetId(c.asset.assetId)} className={`rounded-lg border px-3 py-2 text-xs font-mono transition ${selectedAsset?.asset.assetId===c.asset.assetId?'border-violet-400 bg-violet-500/20 text-violet-100':'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500'}`}>{c.asset.ticker}</button>)}</div>

    <div className="mt-4 h-[360px] rounded-xl border border-slate-800 bg-slate-950/60 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{top:12,right:18,left:2,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={45} tick={{fontSize:10,fill:'#94a3b8'}}/><YAxis tick={{fontSize:10,fill:'#94a3b8'}} domain={['auto','auto']} width={45}/><Tooltip contentStyle={{background:'#0f172a',border:'1px solid #334155',fontSize:11}} labelStyle={{color:'#cbd5e1'}}/><Legend wrapperStyle={{fontSize:10}}/>{scan.selected.map((c,i)=><Line key={c.asset.ticker} type="monotone" dataKey={c.asset.ticker} connectNulls dot={false} stroke={SERIES_COLORS[i%SERIES_COLORS.length]} strokeWidth={selectedAsset?.asset.assetId===c.asset.assetId?3.2:1.25} strokeOpacity={selectedAsset?.asset.assetId===c.asset.assetId?1:0.3} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div>
    <div className="mt-2 text-[10px] text-slate-500">Base 100 = primer cierre disponible del periodo · datos diarios ajustados del mismo pipeline REAL.</div>

    {selectedAsset && <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-lg font-bold text-violet-100">{selectedAsset.asset.ticker}</div><div className="text-xs text-slate-400">{selectedAsset.asset.name} · {selectedAsset.asset.category}</div></div><div className="text-right"><div className="text-[10px] uppercase text-slate-500">Último cierre</div><div className="font-mono font-bold">{selectedAsset.lastClose?.toFixed(2) ?? 'N/D'} €</div></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{selectedMetrics.map(([label,value])=><div key={label} className="rounded-lg bg-slate-950 p-2 text-center"><div className="text-[10px] text-slate-500">{label}</div><div className={`mt-1 font-mono text-sm font-semibold ${(value??0)>=0?'text-emerald-300':'text-rose-300'}`}>{formatReturn(value)}</div></div>)}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Volatilidad</div><div className="font-mono font-bold">{selectedAsset.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</div></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Max drawdown</div><div className="font-mono font-bold">{selectedAsset.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</div></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Score</div><div className="font-mono font-bold">{selectedAsset.score?.toFixed(2) ?? 'N/D'}</div></div></div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300"><b>Por qué entra:</b> {selectionReason(scan, selectedAsset.asset.assetId)}</div></div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-sm font-semibold text-slate-200">Mejor alternativa de la misma categoría</div>{alternative?<><div className="mt-3 flex items-end justify-between"><div><div className="font-mono font-bold">{alternative.asset.ticker}</div><div className="text-[11px] text-slate-500">{alternative.asset.name}</div></div><div className="font-mono text-sm">score {alternative.score?.toFixed(2)}</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-900 p-2">Mom. 120d<br/><b>{alternative.momentum120Pct?.toFixed(1) ?? 'N/D'}%</b></div><div className="rounded-lg bg-slate-900 p-2">Volatilidad<br/><b>{alternative.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</b></div><div className="rounded-lg bg-slate-900 p-2">Max DD<br/><b>{alternative.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</b></div><div className="rounded-lg bg-slate-900 p-2">1A<br/><b>{formatReturn(periodReturn(alternative,252))}</b></div></div><div className="mt-3 text-xs text-slate-400">{exclusionReason(scan,alternative.asset.assetId)}</div></>:<div className="mt-3 text-xs text-slate-500">No hay otro candidato válido de esta categoría en el universo actual.</div>}</div>
    </div>}

    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="font-semibold text-slate-200">Cómo se calcula el score</div><div className="mt-2 font-mono text-[11px] text-slate-400">Score = 0,20×Momentum20 + 0,35×Momentum60 + 0,45×Momentum120 − 0,30×Volatilidad − 0,25×Drawdown + 2,5 si es defensivo</div><p className="mt-2 text-xs text-slate-500">Después del ranking, el selector fuerza diversificación por categorías. Por eso el shortlist no coincide necesariamente con los ocho scores más altos.</p></div>

    {excludedTop.length>0&&<div className="mt-5"><h3 className="text-sm font-semibold text-slate-200">Mejores candidatos que quedaron fuera</h3><div className="mt-2 grid gap-2 md:grid-cols-2">{excludedTop.map(c=><button key={c.asset.assetId} onClick={()=>{const same=scan.selected.find(s=>s.asset.category===c.asset.category); if(same) setSelectedAssetId(same.asset.assetId);}} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-left hover:border-slate-600"><div className="flex items-center justify-between"><span className="font-mono font-semibold">{c.asset.ticker}</span><span className="font-mono text-xs text-slate-400">score {c.score?.toFixed(2)}</span></div><div className="mt-1 text-[11px] text-slate-500">{c.asset.category}</div><div className="mt-2 text-xs text-slate-400">{exclusionReason(scan,c.asset.assetId)}</div></button>)}</div></div>}
  </section>;
};
