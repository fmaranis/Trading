/**
 * Price/volume evidence for the existing entry-timing workflow (research only).
 * Neither a trade signal nor evidence identifying an institutional buyer/seller.
 *
 * Inspiration: public OHLCV methodology in Qullamaggie/SEPA-style screeners.
 * Implementation is original, deterministic and free of vendor dependencies.
 * All reference windows end BEFORE the assessed day's closing bar.
 */
export interface PriceVolumeObservation {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type PriceVolumeEvidenceState =
  | 'REAL_EOD_AVAILABLE'
  | 'NON_REAL_SOURCE'
  | 'NO_RELIABLE_LISTED_VOLUME'
  | 'INSUFFICIENT_HISTORY'
  | 'INVALID_OHLCV'
  | 'NO_BAR_AT_INFORMATION_DATE';

export interface PriceVolumeEvidence {
  version: 'PRICE_VOLUME_EVIDENCE_V1';
  authority: 'RESEARCH_ONLY';
  informationDate: string;
  state: PriceVolumeEvidenceState;
  prior20High: number | null;
  prior20Low: number | null;
  priceBreakout20: boolean | null;
  priceBreakdown20: boolean | null;
  relativeVolume50: number | null;
  preBreakoutVolumeContraction5v5: number | null;
  highVolumeBreakout: boolean | null;
  highVolumeBreakdown: boolean | null;
  institutionalBuyerIdentified: false;
}

export function assessPriceVolumeEvidence(input: {
  bars: readonly PriceVolumeObservation[] | null | undefined;
  informationDate: string;
  provenance: 'REAL' | 'STATIC_REFERENCE' | 'SYNTHETIC' | null | undefined;
  instrumentType?: string | null;
}): PriceVolumeEvidence {
  const result: PriceVolumeEvidence = {
    version: 'PRICE_VOLUME_EVIDENCE_V1', authority: 'RESEARCH_ONLY',
    informationDate: input.informationDate, state: 'INSUFFICIENT_HISTORY',
    prior20High: null, prior20Low: null, priceBreakout20: null,
    priceBreakdown20: null, relativeVolume50: null,
    preBreakoutVolumeContraction5v5: null, highVolumeBreakout: null,
    highVolumeBreakdown: null, institutionalBuyerIdentified: false
  };
  if (input.provenance !== 'REAL') return { ...result, state: 'NON_REAL_SOURCE' };
  if (input.instrumentType === 'MUTUAL_FUND') return { ...result, state: 'NO_RELIABLE_LISTED_VOLUME' };
  // An end-of-day observation is available only after its own session close.
  // Ignore future observations; never reconstruct an earlier signal with later bars.
  const bars = (input.bars ?? []).filter(bar =>
    typeof bar.timestamp === 'string' && bar.timestamp.slice(0, 10) <= input.informationDate
  );
  if (bars.length < 51) return result;
  if (bars.at(-1)!.timestamp.slice(0, 10) !== input.informationDate) {
    return { ...result, state: 'NO_BAR_AT_INFORMATION_DATE' };
  }
  const sample = bars.slice(-51);
  if (sample.some((bar, index) =>
    !Number.isFinite(bar.open) || !Number.isFinite(bar.high)
    || !Number.isFinite(bar.low) || !Number.isFinite(bar.close)
    || !(bar.open > 0 && bar.high >= Math.max(bar.open, bar.close, bar.low)
      && bar.low > 0 && bar.low <= Math.min(bar.open, bar.close))
    || (index > 0 && bar.timestamp.slice(0, 10) <= sample[index - 1].timestamp.slice(0, 10))
  )) return { ...result, state: 'INVALID_OHLCV' };
  if (sample.some(bar => !(typeof bar.volume === 'number' && Number.isFinite(bar.volume) && bar.volume > 0))) {
    return { ...result, state: 'NO_RELIABLE_LISTED_VOLUME' };
  }

  const current = sample[50];
  const before = sample.slice(0, 50);
  const prior20 = before.slice(-20);
  const prior20High = Math.max(...prior20.map(bar => bar.high));
  const prior20Low = Math.min(...prior20.map(bar => bar.low));
  const mean = (rows: readonly PriceVolumeObservation[]) =>
    rows.reduce((sum, bar) => sum + Number(bar.volume), 0) / rows.length;
  const average50 = mean(before);
  const relativeVolume50 = current.volume! / average50;
  const priorFive = before.slice(-10, -5);
  const lastFive = before.slice(-5);
  const preBreakoutVolumeContraction5v5 = mean(lastFive) / mean(priorFive);
  const priceBreakout20 = current.close > prior20High;
  const priceBreakdown20 = current.close < prior20Low;
  return {
    ...result,
    state: 'REAL_EOD_AVAILABLE',
    prior20High,
    prior20Low,
    priceBreakout20,
    priceBreakdown20,
    relativeVolume50,
    preBreakoutVolumeContraction5v5,
    // Research descriptors, not optimized production thresholds.
    // >=2.5x is a predeclared large-volume research convention from
    // published O\u0027Neil-style breakout analyses, not a tuned production gate.
    highVolumeBreakout: priceBreakout20 && relativeVolume50 >= 2.5,
    highVolumeBreakdown: priceBreakdown20 && relativeVolume50 >= 2.5
  };
}
