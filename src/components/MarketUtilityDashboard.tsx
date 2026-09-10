import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  applyTaxAwareExecutionOverlay,
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  evaluatePortfolioDecision,
  InvestmentDecisionResult,
  SPANISH_TAX_SETTINGS_UPDATED_EVENT,
  SpanishTaxSettingsService,
  UserPortfolioService,
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

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const [taxRevision, setTaxRevision] = useState(0);
  const cashBenchmarkAnnualPct = CashBenchmarkService.load();
  const portfolio = UserPortfolioService.load();

  useEffect(() => {
    const refreshTax = () => setTaxRevision(value => value + 1);
    window.addEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
    return () => window.removeEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
  }, []);

  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct
  }), [scan, decision, positionHealth, cashBenchmarkAnnualPct, portfolio.updatedAt]);

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
    return applyTaxAwareExecutionOverlay({
      plan: raw,
      portfolio,
      portfolioDecision,
      scan,
      horizonYears: decision.horizonYears,
      taxSettings: SpanishTaxSettingsService.load(),
      currentValueByKey
    });
  }, [portfolio, scan, decision.asOfDate, decision.horizonYears, portfolioDecision, cashBenchmarkAnnualPct, positionHealth, taxRevision]);

  return <section className="space-y-4">
    {/* One canonical portfolio decision plus one canonical executable plan. */}
    <CurrentOpportunityAlertsPanel
      scan={scan}
      decision={decision}
      portfolioDecision={portfolioDecision}
      executionPlan={executionPlan}
      onInspectAsset={onInspectAsset}
    />

    {/* Registration is derived from the exact executable plan shown above. */}
    <RealPurchaseRegistrationPanel scan={scan} executionPlan={executionPlan} />

    {/* Actual portfolio state remains a first-level surface. */}
    <UserPortfolioPanel scan={scan} decision={decision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />

    {/* Historical/pilot bookkeeping is secondary and cannot create a headline recommendation. */}
    <details className="rounded-2xl border border-violet-500/15 bg-slate-900/50 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Seguimiento operativo e historial</div><div className="mt-1 text-[10px] text-slate-500">Estado de posiciones, disponibilidad MyInvestor, historial diario y operaciones registradas. No genera una segunda decisión.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4"><PilotOperationsPanel scan={scan} decision={decision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} /></div>
    </details>

    <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Controles y detalle de ejecución</div><div className="mt-1 text-[10px] text-slate-500">Consenso, fiscalidad y plan operativo del mismo resultado. Los ajustes de ejecución pueden aplazar una orden, pero no crean otra estrategia.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4 space-y-4">
        <StrategyConsensusPanel scan={scan} />
        <PortfolioExecutionPlanPanel
          scan={scan}
          decision={decision}
          positionHealth={positionHealth}
          portfolioDecision={portfolioDecision}
          executionPlan={executionPlan}
          onInspectAsset={onInspectAsset}
        />
      </div>
    </details>
  </section>;
};