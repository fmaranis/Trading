import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { HistoricalMarketDataService } from '../investment/data/marketData/historicalMarketDataService';
import { InvestmentDecisionEngine, InvestmentDecisionResult, InvestorRiskProfile, InvestmentHorizonYears } from '../investment/decision';

const UNIVERSE = [
  { assetId: 'VWCE', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', currency: 'EUR' },
  { assetId: 'EQQQ', ticker: 'EQQQ.DE', name: 'Invesco EQQQ Nasdaq-100 UCITS ETF', currency: 'EUR' },
  { assetId: '4GLD', ticker: '4GLD.DE', name: 'Xetra-Gold / Gold ETC EUR listing', currency: 'EUR' },
  { assetId: 'VAGF', ticker: 'VAGF.DE', name: 'Vanguard Global Aggregate Bond UCITS EUR Hedged', currency: 'EUR' },
  { assetId: 'XEON', ticker: 'XEON.DE', name: 'Xtrackers EUR Overnight Rate Swap UCITS ETF', currency: 'EUR' }
] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function historyStart(horizon: InvestmentHorizonYears): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - Math.max(5, horizon + 2));
  return isoDate(d);
}

function confidenceClass(level: string): string {
  if (level === 'HIGH') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  if (level === 'MEDIUM') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
}

function actionLabel(action: string): string {
  if (action === 'PRIORITIZE') return 'PRIORIZAR';
  if (action === 'SECONDARY') return 'SECUNDARIO';
  return 'SIN ASIGNACIÓN';
}

export const InvestmentDecisionCenter: React.FC = () => {
  const [capital, setCapital] = useState(100);
  const [riskProfile, setRiskProfile] = useState<InvestorRiskProfile>('MEDIUM');
  const [horizon, setHorizon] = useState<InvestmentHorizonYears>(3);
  const [result, setResult] = useState<InvestmentDecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrices, setLastPrices] = useState<Record<string, number>>({});

  const allocated = useMemo(() => result?.assets.reduce((s, a) => s + a.amountEur, 0) ?? 0, [result]);

  const analyze = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const endDate = isoDate(new Date());
      const startDate = historyStart(horizon);
      const responses = await Promise.all(UNIVERSE.map(asset => HistoricalMarketDataService.getHistoricalBars({
        symbol: asset.ticker,
        startDate,
        endDate,
        timeframe: '1d',
        adjusted: true
      }, { forceRefresh })));

      const prices: Record<string, number> = {};
      const dataset = {
        timeframe: '1d',
        assets: UNIVERSE.map((asset, i) => {
          const response = responses[i];
          const providerCurrency = response.metadata.currency;
          if (providerCurrency && providerCurrency !== 'EUR') {
            throw new Error(`${asset.ticker} devuelve divisa ${providerCurrency}; se bloquea la decisión para evitar FX implícito.`);
          }
          prices[asset.assetId] = response.bars[response.bars.length - 1].close;
          return {
            assetId: asset.assetId,
            ticker: asset.ticker,
            name: asset.name,
            currency: 'EUR',
            bars: response.bars,
            provenance: response.provenance
          };
        })
      };

      const decision = InvestmentDecisionEngine.decide(dataset, {
        capitalEur: capital,
        riskProfile,
        horizonYears: horizon
      });
      setLastPrices(prices);
      setResult(decision);
    } catch (e: any) {
      setResult(null);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void analyze(false);
    // Initial analysis only; user inputs trigger explicitly to avoid repeated provider calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-300" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">¿Dónde invertir ahora?</h1>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Convierte los últimos datos diarios disponibles en una asignación concreta y auditable. No es trading intradía: la fecha del último cierre usado aparece siempre visible.
            </p>
          </div>
          {result && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${confidenceClass(result.confidence)}`}>
            Confianza {result.confidence} · {result.confidenceScore}/100
          </div>}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Capital</span>
            <div className="mt-1 flex items-center gap-2"><input type="number" min="10" step="10" value={capital} onChange={e => setCapital(Math.max(1, Number(e.target.value)))} className="w-full bg-transparent text-xl font-mono font-bold outline-none"/><span className="text-slate-400">€</span></div>
          </label>
          <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Riesgo máximo</span>
            <select value={riskProfile} onChange={e => setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none">
              <option className="bg-slate-900" value="LOW">Bajo</option>
              <option className="bg-slate-900" value="MEDIUM">Medio</option>
              <option className="bg-slate-900" value="HIGH">Alto</option>
            </select>
          </label>
          <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Horizonte</span>
            <select value={horizon} onChange={e => setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none">
              <option className="bg-slate-900" value={1}>1 año</option>
              <option className="bg-slate-900" value={3}>3 años</option>
              <option className="bg-slate-900" value={5}>5 años</option>
            </select>
          </label>
          <button onClick={() => void analyze(true)} disabled={loading} className="flex min-h-20 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analizando…' : 'Analizar mercado'}
          </button>
        </div>
      </section>

      {error && <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle className="h-5 w-5 shrink-0"/><div><div className="font-bold">No puedo emitir una asignación fiable</div><div className="mt-1">{error}</div></div></div>}

      {loading && !result && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Descargando y validando datos reales de los cinco activos EUR…</div>}

      {result && <>
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><Clock3 className="h-4 w-4 text-sky-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Datos hasta</div><div className="font-mono font-bold">{result.asOfDate}</div><div className="text-xs text-slate-500">Antigüedad: {result.dataAgeDays} días</div></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div><div className="text-xs text-slate-500">Tendencia {result.regimeTrendPct == null ? 'N/D' : `${result.regimeTrendPct.toFixed(1)}%`}</div></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método</div><div className="font-bold text-sm">{result.recommendedMethod}</div><div className="text-xs text-slate-500">Perfil {result.riskProfile} · {result.horizonYears} años</div></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WalletCards className="h-4 w-4 text-amber-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Efectivo</div><div className="font-mono font-bold">{result.cashAmountEur.toFixed(2)} €</div><div className="text-xs text-slate-500">{(result.cashWeight * 100).toFixed(0)}% sin invertir</div></div>
        </section>

        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400 shrink-0"/><div><h2 className="font-bold text-emerald-100">Propuesta con los últimos datos disponibles</h2><p className="mt-1 text-sm text-slate-200">{result.summary}</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.assets.filter(a => a.amountEur >= 0.01).map(asset => <div key={asset.assetId} className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{asset.ticker}</div><div className="text-[11px] text-slate-400">{asset.name}</div></div><span className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-300">{actionLabel(asset.action)}</span></div>
              <div className="mt-3 flex items-end justify-between"><div className="font-mono text-xl font-bold text-white">{asset.amountEur.toFixed(2)} €</div><div className="font-mono text-sm text-indigo-300">{(asset.weight * 100).toFixed(1)}%</div></div>
              <div className="mt-1 text-[10px] text-slate-500">Último cierre: {lastPrices[asset.assetId]?.toFixed(2) ?? 'N/D'} EUR · Score {asset.score.toFixed(0)}/100</div>
              <ul className="mt-3 space-y-1 text-[11px] text-slate-400">{asset.rationale.slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}</ul>
            </div>)}
            <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
              <div className="font-bold">EFECTIVO</div><div className="text-[11px] text-slate-400">Reserva no invertida</div>
              <div className="mt-3 flex items-end justify-between"><div className="font-mono text-xl font-bold">{result.cashAmountEur.toFixed(2)} €</div><div className="font-mono text-sm text-amber-300">{(result.cashWeight * 100).toFixed(1)}%</div></div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Asignado a activos: {allocated.toFixed(2)} € · Total con efectivo: {(allocated + result.cashAmountEur).toFixed(2)} €</div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-bold">Por qué sale esta cartera</h3><ul className="mt-3 space-y-2 text-sm text-slate-400">{result.methodology.map((m, i) => <li key={i}>• {m}</li>)}</ul></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-bold">Controles y advertencias</h3><div className="mt-2 text-xs text-slate-500">Evidence: {result.evidence} · Fingerprint <span className="font-mono">{result.portfolioDatasetFingerprint}</span></div>{result.warnings.length ? <ul className="mt-3 space-y-2 text-sm text-amber-300">{result.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul> : <p className="mt-3 text-sm text-emerald-300">No se han detectado advertencias de frescura o integridad que bloqueen el análisis.</p>}<p className="mt-4 text-[11px] text-slate-500">Herramienta experimental de investigación cuantitativa. No garantiza rentabilidad ni sustituye asesoramiento financiero personalizado.</p></div>
        </section>
      </>}
    </div>
  );
};
