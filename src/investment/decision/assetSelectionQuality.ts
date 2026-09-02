import type { TrendStructureDiagnostics } from './strategyConsensusEngine';

export interface AssetSelectionQualityMetrics {
  reliabilityScore: number;
  opportunityScore: number;
  currentDrawdownPct: number | null;
  positiveRolling60Pct: number | null;
  positiveRolling120Pct: number | null;
}

export interface SlopeSelectionQualityMetrics {
  slopeQualityScore: number;
  regression20Quality: number;
  regression60Quality: number;
  regression120Quality: number;
  accelerationQuality: number;
  sma20Quality: number;
  sma50Quality: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scale(value: number | null, min: number, max: number): number {
  if (value == null || !Number.isFinite(value) || max <= min) return 50;
  return clamp((value - min) / (max - min) * 100, 0, 100);
}

function currentDrawdownPct(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  const peak = Math.max(...slice);
  const current = slice.at(-1)!;
  return peak > 0 ? (current / peak - 1) * 100 : null;
}

function positiveRollingReturnPct(prices: number[], window: number, observationLookback = 252): number | null {
  if (prices.length <= window) return null;
  const lastIndex = prices.length - 1;
  const firstIndex = Math.max(window, prices.length - observationLookback);
  let positive = 0;
  let observed = 0;
  for (let index = firstIndex; index <= lastIndex; index++) {
    const start = prices[index - window];
    const end = prices[index];
    if (!(start > 0) || !(end > 0)) continue;
    observed++;
    if (end > start) positive++;
  }
  return observed > 0 ? positive / observed * 100 : null;
}

/**
 * Causal selection diagnostics based only on the price prefix available at the
 * assessment date. Scores are intentionally absolute rather than cross-sectional
 * percentiles so adding/removing another universe member does not rewrite the
 * history of an unchanged asset.
 *
 * Reliability answers "has this asset produced a persistent, tolerable path?".
 * Opportunity answers "is the current trend attractive now?" while keeping
 * reliability as a material input so one short momentum burst cannot dominate.
 */
export function assessAssetSelectionQuality(input: {
  prices: number[];
  momentum20Pct: number | null;
  momentum60Pct: number | null;
  momentum120Pct: number | null;
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
}): AssetSelectionQualityMetrics {
  const prices = input.prices.filter(price => Number.isFinite(price) && price > 0);
  const positive60 = positiveRollingReturnPct(prices, 60);
  const positive120 = positiveRollingReturnPct(prices, 120);
  const currentDd = currentDrawdownPct(prices, 252);

  const drawdownQuality = scale(input.maxDrawdownPct == null ? null : -input.maxDrawdownPct, -40, -5);
  const volatilityQuality = scale(input.annualizedVolatilityPct == null ? null : -input.annualizedVolatilityPct, -40, -10);
  const reliabilityScore = clamp(
    (positive60 ?? 50) * 0.45
      + (positive120 ?? 50) * 0.25
      + drawdownQuality * 0.20
      + volatilityQuality * 0.10,
    0,
    100
  );

  const m20Quality = scale(input.momentum20Pct, -6, 8);
  const m60Quality = scale(input.momentum60Pct, -8, 15);
  const m120Quality = scale(input.momentum120Pct, -10, 25);
  const acceleration = input.momentum20Pct != null && input.momentum60Pct != null
    ? input.momentum20Pct * 3 - input.momentum60Pct
    : null;
  const accelerationQuality = scale(acceleration, -15, 15);
  const currentDrawdownQuality = currentDd == null
    ? 50
    : clamp(100 - Math.max(0, Math.abs(currentDd) - 8) * 4, 0, 100);

  const opportunityScore = clamp(
    reliabilityScore * 0.30
      + m120Quality * 0.25
      + m60Quality * 0.15
      + m20Quality * 0.10
      + accelerationQuality * 0.10
      + currentDrawdownQuality * 0.10,
    0,
    100
  );

  return {
    reliabilityScore,
    opportunityScore,
    currentDrawdownPct: currentDd,
    positiveRolling60Pct: positive60,
    positiveRolling120Pct: positive120
  };
}

function smoothSignedQuality(value: number | null, scalePctPoints: number): number {
  if (value == null || !Number.isFinite(value) || !(scalePctPoints > 0)) return 50;
  return clamp(50 + 50 * Math.tanh(value / scalePctPoints), 0, 100);
}

/**
 * SELECTION_SLOPE_V1 consumes the trend diagnostics already calculated by
 * StrategyConsensusEngine. It deliberately uses smooth, bounded transforms
 * rather than fitted cut-offs: extreme annualized slopes saturate instead of
 * dominating the rank, and missing diagnostics remain neutral at 50/100.
 *
 * The score rewards multi-horizon trend coherence and positive acceleration:
 * 25% slope120, 25% slope60, 15% slope20, 15% SMA20 slope, 10% SMA50 slope,
 * 10% acceleration 20-vs-60. It is descriptive evidence, never an entry gate.
 */
export function assessSlopeSelectionQuality(trend: TrendStructureDiagnostics): SlopeSelectionQualityMetrics {
  const regression20Quality = smoothSignedQuality(trend.regressionSlope20AnnualizedPct, 25);
  const regression60Quality = smoothSignedQuality(trend.regressionSlope60AnnualizedPct, 20);
  const regression120Quality = smoothSignedQuality(trend.regressionSlope120AnnualizedPct, 15);
  const accelerationQuality = smoothSignedQuality(trend.slopeAcceleration20vs60PctPoints, 20);
  const sma20Quality = smoothSignedQuality(trend.sma20Slope20AnnualizedPct, 20);
  const sma50Quality = smoothSignedQuality(trend.sma50Slope20AnnualizedPct, 15);

  const slopeQualityScore = clamp(
    regression120Quality * 0.25
      + regression60Quality * 0.25
      + regression20Quality * 0.15
      + sma20Quality * 0.15
      + sma50Quality * 0.10
      + accelerationQuality * 0.10,
    0,
    100
  );

  return {
    slopeQualityScore,
    regression20Quality,
    regression60Quality,
    regression120Quality,
    accelerationQuality,
    sma20Quality,
    sma50Quality
  };
}
