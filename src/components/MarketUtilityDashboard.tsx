import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, History, Radar } from 'lucide-react';
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
import { AlertAutomationStatusPanel } from './AlertAutomationStatusPanel';
import { UserPortfolioPanel } from './UserPortfolioPanel';
import { RecommendationSimulationPanel } from './RecommendationSimulationPanel';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';
import { HistoricalDecisionReplayPanel } from './HistoricalDecisionReplayPanel';

interface Props { scan: AssetUniverseScanResult; decision: InvestmentDecisionResult; eodhdValidation: EodhdCrossValidationResult | null; }

function evidenceFrom(validation: EodhdCrossValidationResult | null): CrossProviderEvidenceQuality | null {
  if (!validation) return null;
  return assessCrossProviderEvidence({ primaryProvider: 'Yahoo Finance', secondaryProvider: 'EODHD', requested: validation.requested, checked: validation.checked, matched: validation.matched, divergent: validation.divergent, summaryState: validation.summaryState, checkedAt: validation.checkedAt });
}
function severityClass(severity: OpportunityAlert['severity']): string {
  if (severity === 'MATERIAL') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (severity === 'REVIEW') return 'border-sky-500/25 bg-sky-500/10 text-sky-100';
  return 'border-slate-700 bg-slate-950 text-slate-200';
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

  const materialCount = alerts.filter(a => a.severity === 'MATERIAL').length;

  return <section className="space-y-4">
    <PortfolioExecutionPlanPanel scan={scan} decision={decision} />
    <UserPortfolioPanel scan={scan} decision={decision} />
    <HistoricalDecisionReplayPanel scan={scan} capitalEur={decision.capitalEur} riskProfile={decision.riskProfile} horizonYears={decision.horizonYears} />
    <RecommendationSimulationPanel scan={scan} snapshots={history} />

    <section className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h2 className="text-lg font-bold">Alertas y seguimiento</h2></div><p className="mt-1 text-xs text-slate-400">Cambios respecto a recomendaciones anteriores. Las operaciones actuales, la cartera y las simulaciones históricas están arriba en el mismo flujo.</p></div><div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"><History className="mr-1 inline h-3.5 w-3.5"/>{history.length} recomendaciones guardadas</div></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-amber-300"/><h3 className="font-bold">Alertas activas</h3></div><span className="text-xs text-slate-500">{materialCount} materiales</span></div><div className="mt-3 space-y-2">{alerts.length === 0 && <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-500">Sin cambios materiales que requieran revisión.</div>}{alerts.map(alert => <div key={alert.id} className={`rounded-xl border p-3 ${severityClass(alert.severity)}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{alert.title}</div><div className="text-[10px] font-bold uppercase">{alert.type} · {alert.severity}</div></div><div className="mt-1 text-sm text-slate-200">{alert.message}</div><div className="mt-2 text-[11px] text-slate-400">{alert.reasons.join(' · ')}</div></div>)}</div></div><AlertAutomationStatusPanel /></div>
    </section>

    <details className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><summary className="cursor-pointer font-bold">Historial de recomendaciones</summary><div className="mt-2 text-[11px] text-slate-500">Estas snapshots alimentan el simulador de arriba y permiten comprobar qué habría ocurrido si hubieras seguido cada recomendación.</div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Régimen</th><th className="p-2 text-left">Top candidato</th><th className="p-2 text-right">Alertas</th><th className="p-2 text-right">Evidencia</th></tr></thead><tbody>{history.slice(0,12).map(h => <tr key={h.id} className="border-t border-slate-800"><td className="p-2 font-mono">{h.asOfDate}</td><td className="p-2">{h.marketRegime}</td><td className="p-2 font-mono">{[...h.shortlist].sort((a,b)=>(b.score ?? -999)-(a.score ?? -999))[0]?.ticker ?? '—'}</td><td className="p-2 text-right">{h.alerts.length}</td><td className="p-2 text-right">{h.evidenceState === 'CROSS_PROVIDER_CONFIRMED' ? 'CONFIRMADA' : h.evidenceState}</td></tr>)}</tbody></table></div></details>
  </section>;
};
