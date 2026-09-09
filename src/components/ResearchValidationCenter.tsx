import React, { useEffect, useState } from 'react';
import { Activity, Download, Play, RefreshCw, TerminalSquare } from 'lucide-react';

type Status = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
interface ValidationJob {
  id: string;
  name: string;
  description: string;
  status: Status;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  exitCode: number | null;
  output: string;
  result: any;
  error: string | null;
}
interface ValidationHistoryItem { id: string; label: string; }
interface ProviderStatus { provider: string; configured: boolean; role?: string; primaryProvider?: string; }

const BASE = '/api/alerts/research-validation';

function badge(status: Status): string {
  return status === 'RUNNING' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
    : status === 'PASSED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : status === 'FAILED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
        : 'border-slate-700 bg-slate-900 text-slate-400';
}
function providerClass(configured: boolean | null): string {
  return configured === true ? 'text-emerald-200' : configured === false ? 'text-amber-200' : 'text-slate-400';
}
function safeFileTimestamp(value: string | null): string {
  const source = value || new Date().toISOString();
  return source.replace(/[:.]/g, '-').replace(/[^0-9TZ-]/g, '_');
}
function downloadResultJson(job: ValidationJob): void {
  if (job.result == null) return;
  const payload = {
    jobId: job.id,
    jobName: job.name,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${job.id}-${safeFileTimestamp(job.finishedAt)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function resultSummary(result: any): React.ReactNode {
  if (!result) return null;
  if (result.version === 'OPEN_MARKET_DISCOVERY_V1') {
    const discovery = result.discovery ?? {};
    const scanner = result.scanner ?? {};
    const core = result.coreEligibilityV2 ?? {};
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Infraestructura</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Descubiertos EUR</div><b className="text-sm text-white">{discovery.acceptedEurCandidates ?? 'N/D'}</b><div className="mt-1 text-[8px] text-slate-600">{discovery.queryCount ?? 'N/D'} familias consultadas</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">REAL aceptados</div><b className="text-sm text-white">{scanner.discoveredReal ?? 'N/D'}</b><div className="mt-1 text-[8px] text-slate-600">scanner compartido</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Core V2 shadow</div><b className="text-sm text-white">{core.eligible ?? 'N/D'} elegibles</b><div className="mt-1 text-[8px] text-slate-600">{core.reviewRequired ?? 'N/D'} review · {core.rejected ?? 'N/D'} rechazados</div></div>
    </div>;
  }
  if (result.version === 'OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1') {
    const aggregate = Array.isArray(result.aggregate) ? result.aggregate : [];
    const quality = aggregate.find((row: any) => row?.arm === 'QUALITY_V1') ?? {};
    const slope = aggregate.find((row: any) => row?.arm === 'SLOPE_V1') ?? {};
    const realAssets = result.dataQuality?.acceptedRealAssets ?? 'N/D';
    const delta = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(0)} €` : 'N/D';
    const dd = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)} pp` : 'N/D';
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Comparación</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b><div className="mt-1 text-[8px] text-slate-600">Producción sigue LEGACY</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Dataset REAL</div><b className="text-sm text-white">{realAssets} activos</b><div className="mt-1 text-[8px] text-slate-600">3 ventanas · discovery histórico OFF</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">QUALITY vs LEGACY</div><b className="text-sm text-white">{delta(quality.medianFinalDeltaEurVsLegacy)}</b><div className="mt-1 text-[8px] text-slate-600">final wins {quality.finalValueWinsVsLegacy ?? 'N/D'}/3 · DD {dd(quality.medianDrawdownImprovementPctPointsVsLegacy)}</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">SLOPE vs LEGACY</div><b className="text-sm text-white">{delta(slope.medianFinalDeltaEurVsLegacy)}</b><div className="mt-1 text-[8px] text-slate-600">final wins {slope.finalValueWinsVsLegacy ?? 'N/D'}/3 · DD {dd(slope.medianDrawdownImprovementPctPointsVsLegacy)}</div></div>
    </div>;
  }
  if (result.version === 'OPPORTUNITY_RANKING_REACH_AUDIT_V1') {
    const aggregate = result.aggregate ?? {};
    const legacy = aggregate.legacy ?? {};
    const variants = Array.isArray(aggregate.variants) ? aggregate.variants : [];
    const quality = variants.find((row: any) => row?.policy === 'QUALITY_V1') ?? {};
    const slope = variants.find((row: any) => row?.policy === 'SLOPE_V1') ?? {};
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Audit</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b><div className="mt-1 text-[8px] text-slate-600">Producción sigue LEGACY</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Competencia selección</div><b className="text-sm text-white">{legacy.selectionCompetitionDecisionGatesAcrossWindows ?? 'N/D'} / {legacy.decisionGatesAcrossWindows ?? 'N/D'}</b><div className="mt-1 text-[8px] text-slate-600">gates con algún ELIGIBLE fuera</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">QUALITY llega a</div><b className="text-sm text-white">{quality.selectedSetChangedDecisionGatesAcrossWindows ?? 'N/D'} sets · {quality.executedAcquisitionDecisionDatesChangedAcrossWindows ?? 'N/D'} compras</b><div className="mt-1 text-[8px] text-slate-600">orden cambia {quality.rankOrderChangedDecisionGatesAcrossWindows ?? 'N/D'} gates</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">SLOPE llega a</div><b className="text-sm text-white">{slope.selectedSetChangedDecisionGatesAcrossWindows ?? 'N/D'} sets · {slope.executedAcquisitionDecisionDatesChangedAcrossWindows ?? 'N/D'} compras</b><div className="mt-1 text-[8px] text-slate-600">orden cambia {slope.rankOrderChangedDecisionGatesAcrossWindows ?? 'N/D'} gates</div></div>
    </div>;
  }
  if (result.version === 'OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1') {
    const aggregate = result.aggregate ?? {};
    const delta = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(0)} €` : 'N/D';
    const dd = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)} pp` : 'N/D';
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">QUALITY bridge</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b><div className="mt-1 text-[8px] text-slate-600">Producción sigue LEGACY</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Planes cambiados</div><b className="text-sm text-white">{aggregate.allocationPlanChangedDecisionGatesAcrossWindows ?? 'N/D'}</b><div className="mt-1 text-[8px] text-slate-600">compras ejecutadas {aggregate.executedAcquisitionDatesChangedAcrossWindows ?? 'N/D'}</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Δ final mediano</div><b className="text-sm text-white">{delta(aggregate.medianFinalDeltaEurVsLegacy)}</b><div className="mt-1 text-[8px] text-slate-600">wins/losses {aggregate.finalValueWinsVsLegacy ?? 'N/D'} / {aggregate.finalValueLossesVsLegacy ?? 'N/D'}</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">DD mediano</div><b className="text-sm text-white">{dd(aggregate.medianDrawdownImprovementPctPointsVsLegacy)}</b><div className="mt-1 text-[8px] text-slate-600">notional distinto {Number.isFinite(Number(aggregate.totalAbsoluteExecutedNotionalDeltaEurAcrossWindows)) ? `${Number(aggregate.totalAbsoluteExecutedNotionalDeltaEurAcrossWindows).toFixed(0)} €` : 'N/D'}</div></div>
    </div>;
  }
  if (result.version === 'REPLAY_EXPLICIT_CASH_FLOWS_V1') {
    const aggregate = result.aggregate ?? {};
    const eur = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(0)} €` : 'N/D';
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Flujos explícitos</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b><div className="mt-1 text-[8px] text-slate-600">MONTHLY = revisión, no aportación</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Causalidad / contabilidad</div><b className="text-sm text-white">{aggregate.accountingAndCausalChecksPass === true ? 'PASS' : aggregate.accountingAndCausalChecksPass === false ? 'FAIL' : 'N/D'}</b><div className="mt-1 text-[8px] text-slate-600">fixture externo research-only</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Capital llega a compras</div><b className="text-sm text-white">{aggregate.fundingReachWindows ?? 'N/D'} / 3 ventanas</b><div className="mt-1 text-[8px] text-slate-600">Δ notional {eur(aggregate.executedAcquisitionNotionalDeltaEurExplicitVsClosedAcrossWindows)}</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">QUALITY con capital</div><b className="text-sm text-white">{aggregate.qualityAllocationPlanChangedDecisionGatesAcrossWindows ?? 'N/D'} planes</b><div className="mt-1 text-[8px] text-slate-600">{aggregate.qualityExecutedAcquisitionDatesChangedAcrossWindows ?? 'N/D'} fechas ejecutadas · producción LEGACY</div></div>
    </div>;
  }
  if (result.version === 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1') {
    const maturity = result.maturity ?? {};
    const reach = result.reach ?? {};
    const economics = result.economics ?? null;
    const pp = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(3)} pp` : 'N/D';
    const eur = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(0)} €` : 'N/D';
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Future-forward</div><b className="text-xs text-white">{String(result.status ?? 'N/D')}</b><div className="mt-1 text-[8px] text-slate-600">Producción LEGACY · QUALITY shadow</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Madurez</div><b className="text-sm text-white">{maturity.forwardSessionsObserved ?? 0} / {maturity.minimumForwardSessionsForEconomicEvaluation ?? 252} sesiones</b><div className="mt-1 text-[8px] text-slate-600">desde 10/09/2026 · sin backfill</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Reach QUALITY</div><b className="text-sm text-white">{result.reach == null ? 'Pendiente' : `${reach.changedDecisionGates ?? 0} planes · ${reach.executedAcquisitionDatesChanged ?? 0} fechas`}</b><div className="mt-1 text-[8px] text-slate-600">notional distinto {result.reach == null ? 'N/D' : eur(reach.absoluteExecutedNotionalDeltaEur)}</div></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Economía Phase A</div><b className="text-sm text-white">{economics == null ? 'BLOQUEADA HASTA 252' : pp(economics.cashFlowAdjustedReturnDeltaPctPointsQualityVsLegacy)}</b><div className="mt-1 text-[8px] text-slate-600">no tuning · Phase A no promociona</div></div>
    </div>;
  }
  const aggregate = result.aggregate ?? {};
  if (aggregate.medianFinalDeltaEur != null || aggregate.medianDeferredExecutionPriceImprovementPct != null) {
    return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Veredicto</div><b className="text-xs text-white">{String(result.verdict ?? 'N/D')}</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Δ final mediano</div><b className="text-sm text-white">{aggregate.medianFinalDeltaEur == null ? 'N/D' : `${Number(aggregate.medianFinalDeltaEur).toFixed(0)} €`}</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Mejora precio aplazado</div><b className="text-sm text-white">{aggregate.medianDeferredExecutionPriceImprovementPct == null ? 'N/D' : `${Number(aggregate.medianDeferredExecutionPriceImprovementPct).toFixed(2)}%`}</b></div>
      <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">−5% antes / +5% antes</div><b className="text-sm text-white">{aggregate.downFirstCount ?? 'N/D'} / {aggregate.upFirstCount ?? 'N/D'}</b></div>
    </div>;
  }
  const falseSignal = aggregate.falseSignalTimePct ?? aggregate.falseDivergenceTimePct ?? aggregate.falseVulnerabilityTimePct ?? null;
  return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Veredicto</div><b className="text-xs text-white">{String(result.verdict ?? 'N/D')}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Anticipación</div><b className="text-sm text-white">{aggregate.anticipationRatePct == null ? 'N/D' : `${Number(aggregate.anticipationRatePct).toFixed(2)}%`}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Lead mediano</div><b className="text-sm text-white">{aggregate.medianLeadSessionsBeforePeak == null ? 'N/D' : `${Number(aggregate.medianLeadSessionsBeforePeak).toFixed(0)} sesiones`}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Falsa señal</div><b className="text-sm text-white">{falseSignal == null ? 'N/D' : `${Number(falseSignal).toFixed(2)}%`}</b></div>
  </div>;
}

export const ResearchValidationCenter: React.FC = () => {
  const [jobs, setJobs] = useState<ValidationJob[]>([]);
  const [history, setHistory] = useState<ValidationHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eodhd, setEodhd] = useState<ProviderStatus | null>(null);
  const [alpha, setAlpha] = useState<ProviderStatus | null>(null);

  const refresh = async () => {
    try {
      const [jobsResponse, eodhdResponse, alphaResponse] = await Promise.all([
        fetch(`${BASE}/jobs`),
        fetch('/api/eodhd/status'),
        fetch('/api/alpha-vantage/status')
      ]);
      const payload = await jobsResponse.json();
      if (!jobsResponse.ok) throw new Error(payload?.error || `HTTP_${jobsResponse.status}`);
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setHistory(Array.isArray(payload.history) ? payload.history : []);
      if (eodhdResponse.ok) setEodhd(await eodhdResponse.json());
      if (alphaResponse.ok) setAlpha(await alphaResponse.json());
      setError(null);
    } catch (e: any) { setError(e?.message || String(e)); }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!jobs.some(job => job.status === 'RUNNING')) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const run = async (id: string) => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${BASE}/jobs/${encodeURIComponent(id)}/run`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(payload?.error || `HTTP_${response.status}`);
      await refresh();
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return <section className="mt-5 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-5" id="research-validation-center">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2"><TerminalSquare className="h-5 w-5 text-cyan-200"/></div>
        <div><h2 className="font-bold text-white">Validación de investigación</h2><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Se muestra únicamente la validación vigente de la fase actual. Los experimentos cerrados quedan archivados como trazabilidad, sin acumular botones. Todo se ejecuta en el backend local, sin IA ni GitHub Actions.</p></div>
      </div>
      <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-900"><RefreshCw className="mr-1 inline h-3 w-3"/>Actualizar</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-3 text-[10px]">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Yahoo Finance</div><b className="mt-1 block text-emerald-200">PRINCIPAL · ACTIVO</b><div className="mt-1 text-slate-600">Histórico REAL y discovery current/live. La búsqueda actual no se usa para reconstruir universos históricos.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">EODHD</div><b className={`mt-1 block ${providerClass(eodhd?.configured ?? null)}`}>{eodhd == null ? 'COMPROBANDO…' : eodhd.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">NAV de fondos + contraste secundario.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Alpha Vantage</div><b className={`mt-1 block ${providerClass(alpha?.configured ?? null)}`}>{alpha == null ? 'COMPROBANDO…' : alpha.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario; no bloquea Yahoo.</div></div>
    </div>

    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-[10px] text-rose-100">{error}</div>}
    <div className="mt-4 space-y-3">
      {jobs.map(job => <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-violet-300"/><b className="text-sm text-white">{job.name}</b><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${badge(job.status)}`}>{job.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{job.description}</p>{job.currentStep && <div className="mt-2 text-[10px] text-cyan-200">Ejecutando: {job.currentStep}</div>}</div>
          <div className="flex flex-wrap gap-2">
            {job.result != null && <button type="button" onClick={() => downloadResultJson(job)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[10px] font-black text-cyan-100"><Download className="mr-1 inline h-3 w-3"/>Descargar JSON</button>}
            <button type="button" disabled={loading || job.status === 'RUNNING'} onClick={() => void run(job.id)} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-black text-emerald-100 disabled:opacity-40"><Play className="mr-1 inline h-3 w-3"/>{job.status === 'RUNNING' ? 'En ejecución' : 'Ejecutar validación'}</button>
          </div>
        </div>
        {resultSummary(job.result)}
        {(job.output || job.error) && <details className="mt-3"><summary className="cursor-pointer text-[9px] font-bold text-slate-500">Salida técnica</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-[9px] text-slate-400">{job.error ? `${job.error}\n\n` : ''}{job.output}</pre></details>}
      </div>)}
      {!jobs.length && !error && <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[10px] text-slate-500">No hay una validación de investigación pendiente. Las fases cerradas permanecen en el histórico.</div>}
    </div>

    {history.length > 0 && <details className="mt-4 border-t border-slate-800 pt-3">
      <summary className="cursor-pointer text-[9px] font-bold text-slate-500">Histórico de investigación · {history.length} controles archivados</summary>
      <div className="mt-2 text-[9px] text-slate-600">{history.map(item => item.label).join(' · ')}</div>
    </details>}
  </section>;
};
