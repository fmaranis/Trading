import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Download, Play, RefreshCw, TerminalSquare } from 'lucide-react';

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
  readyToRun?: boolean;
  blockedReason?: string | null;
  execution?: 'LOCAL_APP_BACKEND' | 'REMOTE_TIMESFM_RUNNER';
  runnerReachable?: boolean | null;
  runnerError?: string | null;
}
interface ValidationHistoryItem { id: string; label: string; }
interface ProviderStatus { provider: string; configured: boolean; role?: string; primaryProvider?: string; }
interface ValidationPrerequisites { githubReplaySyncConfigured: boolean; eodhdConfigured?: boolean; secEdgarUserAgentConfigured?: boolean; timesFmRemoteRunnerConfigured?: boolean; }
interface Phase4RecoveryStatus {
  jobId: string;
  evidenceAvailable: boolean;
  recoveryAllowed: boolean;
  tokenConfigured: boolean;
  status: Status;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep?: string | null;
  output: string;
  error: string | null;
}
interface Phase4R3Status {
  jobId: string;
  r2EvidenceAvailable: boolean;
  r2ReproductionVerdict: string | null;
  evidenceAvailable: boolean;
  verdict: string | null;
  readyToRun: boolean;
  tokenConfigured: boolean;
  status: Status;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  output: string;
  error: string | null;
}

const BASE = '/api/alerts/research-validation';
const PHASE4_JOB_ID = 'phase4-reentry-cash-custody-v1';

function badge(status: Status): string {
  return status === 'RUNNING' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
    : status === 'PASSED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : status === 'FAILED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
        : 'border-slate-700 bg-slate-900 text-slate-400';
}

function providerClass(configured: boolean | null): string {
  return configured === true ? 'text-emerald-200' : configured === false ? 'text-amber-200' : 'text-slate-400';
}

function nextWindowLabel(month: unknown): string {
  const value = String(month ?? '');
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return 'Próxima ventana según protocolo: día 9 · 22:30–24:00 Madrid';
  return `Próxima ventana: 09/${match[2]}/${match[1]} · 22:30–24:00 Madrid`;
}

function futureForwardMeaning(result: any): { title: string; detail: string; tone: string } {
  if (result.observationRecordedThisRun === true) {
    return {
      title: 'NUEVA OBSERVACIÓN REGISTRADA',
      detail: 'El checkpoint válido de este mes se ha añadido al estado prospectivo durable. No ejecutes otro checkpoint del mismo mes.',
      tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
    };
  }
  if (result.observationStatus === 'ALREADY_RECORDED' || result.status === 'PROSPECTIVE_STATE_VERIFIED_NO_REWRITE') {
    return {
      title: 'ESTADO VERIFICADO · SIN REESCRIBIR',
      detail: 'La observación del mes ya existía. La app sólo comprobó continuidad e integridad; no creó otra observación ni modificó la muestra.',
      tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
    };
  }
  if (result.checkpointWindow?.status === 'BEFORE_WINDOW') {
    return {
      title: 'TODAVÍA NO TOCA CHECKPOINT',
      detail: 'La ventana prospectiva del mes aún no está abierta. No se ha consumido ninguna observación.',
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100'
    };
  }
  if (result.checkpointWindow?.status === 'AFTER_WINDOW') {
    return {
      title: 'VENTANA DEL MES CERRADA',
      detail: 'La ventana válida ya terminó. El protocolo no permite backfill ni una segunda observación mensual.',
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100'
    };
  }
  return {
    title: String(result.status ?? 'RESULTADO DISPONIBLE'),
    detail: 'La evidencia completa queda disponible abajo, pero la interpretación operativa se muestra aquí.',
    tone: 'border-slate-700 bg-slate-950 text-slate-200'
  };
}

function resultSummary(result: any): React.ReactNode {
  if (!result) return null;
  if (result.study === 'TIMESFM_STAGE_A_SMOKE_V1') {
    const passed = String(result.status ?? '').startsWith('PASS_');
    const checks = result.checks ?? {};
    return <div className="mt-4 space-y-3">
      <div className={`rounded-xl border p-4 ${passed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-black">{String(result.status ?? 'RESULTADO')}</div><div className="mt-1 text-[11px] opacity-80">Stage A técnico únicamente · sin precios ni outcomes · producción LEGACY.</div></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Modelo</div><b className="text-xs text-white">TimesFM {String(result.model?.packageVersion ?? 'N/D')}</b><div className="mt-1 text-[9px] text-slate-600">{String(result.runtime?.device ?? 'N/D')} · checkpoint pinneado</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Causalidad</div><b className="text-xs text-white">{checks.causalPrefixExcludesForbiddenFuture === true ? 'PASS' : 'FAIL'}</b><div className="mt-1 text-[9px] text-slate-600">Future tail excluido de informationDate</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Cuantiles</div><b className="text-xs text-white">{checks.quantilesMonotonic === true ? 'PASS' : 'FAIL'}</b><div className="mt-1 text-[9px] text-slate-600">P10–P90 · salida multivariante</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Repetibilidad</div><b className="text-xs text-white">{checks.repeatabilityWithinTolerance === true ? 'PASS' : 'FAIL'}</b><div className="mt-1 text-[9px] text-slate-600">Tol. {String(result.evidence?.tolerance ?? 'N/D')}</div></div>
      </div>
    </div>;
  }
  if (result.study === 'SECTOR_52W_HIGH_LEADERSHIP_V1') {
    const diagnostic = result.diagnostic20 ?? {};
    const replication = result.replication20 ?? null;
    const tone = String(result.status ?? '').startsWith('PASS_')
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : String(result.status ?? '').startsWith('FAIL_')
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    const metric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'N/D';
    return <div className="mt-4 space-y-3">
      <div className={`rounded-xl border p-4 ${tone}`}>
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-black">{String(result.status ?? 'RESULTADO')}</div><div className="mt-1 text-[11px] opacity-80">Gate económico con stress 20 pb/lado. Producción permanece LEGACY.</div><div className="mt-1 font-mono text-[9px] opacity-60">{String(result.implementationRevision ?? 'REVISION_NO_REPORTADA')}</div></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Candidata</div><b className="text-xs text-white">{metric(diagnostic.candidate?.cagrPct)}% CAGR</b><div className="mt-1 text-[9px] text-slate-600">2013–2018 · 20 pb/lado</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">SPY</div><b className="text-xs text-white">{metric(diagnostic.spy?.cagrPct)}%</b><div className="mt-1 text-[9px] text-slate-600">Hurdle parent USA</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">URTH</div><b className="text-xs text-white">{metric(diagnostic.urth?.cagrPct)}%</b><div className="mt-1 text-[9px] text-slate-600">Hurdle global</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Basket 9</div><b className="text-xs text-white">{metric(diagnostic.equal9?.cagrPct)}%</b><div className="mt-1 text-[9px] text-slate-600">Control mismo universo</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Replicación</div><b className="text-xs text-white">{replication ? `${metric(replication.candidate?.cagrPct)}%` : 'NO ABIERTA'}</b><div className="mt-1 text-[9px] text-slate-600">{replication ? '2019–2025' : 'Sólo se abre si pasa diagnóstico'}</div></div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">
        Gate diagnóstico 20 pb: <b className={diagnostic.gatePassed ? 'text-emerald-200' : 'text-rose-200'}>{diagnostic.gatePassed ? 'PASS' : 'FAIL'}</b>
        {' · '}80% anual conjunto: {result.userFrequencyTarget == null ? 'N/D' : result.userFrequencyTarget.met ? 'CUMPLIDO' : 'NO CUMPLIDO'}
      </div>
    </div>;
  }
  if (result.version === 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1') {
    const data = result.dataQuality ?? {};
    const cheap = result.groups?.cheapReasonable ?? {};
    const expensive = result.groups?.expensive ?? {};
    const interaction = result.interaction ?? {};
    const positive = String(result.verdict ?? '').includes('SUPPORTS_QUALITY_X_VALUATION');
    return <div className="mt-4 space-y-3">
      <div className={`rounded-xl border p-4 ${positive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-black">{String(result.verdict ?? 'RESULTADO')}</div><div className="mt-1 text-[11px] opacity-80">Diagnóstico histórico amplio. No autoriza promoción; producción permanece LEGACY.</div></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Cobertura causal</div><b className="text-xs text-white">{Number(data.qualityEvaluable ?? 0)} Quality evaluables</b><div className="mt-1 text-[9px] text-slate-600">{Number(data.historicalMembers ?? 0)} miembros PIT · {Number(data.highQualityWithValuation ?? 0)} high Quality con valoración</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Quality barata/razonable</div><b className="text-xs text-white">{Number(cheap.count ?? 0)} acciones</b><div className="mt-1 text-[9px] text-slate-600">Exceso medio: SPY {Number(cheap.meanExcessVsSpyPctPoints ?? 0).toFixed(2)} pp · URTH {Number(cheap.meanExcessVsUrthPctPoints ?? 0).toFixed(2)} pp</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Quality cara</div><b className="text-xs text-white">{Number(expensive.count ?? 0)} acciones</b><div className="mt-1 text-[9px] text-slate-600">Exceso medio: SPY {Number(expensive.meanExcessVsSpyPctPoints ?? 0).toFixed(2)} pp · URTH {Number(expensive.meanExcessVsUrthPctPoints ?? 0).toFixed(2)} pp</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Interacción</div><b className="text-xs text-white">{Number(interaction.meanReturnDeltaCheapMinusExpensivePctPoints ?? 0).toFixed(2)} pp</b><div className="mt-1 text-[9px] text-slate-600">Cheap/reasonable menos expensive en retorno medio.</div></div>
      </div>
    </div>;
  }
  if (result.version === 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1') {
    const phase = result.phaseSummary ?? {};
    const persistence = result.persistence ?? {};
    const window = result.checkpointWindow ?? {};
    const meaning = futureForwardMeaning(result);
    const observations = Number(phase.observations ?? result.observationCount ?? 0);
    const resolved20 = Number(phase.resolved20SessionOutcomes ?? 0);
    const resolved60 = Number(phase.resolved60SessionOutcomes ?? 0);
    const implementationCount = Number(result.implementation?.frozenSourceCount ?? result.frozenSourceCount ?? 25);
    const integrityLabel = Number.isFinite(implementationCount) && implementationCount > 0 ? `${implementationCount}/${implementationCount}` : '25/25';
    return <div className="mt-4 space-y-3">
      <div className={`rounded-xl border p-4 ${meaning.tone}`}>
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-black">{meaning.title}</div><div className="mt-1 text-[11px] opacity-80">{meaning.detail}</div></div></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Protocolo</div><b className="text-xs text-white">COLLECTING · {observations}/12</b><div className="mt-1 text-[9px] text-slate-600">Producción continúa LEGACY</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Esta ejecución</div><b className="text-xs text-white">{result.observationRecordedThisRun === true ? 'CREÓ OBSERVACIÓN' : 'NO CREÓ OBSERVACIÓN'}</b><div className="mt-1 text-[9px] text-slate-600">{String(result.observationStatus ?? result.status ?? 'N/D')}</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Outcomes maduros</div><b className="text-xs text-white">20s: {resolved20} · 60s: {resolved60}</b><div className="mt-1 text-[9px] text-slate-600">Pendientes hasta que transcurran sesiones futuras</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Integridad</div><b className="text-xs text-emerald-200">{integrityLabel} congelados</b><div className="mt-1 text-[9px] text-slate-600">Fingerprint + hash chain</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Persistencia</div><b className="text-xs text-white">{persistence.mode === 'GITHUB_REPLAY_RESULTS' ? 'GitHub durable' : String(persistence.mode ?? 'N/D')}</b><div className="mt-1 text-[9px] text-slate-600">{String(persistence.branch ?? 'replay-results')} · sin backfill</div></div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-[10px] text-violet-100"><Clock3 className="mt-0.5 h-4 w-4 shrink-0"/><div><b>{nextWindowLabel(result.expectedObservationMonth)}</b><div className="mt-1 text-violet-100/70">Ventana actual: {String(window.status ?? 'N/D')}. Pulsar fuera de ventana puede verificar el estado, pero no añade una observación válida.</div></div></div>
    </div>;
  }
  return <div className="mt-3 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-400">Resultado disponible. La evidencia técnica completa puede descargarse aparte.</div>;
}

function blockedMessage(reason: string | null | undefined): string | null {
  if (reason === 'QUALITY_FF_DURABLE_GITHUB_TOKEN_REQUIRED' || reason === 'DURABLE_GITHUB_TOKEN_REQUIRED') {
    return 'Falta GITHUB_REPLAY_SYNC_TOKEN en el backend. El job no arrancará hasta que la persistencia durable esté disponible.';
  }
  if (reason === 'EODHD_API_KEY_REQUIRED') return 'Falta EODHD_API_KEY. La validación PIT amplia necesita la membresía histórica del S&P 500 y no arrancará sin ella.';
  if (reason === 'SEC_EDGAR_USER_AGENT_REQUIRED') return 'Falta SEC_EDGAR_USER_AGENT. Debe identificar el acceso automatizado a SEC EDGAR; sin ese dato el job queda bloqueado antes de abrir la muestra.';
  if (reason === 'TIMESFM_REMOTE_RUNNER_REQUIRED') return 'Falta el Space gratuito Hugging Face ZeroGPU de TimesFM. AI Studio ya no descarga ni ejecuta el modelo.';
  return reason || null;
}

function evidenceFilePart(value: string): string {
  return value.replace(/[:.]/g, '-').replace(/[^0-9A-Za-zTZ_-]/g, '_').slice(0, 120) || 'result';
}

function downloadJobEvidence(job: ValidationJob): void {
  if (job.result == null) throw new Error('VALIDATION_RESULT_NOT_AVAILABLE');
  const stamp = evidenceFilePart(job.finishedAt || new Date().toISOString());
  const filename = `${evidenceFilePart(job.id)}-${stamp}.json`;
  const payload = {
    jobId: job.id,
    jobName: job.name,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    error: job.error,
    result: job.result
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const ResearchValidationCenter: React.FC = () => {
  const [jobs, setJobs] = useState<ValidationJob[]>([]);
  const [history, setHistory] = useState<ValidationHistoryItem[]>([]);
  const [phase4Recovery, setPhase4Recovery] = useState<Phase4RecoveryStatus | null>(null);
  const [phase4R3, setPhase4R3] = useState<Phase4R3Status | null>(null);
  const [prerequisites, setPrerequisites] = useState<ValidationPrerequisites | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eodhd, setEodhd] = useState<ProviderStatus | null>(null);
  const [alpha, setAlpha] = useState<ProviderStatus | null>(null);

  const refresh = async () => {
    try {
      const [jobsResponse, recoveryResponse, r3Response, eodhdResponse, alphaResponse] = await Promise.all([
        fetch(`${BASE}/jobs`),
        fetch(`${BASE}/phase4-recovery`),
        fetch(`${BASE}/phase4-r3`),
        fetch('/api/eodhd/status'),
        fetch('/api/alpha-vantage/status')
      ]);
      const payload = await jobsResponse.json();
      if (!jobsResponse.ok) throw new Error(payload?.error || `HTTP_${jobsResponse.status}`);
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setHistory(Array.isArray(payload.history) ? payload.history : []);
      setPrerequisites(payload?.prerequisites ?? null);
      if (recoveryResponse.ok) setPhase4Recovery(await recoveryResponse.json());
      if (r3Response.ok) setPhase4R3(await r3Response.json());
      if (eodhdResponse.ok) setEodhd(await eodhdResponse.json());
      if (alphaResponse.ok) setAlpha(await alphaResponse.json());
      setError(null);
    } catch (e: any) { setError(e?.message || String(e)); }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!jobs.some(job => job.status === 'RUNNING') && phase4Recovery?.status !== 'RUNNING' && phase4R3?.status !== 'RUNNING') return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [jobs, phase4Recovery?.status, phase4R3?.status]);

  const run = async (id: string) => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${BASE}/jobs/${encodeURIComponent(id)}/run`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409 && payload?.error === 'VALIDATION_ALREADY_RUNNING') { await refresh(); return; }
        throw new Error(payload?.detail || payload?.error || `HTTP_${response.status}`);
      }
      await refresh();
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const recoverPhase4Evidence = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${BASE}/phase4-recovery/run`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409 && (payload?.error === 'PHASE4_EVIDENCE_RECOVERY_ALREADY_RUNNING' || payload?.error === 'PHASE4_DURABLE_EVIDENCE_ALREADY_AVAILABLE')) {
          await refresh();
          return;
        }
        throw new Error(payload?.detail || payload?.error || `HTTP_${response.status}`);
      }
      await refresh();
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const runPhase4R3 = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${BASE}/phase4-r3/run`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409 && (payload?.error === 'PHASE4_R3_ALREADY_RUNNING' || payload?.error === 'PHASE4_R3_DURABLE_EVIDENCE_ALREADY_AVAILABLE')) {
          await refresh();
          return;
        }
        throw new Error(payload?.detail || payload?.error || `HTTP_${response.status}`);
      }
      await refresh();
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return <section className="mt-5 scroll-mt-20 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4 sm:p-5" id="research-validation-center">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2"><TerminalSquare className="h-5 w-5 text-cyan-200"/></div>
        <div><h2 className="font-bold text-white">Validación de investigación</h2><p className="mt-1 max-w-3xl text-[11px] text-slate-400">La pantalla resume qué ocurrió y qué debes hacer después. Los guards y replays normales usan el backend de la app; TimesFM se delega a su runner separado. Sin IA ni GitHub Actions para los cálculos largos.</p></div>
      </div>
      <button type="button" onClick={() => void refresh()} className="touch-target w-full rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900 sm:w-auto"><RefreshCw className="mr-1 inline h-3.5 w-3.5"/>Actualizar estado</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6 text-[10px]">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Yahoo Finance</div><b className="mt-1 block text-emerald-200">PRINCIPAL · ACTIVO</b><div className="mt-1 text-slate-600">Histórico REAL y discovery current/live.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">EODHD</div><b className={`mt-1 block ${providerClass(eodhd?.configured ?? null)}`}>{eodhd == null ? 'COMPROBANDO…' : eodhd.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario y fondos.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">SEC EDGAR PIT</div><b className={`mt-1 block ${providerClass(prerequisites?.secEdgarUserAgentConfigured ?? null)}`}>{prerequisites == null ? 'COMPROBANDO…' : prerequisites.secEdgarUserAgentConfigured ? 'USER-AGENT LISTO' : 'FALTA USER-AGENT'}</b><div className="mt-1 text-slate-600">Fundamentales causales por fecha de filing.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Alpha Vantage</div><b className={`mt-1 block ${providerClass(alpha?.configured ?? null)}`}>{alpha == null ? 'COMPROBANDO…' : alpha.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario; no bloquea Yahoo.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Persistencia research</div><b className={`mt-1 block ${providerClass(prerequisites?.githubReplaySyncConfigured ?? null)}`}>{prerequisites == null ? 'COMPROBANDO…' : prerequisites.githubReplaySyncConfigured ? 'GITHUB LISTO' : 'FALTA TOKEN'}</b><div className="mt-1 text-slate-600">Future-forward y evidencia de validación se anclan en replay-results.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">TimesFM runner</div><b className={`mt-1 block ${providerClass(prerequisites?.timesFmRemoteRunnerConfigured ?? null)}`}>{prerequisites == null ? 'COMPROBANDO…' : prerequisites.timesFmRemoteRunnerConfigured ? 'REMOTO · LISTO' : 'NO CONFIGURADO'}</b><div className="mt-1 text-slate-600">Checkpoint e inferencia en Hugging Face ZeroGPU gratuito; sin billing.</div></div>
    </div>

    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-[11px] text-rose-100">{error}</div>}
    <div className="mt-4 space-y-3">
      {jobs.map(job => {
        const blocked = blockedMessage(job.blockedReason);
        return <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Activity className="h-4 w-4 text-violet-300"/><b className="text-sm text-white">{job.name}</b><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${badge(job.status)}`}>{job.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{job.description}</p>{job.currentStep && <div className="mt-2 text-[10px] text-cyan-200">Ejecutando: {job.currentStep}</div>}{blocked && <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2 text-[10px] text-amber-200">{blocked}</div>}{job.id === 'timesfm-stage-a-smoke-v1' && job.runnerReachable === false && <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-2 text-[10px] text-rose-200">Runner TimesFM no accesible: {job.runnerError || 'sin respuesta'}</div>}</div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {job.result != null && <button type="button" onClick={() => downloadJobEvidence(job)} className="touch-target flex w-full items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[11px] font-black text-cyan-100 sm:w-auto"><Download className="mr-1 h-3.5 w-3.5"/>Evidencia JSON</button>}
              <button type="button" disabled={loading || job.status === 'RUNNING' || job.readyToRun === false} onClick={() => void run(job.id)} className="touch-target w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[11px] font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Play className="mr-1 inline h-3.5 w-3.5"/>{job.status === 'RUNNING' ? 'En ejecución' : job.readyToRun === false ? 'Bloqueado por preflight' : job.id === 'fundamental-quality-valuation-broad-pit-v1' ? 'Ejecutar validación PIT' : job.id === 'sector-52w-high-leadership-v1' ? 'Ejecutar diagnóstico 52W · rev. técnica 3' : job.id === 'timesfm-stage-a-smoke-v1' ? 'Ejecutar smoke TimesFM 3.0' : job.id === 'pead-yahoo-calendar-source-audit-r3' ? 'Ejecutar audit Yahoo REAL PEAD R3' : 'Comprobar / ejecutar checkpoint'}</button>
            </div>
          </div>
          {resultSummary(job.result)}
          {(job.output || job.error) && <details className="mt-3"><summary className="touch-target flex cursor-pointer items-center text-[10px] font-bold text-slate-500">Salida técnica</summary><pre className="mobile-scroll-x mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-[10px] text-slate-400">{job.error ? `${job.error}\n\n` : ''}{job.output}</pre></details>}
        </div>;
      })}
      {!jobs.length && !error && <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[10px] text-slate-500">No hay una validación de investigación pendiente. Las fases cerradas permanecen en el histórico.</div>}
    </div>

    {history.length > 0 && <details className="mt-4 border-t border-slate-800 pt-3">
      <summary className="touch-target flex cursor-pointer items-center text-[10px] font-bold text-slate-500">Histórico de investigación · {history.length} controles archivados</summary>
      <div className="mt-2 space-y-1.5 text-[9px] leading-relaxed text-slate-600">
        {history.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2">
          <span>{item.label}</span>
          {item.id === PHASE4_JOB_ID && phase4Recovery?.evidenceAvailable && <a href={`${BASE}/phase4-recovery/result.json`} className="rounded border border-cyan-500/20 px-2 py-0.5 font-bold text-cyan-200"><Download className="mr-1 inline h-3 w-3"/>R2 reconstruida</a>}
          {item.id === PHASE4_JOB_ID && !phase4Recovery?.evidenceAvailable && <button type="button" disabled={loading || phase4Recovery?.status === 'RUNNING' || phase4Recovery?.recoveryAllowed === false} onClick={() => void recoverPhase4Evidence()} className="rounded border border-amber-500/25 px-2 py-0.5 font-bold text-amber-200 disabled:opacity-40"><RefreshCw className={`mr-1 inline h-3 w-3 ${phase4Recovery?.status === 'RUNNING' ? 'animate-spin' : ''}`}/>{phase4Recovery?.status === 'RUNNING' ? 'Recuperando evidencia…' : 'Recuperar evidencia perdida'}</button>}
          {item.id === PHASE4_JOB_ID && phase4Recovery?.status === 'FAILED' && <span className="text-rose-300">{phase4Recovery.error || 'Falló la recuperación'}</span>}

          {item.id === PHASE4_JOB_ID && phase4R3?.evidenceAvailable && <a href={`${BASE}/phase4-r3/result.json`} className="rounded border border-emerald-500/25 px-2 py-0.5 font-bold text-emerald-200"><Download className="mr-1 inline h-3 w-3"/>R3 · {phase4R3.verdict ?? 'resultado'}</a>}
          {item.id === PHASE4_JOB_ID && !phase4R3?.evidenceAvailable && phase4Recovery?.evidenceAvailable && <button type="button" disabled={loading || phase4R3?.status === 'RUNNING' || phase4R3?.readyToRun !== true} onClick={() => void runPhase4R3()} className="rounded border border-violet-500/25 px-2 py-0.5 font-bold text-violet-200 disabled:opacity-40"><Play className="mr-1 inline h-3 w-3"/>{phase4R3?.status === 'RUNNING' ? `R3 · ${phase4R3.currentStep ?? 'ejecutando'}` : 'Continuar Fase 4 · R3'}</button>}
          {item.id === PHASE4_JOB_ID && phase4R3?.status === 'FAILED' && <span className="text-rose-300">R3: {phase4R3.error || 'falló el preflight/runner'}</span>}
        </div>)}
      </div>
      {phase4Recovery?.output && <details className="mt-2"><summary className="cursor-pointer text-[9px] font-bold text-slate-500">Salida recuperación Fase 4</summary><pre className="mobile-scroll-x mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-[9px] text-slate-500">{phase4Recovery.output}</pre></details>}
      {phase4R3?.output && <details className="mt-2"><summary className="cursor-pointer text-[9px] font-bold text-slate-500">Salida Fase 4 · R3</summary><pre className="mobile-scroll-x mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-[9px] text-slate-500">{phase4R3.output}</pre></details>}
    </details>}
  </section>;
};
