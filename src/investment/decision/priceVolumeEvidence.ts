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
  | 'NO_BAR_AT_INFORMATION_DATE'
  | 'UNCONFIRMED_DAILY_CLOSE';

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
  /** UTC observation time, injectable to verify incomplete current-session bars. */
  observedAtUtc?: string;
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
  // A 1d provider candle dated today can represent a trading session still
  // in progress (especially US listings during European evening hours). Since
  // we lack per-exchange close confirmation, fail closed until the next UTC
  // calendar day rather than present partial volume as a closed-day breakout.
  const observedAtUtc = input.observedAtUtc ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAtUtc)) || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(observedAtUtc)
    || input.informationDate >= observedAtUtc.slice(0, 10)) {
    return { ...result, state: 'UNCONFIRMED_DAILY_CLOSE' };
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
  if (![average50, relativeVolume50, preBreakoutVolumeContraction5v5].every(value => Number.isFinite(value) && value > 0)) {
    return { ...result, state: 'NO_RELIABLE_LISTED_VOLUME' };
  }
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

/**
 * Frozen, descriptive outcome audit of the canonical replay's unfunded WAIT
 * observations. No order or hypothetical portfolio is created. Primary horizon
 * 20 sessions; 60 is secondary. EUNL is fixed before any outcomes are read.
 * Exact matched dates only, with no forward fill or substitute benchmark.
 */
export interface ReplayWaitVolumeSignal {
  assetId: string;
  signalDate: string;
  action: string;
  timingState: string | null;
  executed: boolean;
  isInitialAllocation?: boolean;
}

type WaitVolumeGroup = 'HIGH_VOLUME_BREAKOUT' | 'PRICE_ONLY_BREAKOUT' | 'NO_BREAKOUT';
type WaitVolumeHorizon = 20 | 60;
interface WaitVolumeOutcome {
  horizon: WaitVolumeHorizon;
  exitDate: string;
  grossReturnPct: number;
  excessVsWorldPct: number | null;
}
interface WaitVolumeRow {
  assetId: string;
  date: string;
  group: WaitVolumeGroup;
  index: number;
  outcomes: WaitVolumeOutcome[];
}

export function summarizeReplayWaitPriceVolume(input: {
  signals: readonly ReplayWaitVolumeSignal[];
  dataset: import('../portfolioBacktesting/types').MultiAssetDataset;
  catalog: readonly import('./assetUniverse').AssetUniverseItem[];
}) {
  const groups: WaitVolumeGroup[] = ['HIGH_VOLUME_BREAKOUT', 'PRICE_ONLY_BREAKOUT', 'NO_BREAKOUT'];
  const horizons: WaitVolumeHorizon[] = [20, 60];
  const assets = new Map(input.dataset.assets.map(asset => [asset.assetId, asset] as const));
  const catalog = new Map(input.catalog.map(asset => [asset.assetId, asset] as const));
  const date = (bar: PriceVolumeObservation) => bar.timestamp.slice(0, 10);
  const validPrice = (value: number) => Number.isFinite(value) && value > 0;
  const dateIndex = new Map<string, Map<string, number>>();
  for (const asset of input.dataset.assets) {
    const byDate = new Map<string, number>();
    let previous = '';
    let valid = true;
    for (let i = 0; i < asset.bars.length; i++) {
      const d = date(asset.bars[i]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d <= previous) { valid = false; break; }
      byDate.set(d, i);
      previous = d;
    }
    if (valid) dateIndex.set(asset.assetId, byDate);
  }
  const benchmarkId = 'EUNL';
  const benchmark = assets.get(benchmarkId);
  const benchmarkDates = dateIndex.get(benchmarkId);
  const benchmarkValid = benchmark?.provenance.sourceType === 'REAL' && benchmark.currency === 'EUR'
    && benchmark.ticker === 'EUNL.DE' && benchmarkDates != null;
  const rows: WaitVolumeRow[] = [];
  const unavailable: Record<string, number> = {};
  let waitCount = 0;
  let benchmarkSelfExcluded = 0;
  const reject = (reason: string) => { unavailable[reason] = (unavailable[reason] ?? 0) + 1; };
  const seen = new Set<string>();
  for (const signal of input.signals) {
    if (signal.action !== 'AVOID' || signal.timingState !== 'WAIT' || signal.executed || signal.isInitialAllocation) continue;
    const key = signal.assetId + '|' + signal.signalDate;
    if (seen.has(key)) continue;
    seen.add(key);
    waitCount++;
    if (signal.assetId === benchmarkId) { benchmarkSelfExcluded++; continue; }
    const asset = assets.get(signal.assetId);
    const item = catalog.get(signal.assetId);
    const idx = dateIndex.get(signal.assetId)?.get(signal.signalDate);
    if (!asset || !item || asset.provenance.sourceType !== 'REAL' || item.currency !== 'EUR' || asset.currency !== 'EUR') {
      reject('NON_REAL_OR_NON_EUR'); continue;
    }
    if (input.dataset.timeframe !== '1d' || idx == null) { reject('NO_EXACT_DAILY_BAR'); continue; }
    if (item.instrumentType === 'MUTUAL_FUND') { reject('NO_RELIABLE_LISTED_VOLUME'); continue; }
    // Only the 51-bar causal prefix is exposed to the descriptor, never outcomes.
    const evidence = assessPriceVolumeEvidence({
      bars: asset.bars.slice(Math.max(0, idx - 50), idx + 1),
      informationDate: signal.signalDate,
      provenance: 'REAL',
      instrumentType: item.instrumentType,
      observedAtUtc: new Date(Date.parse(signal.signalDate + 'T00:00:00Z') + 86400000).toISOString()
    });
    if (evidence.state !== 'REAL_EOD_AVAILABLE') { reject(evidence.state); continue; }
    const group: WaitVolumeGroup = evidence.highVolumeBreakout ? 'HIGH_VOLUME_BREAKOUT'
      : evidence.priceBreakout20 ? 'PRICE_ONLY_BREAKOUT' : 'NO_BREAKOUT';
    const outcomes: WaitVolumeOutcome[] = [];
    const entry = asset.bars[idx + 1];
    for (const horizon of horizons) {
      const exit = asset.bars[idx + horizon];
      if (!entry || !exit || !validPrice(entry.open) || !validPrice(exit.close)) continue;
      const grossReturnPct = (exit.close / entry.open - 1) * 100;
      if (!Number.isFinite(grossReturnPct)) continue;
      const bi = benchmarkValid ? benchmarkDates?.get(date(entry)) : undefined;
      const bx = benchmarkValid ? benchmarkDates?.get(date(exit)) : undefined;
      const bo = bi == null ? undefined : benchmark?.bars[bi]?.open;
      const bc = bx == null ? undefined : benchmark?.bars[bx]?.close;
      const benchmarkReturn = bo != null && bc != null && validPrice(bo) && validPrice(bc)
        ? (bc / bo - 1) * 100 : null;
      const excess = benchmarkReturn == null ? null : grossReturnPct - benchmarkReturn;
      outcomes.push({ horizon, exitDate: date(exit), grossReturnPct,
        excessVsWorldPct: excess != null && Number.isFinite(excess) ? excess : null });
    }
    rows.push({ assetId: signal.assetId, date: signal.signalDate, index: idx, group, outcomes });
  }
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const summarize = (selected: WaitVolumeRow[]) => groups.map(group => {
    const members = selected.filter(row => row.group === group);
    return {
      group, observations: members.length, distinctAssets: new Set(members.map(row => row.assetId)).size,
      horizons: horizons.map(horizon => {
        const completed = members.flatMap(row => row.outcomes.filter(outcome => outcome.horizon === horizon));
        const returns = completed.map(row => row.grossReturnPct);
        const excess = completed.flatMap(row => row.excessVsWorldPct == null ? [] : [row.excessVsWorldPct]);
        return {
          sessions: horizon, evaluated: returns.length, benchmarkMatched: excess.length,
          meanGrossReturnPct: mean(returns), positiveRatePct: mean(returns.map(value => value > 0 ? 100 : 0)),
          meanExcessVsWorldPct: mean(excess), outperformRatePct: mean(excess.map(value => value > 0 ? 100 : 0))
        };
      })
    };
  });
  // Select first price breakout across BOTH volume groups per asset. Do not use
  // its outcome or volume label to choose which consecutive event to retain.
  const lastByAsset = new Map<string, number>();
  const separated = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.assetId.localeCompare(b.assetId))
    .filter(row => {
      if (row.group === 'NO_BREAKOUT') return false;
      const last = lastByAsset.get(row.assetId);
      if (last != null && row.index - last < 20) return false;
      lastByAsset.set(row.assetId, row.index);
      return true;
    });
  return {
    version: 'REPLAY_WAIT_PRICE_VOLUME_DIAGNOSTIC_V1' as const,
    authority: 'RESEARCH_ONLY' as const,
    scope: 'UNFUNDED_AVOID_WAIT_AT_REPLAY_DECISION_DATES' as const,
    benchmark: 'EUNL.DE' as const, benchmarkAvailable: benchmarkValid,
    primaryHorizonSessions: 20 as const, waitCount, benchmarkSelfExcluded,
    coverageAvailable: rows.length, unavailable,
    allObservations: summarize(rows),
    firstBreakoutsSeparated20Sessions: summarize(separated).filter(row => row.group !== 'NO_BREAKOUT'),
    notes: [
      'Gross price returns from next session open to horizon close; no costs, taxes or dividends modeled.',
      'Only AVOID/WAIT rows, not every gate rejection; decision frequency determines reach.',
      'Benchmark uses the same exact entry and exit dates; no substitute or fill.',
      'Nonoverlap sensitivity separates 20 sessions per asset, not cross-asset correlation or 60-session overlap.',
      'Existing replay universe may have survivorship bias; descriptive only, not fresh validation or a trading policy.'
    ]
  };
}
