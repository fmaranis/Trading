import React, { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { AssetUniverseScanResult, AssetUniverseScanner, EUR_ASSET_UNIVERSE } from '../investment/decision';

type RangeYears = 1 | 3 | 5;
type HistoryRow = { date: string; [ticker: string]: string | number | null };

const SERIES_COLORS = ['#8b5cf6', '#22c55e', '#38bdf8', '#f59e0b', '#f43f5e', '#14b8a6', '#e879f9', '#a3e635'];

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function cutoffDate(years: RangeYears): number {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.getTime();
}

function buildNormalizedHistory(scan: AssetUniverseScanResult, years: RangeYears): HistoryRow[] {
  const selected = scan.selected.filter(c => c.response?.bars?.length);
  const cutoff = cutoffDate(years);
  const byTicker = new Map<string, Map<string, number>>();
  const firstPrice = new Map<string, number>();
  const allDates = new Set<string>();

  for (const candidate of selected) {
    const ticker = candidate.asset.ticker;
    const bars = candidate.response!.bars.filter(b => Date.parse(b.timestamp) >= cutoff);
    if (!bars.length) continue;
    firstPrice.set(ticker, bars[0].close);
    const dateMap = new Map<string, number>();
    for (const bar of bars) {
      const date = bar.timestamp.slice(0, 10);
      dateMap.set(date, bar.close);
      allDates.add(date);
    }
    byTicker.set(ticker, dateMap);
  }

  return [...allDates].sort().map(date => {
    const row: HistoryRow = { date };
    for (const candidate of selected) {
      const ticker = candidate.asset.ticker;
      const price = byTicker.get(ticker)?.get(date);
      const base = firstPrice.get(ticker);
      row[ticker] = price != null && base ? Number((price / base * 100).toFixed(2)) : null;
    }
    return row;
  });
}

function selectionReason(scan: AssetUniverseScanResult, assetId: string): string {
  const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
  if (!candidate) return 'Sin detalle';
  if (candidate.asset.defensive) return 'Activo defensivo elegido para que el shortlist no sea solo renta variable.';
  const rank = scan.candidates
    .filter(c => c.status === 'ACCEPTED' && c.score != null)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .findIndex(c => c.asset.assetId === assetId) + 1;
  return `Mejor candidato disponible de su categoría; posición ${rank} por score dentro de los activos válidos.`;
}

function exclusionReason(scan: AssetUniverseScanResult, assetId: string): string {
  const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
  if (!candidate) return 'Sin detalle';
  if (candidate.status === 'REJECTED') return candidate.reason ?? 'Datos rechazados';
  const sameCategorySelected = scan.selected.find(s => s.asset.category === candidate.asset.category);
  if (sameCategorySelected) return `No entra porque la categoría ${candidate.asset.category} ya está representada por ${sameCategorySelected.asset.ticker}, con mejor prioridad de selección.`;
  return 'No entra por límite de tamaño del shortlist tras priorizar diversificación por categorías.';
}

export const RecommendationEvidencePanel: React.FC<{ scan: AssetUniverseScanResult }> = ({ scan }) => {
  const [rangeYears, setRangeYears] = useState<RangeYears>(3);
  const history = useMemo(() => buildNormalizedHistory(scan, rangeYears), [scan, rangeYears]);
  const tickers = scan.selected.map(c => c.asset.ticker);
  const acceptedRanked = useMemo(() => scan.candidates
    .filter(c => c.status === 'ACCEPTED' && c.score != null)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)), [scan]);
  const excludedTop = acceptedRanked.filter(c => !scan.selected.some(s => s.asset.assetId === c.asset.assetId)).slice(0, 6);

  return <section className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="font-bold text-white">Histórico y motivo de la recomendación</h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">Cada serie parte de 100 para comparar el comportamiento relativo. El selector no elige solo por subida: combina momentum con penalización por volatilidad y drawdown, y después fuerza diversificación por categorías.</p>
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-950 p-1 text-xs">
        {([1, 3, 5] as RangeYears[]).map(y => <button key={y} onClick={() => setRangeYears(y)} className={`rounded-md px-3 py-1.5 ${rangeYears === y ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{y}A</button>)}
      </div>
    </div>

    <div className="mt-4 h-[360px] rounded-xl border border-slate-800 bg-slate-950/60 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 12, right: 18, left: 2, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" minTickGap={45} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} width={45} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} labelStyle={{ color: '#cbd5e1' }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {tickers.map((ticker, i) => <Line key={ticker} type="monotone" dataKey={ticker} connectNulls dot={false} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={i < 3 ? 2.4 : 1.5} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-2 text-[10px] text-slate-500">Base 100 = primer cierre disponible del periodo. Datos diarios ajustados del mismo pipeline REAL del recomendador. No representa rentabilidad futura.</div>

    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-500"><tr><th className="p-2 text-left">Seleccionado</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Mom. 20d</th><th className="p-2 text-right">Mom. 60d</th><th className="p-2 text-right">Mom. 120d</th><th className="p-2 text-right">Vol.</th><th className="p-2 text-right">Max DD</th><th className="p-2 text-right">Score</th><th className="p-2 text-left">Por qué entra</th></tr></thead>
        <tbody>{scan.selected.map(c => <tr key={c.asset.assetId} className="border-t border-slate-800"><td className="p-2 font-mono font-semibold text-violet-200">{c.asset.ticker}</td><td className="p-2 text-right">{c.lastClose?.toFixed(2) ?? 'N/D'} €</td><td className="p-2 text-right">{c.momentum20Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.momentum60Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.momentum120Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right font-mono">{c.score?.toFixed(2)}</td><td className="p-2 min-w-64 text-slate-400">{selectionReason(scan, c.asset.assetId)}</td></tr>)}</tbody>
      </table>
    </div>

    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="font-semibold text-slate-200">Cómo se calcula el score</div>
      <div className="mt-2 font-mono text-[11px] text-slate-400">Score = 0,20×Momentum20 + 0,35×Momentum60 + 0,45×Momentum120 − 0,30×Volatilidad − 0,25×Drawdown + 2,5 si es defensivo</div>
      <p className="mt-2 text-xs text-slate-500">Después del score, el selector evita repetir categoría y reserva una exposición defensiva cuando existe. Por eso el shortlist no coincide necesariamente con los 8 scores más altos.</p>
    </div>

    {excludedTop.length > 0 && <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-200">Mejores candidatos que quedaron fuera</h3>
      <div className="mt-2 grid gap-2 md:grid-cols-2">{excludedTop.map(c => <div key={c.asset.assetId} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex items-center justify-between"><span className="font-mono font-semibold">{c.asset.ticker}</span><span className="font-mono text-xs text-slate-400">score {c.score?.toFixed(2)}</span></div><div className="mt-1 text-[11px] text-slate-500">{c.asset.category}</div><div className="mt-2 text-xs text-slate-400">{exclusionReason(scan, c.asset.assetId)}</div></div>)}</div>
    </div>}
  </section>;
};

export const RecommendationEvidenceStandalone: React.FC = () => {
  const [scan, setScan] = useState<AssetUniverseScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const end = new Date();
        const start = new Date(end);
        start.setUTCFullYear(start.getUTCFullYear() - 7);
        const result = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, isoDate(start), isoDate(end), {
          forceRefresh: false,
          concurrency: 3,
          maxSelected: 8,
          minimumBars: 252,
          maxDataAgeDays: 7
        });
        if (!cancelled) setScan(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">Cargando histórico y evidencia de los activos recomendados…</section>;
  if (error) return <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">No se pudo cargar la evidencia histórica: {error}</section>;
  return scan ? <RecommendationEvidencePanel scan={scan} /> : null;
};
