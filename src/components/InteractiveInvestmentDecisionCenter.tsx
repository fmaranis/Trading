import React, { useEffect, useState } from 'react';
import { BarChart3, Radar, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import {
  AssetUniverseScanResult,
  AssetUniverseScanner,
  CASH_BENCHMARK_UPDATED_EVENT,
  CashBenchmarkService,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  InvestmentDecisionEngine,
  InvestmentDecisionResult,
  InvestorRiskProfile,
  InvestmentHorizonYears,
  PortfolioCandidateGate,
  PortfolioPositionHealthService,
  USER_PORTFOLIO_UPDATED_EVENT,
  UserPortfolioService,
  type PortfolioCandidateGateResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { AlphaVantageCrossValidationResult, AlphaVantageCrossValidationService, AlphaVantageStatus } from '../investment/data/marketData/alphaVantageCrossValidation';
import { EodhdCrossValidationResult, EodhdCrossValidationService, EodhdStatus } from '../investment/data/marketData/eodhdCrossValidation';
import { RecommendationEvidencePanel } from './RecommendationEvidencePanel';
import { MarketUtilityDashboard } from './MarketUtilityDashboard';
import { DecisionGuardrailsPanel } from './DecisionGuardrailsPanel';
import { InvestmentResearchLab } from './InvestmentResearchLab';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
/**
 * The live decision path only needs 252 bars for scanner risk, 180 for the
 * allocator and 120 for the regime volatility baseline. Three calendar years
 * normally provide well above 500 daily observations while avoiding seven
 * years of payload/parse work for every live instrument.
 */
function liveDecisionHistoryStart(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 3); return isoDate(d); }
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
function methodFor(profile: InvestorRiskProfile): InvestmentDecisionResult['recommendedMethod'] {
  return profile === 'LOW' ? 'INVERSE_VOLATILITY' : profile === 'MEDIUM' ? 'RISK_PARITY_ERC' : 'RELATIVE_MOMENTUM';
}
function cashOnlyDecision(scan: AssetUniverseScanResult, capitalEur: number, riskProfile: InvestorRiskProfile, horizonYears: InvestmentHorizonYears): InvestmentDecisionResult {
  const asOfDate = scan.candidates.filter(c => c.status === 'ACCEPTED' && c.asOfDate).map(c => c.asOfDate!).sort().at(-1) ?? isoDate(new Date());
  return {
    generatedAt: new Date().toISOString(), asOfDate, dataAgeDays: 0, currency: 'EUR', capitalEur, riskProfile, horizonYears,
    marketRegime: 'UNKNOWN', regimeTrendPct: null, regimeVolatilityPct: null, confidence: 'MEDIUM', confidenceScore: 70,
    recommendedMethod: methodFor(riskProfile), cashWeight: 1, cashAmountEur: capitalEur, assets: [],
    portfolioDatasetFingerprint: `CASH_ONLY:${asOfDate}`, evidence: 'REAL_ONLY',
    warnings: ['Ningún candidato supera simultáneamente la referencia de efectivo y el consenso mínimo para dinero nuevo. No se fuerza una inversión.'],
    summary: `Ningún candidato supera los gates actuales; mantener ${capitalEur.toFixed(2)} € en efectivo hasta que aparezca una alternativa que justifique el riesgo frente a la cuenta remunerada.`,
    methodology: ['Descubrimiento amplio REAL.', 'Filtro previo: superar efectivo + consenso BUY.', 'Si ningún activo pasa, el resultado correcto es 100% cash.']
  };
}

type Workspace = 'PORTFOLIO' | 'RESEARCH';

export const InteractiveInvestmentDecisionCenter: React.FC = () => {
  const [workspace, setWorkspace] = useState<Workspace>('PORTFOLIO');
  const [researchSymbol, setResearchSymbol] = useState<string | null>(null);
  const [capital, setCapital] = useState(() => portfolioDeployableCapital());
  const [riskProfile, setRiskProfile] = useState<InvestorRiskProfile>('MEDIUM');
  const [horizon, setHorizon] = useState<InvestmentHorizonYears>(3);
  const [rawScan, setRawScan] = useState<AssetUniverseScanResult | null>(null);
  const [scan, setScan] = useState<AssetUniverseScanResult | null>(null);
  const [candidateGate, setCandidateGate] = useState<PortfolioCandidateGateResult | null>(null);
  const [positionHealth, setPositionHealth] = useState<PortfolioPositionHealthResult | null>(null);
  const [positionHealthLoading, setPositionHealthLoading] = useState(false);
  const [portfolioRevision, setPortfolioRevision] = useState(0);
  const [cashRevision, setCashRevision] = useState(0);
  const [result, setResult] = useState<InvestmentDecisionResult | null>(null);
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

  const inspectAsset = (symbolOrIsin: string) => {
    const clean = symbolOrIsin.trim().toUpperCase();
    if (!clean) return;
    setResearchSymbol(clean);
    setWorkspace('RESEARCH');
    window.setTimeout(() => document.getElementById('single-asset-research')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

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
    } catch (e: any) { setEodhdError(e?.message || String(e)); void runAlphaReserveValidation(scan); }
    finally { setEodhdLoading(false); }
  };

  const refreshMarket = async (forceRefresh: boolean) => {
    if (marketLoading) return;
    setMarketLoading(true); setError(null);
    try {
      const scanResult = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        liveDecisionHistoryStart(),
        isoDate(new Date()),
        { forceRefresh, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
      );
      setRawScan(scanResult);
      setLastMarketRefresh(new Date().toLocaleString('es-ES'));
      setEodhdValidation(null); setAlphaValidation(null);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setMarketLoading(false); }
  };

  useEffect(() => {
    const start = () => { void refreshMarket(false); };
    const idle = (window as any).requestIdleCallback as ((cb: () => void, options?: { timeout: number }) => number) | undefined;
    if (idle) { const id = idle(start, { timeout: 1200 }); return () => (window as any).cancelIdleCallback?.(id); }
    const id = window.setTimeout(start, 180);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!rawScan) return;
    const gate = PortfolioCandidateGate.apply(rawScan, CashBenchmarkService.load(), 12);
    setCandidateGate(gate); setScan(gate.scan);
  }, [rawScan, cashRevision]);

  useEffect(() => {
    const syncPortfolio = () => {
      setCapital(prev => { const next = portfolioDeployableCapital(); return Math.abs(prev - next) > 0.01 ? next : prev; });
      setPortfolioRevision(v => v + 1);
    };
    const syncCash = () => setCashRevision(v => v + 1);
    window.addEventListener('focus', syncPortfolio);
    window.addEventListener(USER_PORTFOLIO_UPDATED_EVENT, syncPortfolio as EventListener);
    window.addEventListener(CASH_BENCHMARK_UPDATED_EVENT, syncCash as EventListener);
    return () => {
      window.removeEventListener('focus', syncPortfolio);
      window.removeEventListener(USER_PORTFOLIO_UPDATED_EVENT, syncPortfolio as EventListener);
      window.removeEventListener(CASH_BENCHMARK_UPDATED_EVENT, syncCash as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!scan) { setPositionHealth(null); return; }
    let active = true;
    setPositionHealthLoading(true);
    PortfolioPositionHealthService.evaluate(UserPortfolioService.load(), scan, CashBenchmarkService.load())
      .then(value => { if (active) setPositionHealth(value); })
      .catch(() => { if (active) setPositionHealth(null); })
      .finally(() => { if (active) setPositionHealthLoading(false); });
    return () => { active = false; };
  }, [scan, portfolioRevision, cashRevision]);

  useEffect(() => {
    if (!scan) return;
    try {
      const next = scan.selected.length > 0
        ? InvestmentDecisionEngine.decide(scan.dataset, { capitalEur: capital, riskProfile, horizonYears: horizon })
        : cashOnlyDecision(scan, capital, riskProfile, horizon);
      setResult(next); setLocalRevision(v => v + 1); setError(null);
    } catch (e: any) { setResult(null); setError(e?.message || String(e)); }
  }, [scan, capital, riskProfile, horizon]);

  return <div className="space-y-5">
    <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-2">
      <button onClick={() => setWorkspace('PORTFOLIO')} className={`rounded-xl px-4 py-4 text-left transition ${workspace === 'PORTFOLIO' ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30' : 'text-slate-400 hover:bg-slate-900'}`}><div className="flex items-center gap-2"><WalletCards className="h-5 w-5"/><b>Mi cartera real</b></div><div className="mt-1 text-[10px] opacity-70">Qué hacer hoy primero; cartera y explicación después.</div></button>
      <button onClick={() => setWorkspace('RESEARCH')} className={`rounded-xl px-4 py-4 text-left transition ${workspace === 'RESEARCH' ? 'bg-violet-500/15 text-violet-100 ring-1 ring-violet-500/30' : 'text-slate-400 hover:bg-slate-900'}`}><div className="flex items-center gap-2"><Radar className="h-5 w-5"/><b>Estudio y señales</b></div><div className="mt-1 text-[10px] opacity-70">Buscar valores, ranking, gráfico y puntos de compra/venta.</div></button>
    </nav>

    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><b>No puedo calcular el mercado actual.</b> {error}</div>}
    {marketLoading && !scan && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">Actualizando automáticamente el mercado REAL ampliado…</div>}

    {workspace === 'PORTFOLIO' && <>
      <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/35 via-slate-900 to-slate-950 p-5 sm:p-6">
        <div className="max-w-3xl"><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-emerald-300"/><h1 className="text-xl sm:text-2xl font-bold text-white">Mi cartera real</h1></div><p className="mt-2 text-sm text-slate-300">La pantalla responde primero si hay que mover dinero hoy. Después puedes abrir las razones, controles y metodología.</p></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3"><span className="text-[10px] uppercase text-emerald-300">Liquidez para nuevas operaciones</span><div className="mt-1 text-xl font-mono font-bold">{capital.toFixed(2)} €</div></div><label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Riesgo</span><select value={riskProfile} onChange={e=>setRiskProfile(e.target.value as InvestorRiskProfile)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value="LOW">Bajo</option><option className="bg-slate-900" value="MEDIUM">Medio</option><option className="bg-slate-900" value="HIGH">Alto</option></select></label><label className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><span className="text-[10px] uppercase text-slate-400">Horizonte</span><select value={horizon} onChange={e=>setHorizon(Number(e.target.value) as InvestmentHorizonYears)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"><option className="bg-slate-900" value={1}>1 año</option><option className="bg-slate-900" value={3}>3 años</option><option className="bg-slate-900" value={5}>5 años</option></select></label></div>
        <button onClick={()=>void refreshMarket(true)} disabled={marketLoading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${marketLoading?'animate-spin':''}`}/>{marketLoading?'Actualizando mercado…':'Actualizar mercado y recomendación'}</button>
        <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-slate-500"><span>Mercado: {lastMarketRefresh ?? 'pendiente'} · recalculo #{localRevision}</span>{candidateGate && <><span>· descubrimiento {rawScan?.accepted ?? 0} válidos</span><span>· superan cash+consenso {candidateGate.eligibleCount}</span><span>· asignador {candidateGate.selectedCount}</span></>}{positionHealthLoading && <span>· vigilando posiciones…</span>}</div>
      </section>

      {scan && result && <MarketUtilityDashboard scan={scan} decision={result} eodhdValidation={eodhdValidation} positionHealth={positionHealth} onInspectAsset={inspectAsset}/>}

      {scan && result && <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <summary className="cursor-pointer font-bold text-slate-200">Datos y controles técnicos de la decisión</summary>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span className={`rounded-lg border px-3 py-2 font-bold ${confidenceClass(result.confidence)}`}>Calidad de datos {result.confidence} · {result.confidenceScore}/100</span><span>Esto mide actualidad, profundidad de histórico y clasificación del régimen. No es probabilidad de beneficio ni convicción de una compra.</span></div>
          <section className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] uppercase text-slate-500">Datos hasta</div><div className="mt-1 font-mono font-bold">{result.asOfDate}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><BarChart3 className="h-4 w-4 text-indigo-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Régimen</div><div className="font-bold text-sm">{result.marketRegime}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div className="mt-2 text-[10px] uppercase text-slate-500">Método tras gates</div><div className="font-bold text-sm">{result.recommendedMethod}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] uppercase text-slate-500">Efectivo objetivo teórico</div><div className="mt-1 font-mono font-bold">{pct(result.cashWeight)}</div></div></section>
          <DecisionGuardrailsPanel scan={scan} capitalEur={capital} riskProfile={riskProfile} horizonYears={horizon}/>
        </div>
      </details>}
    </>}

    {workspace === 'RESEARCH' && <>
      {scan && result ? <InvestmentResearchLab scan={scan} decision={result} requestedSymbol={researchSymbol}/> : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">El radar se habilitará cuando termine la actualización inicial. El estudio individual utiliza datos REAL del proveedor y no modifica tu cartera.</div>}
      {scan && <details className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><summary className="cursor-pointer font-bold">Ranking técnico completo y métricas auxiliares</summary><div className="mt-4"><RecommendationEvidencePanel scan={scan}/></div></details>}
      {scan && <details className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><summary className="cursor-pointer font-bold">Cobertura y proveedores</summary><div className="mt-2 text-xs text-slate-400">{scan.accepted}/{scan.scanned} instrumentos válidos en el descubrimiento ampliado · {scan.selected.length} pasan a asignación después de cash + consenso. El buscador individual sigue sin estar limitado por este conjunto.</div><button onClick={() => void runSecondaryValidation()} disabled={eodhdLoading || alphaLoading} className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs font-bold text-sky-100 disabled:opacity-50">{eodhdLoading||alphaLoading?'Validando proveedores…':'Validar EODHD / Alpha Vantage'}</button><div className="mt-3 grid gap-2 md:grid-cols-3 text-xs"><div className="rounded-lg bg-slate-950 p-3"><b className="text-emerald-300">Yahoo</b><div className="mt-1 text-slate-500">acciones / ETFs · principal</div></div><div className="rounded-lg bg-slate-950 p-3"><b className="text-cyan-300">EODHD</b><div className="mt-1 text-slate-500">{eodhdValidation?.summaryState??(eodhdStatus?.configured?'listo':'sin validar')}</div></div><div className="rounded-lg bg-slate-950 p-3"><b className="text-slate-300">Alpha Vantage</b><div className="mt-1 text-slate-500">{alphaValidation?.summaryState??(alphaStatus?.configured?'listo':'sin validar')}</div></div></div>{(eodhdError || alphaError) && <div className="mt-3 text-xs text-amber-300">{[eodhdError, alphaError].filter(Boolean).join(' · ')}</div>}</details>}
    </>}
  </div>;
};