import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Radar, Search } from 'lucide-react';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  type AssetScanCandidate,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult
} from '../investment/decision';
import { SingleAssetResearchPanel } from './SingleAssetResearchPanel';
import { HistoricalDecisionReplayPanel } from './HistoricalDecisionReplayPanel';

interface Props { scan: AssetUniverseScanResult; decision: InvestmentDecisionResult; requestedSymbol?: string | null; }
type RankingMode = 'OPPORTUNITY' | 'MOMENTUM' | 'SAFETY' | 'PUNISHED';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function fiveYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 5); return isoDate(d); }
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

export const InvestmentResearchLab: React.FC<Props> = ({ scan, decision, requestedSymbol }) => {
  const [rankingMode, setRankingMode] = useState<RankingMode>('OPPORTUNITY');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(requestedSymbol ?? scan.selected[0]?.asset.ticker ?? null);
  const [externalScan, setExternalScan] = useState<AssetUniverseScanResult | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const researchCatalog = useMemo(() => {
    const map = new Map<string, { ticker: string; name: string }>();
    for (const item of [...EUR_PORTFOLIO_DISCOVERY_UNIVERSE, ...EUR_VALIDATION_HOLDOUT_UNIVERSE]) map.set(item.ticker.toUpperCase(), { ticker: item.ticker, name: item.name });
    return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, []);

  useEffect(() => {
    if (requestedSymbol?.trim()) setSelectedSymbol(requestedSymbol.trim().toUpperCase());
  }, [requestedSymbol]);

  useEffect(() => {
    let active = true;
    setExternalLoading(true); setExternalError(null);
    AssetUniverseScanner.scan(EUR_VALIDATION_HOLDOUT_UNIVERSE, fiveYearsAgo(), isoDate(new Date()), { forceRefresh: false, concurrency: 3, maxSelected: 10, minimumBars: 252, maxDataAgeDays: 7 })
      .then(value => { if (active) setExternalScan(value); })
      .catch((e: any) => { if (active) setExternalError(e?.message || String(e)); })
      .finally(() => { if (active) setExternalLoading(false); });
    return () => { active = false; };
  }, []);

  const combinedCandidates = useMemo(() => {
    const map = new Map<string, AssetScanCandidate>();
    for (const candidate of [...scan.candidates, ...(externalScan?.candidates ?? [])]) {
      const key = candidate.asset.ticker.toUpperCase();
      if (!map.has(key) || (map.get(key)?.status === 'REJECTED' && candidate.status === 'ACCEPTED')) map.set(key, candidate);
    }
    return [...map.values()];
  }, [scan, externalScan]);

  const ranking = useMemo(() => {
    const clean = query.trim().toUpperCase();
    return combinedCandidates
      .filter(c => c.status === 'ACCEPTED')
      .filter(c => !clean || c.asset.ticker.toUpperCase().includes(clean) || c.asset.name.toUpperCase().includes(clean) || c.asset.category.toUpperCase().includes(clean))
      .sort((a, b) => scoreFor(b, rankingMode) - scoreFor(a, rankingMode));
  }, [combinedCandidates, rankingMode, query]);
  const visible = showAll ? ranking : ranking.slice(0, 10);
  const externalAccepted = externalScan?.accepted ?? 0;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/35 via-slate-900 to-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h1 className="text-xl font-bold text-white">Estudio de inversiones y señales</h1></div><p className="mt-1 max-w-3xl text-sm text-slate-300">Esta zona no modifica tu cartera. Sirve para descubrir oportunidades, ordenar un universo de investigación más amplio y estudiar cualquier ticker o ISIN desde la fecha que quieras con las señales dibujadas sobre el precio.</p></div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-xs text-violet-100"><b>Sin límite de shortlist</b><div className="mt-1 text-[10px] text-slate-400">{researchCatalog.length} instrumentos catalogados + cualquier ticker/ISIN que acepte el proveedor.</div></div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
        <label className="rounded-xl border border-violet-500/20 bg-slate-950/70 p-3"><span className="text-[9px] uppercase text-slate-500">Explorar catálogo ampliado</span><select defaultValue="" onChange={e => { if (e.target.value) setSelectedSymbol(e.target.value); }} className="mt-1 w-full bg-transparent text-sm outline-none"><option value="">Selecciona uno de los {researchCatalog.length} valores catalogados…</option>{researchCatalog.map(item => <option className="bg-slate-900" key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>)}</select></label>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-400">También puedes escribir directamente <b className="text-white">AAPL, NVDA, SAN.MC, SAP.DE…</b> o un ISIN en el analizador inferior.</div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">Radar actual ampliado</h2></div><p className="mt-1 text-xs text-slate-400">Combina los instrumentos válidos del universo de cartera con el universo externo de robustez. No usa el shortlist del asignador como límite de investigación.</p></div><div className="flex flex-wrap gap-2">{(['OPPORTUNITY','MOMENTUM','SAFETY','PUNISHED'] as RankingMode[]).map(mode => <button key={mode} onClick={() => setRankingMode(mode)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${rankingMode === mode ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{modeLabel(mode)}</button>)}</div></div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-emerald-200">Producción: {scan.accepted} válidos</span><span className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-cyan-200">Externos: {externalLoading ? 'cargando…' : `${externalAccepted} válidos`}</span><span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-violet-200">Radar combinado: {ranking.length}</span></div>
      {externalError && <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-100">El universo externo no pudo cargarse completo: {externalError}. El analizador individual sigue disponible.</div>}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><Search className="h-4 w-4 text-slate-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar ticker, nombre o categoría…" className="w-full bg-transparent text-sm outline-none"/><span className="text-[10px] text-slate-500">{ranking.length} válidos</span></div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Categoría</th><th className="p-3 text-right">Mom. 120d</th><th className="p-3 text-right">Vol.</th><th className="p-3 text-right">DD máx.</th><th className="p-3 text-right">Score</th><th className="p-3"></th></tr></thead><tbody>{visible.map((c, i) => <tr key={c.asset.assetId} className="border-t border-slate-800"><td className="p-3 text-slate-500">{i + 1}</td><td className="p-3"><b className="font-mono text-white">{c.asset.ticker}</b><div className="max-w-[240px] truncate text-[9px] text-slate-500">{c.asset.name}</div></td><td className="p-3 text-slate-400">{c.asset.category}</td><td className={`p-3 text-right font-mono ${(c.momentum120Pct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{c.momentum120Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono text-amber-200">{c.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.score?.toFixed(2) ?? 'N/D'}</td><td className="p-3 text-right"><button onClick={() => setSelectedSymbol(c.asset.ticker)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 text-[10px] font-bold text-cyan-200">Abrir gráfica</button></td></tr>)}</tbody></table></div>
      {ranking.length > 10 && <button onClick={() => setShowAll(v => !v)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"><ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`}/>{showAll ? 'Mostrar solo los 10 primeros' : `Ver los ${ranking.length} instrumentos válidos`}</button>}
      <div className="mt-3 text-[10px] text-slate-500">“Más fuerte/seguro/castigado” describe métricas observadas. El radar necesita un universo cargado para comparar; el analizador individual de abajo no está restringido a este conjunto.</div>
    </section>

    <SingleAssetResearchPanel requestedSymbol={selectedSymbol} suggestions={researchCatalog}/>

    <details className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-4"><summary className="cursor-pointer list-none"><div className="font-bold text-white">Validación general del motor y casos externos</div><div className="mt-1 text-[10px] text-slate-500">Pruebas de robustez multiactivo, fechas distintas y episodios históricos adversos. Se mantiene separado del estudio visual de un ticker concreto.</div></summary><div className="mt-4"><HistoricalDecisionReplayPanel scan={scan} capitalEur={decision.capitalEur} riskProfile={decision.riskProfile} horizonYears={decision.horizonYears}/></div></details>
  </div>;
};
