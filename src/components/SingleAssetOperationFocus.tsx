import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { SingleAssetResearchResult, SingleAssetResearchSignal } from '../investment/decision';

type WindowSessions = 20 | 60 | 120;

interface Props {
  result: SingleAssetResearchResult;
}

function actionLabel(action: SingleAssetResearchSignal['action']): string {
  if (action === 'BUY') return 'COMPRAR';
  if (action === 'ADD') return 'AÑADIR';
  return 'SALIR / REDUCIR';
}

function signedPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'N/D';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function FocusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl">
    <div className="font-mono text-slate-400">{label}</div>
    <div className="mt-1 font-bold text-white">Precio / NAV {Number(row?.price ?? 0).toFixed(2)}</div>
    {row?.returnFromExecutionPct != null && <div className={row.returnFromExecutionPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>Desde ejecución: {signedPct(row.returnFromExecutionPct)}</div>}
  </div>;
}

function SelectedShape(props: any) {
  const { cx = 0, cy = 0 } = props;
  return <circle cx={cx} cy={cy} r={6} fill="#f8fafc" stroke="#22d3ee" strokeWidth={3}/>;
}

export const SingleAssetOperationFocus: React.FC<Props> = ({ result }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [windowSessions, setWindowSessions] = useState<WindowSessions>(60);

  useEffect(() => {
    setSelectedId(result.signals.at(-1)?.id ?? null);
  }, [result]);

  const selected = useMemo(() => result.signals.find(signal => signal.id === selectedId) ?? result.signals.at(-1) ?? null, [result, selectedId]);

  const focus = useMemo(() => {
    if (!selected || !result.chart.length) return { rows: [], beforeDate: null as string | null, afterDate: null as string | null, after20: null as number | null, after60: null as number | null, after120: null as number | null };
    const executionIndex = result.chart.findIndex(point => point.date === selected.executionDate);
    if (executionIndex < 0) return { rows: [], beforeDate: null, afterDate: null, after20: null, after60: null, after120: null };
    const start = Math.max(0, executionIndex - windowSessions);
    const end = Math.min(result.chart.length - 1, executionIndex + windowSessions);
    const rows = result.chart.slice(start, end + 1).map((point, localIndex) => {
      const originalIndex = start + localIndex;
      return {
        date: point.date,
        price: point.close,
        selectedPrice: originalIndex === executionIndex ? selected.executionPrice : null,
        returnFromExecutionPct: selected.executionPrice > 0 ? (point.close / selected.executionPrice - 1) * 100 : null
      };
    });
    const forwardReturn = (sessions: number) => {
      const point = result.chart[Math.min(result.chart.length - 1, executionIndex + sessions)];
      return point && selected.executionPrice > 0 ? (point.close / selected.executionPrice - 1) * 100 : null;
    };
    return {
      rows,
      beforeDate: rows[0]?.date ?? null,
      afterDate: rows.at(-1)?.date ?? null,
      after20: executionIndex + 20 < result.chart.length ? forwardReturn(20) : null,
      after60: executionIndex + 60 < result.chart.length ? forwardReturn(60) : null,
      after120: executionIndex + 120 < result.chart.length ? forwardReturn(120) : null
    };
  }, [result, selected, windowSessions]);

  if (!result.signals.length) return null;

  return <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-950/55 p-3">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <b className="text-sm text-white">Vista centrada en una operación</b>
        <div className="mt-1 text-[9px] text-slate-500">Selecciona una señal para ver qué ocurrió antes y después. La parte posterior es diagnóstico ex post y nunca entra en la decisión causal del motor.</div>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">{([20, 60, 120] as WindowSessions[]).map(value => <button key={value} type="button" onClick={() => setWindowSessions(value)} className={`rounded-lg border px-2.5 py-1.5 font-bold ${windowSessions === value ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 text-slate-400'}`}>±{value} sesiones</button>)}</div>
    </div>

    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{[...result.signals].reverse().map(signal => <button key={signal.id} type="button" onClick={() => setSelectedId(signal.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-[9px] ${selected?.id === signal.id ? 'border-cyan-500/50 bg-cyan-500/15 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'}`}><div className={`font-black ${signal.action === 'BUY' ? 'text-emerald-300' : signal.action === 'ADD' ? 'text-cyan-300' : 'text-rose-300'}`}>{actionLabel(signal.action)}</div><div className="mt-0.5 font-mono">{signal.executionDate}</div><div className="font-mono">{signal.executionPrice.toFixed(2)}</div></button>)}</div>

    {selected && <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6 text-[10px]">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">Acción</div><b className={selected.action === 'BUY' ? 'text-emerald-300' : selected.action === 'ADD' ? 'text-cyan-300' : 'text-rose-300'}>{actionLabel(selected.action)}</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">Señal</div><b className="font-mono text-white">{selected.signalDate}</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">Ejecución</div><b className="font-mono text-white">{selected.executionDate}</b><div className="font-mono text-slate-400">{selected.executionPrice.toFixed(2)}</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">Consenso</div><b className="font-mono text-white">{selected.consensusScore >= 0 ? '+' : ''}{selected.consensusScore}</b><div className="text-slate-500">{selected.favorableVotes} fav. · {selected.unfavorableVotes} adv.</div></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">+20 sesiones</div><b className={(focus.after20 ?? 0) >= 0 ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>{signedPct(focus.after20)}</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="uppercase text-slate-500">+60 / +120</div><b className={(focus.after60 ?? 0) >= 0 ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>{signedPct(focus.after60)}</b><div className="font-mono text-slate-500">{signedPct(focus.after120)}</div></div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400"><b className="text-slate-200">Motivo causal de la señal:</b> {selected.reason}</div>

      <div className="mt-3 h-[330px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={focus.rows} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={34} tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis domain={['auto','auto']} width={62} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => Number(value).toFixed(0)}/><Tooltip content={<FocusTooltip/>}/><ReferenceLine x={selected.executionDate} stroke="#22d3ee" strokeDasharray="4 4" label={{ value: actionLabel(selected.action), fill: '#67e8f9', fontSize: 9 }}/><Line type="monotone" dataKey="price" name="Precio / NAV" stroke="#94a3b8" strokeWidth={2} dot={false}/><Scatter dataKey="selectedPrice" name="Ejecución" shape={<SelectedShape/>}/></ComposedChart></ResponsiveContainer></div>
      <div className="mt-2 text-[9px] text-slate-600">Ventana visible: {focus.beforeDate ?? 'N/D'} → {focus.afterDate ?? 'N/D'}. Los retornos +20/+60/+120 se calculan únicamente para explicar ex post la trayectoria posterior de una decisión ya tomada.</div>
    </>}
  </div>;
};
