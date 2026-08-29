import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Radar, Search } from 'lucide-react';
import {
  EUR_ASSET_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  type AssetScanCandidate,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult
} from '../investment/decision';
import { SingleAssetResearchPanel } from './SingleAssetResearchPanel';
import { HistoricalDecisionReplayPanel } from './HistoricalDecisionReplayPanel';

interface Props { scan: AssetUniverseScanResult; decision: InvestmentDecisionResult; }
type RankingMode = 'OPPORTUNITY' | 'MOMENTUM' | 'SAFETY' | 'PUNISHED';

function scoreFor(candidate: AssetScanCandidate, mode: RankingMode): number {
  if (mode === 'MOMENTUM') return candidate.momentum120Pct ?? -Infinity;
  if (mode === 'SAFETY') return -((candidate.annualizedVolatilityPct ?? 999) * 0.65 + (candidate.maxDrawdownPct ?? 999) * 0.35);
  if (mode === 'PUNISHED') return candidate.maxDrawdownPct ?? -Infinity;
  return candidate.score ?? -Infinity;
}
function modeLabel(mode: RankingMode): string {
  if (mode === 'MOMENTUM') return 'Más fuertes ahora';
  if (mode === 'SAFETY') return 'Más estables / seguros';
  if (mode === 'PUNISHED') return 'Más castigados';
  return 'Mejor equilibrio actual';
}

export const InvestmentResearchLab: React.FC<Props> = ({ scan, decision }) => {
  const [rankingMode, setRankingMode] = useState<RankingMode>('OPPORTUNITY');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(scan.selected[0]?.asset.ticker ?? null);

  const researchCatalog = useMemo(() => {
    const map = new Map<string, { ticker: string; name: string }>();
    for (const item of [...EUR_ASSET_UNIVERSE, ...EUR_VALIDATION_HOLDOUT_UNIVERSE]) map.set(item.ticker.toUpperCase(), { ticker: item.ticker, name: item.name });
    return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, []);

  const ranking = useMemo(() => {
    const clean = query.trim().toUpperCase();
    return scan.candidates
      .filter(c => c.status === 'ACCEPTED')
      .filter(c => !clean || c.asset.ticker.toUpperCase().includes(clean) || c.asset.name.toUpperCase().includes(clean) || c.asset.category.toUpperCase().includes(clean))
      .sort((a, b) => scoreFor(b, rankingMode) - scoreFor(a, rankingMode));
  }, [scan, rankingMode, query]);
  const visible = showAll ? ranking : ranking.slice(0, 10);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/35 via-slate-900 to-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h1 className="text-xl font-bold text-white">Estudio de inversiones y señales</h1></div><p className="mt-1 max-w-3xl text-sm text-slate-300">Esta zona no modifica tu cartera. Sirve para descubrir oportunidades, ordenar el mercado con distintos criterios y estudiar cualquier ticker desde la fecha que quieras con las señales dibujadas sobre el precio.</p></div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-xs text-violet-100"><b>Sin límite de shortlist</b><div className="mt-1 text-[10px] text-slate-400">{researchCatalog.length} instrumentos ya catalogados + cualquier ticker que acepte el proveedor.</div></div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">Radar actual</h2></div><p className="mt-1 text-xs text-slate-400">Ordena todos los instrumentos aceptados en la actualización actual, no solo los 8 elegidos para construir una cartera diversificada.</p></div><div className="flex flex-wrap gap-2">{(['OPPORTUNITY','MOMENTUM','SAFETY','PUNISHED'] as RankingMode[]).map(mode => <button key={mode} onClick={() => setRankingMode(mode)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${rankingMode === mode ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{modeLabel(mode)}</button>)}</div></div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><Search className="h-4 w-4 text-slate-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar ticker, nombre o categoría…" className="w-full bg-transparent text-sm outline-none"/><span className="text-[10px] text-slate-500">{ranking.length} válidos</span></div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Categoría</th><th className="p-3 text-right">Mom. 120d</th><th className="p-3 text-right">Vol.</th><th className="p-3 text-right">DD máx.</th><th className="p-3 text-right">Score</th><th className="p-3"></th></tr></thead><tbody>{visible.map((c, i) => <tr key={c.asset.assetId} className="border-t border-slate-800"><td className="p-3 text-slate-500">{i + 1}</td><td className="p-3"><b className="font-mono text-white">{c.asset.ticker}</b><div className="max-w-[240px] truncate text-[9px] text-slate-500">{c.asset.name}</div></td><td className="p-3 text-slate-400">{c.asset.category}</td><td className={`p-3 text-right font-mono ${(c.momentum120Pct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{c.momentum120Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono text-amber-200">{c.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.score?.toFixed(2) ?? 'N/D'}</td><td className="p-3 text-right"><button onClick={() => setSelectedSymbol(c.asset.ticker)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 text-[10px] font-bold text-cyan-200">Abrir gráfica</button></td></tr>)}</tbody></table>
      </div>
      {ranking.length > 10 && <button onClick={() => setShowAll(v => !v)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"><ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`}/>{showAll ? 'Mostrar solo los 10 primeros' : `Ver los ${ranking.length} instrumentos válidos`}</button>}
      <div className="mt-3 text-[10px] text-slate-500">Este ranking solo necesita un conjunto para comparar. No limita el analizador individual: puedes escribir cualquier ticker aunque no aparezca aquí. “Más rentable/seguro” describe métricas observadas, no rentabilidad futura garantizada.</div>
    </section>

    <SingleAssetResearchPanel requestedSymbol={selectedSymbol}/>

    <details className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-4">
      <summary className="cursor-pointer list-none"><div className="font-bold text-white">Validación general del motor y casos externos</div><div className="mt-1 text-[10px] text-slate-500">Pruebas de robustez multiactivo, fechas distintas y episodios históricos adversos. Se mantiene separado del estudio visual de un ticker concreto.</div></summary>
      <div className="mt-4"><HistoricalDecisionReplayPanel scan={scan} capitalEur={decision.capitalEur} riskProfile={decision.riskProfile} horizonYears={decision.horizonYears}/></div>
    </details>
  </div>;
};