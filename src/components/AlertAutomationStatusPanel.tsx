import React, { useEffect, useState } from 'react';
import { BellRing, Clock3, ServerCog } from 'lucide-react';

interface AlertAutomationStatus {
  enabled: boolean;
  timezone: string;
  runTimeLocal: string;
  notificationChannelConfigured: boolean;
  lastSuccessAt: string | null;
  lastMarketDate: string | null;
  lastEvidenceState: string | null;
  lastNotificationAt: string | null;
  lastNotificationEventCount: number;
  lastNotificationEventKeys: string[];
  lastErrorPresent: boolean;
  lastAlertCount: number;
}

export const AlertAutomationStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<AlertAutomationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/alerts/status')
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { if (alive) setStatus(data); })
      .catch(err => { if (alive) setError(err?.message || String(err)); });
    return () => { alive = false; };
  }, []);

  return <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-sky-300"/><h3 className="font-bold">Alarmas autónomas</h3></div><p className="mt-1 text-[11px] text-slate-400">Comprobación diaria de oportunidades de entrada. Solo avisa cuando aparece una BUENA OPORTUNIDAD nueva o una señal existente escala a ALTA CONVICCIÓN; mantener la misma señal otro día no repite el aviso.</p></div>
      {status && <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${status.enabled ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{status.enabled ? 'ACTIVADAS' : 'DESACTIVADAS'}</span>}
    </div>

    {error && <div className="mt-3 text-xs text-amber-300">No se pudo leer el estado del scheduler: {error}</div>}
    {status && <>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><Clock3 className="mb-1 h-3.5 w-3.5 text-sky-300"/><div className="text-slate-500">Comprobación</div><b>{status.runTimeLocal}</b><div className="text-[10px] text-slate-600">{status.timezone}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Último mercado</div><b>{status.lastMarketDate ?? '—'}</b><div className="text-[10px] text-slate-600">{status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString('es-ES') : 'sin ejecución'}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Evidencia</div><b>{status.lastEvidenceState ?? '—'}</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><BellRing className="mb-1 h-3.5 w-3.5 text-amber-300"/><div className="text-slate-500">Último aviso</div><b>{status.lastNotificationEventCount > 0 ? `${status.lastNotificationEventCount} evento(s)` : status.lastNotificationAt ? 'sin evento nuevo hoy' : 'sin envío registrado'}</b><div className="text-[10px] text-slate-600">{status.notificationChannelConfigured ? 'canal configurado' : 'canal sin configurar'}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Último análisis</div><b>{status.lastAlertCount} entrada(s) válida(s)</b><div className={`text-[10px] ${status.lastErrorPresent ? 'text-rose-300' : 'text-slate-600'}`}>{status.lastErrorPresent ? 'error registrado en backend' : 'sin error registrado'}</div></div>
      </div>
      {status.lastNotificationEventKeys.length > 0 && <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 font-mono text-[10px] text-emerald-200">Últimos eventos avisados: {status.lastNotificationEventKeys.join(' · ')}</div>}
      <div className="mt-2 text-[10px] text-slate-600">La alarma de entrada es backend. REDUCE/EXIT depende de la cartera real y solo puede ser autónoma con la app cerrada cuando esa cartera se sincronice a almacenamiento persistente del despliegue.</div>
    </>}
  </section>;
};
