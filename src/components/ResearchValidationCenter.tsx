import React, { useEffect, useState } from 'react';
import { Activity, Play, RefreshCw, TerminalSquare } from 'lucide-react';

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

function resultSummary(result: any): React.ReactNode {
  if (!result) return null;
  const aggregate = result.aggregate ?? {};
  return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Veredicto</div><b className="text-xs text-white">{String(result.verdict ?? 'N/D')}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Anticipación</div><b className="text-sm text-white">{aggregate.anticipationRatePct == null ? 'N/D' : `${Number(aggregate.anticipationRatePct).toFixed(2)}%`}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Lead mediano</div><b className="text-sm text-white">{aggregate.medianLeadSessionsBeforePeak == null ? 'N/D' : `${Number(aggregate.medianLeadSessionsBeforePeak).toFixed(0)} sesiones`}</b></div>
    <div className="rounded-lg bg-slate-950 p-3"><div className="text-[8px] uppercase text-slate-500">Falsa divergencia</div><b className="text-sm text-white">{aggregate.falseDivergenceTimePct == null ? 'N/D' : `${Number(aggregate.falseDivergenceTimePct).toFixed(2)}%`}</b></div>
  </div>;
}

export const ResearchValidationCenter: React.FC = () => {
  const [jobs, setJobs] = useState<ValidationJob[]>([]);
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
        <div><h2 className="font-bold text-white">Validaciones de investigación</h2><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Ejecuta los gates directamente en el backend Node de esta app. No llama a Gemini, no consume tokens de AI Studio y no usa GitHub Actions.</p></div>
      </div>
      <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-900"><RefreshCw className="mr-1 inline h-3 w-3"/>Actualizar</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-3 text-[10px]">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Yahoo Finance</div><b className="mt-1 block text-emerald-200">PRINCIPAL · ACTIVO</b><div className="mt-1 text-slate-600">Histórico y descubrimiento abierto por ticker/ISIN/nombre.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">EODHD</div><b className={`mt-1 block ${providerClass(eodhd?.configured ?? null)}`}>{eodhd == null ? 'COMPROBANDO…' : eodhd.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">NAV de fondos + contraste secundario.</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="uppercase text-slate-500">Alpha Vantage</div><b className={`mt-1 block ${providerClass(alpha?.configured ?? null)}`}>{alpha == null ? 'COMPROBANDO…' : alpha.configured ? 'CONFIGURADO' : 'SIN API KEY'}</b><div className="mt-1 text-slate-600">Contraste secundario; no bloquea Yahoo.</div></div>
    </div>

    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-[10px] text-rose-100">{error}</div>}
    <div className="mt-4 space-y-3">
      {jobs.map(job => <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-violet-300"/><b className="text-sm text-white">{job.name}</b><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${badge(job.status)}`}>{job.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{job.description}</p>{job.currentStep && <div className="mt-2 text-[10px] text-cyan-200">Ejecutando: {job.currentStep}</div>}</div>
          <button type="button" disabled={loading || job.status === 'RUNNING'} onClick={() => void run(job.id)} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-black text-emerald-100 disabled:opacity-40"><Play className="mr-1 inline h-3 w-3"/>{job.status === 'RUNNING' ? 'En ejecución' : 'Ejecutar sin IA'}</button>
        </div>
        {resultSummary(job.result)}
        {(job.output || job.error) && <details className="mt-3"><summary className="cursor-pointer text-[9px] font-bold text-slate-500">Salida técnica</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-[9px] text-slate-400">{job.error ? `${job.error}\n\n` : ''}{job.output}</pre></details>}
      </div>)}
      {!jobs.length && !error && <div className="text-[10px] text-slate-500">Cargando validaciones disponibles…</div>}
    </div>
  </section>;
};