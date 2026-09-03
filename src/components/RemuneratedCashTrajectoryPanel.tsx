import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CASH_BENCHMARK_UPDATED_EVENT,
  CashBenchmarkService,
  accrueRemuneratedCash
} from '../investment/decision';

const REPLAY_STORAGE_KEY = 'historical_progressive_audit_v3';

type LiveProps = {
  mode: 'LIVE';
  principalEur: number;
  horizonMonths: number;
};

type ReplayProps = {
  mode: 'REPLAY';
};

type Props = LiveProps | ReplayProps;

type ReplayCashPoint = {
  date: string;
  cashEur: number;
  cashBenchmarkEur: number;
};

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
function monthLabel(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
function loadReplayCashPath(): ReplayCashPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REPLAY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.path)) return [];
    return parsed.path
      .filter((point: any) => typeof point?.date === 'string' && Number.isFinite(Number(point?.cashEur)) && Number.isFinite(Number(point?.cashBenchmarkEur)))
      .map((point: any) => ({ date: point.date, cashEur: Number(point.cashEur), cashBenchmarkEur: Number(point.cashBenchmarkEur) }));
  } catch {
    return [];
  }
}

export const RemuneratedCashTrajectoryPanel: React.FC<Props> = props => {
  const [annualPct, setAnnualPct] = useState(() => CashBenchmarkService.load());
  const [replayPath, setReplayPath] = useState<ReplayCashPoint[]>(() => props.mode === 'REPLAY' ? loadReplayCashPath() : []);
  const replaySignatureRef = useRef('');

  useEffect(() => {
    const sync = () => setAnnualPct(CashBenchmarkService.load());
    window.addEventListener(CASH_BENCHMARK_UPDATED_EVENT, sync as EventListener);
    return () => window.removeEventListener(CASH_BENCHMARK_UPDATED_EVENT, sync as EventListener);
  }, []);

  useEffect(() => {
    if (props.mode !== 'REPLAY') return;
    const refresh = () => {
      const next = loadReplayCashPath();
      const last = next.at(-1);
      const signature = `${next.length}|${last?.date ?? ''}|${last?.cashEur ?? ''}|${last?.cashBenchmarkEur ?? ''}`;
      if (signature === replaySignatureRef.current) return;
      replaySignatureRef.current = signature;
      setReplayPath(next);
    };
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, [props.mode]);

  const liveData = useMemo(() => {
    if (props.mode !== 'LIVE') return [];
    const start = new Date();
    const from = isoDate(start);
    const months = Math.max(1, Math.min(120, Math.trunc(props.horizonMonths)));
    return Array.from({ length: months + 1 }, (_, index) => {
      const date = addMonths(start, index);
      const accrued = accrueRemuneratedCash(Math.max(0, props.principalEur), annualPct, from, isoDate(date));
      return { date: monthLabel(date), accountEur: accrued.cashEur, interestEur: accrued.interestEur };
    });
  }, [props, annualPct]);

  const setRate = (value: number) => setAnnualPct(CashBenchmarkService.set(value));

  if (props.mode === 'LIVE') {
    const last = liveData.at(-1);
    const interest = last?.interestEur ?? 0;
    return <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-sky-300"/><b className="text-sm text-white">Cuenta remunerada · cash objetivo del motor</b></div><div className="mt-1 text-[10px] text-slate-400">Proyección separada de la cartera: muestra cómo crecería el efectivo objetivo si no se mueve durante el horizonte seleccionado.</div></div>
        <div className="text-right text-[10px] text-sky-200"><b className="font-mono text-sm">{Math.max(0, props.principalEur).toFixed(2)} €</b><div>{annualPct.toFixed(2)}% TAE</div></div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs"><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Cash inicial</div><b className="font-mono">{Math.max(0, props.principalEur).toFixed(2)} €</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Interés al horizonte</div><b className="font-mono text-emerald-200">+{interest.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Saldo proyectado</div><b className="font-mono text-sky-100">{(last?.accountEur ?? props.principalEur).toFixed(2)} €</b></div></div>
      <div className="mt-3 h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={liveData}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={28}/><YAxis tick={{ fontSize: 9 }} tickFormatter={value => `${Number(value).toFixed(0)}€`}/><Tooltip formatter={(value: any) => [`${Number(value ?? 0).toFixed(2)} €`, 'Cuenta remunerada']}/><Line type="monotone" dataKey="accountEur" name="Cuenta remunerada" dot={false} stroke="#38bdf8" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
      <div className="mt-1 text-[9px] text-slate-500">Escenario bruto a TAE constante; no incluye todavía retención/fiscalidad del interés bancario.</div>
    </section>;
  }

  const latest = replayPath.at(-1);
  return <section className="rounded-xl border border-sky-500/20 bg-slate-950/60 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-sky-300"/><b className="text-sm text-white">Cash del replay · cuenta remunerada</b></div><div className="mt-1 text-[10px] text-slate-400">Azul: cash que realmente conserva el motor y que devenga la TAE entre operaciones. Discontinua: qué habría ocurrido dejando el 100% del capital en cuenta.</div></div>
      <label className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-[10px] text-sky-100"><span className="block font-bold">TAE del próximo replay</span><span className="mt-1 flex items-center gap-2"><input type="number" min="0" max="50" step="0.1" value={annualPct} onChange={event => setRate(Number(event.target.value))} className="w-20 rounded border border-sky-500/30 bg-slate-950 px-2 py-1 text-right font-mono text-white"/>%</span></label>
    </div>
    {latest && <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs"><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Cash real del motor</div><b className="font-mono text-sky-100">{latest.cashEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Todo en cuenta</div><b className="font-mono text-slate-200">{latest.cashBenchmarkEur.toFixed(2)} €</b></div></div>}
    {replayPath.length > 0 ? <div className="mt-3 h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={replayPath}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={28}/><YAxis tick={{ fontSize: 9 }} tickFormatter={value => `${Number(value).toFixed(0)}€`}/><Tooltip formatter={(value: any, name: any) => [`${Number(value ?? 0).toFixed(2)} €`, name]}/><Legend wrapperStyle={{ fontSize: 10 }}/><Line type="monotone" dataKey="cashEur" name="Cash real del motor" dot={false} stroke="#38bdf8" strokeWidth={3}/><Line type="monotone" dataKey="cashBenchmarkEur" name="100% en cuenta" dot={false} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={2}/></LineChart></ResponsiveContainer></div> : <div className="mt-3 rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">La trayectoria aparecerá al ejecutar el primer tramo del replay.</div>}
    <div className="mt-2 text-[9px] text-amber-200/80">Cambiar la TAE no recalcula checkpoints ya guardados. Para usar otro valor, pulsa «Reiniciar replay con esta TAE» antes de volver a ejecutar.</div>
  </section>;
};
