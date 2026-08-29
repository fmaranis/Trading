import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  AssetUniverseScanner,
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
import { DecisionGuardrailsPanel } from './DecisionGuardrailsPanel';

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
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMarketRefresh, setLastMarketRefresh] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [showResearchDetails, setShowResearchDetails] = useState(false);
  const [showPortfolioFlow, setShowPortfolioFlow] = useState(false);
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

  const runSecondaryValidation = async () => {
    if (!scan) return;
    const payload = shortlistPayload(scan);
    if (!payload.length) return;
    setEodhdLoading(true); setEodhdError(null); setEodhdValidation(null); setAlphaValidation(null); setAlphaError(null);
    try {
      const status = await EodhdCrossValidationService.getStatus();
      setEodhdStatus(status);
      if (!status.configured) { void runAlphaReserveValidation(scan); return; }
      const validation = await EodhdCrossValidationService.crossValidate(payload);
      setEodhdValidation(validation);
      if (validation.summaryState !== 'AVAILABLE' || validation.divergent > 0) void runAlphaReserveValidation(scan);
      else { try { setAlphaStatus(await AlphaVantageCrossValidationService.getStatus()); } catch {} }
    } catch (e: any) {
      setEodhdError(e?.message || String(e));
      void runAlphaReserveValidation(scan);
    } finally { setEodhdLoading(false); }
  };

  const refreshMarket = async (forceRefresh: boolean) => {
    if (marketLoading) return;
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
      setEodhdValidation(null); setAlphaValidation(null);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setMarketLoading(false); }
  };

  useEffect(() => {
    const sync = () => setCapital(prev => {
      const next = portfolioDeployableCapital();
      return Math.abs(prev - next) > 0.01 ? next : prev;
    });
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  useEffect(() => {
    if (!scan) return;
    try {
      setResult(InvestmentDecisionEngine.decide(scan.dataset, { capitalEur: capital, riskProfile, horizonYears: horizon }));
      setLocalRevision(v => v + 1); setError(null);
    } catch (e: any) { setResult(null); setError(e?.message || String(e)); }
  }, [scan, capital, riskProfile, horizon]);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-300"/><h1 className="text-xl sm:text-2xl font-bold text-white">¿Dónde invertir ahora?</h1></div><p className="mt-2 text-sm text-slate-300">La pantalla abre sin lanzar cálculos ni peticiones de mercado automáticamente. Carga los datos REAL cuando quieras y después revisa los filtros de efectivo, costes y MyInvestor.</p></div>
        {result && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${confidenceClass(result.confidence)}`}>Calidad de evidencia {result.confidence} · {result.confidenceScore}/100</div>}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3"><span className="text-[10px] uppercase text-emerald-300">Capital disponible · Mi cartera real</span><div className="mt-1 text-xl font-mono font-bold">{capital.toFixed(2)} €</div><div className="mt-1 text-[10px] text-slate-400">Efectivo libre + capital pendiente.</div></div>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Riesgo máximo</span><select value={riskProfile} onChange={e=>setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value="LOW">Bajo</option><option className="bg-slate-900" value="MEDIUM">Medio</option><option className="bg-slate-900" value="HIGH">Alto</option></select></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Horizonte</span><select value={horizon} onChange={e=>setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value={1}>1 año</option><option className="bg-slate-900" value={3}>3 años</option><option className="bg-slate-900" value={5}>5 años</option></select></label>
      </div>
      <button onClick={()=>void refreshMarket(Boolean(scan))} disabled={marketLoading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${marketLoading?'animate-spin':''}`}/>{marketLoading?'Cargando universo REAL…':scan?'Actualizar datos REAL':'Cargar datos REAL'}</button>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-400">Mercado: {lastMarketRefresh??'sin cargar'}</span><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Recalculo local #{localRevision}</span></div>
    </section>

    {!scan && !marketLoading && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">La app está lista. No se ejecutará ninguna carga pesada hasta que pulses <b>Cargar datos REAL</b>.</div>}
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><b>No puedo calcular la decisión.</b> {error}</div>}
    {marketLoading && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">Cargando 38 instrumentos con histórico REAL. La interfaz permanece separada de esta tarea.</div>}

    {result && <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Datos hasta</div><div className="mt-1 font-mono font-bold">{result.asOfDate}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método</div><div className="font-bold text-sm">{result.recommendedMethod}</div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WalletCards className="h-4 w-4 text-amber-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Efectivo objetivo</div><div className="font-mono font-bold">{pct(result.cashWeight)}</div></div>
    </section>}

    {scan && <DecisionGuardrailsPanel scan={scan} capitalEur={capital} riskProfile={riskProfile} horizonYears={horizon}/>} 

    {scan && <section className="grid gap-3 lg:grid-cols-3">
      <button onClick={() => setShowPortfolioFlow(v => !v)} className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-left text-xs text-cyan-100"><b>{showPortfolioFlow?'Ocultar':'Ver'} cartera, operaciones y alertas</b><div className="mt-1 text-slate-400">Esta zona puede cargar valoraciones de fondos al abrirse.</div></button>
      <button onClick={() => setShowResearchDetails(v => !v)} className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 text-left text-xs text-violet-100"><b>{showResearchDetails?'Ocultar':'Ver'} histórico y ranking completo</b><div className="mt-1 text-slate-400">Monta el gráfico multiactivo solo bajo demanda.</div></button>
      <button onClick={() => void runSecondaryValidation()} disabled={eodhdLoading || alphaLoading} className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 text-left text-xs text-sky-100 disabled:opacity-50"><b>{eodhdLoading||alphaLoading?'Validando proveedores…':'Validar proveedores secundarios'}</b><div className="mt-1 text-slate-400">EODHD / Alpha Vantage no se consultan automáticamente.</div></button>
    </section>}

    {scan && showResearchDetails && <RecommendationEvidencePanel scan={scan}/>} 
    {scan && result && showPortfolioFlow && <MarketUtilityDashboard scan={scan} decision={result} eodhdValidation={eodhdValidation}/>} 

    {scan && <details className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <summary className="cursor-pointer font-bold">Cobertura y proveedores · detalle técnico</summary>
      <div className="mt-2 text-xs text-slate-400">{scan.accepted}/{scan.scanned} instrumentos válidos · shortlist {scan.selected.length}. Esta zona documenta calidad de datos; no genera otra recomendación.</div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-emerald-300">Yahoo</b><div className="mt-1 text-slate-500">ETFs/ETCs · principal</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-cyan-300">EODHD</b><div className="mt-1 text-slate-500">Fondos + contraste ETFs · {eodhdLoading?'validando':eodhdValidation?.summaryState??(eodhdStatus?.configured?'listo':'sin validar')}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><b className="text-slate-300">Alpha Vantage</b><div className="mt-1 text-slate-500">Reserva ETFs · {alphaLoading?'validando':alphaValidation?.summaryState??(alphaStatus?.configured?'listo':'sin validar')}</div></div>
      </div>
      {(eodhdError || alphaError) && <div className="mt-3 text-xs text-amber-300">{[eodhdError, alphaError].filter(Boolean).join(' · ')}</div>}
    </details>}
  </div>;
};
