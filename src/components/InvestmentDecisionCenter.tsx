import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  AssetUniverseScanner,
  DecisionAlert,
  DecisionBacktestEngine,
  DecisionBacktestResult,
  DecisionHistoryEntry,
  DecisionHistoryService,
  EUR_ASSET_UNIVERSE,
  InvestmentDecisionEngine,
  InvestmentDecisionResult,
  InvestorRiskProfile,
  InvestmentHorizonYears
} from '../investment/decision';
import { MultiAssetDataAligner } from '../investment/portfolioBacktesting';
import { DeterministicPortfolioAllocator } from '../investment/portfolioAnalytics';

type MethodSnapshot = { method: string; description: string; top: string; cashPct: number };

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function historyStart(horizon: InvestmentHorizonYears): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - Math.max(5, horizon + 2));
  return isoDate(d);
}
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function confidenceClass(level: string): string {
  return level === 'HIGH' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : level === 'MEDIUM' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

export const InvestmentDecisionCenter: React.FC = () => {
  const [capital, setCapital] = useState(100);
  const [riskProfile, setRiskProfile] = useState<InvestorRiskProfile>('MEDIUM');
  const [horizon, setHorizon] = useState<InvestmentHorizonYears>(3);
  const [result, setResult] = useState<InvestmentDecisionResult | null>(null);
  const [scan, setScan] = useState<AssetUniverseScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionHistoryEntry[]>(() => DecisionHistoryService.load());
  const [alerts, setAlerts] = useState<DecisionAlert[]>([]);
  const [backtest, setBacktest] = useState<DecisionBacktestResult | null>(null);
  const [methodSnapshots, setMethodSnapshots] = useState<MethodSnapshot[]>([]);

  const allocated = useMemo(() => result?.assets.reduce((s, a) => s + a.amountEur, 0) ?? 0, [result]);
  const selectedById = useMemo(() => new Map((scan?.selected ?? []).map(x => [x.asset.assetId, x])), [scan]);

  const analyze = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const endDate = isoDate(new Date());
      const startDate = historyStart(horizon);
      const scanResult = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, startDate, endDate, {
        forceRefresh,
        concurrency: 3,
        maxSelected: 8,
        minimumBars: 252,
        maxDataAgeDays: 7
      });
      setScan(scanResult);

      const decision = InvestmentDecisionEngine.decide(scanResult.dataset, { capitalEur: capital, riskProfile, horizonYears: horizon });
      const previous = DecisionHistoryService.load()[0] ?? null;
      setAlerts(DecisionHistoryService.detectAlerts(previous, decision));
      setHistory(DecisionHistoryService.save(decision));
      setResult(decision);

      try {
        setBacktest(DecisionBacktestEngine.run(scanResult.dataset, { initialCapital: capital, riskProfile, horizonYears: horizon, commissionPct: 0.05, slippagePct: 0.02, rebalanceFrequency: 'MONTHLY' }));
      } catch { setBacktest(null); }

      const aligned = MultiAssetDataAligner.align(scanResult.dataset, 'INTERSECTION');
      const lookback = horizon === 1 ? 60 : horizon === 3 ? 120 : 180;
      const methods = [
        { method: 'EQUAL_WEIGHT' as const, description: 'Mismo peso para todos' },
        { method: 'INVERSE_VOLATILITY' as const, description: 'Más peso a menor volatilidad' },
        { method: 'RISK_PARITY_ERC' as const, description: 'Equilibra contribución al riesgo' },
        { method: 'RELATIVE_MOMENTUM' as const, description: 'Prioriza momentum positivo' }
      ];
      setMethodSnapshots(methods.map(m => {
        const allocation = DeterministicPortfolioAllocator.allocate(aligned, { method: m.method, lookbackBars: lookback, topK: 3, minimumMomentumPct: 0 });
        const top = Object.entries(allocation.weights).filter(([, w]) => w > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, w]) => `${id} ${(w * 100).toFixed(0)}%`).join(' · ');
        return { method: m.method, description: m.description, top: top || '100% efectivo', cashPct: allocation.cashWeight * 100 };
      }));
    } catch (e: any) {
      setResult(null);
      setBacktest(null);
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { void analyze(false); /* initial scan only */ /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-300"/><h1 className="text-xl sm:text-2xl font-bold text-white">¿Dónde invertir ahora?</h1></div>
          <p className="mt-2 text-sm text-slate-300">La app ya no parte de cinco activos fijos. Escanea un universo EUR amplio, elimina datos inválidos y selecciona candidatos diversificados antes de construir la cartera.</p>
        </div>
        {result && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${confidenceClass(result.confidence)}`}>Confianza {result.confidence} · {result.confidenceScore}/100</div>}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Capital</span><div className="mt-1 flex items-center gap-2"><input type="number" min="10" step="10" value={capital} onChange={e => setCapital(Math.max(1, Number(e.target.value)))} className="w-full bg-transparent text-xl font-mono font-bold outline-none"/><span>€</span></div></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Riesgo máximo</span><select value={riskProfile} onChange={e => setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value="LOW">Bajo</option><option className="bg-slate-900" value="MEDIUM">Medio</option><option className="bg-slate-900" value="HIGH">Alto</option></select></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Horizonte</span><select value={horizon} onChange={e => setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value={1}>1 año</option><option className="bg-slate-900" value={3}>3 años</option><option className="bg-slate-900" value={5}>5 años</option></select></label>
        <button onClick={() => void analyze(true)} disabled={loading} className="flex min-h-20 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>{loading ? 'Escaneando mercado…' : 'Escanear y decidir'}</button>
      </div>
    </section>

    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><b>No puedo emitir una asignación fiable.</b> {error}</div>}
    {loading && !scan && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Consultando Yahoo Finance y validando el universo EUR…</div>}

    {scan && <section className="rounded-2xl border border-sky-500/20 bg-slate-900 p-5">
      <div className="flex items-center gap-2"><Search className="h-5 w-5 text-sky-400"/><h2 className="font-bold">Embudo de selección</h2></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Universo</div><div className="text-2xl font-bold">{scan.scanned}</div><div className="text-xs text-slate-500">instrumentos consultados</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Válidos</div><div className="text-2xl font-bold text-emerald-300">{scan.accepted}</div><div className="text-xs text-slate-500">datos EUR, suficientes y recientes</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Descartados</div><div className="text-2xl font-bold text-rose-300">{scan.rejected}</div><div className="text-xs text-slate-500">ticker, divisa, histórico o frescura</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Candidatos finales</div><div className="text-2xl font-bold text-indigo-300">{scan.selected.length}</div><div className="text-xs text-slate-500">máximo 2 por categoría</div></div>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Ticker</th><th className="p-2 text-left">Categoría</th><th className="p-2 text-right">Score</th><th className="p-2 text-right">Mom. 120d</th><th className="p-2 text-right">Vol.</th><th className="p-2 text-right">DD</th></tr></thead><tbody>{scan.candidates.filter(c => c.status === 'ACCEPTED').sort((a,b)=>(b.score ?? -999)-(a.score ?? -999)).slice(0,15).map((c,i)=><tr key={c.asset.assetId} className={scan.selected.some(s=>s.asset.assetId===c.asset.assetId)?'bg-indigo-500/10':'border-t border-slate-800'}><td className="p-2">{i+1}</td><td className="p-2 font-mono">{c.asset.ticker}</td><td className="p-2">{c.asset.category}</td><td className="p-2 text-right font-mono">{c.score?.toFixed(2)}</td><td className="p-2 text-right">{c.momentum120Pct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.annualizedVolatilityPct?.toFixed(1) ?? 'N/D'}%</td><td className="p-2 text-right">{c.maxDrawdownPct?.toFixed(1) ?? 'N/D'}%</td></tr>)}</tbody></table></div>
      {Object.keys(scan.rejectionCounts).length > 0 && <div className="mt-3 text-xs text-slate-500">Descartes: {Object.entries(scan.rejectionCounts).map(([k,v])=>`${k}: ${v}`).join(' · ')}</div>}
    </section>}

    {result && <>
      {alerts.length > 0 && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{alerts.map(a=><div key={a.id}>• {a.message}</div>)}</section>}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><Clock3 className="h-4 w-4 text-sky-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Datos hasta</div><div className="font-mono font-bold">{result.asOfDate}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método final</div><div className="font-bold text-sm">{result.recommendedMethod}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WalletCards className="h-4 w-4 text-amber-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Efectivo</div><div className="font-mono font-bold">{result.cashAmountEur.toFixed(2)} €</div><div className="text-xs text-slate-500">{pct(result.cashWeight)}</div></div>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400"/><div><h2 className="font-bold text-emerald-100">Propuesta tras escanear el mercado</h2><p className="mt-1 text-sm text-slate-200">{result.summary}</p></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{result.assets.filter(a=>a.amountEur>=0.01).map(asset=>{const c=selectedById.get(asset.assetId); const price=c?.lastClose ?? 0; const shares=price>0?asset.amountEur/price:null; return <div key={asset.assetId} className="rounded-xl border border-slate-700 bg-slate-950/80 p-4"><div className="font-bold">{asset.ticker}</div><div className="text-[11px] text-slate-400">{asset.name}</div><div className="mt-3 flex justify-between"><span className="font-mono text-xl font-bold">{asset.amountEur.toFixed(2)} €</span><span className="text-indigo-300">{pct(asset.weight)}</span></div><div className="mt-1 text-[10px] text-slate-500">Cierre {price?`${price.toFixed(2)} €`:'N/D'} · {shares==null?'N/D':`${shares.toFixed(4)} participaciones`}</div>{shares!=null&&shares<1&&<div className="mt-2 text-[10px] text-amber-300">Requiere fraccionamiento si se ejecuta con este capital.</div>}</div>})}<div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4"><div className="font-bold">EFECTIVO</div><div className="mt-3 font-mono text-xl font-bold">{result.cashAmountEur.toFixed(2)} €</div></div></div>
        <div className="mt-3 text-xs text-slate-500">Asignado: {allocated.toFixed(2)} € · Total: {(allocated+result.cashAmountEur).toFixed(2)} € · Fingerprint {result.portfolioDatasetFingerprint}</div>
      </section>

      {backtest && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Backtest causal del recomendador</h3><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5 text-sm"><div>Final<br/><b>{backtest.finalEquity.toFixed(2)} €</b></div><div>Retorno<br/><b>{backtest.totalReturnPct.toFixed(1)}%</b></div><div>Max DD<br/><b>{backtest.maxDrawdownPct.toFixed(1)}%</b></div><div>Trades<br/><b>{backtest.totalTrades}</b></div><div>Costes<br/><b>{backtest.totalTradingCostsEur.toFixed(2)} €</b></div></div></section>}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Comparación de métodos sobre los candidatos seleccionados</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{methodSnapshots.map(m=><div key={m.method} className={`rounded-xl border p-3 ${m.method===result.recommendedMethod?'border-indigo-500/40 bg-indigo-500/10':'border-slate-800 bg-slate-950'}`}><div className="font-mono text-xs font-bold">{m.method}</div><div className="text-xs text-slate-400">{m.description}</div><div className="mt-2 text-sm">{m.top}</div></div>)}</div></section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Historial local</h3><div className="mt-2 text-xs text-slate-500">{history.length} decisiones guardadas en este navegador.</div></section>
    </>}
  </div>;
};
