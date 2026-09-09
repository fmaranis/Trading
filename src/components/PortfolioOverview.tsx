import React from 'react';
import type { Asset, Portfolio } from '../types';
import { InteractiveInvestmentDecisionCenter } from './InteractiveInvestmentDecisionCenter';

interface PortfolioOverviewProps {
  portfolio: Portfolio;
  onOpenTradeModal: (asset: Asset, defaultType?: 'BUY' | 'SELL') => void;
  onOpenMyInvestorBridge: () => void;
  onGoToRiskCenter: () => void;
}

/**
 * Compatibility route for the old dashboard tab.
 *
 * Portfolio state, recommendations and executable actions now live in the same
 * UserPortfolioService-backed canonical surface. The previous simulated
 * PortfolioEngine dashboard is intentionally not allowed to emit a second view
 * of the user's actionable portfolio.
 */
export const PortfolioOverview: React.FC<PortfolioOverviewProps> = () => (
  <InteractiveInvestmentDecisionCenter />
);
