import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';

export type EntryTimingState = 'WAIT' | 'ENTRY_READY' | 'ENTRY_STRONG';
export type EntryTimingSetup = 'NONE' | 'BREAKOUT_CONFIRMATION' | 'PULLBACK_RECOVERY' | 'TREND_CONTINUATION';

export interface EntryTimingAssessment {
  assetId: string;
  state: EntryTimingState;
  setup: EntryTimingSetup;
  score: number;
  suggestedInitialFraction: number;
  close: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  distanceToSma20Pct: number | null;
  distanceToSma50Pct: number | null;
  distanceToSma200Pct: number | null;
  return5Pct: number | null;
  prior20High: number | null;
  drawdownFrom60HighPct: number | null;
  tooExtended: boolean;
  reasons: string[];
}

export interface EntryTimingPersistenceAssessment {
  assetId: string;
  lookbackSessions: number;
  observedSessions: number;
  strongCount: number;
  strongDates: string[];
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(base: number | null, current: number | null): number | null {
  if (base == null || current == null || !(base > 0)) return null;
  return (current / base - 1) * 100;
}

function finitePositive(values: number[]): number[] {
  return values.filter(value => Number.isFinite(value) && value > 0);
}

function momentum(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  return pct(prices[prices.length - 1 - lookback], prices.at(-1) ?? null);
}

function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function historicalSingleAssetScan(scan: AssetUniverseScanResult, assetId: string, barIndexInclusive: number): AssetUniverseScanResult | null {
  const candidate = scan.candidates.find(row => row.asset.assetId === assetId);
  const series = scan.acceptedDataset.assets.find(row => row.assetId === assetId);
  if (!candidate || !series || barIndexInclusive < 0 || barIndexInclusive >= series.bars.length) return null;
  const bars = series.bars.slice(0, barIndexInclusive + 1);
  const prices = finitePositive(bars.map(bar => bar.close));
  if (!prices.length) return null;
  const lastBar = bars.at(-1)!;
  const historicalCandidate = {
    ...candidate,
    bars: bars.length,
    asOfDate: lastBar.timestamp.slice(0, 10),
    lastClose: prices.at(-1) ?? null,
    momentum20Pct: momentum(prices, 20),
    momentum60Pct: momentum(prices, 60),
    momentum120Pct: momentum(prices, 120),
    annualizedVolatilityPct: annualizedVolatility(prices, 60)
  };
  const historicalAsset = { ...series, bars };
  const dataset = { ...scan.acceptedDataset, assets: [historicalAsset] };
  return {
    ...scan,
    scanned: 1,
    accepted: 1,
    rejected: 0,
    rejectionCounts: {},
    selected: [historicalCandidate],
    candidates: [historicalCandidate],
    dataset,
    acceptedDataset: dataset
  };
}

/**
 * Causal entry-timing gate.
 *
 * The selector decides WHICH assets deserve attention. This layer decides
 * WHETHER today offers a sufficiently explicit setup to deploy fresh cash.
 * It deliberately uses only bars available at the assessment date and never
 * turns a strategic target weight into an automatic immediate order.
 */
export class EntryTimingEngine {
  static assess(
    scan: AssetUniverseScanResult,
    assetId: string,
    consensus: StrategyConsensusAssessment
  ): EntryTimingAssessment {
    const series = scan.acceptedDataset.assets.find(asset => asset.assetId === assetId);
    const prices = finitePositive(series?.bars.map(bar => bar.close) ?? []);
    const empty = (reason: string): EntryTimingAssessment => ({
      assetId,
      state: 'WAIT',
      setup: 'NONE',
      score: 0,
      suggestedInitialFraction: 0,
      close: prices.at(-1) ?? null,
      sma20: null,
      sma50: null,
      sma200: null,
      distanceToSma20Pct: null,
      distanceToSma50Pct: null,
      distanceToSma200Pct: consensus.distanceToSma200Pct,
      return5Pct: null,
      prior20High: null,
      drawdownFrom60HighPct: consensus.currentDrawdownPct,
      tooExtended: false,
      reasons: [reason]
    });

    if (prices.length < 220) return empty('WAIT: no hay profundidad suficiente para validar el timing con tendencia larga.');

    const close = prices.at(-1)!;
    const sma20 = mean(prices.slice(-20));
    const sma50 = mean(prices.slice(-50));
    const sma200 = mean(prices.slice(-200));
    const distanceToSma20Pct = pct(sma20, close);
    const distanceToSma50Pct = pct(sma50, close);
    const distanceToSma200Pct = pct(sma200, close);
    const return5Pct = prices.length > 5 ? pct(prices[prices.length - 6], close) : null;
    const prior20 = prices.slice(-21, -1);
    const prior20High = prior20.length ? Math.max(...prior20) : null;
    const last60 = prices.slice(-60);
    const high60 = last60.length ? Math.max(...last60) : null;
    const drawdownFrom60HighPct = pct(high60, close);

    const vol = consensus.annualizedVolatilityPct ?? 25;
    const maxHealthyDistance50 = Math.max(7, Math.min(14, vol * 0.40));
    const maxHealthyMomentum20 = Math.max(12, Math.min(24, vol * 0.80));
    const tooExtended =
      (distanceToSma50Pct ?? Infinity) > maxHealthyDistance50 ||
      (consensus.momentum20Pct ?? Infinity) > maxHealthyMomentum20;

    const trendAcceptable =
      (distanceToSma200Pct ?? -Infinity) > 0 &&
      (consensus.momentum120Pct ?? -Infinity) > 4 &&
      !consensus.structuralDowntrend;
    const trendStrong =
      trendAcceptable &&
      sma50 != null && sma200 != null && sma50 > sma200 &&
      (consensus.longReturnPct ?? -Infinity) > 5;

    const freshBreakout =
      trendAcceptable &&
      prior20High != null && close >= prior20High * 0.997 &&
      (return5Pct ?? -Infinity) > 0 &&
      (consensus.momentum20Pct ?? -Infinity) >= 0;

    const pullbackRecovery =
      trendAcceptable &&
      (drawdownFrom60HighPct ?? 0) <= -2.5 &&
      (drawdownFrom60HighPct ?? -Infinity) >= -12 &&
      (return5Pct ?? -Infinity) > 0 &&
      sma20 != null && close >= sma20 &&
      (consensus.momentum60Pct ?? -Infinity) > 0;

    const trendContinuation =
      trendStrong &&
      Math.abs(distanceToSma20Pct ?? Infinity) <= 2.5 &&
      (return5Pct ?? -Infinity) > 0 &&
      (consensus.momentum20Pct ?? -Infinity) >= 0 &&
      (consensus.momentum60Pct ?? -Infinity) > 0;

    const riskBlocked =
      vol > 40 ||
      (consensus.currentDrawdownPct ?? 0) < -25 ||
      consensus.unfavorableVotes >= 2;

    let setup: EntryTimingSetup = 'NONE';
    if (freshBreakout) setup = 'BREAKOUT_CONFIRMATION';
    else if (pullbackRecovery) setup = 'PULLBACK_RECOVERY';
    else if (trendContinuation) setup = 'TREND_CONTINUATION';

    const reasons: string[] = [];
    if (!trendAcceptable) reasons.push('WAIT: la tendencia de 120/200 sesiones todavía no confirma una entrada de dinero nuevo.');
    if (tooExtended) reasons.push(`WAIT: el precio/momentum está demasiado extendido para perseguir la subida (dist. SMA50 ${distanceToSma50Pct?.toFixed(1) ?? 'N/D'}%, momentum20 ${consensus.momentum20Pct?.toFixed(1) ?? 'N/D'}%).`);
    if (riskBlocked) reasons.push(`WAIT: riesgo de entrada elevado (volatilidad ${vol.toFixed(1)}%, drawdown ${consensus.currentDrawdownPct?.toFixed(1) ?? 'N/D'}%, ${consensus.unfavorableVotes} votos adversos).`);
    if (setup === 'NONE' && trendAcceptable && !tooExtended && !riskBlocked) reasons.push('WAIT: el activo es candidato válido, pero hoy no presenta breakout, recuperación tras pullback ni continuación suficientemente limpia.');

    let state: EntryTimingState = 'WAIT';
    let suggestedInitialFraction = 0;
    let score = 0;

    if (setup !== 'NONE' && !tooExtended && !riskBlocked && consensus.consensusScore >= 2 && consensus.favorableVotes >= 3) {
      state = 'ENTRY_READY';
      suggestedInitialFraction = 0.25;
      score = 60 + Math.min(15, consensus.consensusScore * 3) + Math.min(10, consensus.favorableVotes * 2);
      reasons.push(`ENTRY_READY: setup ${setup} confirmado; iniciar solo una fracción del objetivo y conservar liquidez para confirmación posterior.`);
    }

    if (
      state === 'ENTRY_READY' &&
      setup !== 'TREND_CONTINUATION' &&
      trendStrong &&
      consensus.consensusScore >= 3 &&
      consensus.favorableVotes >= 4 &&
      vol <= 32
    ) {
      state = 'ENTRY_STRONG';
      suggestedInitialFraction = 0.50;
      score = Math.max(score, 82 + Math.min(12, consensus.consensusScore * 2));
      reasons.push('ENTRY_STRONG: tendencia larga, consenso y setup temporal alineados; aun así no se autoriza completar el 100% del target en una sola orden.');
    }

    return {
      assetId,
      state,
      setup,
      score: Math.min(100, Math.round(score)),
      suggestedInitialFraction,
      close,
      sma20,
      sma50,
      sma200,
      distanceToSma20Pct,
      distanceToSma50Pct,
      distanceToSma200Pct,
      return5Pct,
      prior20High,
      drawdownFrom60HighPct,
      tooExtended,
      reasons
    };
  }

  /**
   * Rebuilds prior timing states from the same causal bar prefix already present
   * in the scan. The current session is excluded deliberately: persistence is
   * evidence that existed before today's ENTRY_STRONG, not a duplicate count of
   * the current signal. No local storage or replay-only state is required.
   */
  static assessRecentPersistence(
    scan: AssetUniverseScanResult,
    assetId: string,
    cashBenchmarkAnnualPct: number,
    lookbackSessions = 10
  ): EntryTimingPersistenceAssessment {
    const series = scan.acceptedDataset.assets.find(row => row.assetId === assetId);
    const safeLookback = Math.max(0, Math.floor(lookbackSessions));
    if (!series || safeLookback === 0 || series.bars.length < 2) {
      return { assetId, lookbackSessions: safeLookback, observedSessions: 0, strongCount: 0, strongDates: [] };
    }

    const currentIndex = series.bars.length - 1;
    const firstIndex = Math.max(0, currentIndex - safeLookback);
    let observedSessions = 0;
    const strongDates: string[] = [];

    for (let barIndex = firstIndex; barIndex < currentIndex; barIndex++) {
      const historicalScan = historicalSingleAssetScan(scan, assetId, barIndex);
      if (!historicalScan) continue;
      const consensus = StrategyConsensusEngine.assess(historicalScan, assetId, cashBenchmarkAnnualPct);
      if (!consensus) continue;
      observedSessions++;
      const timing = this.assess(historicalScan, assetId, consensus);
      if (timing.state === 'ENTRY_STRONG') {
        const historicalSeries = historicalScan.acceptedDataset.assets[0];
        const date = historicalSeries?.bars.at(-1)?.timestamp.slice(0, 10);
        if (date) strongDates.push(date);
      }
    }

    return {
      assetId,
      lookbackSessions: safeLookback,
      observedSessions,
      strongCount: strongDates.length,
      strongDates
    };
  }
}
