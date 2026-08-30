import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Radar, RefreshCw } from 'lucide-react';
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
import { HistoricalReplayRobustnessPanel } from './HistoricalReplayRobustnessPanel';

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
  const [showAll, setShowAll] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(requestedSymbol?.trim().toUpperCase() ?? null);
  const [externalScan, setExternalScan] = useState<AssetUniverseScanResult | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const productionTickers = useMemo(() => new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(item => item.ticker.toUpperCase())), []);
  const researchCatalog = useMemo(() => {
    const map = new Map<string, { ticker: string; name: string }>();
    for (const item of [...EUR_PORTFOLIO_DISCOVERY_UNIVERSE, ...EUR_VALIDATION_HOLDOUT_UNIVERSE]) {
      map.set(item.ticker.toUpperCase(), { ticker: item.ticker, name: item.name });
      if (item.isin) map.set(item.isin.toUpperCase(), { ticker: item.isin, name: `${item.name} · ISIN` });
    }
    return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, []);

  useEffect(() => {
    if (requestedSymbol?.trim()) setSelectedSymbol(requestedSymbol.trim().toUpperCase());
  }, [requestedSymbol]);

  const loadExternalScan = async () => {
    if (externalLoading || externalScan) return;
    setExternalLoading(true);
    setExternalError(null);
    try {
      setExternalScan(await AssetUniverseScanner.scan(
        EUR_VALIDATION_HOLDOUT_UNIVERSE,
        fiveYearsAgo(),
        isoDate(new Date()),
        { forceRefresh: false, concurrency: 3, maxSelected: 10, minimumBars: 252, maxDataAgeDays: 7 }
      ));
    } catch (e: any) {
      setExternalError(e?.message || String(e));
    } finally {
      setExternalLoading(false);
    }
  };

  const combinedCandidates = useMemo(() => {
    const map = new Map<string, AssetScanCandidate>();
    for (const candidate of [...scan.candidates, ...(externalScan?.candidates ?? [])]) {
      const key = candidate.asset.ticker.toUpperCase();
      if (!map.has(key) || (map.get(key)?.status === 'REJECTED' && candidate.status === 'ACCEPTED')) map.set(key, candidate);
    }
    return [...map.values()];
  }, [scan, externalScan]);

  const ranking = useMemo(() => combinedCandidates
    .filter(c => c.status === 'ACCEPTED')
    .sort((a, b) => scoreFor(b, rankingMode) - scoreFor(a, rankingMode)), [combinedCandidates, rankingMode]);
  const visible = showAll ? ranking : ranking.slice(0, 10);
  const externalAccepted = externalScan?.accepted ?? 0;

  const openAsset = (symbol: string) => {
    setSelectedSymbol(symbol.toUpperCase());
    window.setTimeout(() => document.getElementById('single-asset-research')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/35 via-slate-900 to-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h1 className="text-xl font-bold text-white">Estudio de inversiones y señales</h1></div>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">Una única superficie para buscar o seleccionar cualquier ticker/ISIN, ver su gráfica y señales, y recorrer el ranking actual. No se crean buscadores paralelos para la misma tarea.</p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-xs text-violet-100"><b>Buscador único</b><div className="mt-1 text-[10px] text-slate-400">Catálogo + escritura manual + análisis del proveedor en el mismo control.</div></div>
      </div>

      <div className="mt-4">
        <SingleAssetResearchPanel requestedSymbol={selectedSymbol} suggestions={researchCatalog}/>
      </div>

      <div className="mt-5 border-t border-slate-800 pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">Ranking y oportunidades del mismo estudio</h2></div>
            <p className="mt-1 text-xs text-slate-400">El ranking no tiene otro buscador. Sirve para descubrir candidatos y abrirlos en el analizador de arriba. El universo externo de robustez sigue siendo opcional.</p>
          </div>
          <div className="flex flex-wrap gap-2">{(['OPPORTUNITY','MOMENTUM','SAFETY','PUNISHED'] as RankingMode[]).map(mode => <button key={mode} onClick={() => setRankingMode(mode)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${rankingMode === mode ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{modeLabel(mode)}</button>)}</div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-emerald-200">Producción: {scan.accepted} válidos</span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-cyan-200">Externos: {externalLoading ? 'cargando…' : externalScan ? `${externalAccepted} válidos` : 'sin cargar'}</span>
          <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-violet-200">Ranking: {ranking.length}</span>
          <button type="button" onClick={() => void loadExternalScan()} disabled={externalLoading || Boolean(externalScan)} className="flex items-center gap-1 rounded-lg border border-violet-500/30 px-3 py-1 font-bold text-violet-200 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${externalLoading ? 'animate-spin' : ''}`}/>{externalScan ? 'Externos cargados' : externalLoading ? 'Cargando externos…' : 'Cargar validación externa'}</button>
        </div>
        {externalError && <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-100">El universo externo no pudo cargarse completo: {externalError}. El buscador y el análisis principal siguen disponibles.</div>}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[820px] text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Valor</th><th className="p-3 text-left">Uso</th><th className="p-3 text-left">Categoría</th><th className="p-3 text-right">Mom. 120d</th><th className="p-3 text-right">Vol.</th><th className="p-3 text-right">DD máx.</th><th className="p-3 text-right">Score</th><th className="p-3"></th></tr></thead><tbody>{visible.map((c, i) => {
          const production = productionTickers.has(c.asset.ticker.toUpperCase());
          return <tr key={c.asset.assetId} className="border-t border-slate-800"><td className="p-3 text-slate-500">{i + 1}</td><td className="p-3"><b className="font-mono text-white">{c.asset.ticker}</b>{c.asset.isin && <div className="font-mono text-[9px] text-cyan-400">{c.asset.isin}</div>}<div className="max-w-[240px] truncate text-[9px] text-slate-500">{c.asset.name}</div></td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${production ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-violet-500/30 bg-violet-500/10 text-violet-200'}`}>{production ? 'CARTERA' : 'VALIDACIÓN EXTERNA'}</span></td><td className="p-3 text-slate-400">{c.asset.category}</td><td className={`p-3 text-right font-mono ${(c.momentum120Pct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{c.momentum120Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono text-amber-200">{c.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-3 text-right font-mono">{c.score?.toFixed(2) ?? 'N/D'}</td><td className="p-3 text-right"><button onClick={() => openAsset(c.asset.ticker)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 text-[10px] font-bold text-cyan-200">Analizar</button></td></tr>;
        })}</tbody></table></div>
        {ranking.length > 10 && <button onClick={() => setShowAll(v => !v)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"><ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`}/>{showAll ? 'Mostrar solo los 10 primeros' : `Ver los ${ranking.length} instrumentos válidos`}</button>}
        <div className="mt-3 text-[10px] text-slate-500"><b className="text-emerald-300">CARTERA</b> puede competir en “Qué haría hoy”. <b className="text-violet-300">VALIDACIÓN EXTERNA</b> sigue fuera de producción aunque se muestre en este mismo espacio de estudio.</div>
      </div>
    </section>

    <details className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-4"><summary className="cursor-pointer list-none"><div className="font-bold text-white">Validación general del motor y casos externos</div><div className="mt-1 text-[10px] text-slate-500">Esto sí permanece separado porque responde a otra pregunta: robustez histórica del motor, no búsqueda o análisis de un activo concreto.</div></summary><div className="mt-4"><HistoricalDecisionReplayPanel scan={scan} capitalEur={decision.capitalEur} riskProfile={decision.riskProfile} horizonYears={decision.horizonYears}/><HistoricalReplayRobustnessPanel capitalEur={decision.capitalEur} riskProfile={decision.riskProfile} horizonYears={decision.horizonYears}/></div></details>
  </div>;
};