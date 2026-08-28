import React, { useEffect, useState } from 'react';
import { BellRing, Clock3, ServerCog } from 'lucide-react';

interface AlertAutomationStatus {
  enabled: boolean;
  timezone: string;
  runTimeLocal: string;
  webhookConfigured: boolean;
  capitalEur: number;
  riskProfile: string;
  horizonYears: number;
  state: {
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastRunLocalDate?: string | null;
    lastMarketDate: string | null;
    lastError: string | null;
    lastAlerts: Array<{ type: string; severity: string; ticker?: string; title: string }>;
    lastEvidenceState: string | null;
    lastNotificationAt: string | null;
  };
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
      <div><div className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-sky-300"/><h3 className="font-bold">Alarmas autónomas</h3></div><p className="mt-1 text-[11px] text-slate-400">Estado del job diario del servidor. Puede seguir comprobando oportunidades aunque el navegador esté cerrado, siempre que el servidor esté activo.</p></div>
      {status && <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${status.enabled ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{status.enabled ? 'ACTIVADAS' : 'DESACTIVADAS'}</span>}
    </div>

    {error && <div className="mt-3 text-xs text-amber-300">No se pudo leer el estado del scheduler: {error}</div>}
    {status && <>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><Clock3 className="mb-1 h-3.5 w-3.5 text-sky-300"/><div className="text-slate-500">Comprobación</div><b>{status.runTimeLocal}</b><div className="text-[10px] text-slate-600">{status.timezone}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Perfil</div><b>{status.riskProfile}</b><div className="text-[10px] text-slate-600">{status.capitalEur} € · {status.horizonYears} años</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Último mercado</div><b>{status.state.lastMarketDate ?? '—'}</b><div className="text-[10px] text-slate-600">{status.state.lastSuccessAt ? new Date(status.state.lastSuccessAt).toLocaleString('es-ES') : 'sin ejecución'}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Evidencia</div><b>{status.state.lastEvidenceState ?? '—'}</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><BellRing className="mb-1 h-3.5 w-3.5 text-amber-300"/><div className="text-slate-500">Canal de aviso</div><b>{status.webhookConfigured ? 'CONFIGURADO' : 'SIN CONFIGURAR'}</b></div>
      </div>
      {status.state.lastError && <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">Último error: {status.state.lastError}</div>}
      {status.state.lastAlerts?.length > 0 && <div className="mt-3 text-xs text-slate-400">Última ejecución: {status.state.lastAlerts.length} alerta(s) · {status.state.lastAlerts.slice(0,4).map(a => `${a.type}${a.ticker ? ` ${a.ticker}` : ''}`).join(' · ')}</div>}
      <div className="mt-2 text-[10px] text-slate-600">La activación y el webhook se configuran únicamente en secretos/variables del backend; nunca se exponen ni se guardan en el navegador.</div>
    </>}
  </section>;
};
