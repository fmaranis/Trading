import { HistoricalMarketDataService } from '../data/marketData/historicalMarketDataService';
import type { MultiAssetDataset } from '../portfolioBacktesting/types';

export const FORWARD_RISK_DIAGNOSTIC_DATA = 'FORWARD_RISK_DIAGNOSTIC_DATA_V1' as const;

const DIAGNOSTIC_SERIES = [
  { assetId: 'DIAG_VIX', ticker: '^VIX', name: 'Cboe VIX 30-day expected volatility' },
  { assetId: 'DIAG_VIX3M', ticker: '^VIX3M', name: 'Cboe 3-Month Volatility Index' }
] as const;

export interface ForwardRiskDiagnosticLoadResult {
  dataset: MultiAssetDataset;
  loaded: string[];
  failures: string[];
}

/**
 * Loads non-tradable diagnostic series used only as predictive features.
 *
 * These series are deliberately kept outside EUR_ASSET_UNIVERSE: they can never
 * become portfolio candidates or orders. Currency is irrelevant because their
 * levels/changes are features, not investable notionals. There is no synthetic
 * fallback; an unavailable series is reported and the forecaster must degrade
 * explicitly to the remaining feature set.
 */
export async function loadForwardRiskDiagnosticData(
  startDate: string,
  endDate: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ForwardRiskDiagnosticLoadResult> {
  const assets: MultiAssetDataset['assets'] = [];
  const loaded: string[] = [];
  const failures: string[] = [];

  for (const series of DIAGNOSTIC_SERIES) {
    try {
      const response = await HistoricalMarketDataService.getHistoricalBars({
        symbol: series.ticker,
        startDate,
        endDate,
        timeframe: '1d',
        adjusted: false
      }, { forceRefresh: options.forceRefresh ?? false, maxRetries: 1 });

      assets.push({
        assetId: series.assetId,
        ticker: series.ticker,
        name: series.name,
        currency: response.metadata?.currency,
        bars: response.bars,
        provenance: response.provenance
      });
      loaded.push(series.ticker);
    } catch (error: any) {
      failures.push(`${series.ticker}:${error?.message || String(error)}`);
    }
  }

  return {
    dataset: { timeframe: '1d', assets },
    loaded,
    failures
  };
}
