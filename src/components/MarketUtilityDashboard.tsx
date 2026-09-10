import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  applyTaxAwareExecutionOverlay,
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  evaluatePortfolioDecision,
  getMyInvestorAvailability,
  InvestmentDecisionResult,
  MYINVESTOR_AVAILABILITY_UPDATED_EVENT,
  SPANISH_TAX_SETTINGS_UPDATED_EVENT,
  SpanishTaxSettingsService,
  UserPortfolioService,
  type PortfolioExecutionPlan,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { CurrentOpportunityAlertsPanel } from './CurrentOpportunityAlertsPanel';
import { UserPortfolioPanel } from './UserPortfolioPanel';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';
import { RealPurchaseRegistrationPanel } from './RealPurchaseRegistrationPanel';
import { StrategyConsensusPanel } from './StrategyConsensusPanel';
import { PilotOperationsPanel } from './PilotOperationsPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  eodhdValidation: EodhdCrossValidationResult | null;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function applyBrokerAvailabilityOverlay(plan: PortfolioExecutionPlan, scan: AssetUniverseScanResult): PortfolioExecutionPlan {
  let blocked = 0;
  const lines = plan.lines.map(line => {
    if (!['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action)) return line;
    const candidate = scan.candidates.find(row =>
      (!!line.targetAssetId && row.asset.assetId === line.targetAssetId)
      || (!!line.targetTicker && row.asset.ticker.toUpperCase() === line.targetTicker.toUpperCase())
      || (!!line.targetIsin && row.asset.isin?.toUpperCase() === line.targetIsin.toUpperCase())
    );
    if (!candidate || getMyInvestorAvailability(candidate.asset).status !== 'USER_CONFIRMED_UNAVAILABLE') return line;
    blocked += 1;
    return {
      ...line,
      action: 'REVIEW' as const,
      instruction: `No ejecutar ${line.targetTicker ?? line.targetName ?? 'esta compra'}: el instrumento está marcado por ti como no disponible en MyInvestor.`,
      rationale: `${line.rationale} [BROKER_USER_CONFIRMED_UNAVAILABLE] La señal de inversión se conserva como evidencia, pero no existe una orden ejecutable mientras mantengas esta marca.`
    };
  });
  if (blocked === 0) return plan;
  return { ...plan, lines, warnings: [...plan.warnings, `BROKER_USER_CONFIRMED_UNAVAILABLE:${blocked}`] };
}

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const [taxRevision, setTaxRevision] = useState(0);
  const [brokerRevision, setBrokerRevision] = useState(0);
  const cashBenchmarkAnnualPct = CashBenchmarkService.load();
  // A portfolio save in the parent triggers a fresh positionHealth object before
  // this dashboard becomes actionable again. Memoizing the load prevents an
  // unrelated child render from rebuilding Date.now()-based execution-line IDs.
  const portfolio = useMemo(() => UserPortfolioService.load(), [positionHealth, decision.asOfDate]);

  useEffect(() => {
    const refreshTax = () => setTaxRevision(value => value + 1);
    const refreshBroker = () => setBrokerRevision(value => value + 1);
    window.addEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
    window.addEventListener(MYINVESTOR_AVAILABILITY_UPDATED_EVENT, refreshBroker as EventListener);
    return () => {
      window.removeEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
      window.removeEventListener(MYINVESTOR_AVAILABILITY_UPDATED_EVENT, refreshBroker as EventListener);
    };
  }, []);

  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct
  }), [portfolio, scan, decision, positionHealth, cashBenchmarkAnnualPct]);

  const executionPlan = useMemo(() => {
    const raw = buildPortfolioExecutionPlan({
      portfolio,
      scan,
      decisionAsOf: decision.asOfDate,
      portfolioDecision,
      cashBenchmarkAnnualPct
    });
    const healthEntries = Object.entries(positionHealth?.byKey ?? {}) as Array<[string, PortfolioPositionHealthResult['positions'][number]]>;
    const currentValueByKey = Object.fromEntries(healthEntries.map(([key, health]) => [key, health.currentValueEur ?? null]));
    const taxAware = applyTaxAwareExecutionOverlay({
      plan: raw,
      portfolio,
      portfolioDecision,
      scan,
      horizonYears: decision.horizonYears,
      taxSettings: SpanishTaxSettingsService.load(),
      currentValueByKey
    });
    return applyBrokerAvailabilityOverlay(taxAware, scan);
  }, [portfolio, scan, decision.asOfDate, decision.horizonYears, portfolioDecision, cashBenchmarkAnnualPct, positionHealth, taxRevision, brokerRevision]);

  return <section className="space-y-4">
    {/* One canonical portfolio decision plus one canonical executable plan. */}
    <CurrentOpportunityAlertsPanel scan={scan} decision={decision} portfolioDecision={portfolioDecision} executionPlan={executionPlan} onInspectAsset={onInspectAsset} />

    {/* Registration is derived from the exact executable plan shown above. */}
    <RealPurchaseRegistrationPanel scan={scan} executionPlan={executionPlan} />

    {/* Actual portfolio state reuses the same canonical decision; edits stay drafts until saved. */}
    <UserPortfolioPanel scan={scan} portfolioDecision={portfolioDecision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />

    {/* Historical/pilot bookkeeping is secondary and cannot create a headline recommendation. */}
    <details className="rounded-2xl border border-violet-500/15 bg-slate-900/50 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Seguimiento operativo e historial</div><div className="mt-1 text-[10px] text-slate-500">Archiva la misma decisión/plan, disponibilidad MyInvestor y operaciones registradas. No genera una segunda decisión.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4"><PilotOperationsPanel scan={scan} decision={decision} portfolioDecision={portfolioDecision} executionPlan={executionPlan} positionHealth={positionHealth} onInspectAsset={onInspectAsset} /></div>
    </details>

    <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Controles y detalle de ejecución</div><div className="mt-1 text-[10px] text-slate-500">Consenso, fiscalidad, broker y plan operativo del mismo resultado. Los ajustes de ejecución pueden aplazar una orden, pero no crean otra estrategia.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4 space-y-4">
        <StrategyConsensusPanel scan={scan} />
        <PortfolioExecutionPlanPanel scan={scan} executionPlan={executionPlan} onInspectAsset={onInspectAsset} />
      </div>
    </details>
  </section>;
};
