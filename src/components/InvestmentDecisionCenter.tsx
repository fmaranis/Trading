import React from 'react';
import { InteractiveInvestmentDecisionCenter } from './InteractiveInvestmentDecisionCenter';

/**
 * Backwards-compatible alias for the canonical live decision surface.
 *
 * The previous implementation scanned EUR_ASSET_UNIVERSE directly and called
 * InvestmentDecisionEngine without the full current product chain. Keeping a
 * second recommendation engine is forbidden by CORE_ARCHITECTURE_V1, so every
 * caller now converges on InteractiveInvestmentDecisionCenter.
 */
export const InvestmentDecisionCenter: React.FC = () => (
  <InteractiveInvestmentDecisionCenter />
);
