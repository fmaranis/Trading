import {
  activeReplayCashContextSnapshot,
  beginReplayCashContext,
  DEFAULT_REPLAY_CASH_BENCHMARK_MODE,
  endReplayCashContext,
  type CashBenchmarkMode
} from './cashBenchmark';
import {
  DynamicHistoricalReplayEngine as DynamicHistoricalReplayCoreEngine,
  type DynamicHistoricalReplayResult as CoreDynamicHistoricalReplayResult
} from './dynamicHistoricalReplayCore';
import { STRATEGIC_GROWTH_CORE_PRIORITY } from './portfolioAssetRole';

export type {
  DynamicReplayFrequency,
  DynamicReplaySignalAction,
  DynamicReplayEventType,
  DynamicReplayDeploymentSession,
  DynamicReplaySimulationMode,
  DynamicReplayInitialPortfolioSource,
  DynamicReplayInitialAllocation,
  DynamicReplayInitialPortfolio,
  DynamicReplaySignal,
  DynamicReplayEvent,
  DynamicReplayEquityPoint,
  DynamicReplayDeploymentHorizon,
  DynamicReplayTimingStateCounts,
  DynamicReplayTrendProtectionV1Counts
} from './dynamicHistoricalReplayCore';

export interface DynamicHistoricalReplayResult extends CoreDynamicHistoricalReplayResult {
  cashBenchmarkMode: CashBenchmarkMode;
  cashBenchmarkFixedAnnualPct: number;
  cashInterestTaxEur: number;
  cashInterestNetEur: number;
  structuralCoreBenchmarkAssetId: string | null;
  structuralCoreBenchmarkTicker: string | null;
  structuralCoreBenchmarkFinalEur: number | null;
  structuralCoreBenchmarkReturnPct: number | null;
  structuralCoreBenchmarkCagrPct: number | null;
  structuralCoreBenchmarkMaxDrawdownPct: number | null;
  excessFinalEurVsStructuralCore: number | null;
  excessReturnVsStructuralCorePctPoints: number | null;
  beatsStructuralCoreBenchmark: boolean | null;
}

type CoreReplayInput = Parameters<typeof DynamicHistoricalReplayCoreEngine.run>[0];
export type DynamicHistoricalReplayInput = CoreReplayInput & {
  cashBenchmarkMode?: CashBenchmarkMode;
};

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }

function maxDrawdownPct(values: number[]): number | null {
  if (!values.length) return null;
  let peak = values[0];
  let maximum = 0;
  for (const value of values) {
    if (!(value > 0)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) maximum = Math.max(maximum, (peak - value) / peak * 100);
  }
  return maximum;
}

function yearsBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? (end - start) / 86_400_000 / 365.2425
    : 0;
}

function structuralCoreBenchmark(input: DynamicHistoricalReplayInput, result: CoreDynamicHistoricalReplayResult) {
  const fallbackIds = input.catalog
    .filter(asset => asset.category === 'GLOBAL_EQUITY' && !asset.assetId.startsWith('EQ_'))
    .map(asset => asset.assetId);
  const candidateIds = [...new Set<string>([...STRATEGIC_GROWTH_CORE_PRIORITY, ...fallbackIds])];

  for (const assetId of candidateIds) {
    const item = input.catalog.find(asset => asset.assetId === assetId);
    const series = input.dataset.assets.find(asset => asset.assetId === assetId);
    if (!item || !series?.bars.length) continue;
    const validBars = [...series.bars]
      .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
      .sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
    const startBar = validBars.find(bar => {
      const date = isoDate(bar.timestamp);
      return date >= result.startDate && date <= result.endDate;
    });
    const endBar = validBars.filter(bar => isoDate(bar.timestamp) <= result.endDate).at(-1);
    if (!startBar || !endBar || !(startBar.close > 0) || !(endBar.close > 0)) continue;
    const benchmarkStartDate = isoDate(startBar.timestamp);
    const benchmarkEndDate = isoDate(endBar.timestamp);
    if (benchmarkEndDate < benchmarkStartDate) continue;

    const units = input.initialCapitalEur / startBar.close;
    const finalEur = units * endBar.close;
    const returnPct = (finalEur / input.initialCapitalEur - 1) * 100;
    const years = yearsBetween(benchmarkStartDate, benchmarkEndDate);
    const cagrPct = years > 0 && finalEur > 0
      ? (Math.pow(finalEur / input.initialCapitalEur, 1 / years) - 1) * 100
      : null;
    const pathValues = validBars
      .filter(bar => {
        const date = isoDate(bar.timestamp);
        return date >= benchmarkStartDate && date <= benchmarkEndDate;
      })
      .map(bar => units * bar.close);

    return {
      assetId,
      ticker: item.ticker,
      startDate: benchmarkStartDate,
      endDate: benchmarkEndDate,
      finalEur,
      returnPct,
      cagrPct,
      maxDrawdownPct: maxDrawdownPct(pathValues)
    };
  }
  return null;
}

/**
 * Public replay entry point.
 *
 * The mature decision/rebalancing engine remains isolated in
 * dynamicHistoricalReplayCore.ts. This wrapper scopes the economic cash context
 * and adds an independent 100%-structural-core buy-and-hold benchmark. The
 * benchmark never feeds the trading decisions, so it cannot introduce look-ahead.
 */
export class DynamicHistoricalReplayEngine {
  static run(input: DynamicHistoricalReplayInput): DynamicHistoricalReplayResult {
    const cashBenchmarkMode: CashBenchmarkMode = input.cashBenchmarkMode ?? DEFAULT_REPLAY_CASH_BENCHMARK_MODE;
    const fixedAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : 2.5;

    beginReplayCashContext({
      mode: cashBenchmarkMode,
      fixedAnnualPct,
      startDate: input.startDate,
      taxSettings: input.taxSettings
    });

    let coreResult: CoreDynamicHistoricalReplayResult;
    let engineSnapshot = activeReplayCashContextSnapshot();
    try {
      coreResult = DynamicHistoricalReplayCoreEngine.run({
        ...input,
        cashBenchmarkAnnualPct: fixedAnnualPct
      });
      engineSnapshot = activeReplayCashContextSnapshot();
    } finally {
      const closed = endReplayCashContext();
      if (closed) engineSnapshot = {
        ...closed,
        // endReplayCashContext always reports the engine phase totals even if
        // the core has subsequently rebuilt its daily chart path.
        phase: closed.phase
      };
    }

    const cashInterestTaxEur = engineSnapshot?.interestTaxEur ?? 0;
    const cashInterestGrossEur = engineSnapshot?.grossInterestEur ?? coreResult!.cashInterestEur;
    const cashInterestNetEur = engineSnapshot?.netInterestEur ?? Math.max(0, cashInterestGrossEur - cashInterestTaxEur);
    const benchmark = structuralCoreBenchmark(input, coreResult!);
    const excessFinalEurVsStructuralCore = benchmark == null ? null : coreResult!.finalValueEur - benchmark.finalEur;
    const excessReturnVsStructuralCorePctPoints = benchmark == null ? null : coreResult!.totalReturnPct - benchmark.returnPct;

    return {
      ...coreResult!,
      cashBenchmarkMode,
      cashBenchmarkFixedAnnualPct: fixedAnnualPct,
      cashInterestEur: cashInterestGrossEur,
      cashInterestTaxEur,
      cashInterestNetEur,
      totalEstimatedTaxEur: coreResult!.totalEstimatedTaxEur + cashInterestTaxEur,
      structuralCoreBenchmarkAssetId: benchmark?.assetId ?? null,
      structuralCoreBenchmarkTicker: benchmark?.ticker ?? null,
      structuralCoreBenchmarkFinalEur: benchmark?.finalEur ?? null,
      structuralCoreBenchmarkReturnPct: benchmark?.returnPct ?? null,
      structuralCoreBenchmarkCagrPct: benchmark?.cagrPct ?? null,
      structuralCoreBenchmarkMaxDrawdownPct: benchmark?.maxDrawdownPct ?? null,
      excessFinalEurVsStructuralCore,
      excessReturnVsStructuralCorePctPoints,
      beatsStructuralCoreBenchmark: benchmark == null ? null : excessFinalEurVsStructuralCore! > 0,
      notes: [
        ...coreResult!.notes,
        cashBenchmarkMode === 'HISTORICAL_ECB_DFR_FLOOR_0'
          ? 'Cash del replay: facilidad de deposito del BCE por fecha, con suelo nominal 0% para el proxy minorista.'
          : `Cash del replay: TAE fija configurada de ${fixedAnnualPct.toFixed(2)}%.`,
        input.taxSettings?.contextConfirmed
          ? 'Intereses de cash: tributacion progresiva segun la base del ahorro configurada.'
          : 'Intereses de cash: se descuenta retencion del 19% al no existir contexto fiscal anual confirmado.',
        benchmark
          ? `Benchmark estructural: 100% del capital en ${benchmark.ticker} desde la primera sesión disponible ${benchmark.startDate} hasta ${benchmark.endDate}, buy-and-hold sin market timing. Final ${benchmark.finalEur.toFixed(2)} €, retorno ${benchmark.returnPct.toFixed(2)}%, CAGR ${benchmark.cagrPct == null ? 'N/D' : `${benchmark.cagrPct.toFixed(2)}%`}, DD máx. ${benchmark.maxDrawdownPct == null ? 'N/D' : `${benchmark.maxDrawdownPct.toFixed(2)}%`}. Este benchmark no participa en ninguna decisión del motor.`
          : 'Benchmark estructural no disponible: el dataset del replay no contiene un core global con precio válido en inicio y fin.'
      ]
    };
  }
}
