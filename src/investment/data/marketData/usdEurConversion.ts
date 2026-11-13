import type { PriceBar } from '../../backtesting/types';

/**
 * Historical USD securities are evaluated in the user's EUR accounting unit.
 * EURUSD=X is quoted in USD per 1 EUR; dividing USD OHLC by a PREVIOUS
 * FX SESSION's close avoids using a not-yet-known same-day fixing at NEXT_OPEN.
 * No interpolation, future FX, fixed rate, or synthetic fallback.
 * Missing/stale REAL FX fails the research request closed.
 */
export function convertUsdBarsToEurCausally(
  usdBars: PriceBar[],
  eurUsdBars: PriceBar[],
  maxFxAgeDays = 5
): {
  bars: PriceBar[];
  fxPair: 'EURUSD=X';
  fxObservationDate: string;
  fxRateUsdPerEur: number;
  maxObservedFxAgeDays: number;
} {
  if (!usdBars.length || !eurUsdBars.length) throw new Error('USD_FX_REAL_HISTORY_REQUIRED');
  const orderedFx = [...eurUsdBars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const orderedEquity = [...usdBars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const rates = orderedFx.map(bar => ({
    date: bar.timestamp.slice(0, 10),
    close: bar.close
  }));
  let index = -1;
  let maxObservedFxAgeDays = 0;
  let fxObservationDate = '';
  let fxRateUsdPerEur = 0;
  const bars = orderedEquity.map(bar => {
    const date = bar.timestamp.slice(0, 10);
    while (index + 1 < rates.length && rates[index + 1].date < date) index++;
    const rate = rates[index];
    const ageDays = rate ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${rate.date}T00:00:00Z`)) / 86_400_000) : Infinity;
    if (!rate || !(rate.close > 0) || !Number.isFinite(rate.close) || ageDays < 1 || ageDays > maxFxAgeDays) {
      throw new Error(`USD_FX_MISSING_OR_STALE:${date}`);
    }
    maxObservedFxAgeDays = Math.max(maxObservedFxAgeDays, ageDays);
    fxObservationDate = rate.date;
    fxRateUsdPerEur = rate.close;
    const converted = {
      ...bar,
      open: bar.open / rate.close,
      high: bar.high / rate.close,
      low: bar.low / rate.close,
      close: bar.close / rate.close
    };
    if (![converted.open, converted.high, converted.low, converted.close].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error(`USD_FX_INVALID_CONVERTED_BAR:${date}`);
    }
    return converted;
  });
  return { bars, fxPair: 'EURUSD=X', fxObservationDate, fxRateUsdPerEur, maxObservedFxAgeDays };
}

