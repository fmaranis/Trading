import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  AssetUniverseScanner,
  DecisionBacktestEngine,
  DecisionBacktestResult,
  EUR_ASSET_UNIVERSE,
  InvestmentDecisionEngine,
  InvestmentDecisionResult,
  InvestorRiskProfile,
  InvestmentHorizonYears
} from '../investment/decision';
import {
  AlphaVantageCrossValidationResult,
  AlphaVantageCrossValidationService,
  AlphaVantageStatus
} from '../investment/data/marketData/alphaVantageCrossValidation';
import { RecommendationEvidencePanel } from './RecommendationEvidencePanel';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function sevenYearsAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 7);
  return isoDate(d);
}
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function confidenceClass(level: string): string {
  return level === 'HIGH'
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : level === 'MEDIUM'
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

export const InteractiveInvestmentDecisionCenter: React.FC = () => {
  const [capital, setCapital] = useState(100);
  const [riskProfile, setRiskProfile] = useState<InvestorRiskProfile>('MEDIUM');
  const [horizon, setHorizon] = useState<InvestmentHorizonYears>(3);
  const [scan, setScan] = useState<AssetUniverseScanResult | null>(null);
  const [result, setResult] = useState<InvestmentDecisionResult | null>(null);
  const [backtest, setBacktest] = useState<DecisionBacktestResult | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMarketRefresh, setLastMarketRefresh] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [alphaStatus, setAlphaStatus] = useState<AlphaVantageStatus | null>(null);
  const [alphaValidation, setAlphaValidation] = useState<AlphaVantageCrossValidationResult | null>(null);
  const [alphaLoading, setAlphaLoading] = useState(false);
  const [alphaError, setAlphaError] = useState<string | null>(null);

  const selectedById = useMemo(() => new Map((scan?.selected ?? []).map(c => [c.asset.assetId, c])), [scan]);
  const allocated = useMemo(() => result?.assets.reduce((s, a) => s + a.amountEur, 0) ?? 0, [result]);

  const runSecondaryValidation = async (scanResult: AssetUniverseScanResult) => {
    setAlphaLoading(true);
    setAlphaError(null);
    setAlphaValidation(null);
    try {
      const status = await AlphaVantageCrossValidationService.getStatus();
      setAlphaStatus(status);
      if (!status.configured) return;
      const validation = await AlphaVantageCrossValidationService.crossValidate(
        scanResult.selected.map(c => ({ ticker: c.asset.ticker, asOfDate: c.asOfDate, lastClose: c.lastClose }))
      );
      setAlphaValidation(validation);
    } catch (e: any) {
      setAlphaError(e?.message || String(e));
    } finally {
      setAlphaLoading(false);
    }
  };

  const refreshMarket = async (forceRefresh: boolean) => {
    setMarketLoading(true);
    setError(null);
    try {
      const scanResult = await AssetUniverseScanner.scan(
        EUR_ASSET_UNIVERSE,
        sevenYearsAgo(),
        isoDate(new Date()),
        { forceRefresh, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 }
      );
      setScan(scanResult);
      setLastMarketRefresh(new Date().toLocaleString('es-ES'));
      void runSecondaryValidation(scanResult);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => { void refreshMarket(false); }, []);

  useEffect(() => {
    if (!scan) return;
    try {
      const next = InvestmentDecisionEngine.decide(scan.dataset, { capitalEur: capital, riskProfile, horizonYears: horizon });
      setResult(next);
      try {
        setBacktest(DecisionBacktestEngine.run(scan.dataset, {
          initialCapital: capital,
          riskProfile,
          horizonYears: horizon,
          commissionPct: 0.05,
          slippagePct: 0.02,
          rebalanceFrequency: 'MONTHLY'
        }));
      } catch { setBacktest(null); }
      setLocalRevision(v => v + 1);
      setError(null);
    } catch (e: any) {
      setResult(null);
      setBacktest(null);
      setError(e?.message || String(e));
    }
  }, [scan, capital, riskProfile, horizon]);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-300"/><h1 className="text-xl sm:text-2xl font-bold text-white">¿Dónde invertir ahora?</h1></div>
          <p className="mt-2 text-sm text-slate-300">Yahoo Finance descarga automáticamente el universo REAL desde el backend. Si configuras Alpha Vantage, la app contrasta automáticamente el shortlist con un segundo proveedor sin exponer tu API key.</p>
        </div>
        {result && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${confidenceClass(result.confidence)}`}>Calidad de evidencia {result.confidence} · {result.confidenceScore}/100</div>}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Capital</span><div className="mt-1 flex items-center gap-2"><input type="number" min="10" step="10" value={capital} onChange={e => setCapital(Math.max(1, Number(e.target.value)))} className="w-full bg-transparent text-xl font-mono font-bold outline-none"/><span>€</span></div></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Riesgo máximo</span><select value={riskProfile} onChange={e => setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value="LOW">Bajo</option><option className="bg-slate-900" value="MEDIUM">Medio</option><option className="bg-slate-900" value="HIGH">Alto</option></select></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Horizonte</span><select value={horizon} onChange={e => setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value={1}>1 año</option><option className="bg-slate-900" value={3}>3 años</option><option className="bg-slate-900" value={5}>5 años</option></select></label>
        <button onClick={() => void refreshMarket(true)} disabled={marketLoading} className="flex min-h-20 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${marketLoading ? 'animate-spin' : ''}`}/>{marketLoading ? 'Actualizando mercado…' : 'Actualizar datos REAL'}</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-400">Yahoo: {lastMarketRefresh ?? 'cargando…'}</span>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Recalculo local #{localRevision}</span>
        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sky-300">Capital/riesgo/horizonte no consumen red</span>
      </div>
    </section>

    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><b>No puedo calcular la decisión.</b> {error}</div>}
    {marketLoading && !scan && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Consultando Yahoo Finance automáticamente y validando el universo EUR…</div>}

    {scan && <section className="rounded-2xl border border-sky-500/20 bg-slate-900 p-5">
      <div className="flex items-center gap-2"><Search className="h-5 w-5 text-sky-400"/><h2 className="font-bold">Embudo de selección</h2></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Universo</div><div className="text-2xl font-bold">{scan.scanned}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Válidos</div><div className="text-2xl font-bold text-emerald-300">{scan.accepted}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Descartados</div><div className="text-2xl font-bold text-rose-300">{scan.rejected}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Shortlist</div><div className="text-2xl font-bold text-indigo-300">{scan.selected.length}</div></div>
      </div>
    </section>}

    {scan && <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-5">
      <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-cyan-300"/><h2 className="font-bold">Validación cruzada de proveedores</h2></div>
      {alphaLoading && <div className="mt-3 text-sm text-slate-400">Contrastando automáticamente los candidatos finales con Alpha Vantage…</div>}
      {!alphaLoading && alphaStatus && !alphaStatus.configured && <div className="mt-3 text-sm text-amber-300">Alpha Vantage no está configurado. Yahoo sigue funcionando como proveedor primario. Añade `ALPHA_VANTAGE_API_KEY` como secreto del backend para activar el contraste automático.</div>}
      {alphaError && <div className="mt-3 text-sm text-amber-300">Alpha Vantage no pudo completar el contraste: {alphaError}. La recomendación sigue usando Yahoo, sin fallback sintético.</div>}
      {alphaValidation && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
          <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Solicitados</div><b>{alphaValidation.requested}</b></div>
          <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Comparables</div><b>{alphaValidation.checked}</b></div>
          <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Coinciden ≤1%</div><b className="text-emerald-300">{alphaValidation.matched}</b></div>
          <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Divergencias</div><b className={alphaValidation.divergent ? 'text-rose-300' : 'text-emerald-300'}>{alphaValidation.divergent}</b></div>
        </div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Yahoo</th><th className="p-2 text-left">Alpha</th><th className="p-2 text-left">Estado</th><th className="p-2 text-right">Yahoo cierre</th><th className="p-2 text-right">Alpha cierre</th><th className="p-2 text-right">Diferencia</th></tr></thead><tbody>{alphaValidation.results.map(r => <tr key={r.ticker} className="border-t border-slate-800"><td className="p-2 font-mono">{r.ticker}</td><td className="p-2 font-mono">{r.alphaSymbol ?? '—'}</td><td className="p-2">{r.status}</td><td className="p-2 text-right">{r.yahooClose?.toFixed(2) ?? '—'}</td><td className="p-2 text-right">{r.alphaClose?.toFixed(2) ?? '—'}</td><td className="p-2 text-right">{r.differencePct != null ? `${r.differencePct.toFixed(2)}%` : '—'}</td></tr>)}</tbody></table></div>
      </>}
    </section>}

    {result && <>
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><Clock3 className="h-4 w-4 text-sky-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Datos hasta</div><div className="font-mono font-bold">{result.asOfDate}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método</div><div className="font-bold text-sm">{result.recommendedMethod}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WalletCards className="h-4 w-4 text-amber-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Efectivo</div><div className="font-mono font-bold">{result.cashAmountEur.toFixed(2)} €</div><div className="text-xs text-slate-500">{pct(result.cashWeight)}</div></div>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
        <h2 className="font-bold text-emerald-100">Propuesta actual</h2>
        <p className="mt-1 text-sm text-slate-200">{result.summary}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.assets.filter(a => a.amountEur >= 0.01).map(asset => {
            const c = selectedById.get(asset.assetId);
            const price = c?.lastClose ?? 0;
            const shares = price > 0 ? asset.amountEur / price : null;
            return <div key={asset.assetId} className="rounded-xl border border-slate-700 bg-slate-950/80 p-4"><div className="font-bold">{asset.ticker}</div><div className="text-[11px] text-slate-400">{asset.name}</div><div className="mt-3 flex justify-between"><span className="font-mono text-xl font-bold">{asset.amountEur.toFixed(2)} €</span><span className="text-indigo-300">{pct(asset.weight)}</span></div><div className="mt-1 text-[10px] text-slate-500">Cierre {price ? `${price.toFixed(2)} €` : 'N/D'} · {shares == null ? 'N/D' : `${shares.toFixed(4)} títulos teóricos`}</div></div>;
          })}
          <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4"><div className="font-bold">EFECTIVO</div><div className="mt-3 font-mono text-xl font-bold">{result.cashAmountEur.toFixed(2)} €</div></div>
        </div>
        <div className="mt-3 text-xs text-slate-500">Asignado {allocated.toFixed(2)} € · total {(allocated + result.cashAmountEur).toFixed(2)} €</div>
      </section>

      {scan && <RecommendationEvidencePanel scan={scan} />}

      {backtest && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Backtest de la política actual</h3><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5 text-sm"><div>Final<br/><b>{backtest.finalEquity.toFixed(2)} €</b></div><div>Retorno<br/><b>{backtest.totalReturnPct.toFixed(1)}%</b></div><div>Max DD<br/><b>{backtest.maxDrawdownPct.toFixed(1)}%</b></div><div>Trades<br/><b>{backtest.totalTrades}</b></div><div>Costes<br/><b>{backtest.totalTradingCostsEur.toFixed(2)} €</b></div></div></section>}
    </>}
  </div>;
};
