import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  AssetUniverseScanner,
  DecisionBacktestEngine,
  DecisionBacktestResult,
  EUR_ASSET_UNIVERSE,
  InvestmentDecisionEngine,
  InvestmentDecisionResult,
  InvestorRiskProfile,
  InvestmentHorizonYears,
  UserPortfolioService
} from '../investment/decision';
import { AlphaVantageCrossValidationResult, AlphaVantageCrossValidationService, AlphaVantageStatus } from '../investment/data/marketData/alphaVantageCrossValidation';
import { EodhdCrossValidationResult, EodhdCrossValidationService, EodhdStatus } from '../investment/data/marketData/eodhdCrossValidation';
import { RecommendationEvidencePanel } from './RecommendationEvidencePanel';
import { MarketUtilityDashboard } from './MarketUtilityDashboard';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function sevenYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 7); return isoDate(d); }
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function confidenceClass(level: string): string {
  return level === 'HIGH' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : level === 'MEDIUM' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}
function portfolioDeployableCapital(): number {
  const p = UserPortfolioService.load();
  return Math.max(1, (p.stagedCapitalPlan?.availableEur ?? 0) + p.cashEur);
}

export const InteractiveInvestmentDecisionCenter: React.FC = () => {
  const [capital, setCapital] = useState(() => portfolioDeployableCapital());
  const [riskProfile, setRiskProfile] = useState<InvestorRiskProfile>('MEDIUM');
  const [horizon, setHorizon] = useState<InvestmentHorizonYears>(3);
  const [scan, setScan] = useState<AssetUniverseScanResult | null>(null);
  const [result, setResult] = useState<InvestmentDecisionResult | null>(null);
  const [backtest, setBacktest] = useState<DecisionBacktestResult | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMarketRefresh, setLastMarketRefresh] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [eodhdStatus, setEodhdStatus] = useState<EodhdStatus | null>(null);
  const [eodhdValidation, setEodhdValidation] = useState<EodhdCrossValidationResult | null>(null);
  const [eodhdLoading, setEodhdLoading] = useState(false);
  const [eodhdError, setEodhdError] = useState<string | null>(null);
  const [alphaStatus, setAlphaStatus] = useState<AlphaVantageStatus | null>(null);
  const [alphaValidation, setAlphaValidation] = useState<AlphaVantageCrossValidationResult | null>(null);
  const [alphaLoading, setAlphaLoading] = useState(false);
  const [alphaError, setAlphaError] = useState<string | null>(null);

  const shortlistPayload = (scanResult: AssetUniverseScanResult) => scanResult.selected
    .filter(c => c.asset.instrumentType !== 'MUTUAL_FUND')
    .map(c => ({ ticker: c.asset.ticker, asOfDate: c.asOfDate, lastClose: c.lastClose }));

  const runAlphaReserveValidation = async (scanResult: AssetUniverseScanResult) => {
    const payload = shortlistPayload(scanResult);
    if (!payload.length) return;
    setAlphaLoading(true); setAlphaError(null); setAlphaValidation(null);
    try {
      const status = await AlphaVantageCrossValidationService.getStatus();
      setAlphaStatus(status);
      if (!status.configured) return;
      setAlphaValidation(await AlphaVantageCrossValidationService.crossValidate(payload));
    } catch (e: any) { setAlphaError(e?.message || String(e)); }
    finally { setAlphaLoading(false); }
  };

  const runSecondaryValidation = async (scanResult: AssetUniverseScanResult) => {
    const payload = shortlistPayload(scanResult);
    if (!payload.length) return;
    setEodhdLoading(true); setEodhdError(null); setEodhdValidation(null); setAlphaValidation(null); setAlphaError(null);
    try {
      const status = await EodhdCrossValidationService.getStatus();
      setEodhdStatus(status);
      if (!status.configured) { void runAlphaReserveValidation(scanResult); return; }
      const validation = await EodhdCrossValidationService.crossValidate(payload);
      setEodhdValidation(validation);
      if (validation.summaryState !== 'AVAILABLE' || validation.divergent > 0) void runAlphaReserveValidation(scanResult);
      else { try { setAlphaStatus(await AlphaVantageCrossValidationService.getStatus()); } catch {} }
    } catch (e: any) {
      setEodhdError(e?.message || String(e));
      void runAlphaReserveValidation(scanResult);
    } finally { setEodhdLoading(false); }
  };

  const refreshMarket = async (forceRefresh: boolean) => {
    setMarketLoading(true); setError(null);
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
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setMarketLoading(false); }
  };

  useEffect(() => { void refreshMarket(false); }, []);
  useEffect(() => {
    const sync = () => setCapital(prev => { const next = portfolioDeployableCapital(); return Math.abs(prev - next) > 0.01 ? next : prev; });
    const id = window.setInterval(sync, 1000);
    window.addEventListener('focus', sync);
    return () => { window.clearInterval(id); window.removeEventListener('focus', sync); };
  }, []);
  useEffect(() => {
    if (!scan) return;
    try {
      const next = InvestmentDecisionEngine.decide(scan.dataset, { capitalEur: capital, riskProfile, horizonYears: horizon });
      setResult(next);
      try {
        setBacktest(DecisionBacktestEngine.run(scan.dataset, { initialCapital: capital, riskProfile, horizonYears: horizon, commissionPct: 0.05, slippagePct: 0.02, rebalanceFrequency: 'MONTHLY' }));
      } catch { setBacktest(null); }
      setLocalRevision(v => v + 1); setError(null);
    } catch (e: any) { setResult(null); setBacktest(null); setError(e?.message || String(e)); }
  }, [scan, capital, riskProfile, horizon]);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-300"/><h1 className="text-xl sm:text-2xl font-bold text-white">¿Dónde invertir ahora?</h1></div><p className="mt-2 text-sm text-slate-300">Fondos y ETFs/ETCs se analizan juntos. El ranking completo muestra todos los candidatos válidos; el shortlist es solo el subconjunto diversificado usado por el asignador.</p></div>
        {result && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${confidenceClass(result.confidence)}`}>Calidad de evidencia {result.confidence} · {result.confidenceScore}/100</div>}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3"><span className="text-[10px] uppercase text-emerald-300">Capital disponible · Mi cartera real</span><div className="mt-1 text-xl font-mono font-bold">{capital.toFixed(2)} €</div><div className="mt-1 text-[10px] text-slate-400">Efectivo libre + capital pendiente.</div></div>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Riesgo máximo</span><select value={riskProfile} onChange={e=>setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value="LOW">Bajo</option><option className="bg-slate-900" value="MEDIUM">Medio</option><option className="bg-slate-900" value="HIGH">Alto</option></select></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Horizonte</span><select value={horizon} onChange={e=>setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value={1}>1 año</option><option className="bg-slate-900" value={3}>3 años</option><option className="bg-slate-900" value={5}>5 años</option></select></label>
      </div>
      <button onClick={()=>void refreshMarket(true)} disabled={marketLoading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${marketLoading?'animate-spin':''}`}/>{marketLoading?'Actualizando universo…':'Actualizar datos REAL'}</button>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-400">Mercado: {lastMarketRefresh??'cargando…'}</span><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Recalculo local #{localRevision}</span></div>
    </section>

    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><b>No puedo calcular la decisión.</b> {error}</div>}
    {marketLoading && !scan && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">Consultando el universo unificado de fondos y ETFs…</div>}

    {result && <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Datos hasta</div><div className="mt-1 font-mono font-bold">{result.asOfDate}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método</div><div className="font-bold text-sm">{result.recommendedMethod}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WalletCards className="h-4 w-4 text-amber-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Efectivo objetivo</div><div className="font-mono font-bold">{pct(result.cashWeight)}</div></div>
    </section>}

    {scan && <RecommendationEvidencePanel scan={scan}/>} 
    {scan && result && <MarketUtilityDashboard scan={scan} decision={result} eodhdValidation={eodhdValidation}/>} 
    {scan && result && <PortfolioExecutionPlanPanel scan={scan} decision={result}/>} 

    {scan && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Cobertura y proveedores</h2><p className="mt-1 text-[11px] text-slate-500">Detalle técnico secundario; no es otra recomendación.</p></div><div className="text-xs text-slate-400">{scan.accepted}/{scan.scanned} válidos · shortlist {scan.selected.length}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-emerald-300">Yahoo</b><div className="mt-1 text-slate-500">ETFs/ETCs · principal</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-cyan-300">EODHD</b><div className="mt-1 text-slate-500">Fondos + contraste ETFs · {eodhdLoading?'validando':eodhdValidation?.summaryState??(eodhdStatus?.configured?'listo':'no configurado')}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-slate-300">Alpha Vantage</b><div className="mt-1 text-slate-500">Reserva ETFs · {alphaLoading?'validando':alphaValidation?.summaryState??(alphaStatus?.configured?'listo':'no configurado')}</div></div>
      </div>
      {(eodhdError || alphaError) && <div className="mt-3 text-xs text-amber-300">{[eodhdError, alphaError].filter(Boolean).join(' · ')}</div>}
    </section>}

    {backtest && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Backtest de la política de asignación</h3><div className="mt-1 text-[10px] text-slate-500">Validación de la política cuantitativa, separada de la cartera personal y de su fiscalidad.</div><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5 text-sm"><div>Final<br/><b>{backtest.finalEquity.toFixed(2)} €</b></div><div>Retorno<br/><b>{backtest.totalReturnPct.toFixed(1)}%</b></div><div>Max DD<br/><b>{backtest.maxDrawdownPct.toFixed(1)}%</b></div><div>Trades<br/><b>{backtest.totalTrades}</b></div><div>Costes<br/><b>{backtest.totalTradingCostsEur.toFixed(2)} €</b></div></div></section>}
  </div>;
};
