import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, History, Radar, WalletCards } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  assessBrokerExecutionQuality,
  assessCrossProviderEvidence,
  assessExecutionFidelity,
  AssetUniverseScanResult,
  buildWholeShareExecutionPlan,
  CrossProviderEvidenceQuality,
  estimateMinimumDiversifiedCapital,
  InvestmentDecisionResult,
  MarketSnapshotEntry,
  MarketSnapshotHistoryService,
  MYINVESTOR_BROKER_PROFILE,
  OpportunityAlert,
  OpportunityAlertEngine
} from '../investment/decision';
import { AlertAutomationStatusPanel } from './AlertAutomationStatusPanel';
import { UserPortfolioPanel } from './UserPortfolioPanel';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';

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

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, eodhdValidation }) => {
  const evidence = useMemo(() => evidenceFrom(eodhdValidation), [eodhdValidation]);
  const [alerts, setAlerts] = useState<OpportunityAlert[]>([]);
  const [history, setHistory] = useState<MarketSnapshotEntry[]>(() => MarketSnapshotHistoryService.load());

  const execution = useMemo(() => {
    const listedSelected = scan.selected.filter(c => c.asset.instrumentType !== 'MUTUAL_FUND');
    const listedIds = new Set(listedSelected.map(c => c.asset.assetId));
    const listedAssetsRaw = decision.assets.filter(a => listedIds.has(a.assetId) && a.amountEur > 0.01);
    const listedBudgetEur = listedAssetsRaw.reduce((s, a) => s + a.amountEur, 0);
    const listedAssets = listedAssetsRaw.map(a => ({
      ...a,
      weight: listedBudgetEur > 0 ? a.amountEur / listedBudgetEur : 0
    }));
    const prices = Object.fromEntries(listedSelected.map(c => [c.asset.assetId, Number(c.lastClose ?? 0)]));
    const plan = buildWholeShareExecutionPlan(listedBudgetEur, listedAssets, prices, MYINVESTOR_BROKER_PROFILE);
    const quality = assessBrokerExecutionQuality(plan, {
      minimumPositions: 2,
      maximumSinglePositionPct: 70,
      maximumFeeDragPct: 2
    });
    const fidelity = assessExecutionFidelity(listedBudgetEur, listedAssets, 0, plan);
    const minimum = estimateMinimumDiversifiedCapital(listedAssets, prices, MYINVESTOR_BROKER_PROFILE, {
      minimumPositions: 2,
      maximumSinglePositionPct: 70,
      maximumFeeDragPct: 2,
      startCapitalEur: Math.max(50, Math.floor(listedBudgetEur || 50)),
      maxCapitalEur: 5000,
      stepEur: 5
    });
    const fundTargetEur = decision.assets
      .filter(a => !listedIds.has(a.assetId))
      .reduce((s, a) => s + a.amountEur, 0);
    return { plan, quality, fidelity, minimum, listedBudgetEur, fundTargetEur };
  }, [scan, decision]);

  useEffect(() => {
    const previousSnapshot = MarketSnapshotHistoryService.latestBefore(
      decision.asOfDate,
      decision.riskProfile,
      decision.horizonYears
    );
    const previousDecision = previousSnapshot
      ? MarketSnapshotHistoryService.asDecisionHistoryEntry(previousSnapshot)
      : null;
    const nextAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousDecision, evidence });
    setAlerts(nextAlerts);
    setHistory(MarketSnapshotHistoryService.saveDaily(scan, decision, evidence, nextAlerts));
  }, [scan, decision, evidence]);

  const materialCount = alerts.filter(a => a.severity === 'MATERIAL').length;
  const executableOrders = execution.plan.orders.filter(o => o.executable);

  return <section className="space-y-4">
    <UserPortfolioPanel scan={scan} decision={decision} />
    <PortfolioExecutionPlanPanel scan={scan} decision={decision} />

    <section className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2"><Radar className="h-5 w-5 text-violet-300"/><h2 className="text-lg font-bold">Alertas y seguimiento</h2></div>
          <p className="mt-1 text-xs text-slate-400">Solo cambios respecto a snapshots anteriores. El ranking completo y el motivo de cada producto están en el bloque de análisis superior.</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"><History className="mr-1 inline h-3.5 w-3.5"/>{history.length} snapshots</div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-amber-300"/><h3 className="font-bold">Alertas activas</h3></div><span className="text-xs text-slate-500">{materialCount} materiales</span></div>
          <div className="mt-3 space-y-2">
            {alerts.length === 0 && <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-500">Sin cambios materiales que requieran revisión.</div>}
            {alerts.map(alert => <div key={alert.id} className={`rounded-xl border p-3 ${severityClass(alert.severity)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{alert.title}</div><div className="text-[10px] font-bold uppercase">{alert.type} · {alert.severity}</div></div>
              <div className="mt-1 text-sm text-slate-200">{alert.message}</div>
              <div className="mt-2 text-[11px] text-slate-400">{alert.reasons.join(' · ')}</div>
            </div>)}
          </div>
        </div>
        <AlertAutomationStatusPanel />
      </div>
    </section>

    <section className="rounded-2xl border border-fuchsia-500/20 bg-slate-900 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-fuchsia-300"/><div><h3 className="font-bold">Ejecución ETF/ETC · MyInvestor</h3><p className="text-[11px] text-slate-400">Única zona de ejecución por títulos enteros. Los fondos permanecen en la decisión de cartera por importe/participaciones y posible traspaso.</p></div></div>
        <div className={`rounded-lg border px-3 py-1 text-xs font-bold ${execution.fidelity.level === 'HIGH' ? 'border-emerald-500/30 text-emerald-300' : execution.fidelity.level === 'MEDIUM' ? 'border-amber-500/30 text-amber-300' : 'border-rose-500/30 text-rose-300'}`}>Fidelidad ETF {execution.fidelity.level} · {execution.fidelity.score.toFixed(0)}/100</div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Objetivo ETF</div><b>{execution.listedBudgetEur.toFixed(2)} €</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Ejecutables</div><b>{execution.quality.executablePositions}</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Invertido ETF</div><b>{execution.plan.investedEur.toFixed(2)} €</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Comisiones est.</div><b>{execution.plan.estimatedFeesEur.toFixed(2)} €</b></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-slate-500">Objetivo fondos</div><b>{execution.fundTargetEur.toFixed(2)} €</b></div>
      </div>
      {executableOrders.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{executableOrders.map(o => <span key={o.assetId} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"><b>{o.ticker}</b> · {o.shares} título{o.shares === 1 ? '' : 's'} · {o.totalCostEur.toFixed(2)} €</span>)}</div>}
      {!execution.quality.diversifiedEnough && execution.listedBudgetEur > 0 && <div className="mt-3 text-xs text-amber-200">La porción ETF no alcanza los criterios de diversificación práctica: {execution.quality.reasons.join(' · ')}.</div>}
      <div className="mt-2 text-[10px] text-slate-500">Capital diversificado ETF aproximado: {execution.minimum.minimumCapitalEur != null ? `${execution.minimum.minimumCapitalEur} €` : '>5.000 €'}. Las operaciones reales siguen la decisión consolidada de “Mi cartera real”.</div>
    </section>

    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2"><History className="h-4 w-4 text-sky-300"/><h3 className="font-bold">Historial de decisiones</h3></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Régimen</th><th className="p-2 text-left">Top candidato</th><th className="p-2 text-right">Alertas</th><th className="p-2 text-right">Evidencia</th></tr></thead><tbody>{history.slice(0,8).map(h => <tr key={h.id} className="border-t border-slate-800"><td className="p-2 font-mono">{h.asOfDate}</td><td className="p-2">{h.marketRegime}</td><td className="p-2 font-mono">{[...h.shortlist].sort((a,b)=>(b.score ?? -999)-(a.score ?? -999))[0]?.ticker ?? '—'}</td><td className="p-2 text-right">{h.alerts.length}</td><td className="p-2 text-right">{h.evidenceState === 'CROSS_PROVIDER_CONFIRMED' ? 'CONFIRMADA' : h.evidenceState}</td></tr>)}</tbody></table></div>
    </section>
  </section>;
};
