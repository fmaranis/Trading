import type { TrendProtectionV2CounterfactualResult } from './trendProtectionCounterfactual';
import type { TrendProtectionV2ReplayComparison } from './trendProtectionReplayComparison';

declare module './dynamicHistoricalReplay' {
  interface DynamicHistoricalReplayResult {
    trendProtectionV2Counterfactual?: TrendProtectionV2CounterfactualResult | TrendProtectionV2ReplayComparison;
  }
}

export {};
