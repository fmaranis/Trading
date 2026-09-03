import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  AssetUniverseScanResult,
  InvestmentDecisionResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { CurrentOpportunityAlertsPanel } from './CurrentOpportunityAlertsPanel';
import { UserPortfolioPanel } from './UserPortfolioPanel';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';
import { RealPurchaseRegistrationPanel } from './RealPurchaseRegistrationPanel';
import { StrategyConsensusPanel } from './StrategyConsensusPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  eodhdValidation: EodhdCrossValidationResult | null;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  return <section className="space-y-4">
    <CurrentOpportunityAlertsPanel scan={scan} decision={decision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />

    <RealPurchaseRegistrationPanel scan={scan} decision={decision} positionHealth={positionHealth} />

    <UserPortfolioPanel scan={scan} decision={decision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />

    <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Por qué y controles de la misma decisión</div><div className="mt-1 text-[10px] text-slate-500">Consenso, gates, fiscalidad y detalle operativo. Son explicaciones de la decisión superior, no recomendaciones independientes.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4 space-y-4">
        <StrategyConsensusPanel scan={scan} />
        <PortfolioExecutionPlanPanel scan={scan} decision={decision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />
      </div>
    </details>
  </section>;
};
