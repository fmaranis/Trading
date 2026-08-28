import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, History, Radar, ShieldCheck, TrendingUp } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  assessCrossProviderEvidence,
  AssetUniverseScanResult,
  CrossProviderEvidenceQuality,
  InvestmentDecisionResult,
  MarketSnapshotEntry,
  MarketSnapshotHistoryService,
  OpportunityAlert,
  OpportunityAlertEngine
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  eodhdValidation: EodhdCrossValidationResult | null;
}

function evidenceFrom(validation: EodhdCrossValidationResult | null): CrossProviderEvidenceQuality | null {
  if (!validation) return null;
  return assessCrossProviderEvidence({
    primaryProvider: 'Yahoo Finance',
    secondaryProvider: 'EODHD',
    requested: validation.requested,
    checked: validation.checked,
    matched: validation.matched,
    divergent: validation.divergent,
    summaryState: validation.summaryState,
    checkedAt: validation.checkedAt
  });
}

function severityClass(severity: OpportunityAlert['severity']): string {
  if (severity === 'MATERIAL') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (severity === 'REVIEW') return 'border-sky-500/25 bg-sky-500/10 text-sky-100';
  return 'border-slate-700 bg-slate-950 text-slate-200';
}

function stateLabel(state: string): string {
  switch (state) {
    case 'CROSS_PROVIDER_CONFIRMED': return 'Yahoo + EODHD confirmados';
    case 'CROSS_PROVIDER_PARTIAL': return 'Validación parcial';
    case 'CROSS_PROVIDER_DIVERGENCE': return 'Divergencia de datos';
    case 'CROSS_PROVIDER_UNAVAILABLE': return 'Segundo proveedor no disponible';
    default: return 'Yahoo primario';
  }
}

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, eodhdValidation }) => {
  const evidence = useMemo(() => evidenceFrom(eodhdValidation), [eodhdValidation]);
  const [alerts, setAlerts] = useState<OpportunityAlert[]>([]);
  const [history, setHistory] = useState<MarketSnapshotEntry[]>(() => MarketSnapshotHistoryService.load());

  useEffect(() => {
    const previousSnapshot = MarketSnapshotHistoryService.latestBefore(decision.asOfDate, decision.riskProfile, decision.horizonYears);
    const previousDecision = previousSnapshot ? MarketSnapshotHistoryService.asDecisionHistoryEntry(previousSnapshot) : null;
    const nextAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousDecision, evidence });
    setAlerts(nextAlerts);
    setHistory(MarketSnapshotHistoryService.saveDaily(scan, decision, evidence, nextAlerts));
  }, [scan, decision, evidence]);

  const opportunityCount = alerts.filter(a => a.type === 'OPPORTUNITY').length;
  const riskCount = alerts.filter(a => a.type === 'RISK' || a.type === 'DATA_WARNING').length;
  const materialCount = alerts.filter(a => a.severity === 'MATERIAL').length;

  return <section className="space-y-4 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/35 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h2 className="text-lg font-bold text-white">Mercado, oportunidades y alertas</h2></div>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">El motor compara la situación actual con snapshots anteriores. Las alertas indican qué merece revisión; no son órdenes automáticas de compra o venta.</p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"><History className="mr-1 inline h-3.5 w-3.5"/> {history.length} snapshots guardados localmente</div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4"><div className="text-[10px] uppercase text-indigo-300">Régimen</div><div className="mt-1 font-bold">{decision.marketRegime}</div></div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="text-[10px] uppercase text-emerald-300">Evidencia</div><div className="mt-1 font-bold">{stateLabel(evidence?.state ?? 'PRIMARY_ONLY')}</div><div className="mt-1 text-xs text-slate-400">{evidence ? `${evidence.checked}/${evidence.requested} comparados · ${evidence.divergent} divergencias` : 'Esperando contraste EODHD'}</div></div>
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4"><div className="text-[10px] uppercase text-sky-300">Oportunidades</div><div className="mt-1 text-2xl font-bold">{opportunityCount}</div><div className="text-xs text-slate-400">candidatos que superan reglas</div></div>
      <div className={`rounded-xl border p-4 ${riskCount ? 'border-amber-500/25 bg-amber-500/10' : 'border-slate-700 bg-slate-950'}`}><div className="text-[10px] uppercase text-slate-400">Atención</div><div className="mt-1 text-2xl font-bold">{riskCount}</div><div className="text-xs text-slate-400">riesgo o datos a revisar</div></div>
    </div>

    {evidence?.state === 'CROSS_PROVIDER_CONFIRMED' && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><div><b>Evidencia cruzada confirmada.</b> {evidence.summary} Esta capa mejora trazabilidad, pero no aumenta silenciosamente los pesos de cartera ni representa probabilidad de beneficio.</div></div>}

    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-amber-300"/><h3 className="font-bold">Alertas activas</h3></div><span className="text-xs text-slate-500">{materialCount} materiales</span></div>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 && <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-500">No hay cambios materiales ni oportunidades que superen los umbrales actuales.</div>}
          {alerts.map(alert => <div key={alert.id} className={`rounded-xl border p-3 ${severityClass(alert.severity)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{alert.title}</div><div className="text-[10px] font-bold uppercase">{alert.type} · {alert.severity}</div></div>
            <div className="mt-1 text-sm text-slate-200">{alert.message}</div>
            <div className="mt-2 text-[11px] text-slate-400">{alert.reasons.join(' · ')}</div>
          </div>)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-300"/><h3 className="font-bold">Top del scanner</h3></div>
        <div className="mt-3 space-y-2">
          {[...scan.selected].sort((a,b)=>(b.score ?? -999)-(a.score ?? -999)).slice(0,5).map((c, i) => <div key={c.asset.assetId} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm"><div><b>#{i + 1} {c.asset.ticker}</b><div className="text-[10px] text-slate-500">Mom. 120d {c.momentum120Pct?.toFixed(1) ?? '—'}% · Vol {c.annualizedVolatilityPct?.toFixed(1) ?? '—'}%</div></div><div className="font-mono text-violet-300">{c.score?.toFixed(2) ?? '—'}</div></div>)}
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2"><History className="h-4 w-4 text-sky-300"/><h3 className="font-bold">Historial reciente</h3></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Régimen</th><th className="p-2 text-left">Top candidato</th><th className="p-2 text-right">Alertas</th><th className="p-2 text-right">Evidencia</th></tr></thead><tbody>{history.slice(0,8).map(h => <tr key={h.id} className="border-t border-slate-800"><td className="p-2 font-mono">{h.asOfDate}</td><td className="p-2">{h.marketRegime}</td><td className="p-2 font-mono">{[...h.shortlist].sort((a,b)=>(b.score ?? -999)-(a.score ?? -999))[0]?.ticker ?? '—'}</td><td className="p-2 text-right">{h.alerts.length}</td><td className="p-2 text-right">{h.evidenceState === 'CROSS_PROVIDER_CONFIRMED' ? 'CONFIRMADA' : h.evidenceState}</td></tr>)}</tbody></table></div>
      <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/>El historial se guarda ahora en este navegador. Para alarmas que funcionen con la web cerrada hará falta ejecutar el scanner en backend con una programación diaria y un canal de notificación.</div>
    </div>

    {riskCount > 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>Hay una alerta de riesgo/calidad de datos. Debe resolverse o revisarse antes de interpretar una oportunidad como evidencia robusta.</div>}
  </section>;
};
