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
}
interface ValidationHistoryItem { id: string; label: string; }
interface ProviderStatus { provider: string; configured: boolean; role?: string; primaryProvider?: string; }
interface ValidationPrerequisites { githubReplaySyncConfigured: boolean; }

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
  if (reason === 'QUALITY_FF_DURABLE_GITHUB_TOKEN_REQUIRED') {
    return 'Falta GITHUB_REPLAY_SYNC_TOKEN en el backend. El job no arrancará hasta que el secreto esté disponible; no se consumirá ninguna observación.';
  }
  return reason || null;
}

export const ResearchValidationCenter: React.FC = () => {
  const [jobs, setJobs] = useState<ValidationJob[]>([]);
  const [history, setHistory] = useState<ValidationHistoryItem[]>([]);
  const [prerequisites, setPrerequisites] = useState<ValidationPrerequisites | null>(null);
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
      setPrerequisites(payload?.prerequisites ?? null);
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
      if (!response.ok) {
        if (response.status === 409 && payload?.error === 'VALIDATION_ALREADY_RUNNING') { await refresh(); return; }
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
        <div><h2 className="font-bold text-white">Validación de investigación</h2><p className="mt-1 max-w-3xl text-[11px] text-slate-400">La pantalla resume qué ocurrió y qué debes hacer después. El JSON es evidencia técnica, no la única forma de interpretar el resultado. Todo se ejecuta en el backend local, sin IA ni GitHub Actions.</p></div>
      </div>
      <button type="button" onClick={() => void refresh()} className="touch-target w-full rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900 sm:w-auto"><RefreshCw className="mr-1 inline h-3.5 w-3.5"/>Actualizar estado</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-[10px]">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Yahoo Finance</div><b className="mt-1 block text-emerald-200">PRINCIPAL · ACTIVO</b><div className="mt-1 text-slate-600">Histórico REAL y discovery current/live.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">EODHD</div><b className={`mt-1 block ${providerClass(eodhd?.configured ?? null)}`}>{eodhd == null ? 'COMPROBANDO…' : eodhd.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario y fondos.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Alpha Vantage</div><b className={`mt-1 block ${providerClass(alpha?.configured ?? null)}`}>{alpha == null ? 'COMPROBANDO…' : alpha.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario; no bloquea Yahoo.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Persistencia future-forward</div><b className={`mt-1 block ${providerClass(prerequisites?.githubReplaySyncConfigured ?? null)}`}>{prerequisites == null ? 'COMPROBANDO…' : prerequisites.githubReplaySyncConfigured ? 'GITHUB LISTO' : 'FALTA TOKEN'}</b><div className="mt-1 text-slate-600">Preflight antes de guards; nunca consume un mes si falta la credencial.</div></div>
    </div>

    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-[11px] text-rose-100">{error}</div>}
    <div className="mt-4 space-y-3">
      {jobs.map(job => {
        const blocked = blockedMessage(job.blockedReason);
        return <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Activity className="h-4 w-4 text-violet-300"/><b className="text-sm text-white">{job.name}</b><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${badge(job.status)}`}>{job.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{job.description}</p>{job.currentStep && <div className="mt-2 text-[10px] text-cyan-200">Ejecutando: {job.currentStep}</div>}{blocked && <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2 text-[10px] text-amber-200">{blocked}</div>}</div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {job.result != null && <a href={`${BASE}/jobs/${encodeURIComponent(job.id)}/result.json`} className="touch-target flex w-full items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[11px] font-black text-cyan-100 sm:w-auto"><Download className="mr-1 h-3.5 w-3.5"/>Evidencia JSON</a>}
              <button type="button" disabled={loading || job.status === 'RUNNING' || job.readyToRun === false} onClick={() => void run(job.id)} className="touch-target w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[11px] font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Play className="mr-1 inline h-3.5 w-3.5"/>{job.status === 'RUNNING' ? 'En ejecución' : job.readyToRun === false ? 'Bloqueado por preflight' : 'Comprobar / ejecutar checkpoint'}</button>
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
      <div className="mt-2 text-[9px] leading-relaxed text-slate-600">{history.map(item => item.label).join(' · ')}</div>
    </details>}
  </section>;
};