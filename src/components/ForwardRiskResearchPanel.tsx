import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert } from 'lucide-react';
import type { ForwardRiskForecastResult } from '../investment/decision/forwardRiskForecast';

const STORAGE_KEY = 'historical_progressive_audit_v3';
const AUDIT_BROADCAST_CHANNEL = 'historical-replay-audit-v3';

function extractFromSession(raw: string | null): ForwardRiskForecastResult | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    const direct = session?.summary?.forwardRiskForecastV1;
    if (direct?.version === 'FORWARD_RISK_FORECAST_V1') return direct;
    for (const signal of Array.isArray(session?.signals) ? session.signals : []) {
      const candidate = signal?.auditExtensions?.forwardRiskForecastV1;
      if (candidate?.version === 'FORWARD_RISK_FORECAST_V1') return candidate;
    }
  } catch { /* audit card is diagnostic-only */ }
  return null;
}

function money(value: number | null | undefined): string { return value == null ? 'N/D' : `${value.toFixed(2)} €`; }
function pct(value: number | null | undefined, suffix = '%'): string { return value == null ? 'N/D' : `${value.toFixed(2)}${suffix}`; }

export const ForwardRiskResearchPanel: React.FC = () => {
  const [result, setResult] = useState<ForwardRiskForecastResult | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractFromSession(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    const sync = () => setResult(extractFromSession(window.localStorage.getItem(STORAGE_KEY)));
    const timer = window.setInterval(sync, 1000);
    if (typeof BroadcastChannel === 'undefined') return () => window.clearInterval(timer);
    const channel = new BroadcastChannel(AUDIT_BROADCAST_CHANNEL);
    channel.onmessage = event => {
      if (event.data?.type === 'FORWARD_RISK_FORECAST_V1') setResult(event.data.forecast ?? null);
    };
    return () => { window.clearInterval(timer); channel.close(); };
  }, []);

  if (!result) return null;
  const metrics = result.modelMetrics;
  const frictionless = result.frictionless;
  const realistic = result.realistic;
  const benchmark = result.benchmark;
  const pass = result.economicPassRealistic === true && result.predictiveSignalPass === true;
  const inconclusive = result.status !== 'VALID';

  return <section className={`mt-5 rounded-2xl border p-5 ${inconclusive ? 'border-slate-700 bg-slate-900/60' : pass ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-amber-500/30 bg-amber-950/10'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2"><Activity className="h-5 w-5 text-violet-200"/></div>
        <div>
          <h2 className="font-bold text-white">Forward Risk Forecast V1 · investigación causal</h2>
          <p className="mt-1 max-w-3xl text-[11px] text-slate-400">Predice drawdown futuro a 5/20/60 sesiones con entrenamiento walk-forward. No modifica Custodia ni la cartera real; toda señal ejecuta al siguiente open.</p>
        </div>
      </div>
      <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${inconclusive ? 'border-slate-600 text-slate-300' : pass ? 'border-emerald-500/30 text-emerald-200' : 'border-amber-500/30 text-amber-200'}`}>
        {inconclusive ? 'DATOS INSUFICIENTES' : pass ? 'CANDIDATO PASS' : 'NO APROBADO'}
      </span>
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map(metric => <div key={metric.horizonSessions} className="rounded-xl bg-slate-950/70 p-3">
        <div className="text-[8px] uppercase text-slate-500">Pérdida ≥{metric.drawdownThresholdPct}% · {metric.horizonSessions}d</div>
        <b className="text-sm text-white">AUC {metric.auc == null ? 'N/D' : metric.auc.toFixed(3)}</b>
        <div className="text-[9px] text-slate-400">Brier {metric.brier == null ? 'N/D' : metric.brier.toFixed(3)} · lift top10 {metric.liftVsBaseRate == null ? 'N/D' : `${metric.liftVsBaseRate.toFixed(2)}x`}</div>
      </div>)}
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[8px] uppercase text-slate-500">100% core · {result.coreTicker ?? 'global'}</div><b className="text-sm text-white">{money(benchmark?.finalEur)}</b><div className="text-[9px] text-slate-400">{pct(benchmark?.returnPct)} · DD -{pct(benchmark?.maxDrawdownPct)}</div></div>
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[8px] uppercase text-slate-500">Predictor · sin fricción</div><b className={result.excessFinalEurFrictionless != null && result.excessFinalEurFrictionless > 0 ? 'text-sm text-emerald-200' : 'text-sm text-white'}>{money(frictionless?.finalEur)}</b><div className="text-[9px] text-slate-400">Δ {money(result.excessFinalEurFrictionless)} · DD -{pct(frictionless?.maxDrawdownPct)}</div></div>
      <div className="rounded-xl bg-slate-950/70 p-3"><div className="text-[8px] uppercase text-slate-500">Predictor · realista</div><b className={result.excessFinalEurRealistic != null && result.excessFinalEurRealistic > 0 ? 'text-sm text-emerald-200' : 'text-sm text-rose-200'}>{money(realistic?.finalEur)}</b><div className="text-[9px] text-slate-400">Δ {money(result.excessFinalEurRealistic)} · DD -{pct(realistic?.maxDrawdownPct)}</div></div>
    </div>

    <div className="mt-3 grid gap-2 md:grid-cols-3 text-[10px]">
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-slate-400">Forecasts OOS: <b className="text-white">{result.forecastsEvaluated}</b> · cambios de exposición: <b className="text-white">{result.exposureChanges}</b> · exposición media realista: <b className="text-white">{pct(realistic?.averageCoreExposurePct)}</b>.</div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-slate-400">Costes realistas: fees <b className="text-white">{money(realistic?.feesEur)}</b> · impuesto conservador <b className="text-white">{money(realistic?.estimatedTaxEur)}</b> · cash neto <b className="text-white">{money(realistic?.cashInterestNetEur)}</b>.</div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-slate-400">Diagnóstico: <b className="text-white">{result.diagnosticSeriesUsed.join(', ') || 'sin VIX'}</b>{result.diagnosticSeriesMissing.length ? ` · faltan ${result.diagnosticSeriesMissing.join(', ')}` : ''}.</div>
    </div>

    {!pass && !inconclusive && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0"/>No se integra en producción. Para aprobar debe existir señal predictiva en los tres horizontes y superar neto al mismo core sin empeorar materialmente el drawdown.</div>}
  </section>;
};