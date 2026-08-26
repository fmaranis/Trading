import React, { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, Play, AlertTriangle, Layers3 } from 'lucide-react';
import { HistoricalMarketDataService } from '../investment/data/marketData/historicalMarketDataService';
import { MultiAssetDataAligner, PortfolioBacktestEngine, PortfolioBacktestResult, RebalanceFrequency } from '../investment/portfolioBacktesting';
import { DeterministicPortfolioAllocator, RealPortfolioAnalytics, RealPortfolioAnalyticsResult } from '../investment/portfolioAnalytics';

const UNIVERSE = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', currency: 'USD' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', currency: 'USD' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', currency: 'USD' }
];

type SnapshotWeights = Record<string, Record<string, number>>;

export const PortfolioLab: React.FC = () => {
  const [selected, setSelected] = useState<string[]>(['SPY', 'GLD']);
  const [weights, setWeights] = useState<Record<string, number>>({ SPY: 50, GLD: 50 });
  const [rebalance, setRebalance] = useState<RebalanceFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioBacktestResult | null>(null);
  const [analytics, setAnalytics] = useState<RealPortfolioAnalyticsResult | null>(null);
  const [allocationSnapshots, setAllocationSnapshots] = useState<SnapshotWeights>({});

  const weightSum = useMemo(() => selected.reduce((s, x) => s + (weights[x] ?? 0), 0), [selected, weights]);

  const toggleAsset = (symbol: string) => {
    setResult(null); setAnalytics(null); setAllocationSnapshots({}); setError(null);
    setSelected(prev => {
      if (prev.includes(symbol)) {
        if (prev.length <= 2) return prev;
        const next = prev.filter(x => x !== symbol);
        setWeights(w => { const copy = { ...w }; delete copy[symbol]; return copy; });
        return next;
      }
      if (prev.length >= 4) return prev;
      const next = [...prev, symbol];
      const equal = 100 / next.length;
      setWeights(Object.fromEntries(next.map(x => [x, equal])));
      return next;
    });
  };

  const setEqualWeights = () => {
    const equal = 100 / selected.length;
    setWeights(Object.fromEntries(selected.map(x => [x, equal])));
  };

  const run = async () => {
    setError(null); setResult(null); setAnalytics(null); setAllocationSnapshots({});
    if (selected.length < 2) return setError('Selecciona al menos 2 activos.');
    if (weightSum > 100.000001) return setError('La suma de pesos no puede superar el 100%.');
    if (selected.some(s => (weights[s] ?? 0) < 0)) return setError('Los pesos no pueden ser negativos.');
    setLoading(true);
    try {
      const responses = await Promise.all(selected.map(symbol => HistoricalMarketDataService.getHistoricalBars({ symbol, startDate, endDate, timeframe: '1d', adjusted: true })));
      const dataset = {
        timeframe: '1d',
        assets: selected.map((symbol, i) => {
          const meta = UNIVERSE.find(x => x.symbol === symbol)!;
          return { assetId: symbol, ticker: symbol, name: meta.name, currency: meta.currency, bars: responses[i].bars, provenance: responses[i].provenance };
        })
      };
      const aligned = MultiAssetDataAligner.align(dataset, 'INTERSECTION');
      const analyticsResult = RealPortfolioAnalytics.calculate(aligned, 60);
      const snapshots: SnapshotWeights = {};
      for (const method of ['EQUAL_WEIGHT', 'INVERSE_VOLATILITY', 'RISK_PARITY_ERC', 'RELATIVE_MOMENTUM'] as const) {
        const allocation = DeterministicPortfolioAllocator.allocateFromAnalytics(aligned, analyticsResult, { method, lookbackBars: 60, topK: Math.min(2, selected.length), minimumMomentumPct: 0 });
        snapshots[method] = allocation.weights;
      }
      const res = PortfolioBacktestEngine.run(dataset, {
        initialCapital: 10000,
        commissionPct: 0.05,
        slippagePct: 0.02,
        rebalanceFrequency: rebalance,
        executionMode: 'NEXT_OPEN',
        targetWeights: Object.fromEntries(selected.map(s => [s, (weights[s] ?? 0) / 100])),
        rebalanceTolerancePct: 0.25,
        alignmentPolicy: 'INTERSECTION'
      });
      setAnalytics(analyticsResult);
      setAllocationSnapshots(snapshots);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const chart = result?.equityCurve.map((p, i) => ({ date: p.timestamp, portfolio: p.equity, benchmark: result.benchmarkEquityCurve[i]?.equity }));

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-emerald-400"/><h1 className="text-xl font-bold">Portfolio Lab</h1></div><p className="mt-1 text-sm text-slate-400">Backtesting determinista multi-activo · datos históricos reales · correlaciones/covarianzas reales · divisa única.</p></div><span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">Paso 9B</span></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-2"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Activos (2–4, USD)</div><div className="grid grid-cols-2 gap-2">{UNIVERSE.map(a => <button key={a.symbol} onClick={() => toggleAsset(a.symbol)} className={`rounded-xl border p-3 text-left ${selected.includes(a.symbol) ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}><div className="font-bold">{a.symbol}</div><div className="truncate text-[11px] text-slate-400">{a.name}</div></button>)}</div></div>
        <div><div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400"><span>Pesos backtest</span><button onClick={setEqualWeights} className="text-emerald-400 normal-case">Equiponderar</button></div><div className="space-y-2">{selected.map(s => <label key={s} className="flex items-center gap-2 text-sm"><span className="w-10 font-mono">{s}</span><input type="number" min="0" max="100" step="1" value={Number((weights[s] ?? 0).toFixed(2))} onChange={e => setWeights(w => ({...w,[s]:Number(e.target.value)}))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5"/><span>%</span></label>)}</div><div className={`mt-2 text-xs ${weightSum <= 100.000001 ? 'text-slate-400' : 'text-rose-400'}`}>Total: {weightSum.toFixed(2)}% · Cash: {Math.max(0,100-weightSum).toFixed(2)}%</div></div>
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Configuración</div><select value={rebalance} onChange={e => setRebalance(e.target.value as RebalanceFrequency)} className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"><option value="NONE">Sin rebalanceo</option><option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option></select><div className="grid grid-cols-2 gap-2"><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs"/><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs"/></div><button onClick={run} disabled={loading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>} Ejecutar cartera</button></div>
      </div>
    </div>

    {error && <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}

    {result && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[['Final', `${result.metrics.financial.finalEquity.toFixed(2)} €`],['Retorno', `${result.metrics.financial.totalReturnPct.toFixed(2)}%`],['Max DD', `${result.metrics.financial.maxDrawdownPct.toFixed(2)}%`],['Costes', `${result.metrics.totalTradingCostsEur.toFixed(2)} €`],['Turnover', result.metrics.annualizedTurnoverPct == null ? 'N/D' : `${result.metrics.annualizedTurnoverPct.toFixed(1)}%`]].map(([k,v])=><div key={k} className="rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="text-[10px] uppercase text-slate-500">{k}</div><div className="mt-1 font-mono font-bold">{v}</div></div>)}</div>
      <div className="h-80 rounded-2xl border border-slate-800 bg-slate-900 p-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.15}/><XAxis dataKey="date" minTickGap={40} tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line type="monotone" dataKey="portfolio" dot={false} strokeWidth={2}/><Line type="monotone" dataKey="benchmark" dot={false} strokeWidth={1}/></LineChart></ResponsiveContainer></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900"><table className="w-full text-sm"><thead className="bg-slate-950 text-xs text-slate-400"><tr><th className="p-3 text-left">Asset</th><th>Target</th><th>Final</th><th>Valor final</th><th>Contribución</th></tr></thead><tbody>{result.assetSummaries.map(a=><tr key={a.assetId} className="border-t border-slate-800"><td className="p-3 font-bold">{a.ticker}</td><td className="text-center">{(a.targetWeight*100).toFixed(1)}%</td><td className="text-center">{(a.finalWeight*100).toFixed(1)}%</td><td className="text-center font-mono">{a.finalValue.toFixed(2)}</td><td className="text-center">{a.contributionToReturnPct.toFixed(2)}%</td></tr>)}</tbody></table></div>
      <div className="text-xs text-slate-500">Evidence: {result.provenance.portfolioEvidence} · Portfolio fingerprint: <span className="font-mono">{result.provenance.portfolioDatasetFingerprint}</span> · {result.alignedBarsCount} fechas alineadas.</div>
    </>}

    {analytics && <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Analítica real de cartera</h2><p className="text-xs text-slate-400">Pearson y covarianza muestral sobre retornos logarítmicos alineados. Las asignaciones son snapshots al final de la ventana y NO se usan para backtestear retrospectivamente el mismo periodo.</p></div>
      <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Correlación media</div><div className="font-mono text-lg font-bold">{analytics.averagePairwiseCorrelation == null ? 'N/D' : analytics.averagePairwiseCorrelation.toFixed(3)}</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Correlación mínima</div><div className="font-mono text-lg font-bold">{analytics.minPairwiseCorrelation == null ? 'N/D' : analytics.minPairwiseCorrelation.toFixed(3)}</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Observaciones</div><div className="font-mono text-lg font-bold">{analytics.observations}</div></div></div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Corr.</th>{analytics.correlationMatrix.assetIds.map(id=><th key={id} className="p-2">{id}</th>)}</tr></thead><tbody>{analytics.correlationMatrix.assetIds.map((id,i)=><tr key={id} className="border-t border-slate-800"><td className="p-2 font-bold">{id}</td>{analytics.correlationMatrix.values[i].map((v,j)=><td key={j} className="p-2 text-center font-mono">{v.toFixed(3)}</td>)}</tr>)}</tbody></table></div>
      <div className="grid gap-3 lg:grid-cols-4">{Object.entries(allocationSnapshots).map(([method, ws])=><div key={method} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="mb-2 text-[11px] font-bold">{method}</div>{selected.map(id=><div key={id} className="flex justify-between text-xs"><span>{id}</span><span className="font-mono">{((ws[id] ?? 0)*100).toFixed(1)}%</span></div>)}</div>)}</div>
    </div>}
  </div>;
};
