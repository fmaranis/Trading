import React from 'react';
import type { Asset, Portfolio, SimulatedOrder } from '../types';
import { InteractiveInvestmentDecisionCenter } from './InteractiveInvestmentDecisionCenter';

interface GrowthTradingBotProps {
  portfolio: Portfolio;
  onExecuteOrder: (order: SimulatedOrder, asset: Asset) => void;
  onExtractCapitalToVault: () => void;
  onResetPortfolio: () => void;
}

/**
 * Compatibility surface only.
 *
 * The former autonomous 2X bot implemented a second live decision engine based on
 * ALL_AVAILABLE_ASSETS + LiveSimulationEngine. That violated CORE_ARCHITECTURE_V1.
 * Keep the component name temporarily so existing App routing does not break, but
 * route every productive recommendation through the single canonical chain:
 *
 * AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine
 * -> evaluatePortfolioDecision -> execution/follow-up.
 */
export const GrowthTradingBot: React.FC<GrowthTradingBotProps> = () => (
  <InteractiveInvestmentDecisionCenter />
);
