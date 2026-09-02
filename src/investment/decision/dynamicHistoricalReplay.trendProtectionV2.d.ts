import type { TrendProtectionV2CounterfactualResult } from './trendProtectionCounterfactual';

declare module './dynamicHistoricalReplay' {
  interface DynamicHistoricalReplayResult {
    trendProtectionV2Counterfactual?: TrendProtectionV2CounterfactualResult;
  }
}

export {};
