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

export type {
  DynamicReplayFrequency,
  DynamicReplaySignalAction,
  DynamicReplayEventType,
  DynamicReplayDeploymentSession,
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
}

type CoreReplayInput = Parameters<typeof DynamicHistoricalReplayCoreEngine.run>[0];
export type DynamicHistoricalReplayInput = CoreReplayInput & {
  cashBenchmarkMode?: CashBenchmarkMode;
};

/**
 * Public replay entry point.
 *
 * The mature decision/rebalancing engine remains isolated in
 * dynamicHistoricalReplayCore.ts. This wrapper only scopes the economic cash
 * context used by the existing helpers: historical/fixed hurdle, remunerated
 * cash accrual and interest taxation. No trading rule is duplicated here.
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

    return {
      ...coreResult!,
      cashBenchmarkMode,
      cashBenchmarkFixedAnnualPct: fixedAnnualPct,
      cashInterestEur: cashInterestGrossEur,
      cashInterestTaxEur,
      cashInterestNetEur,
      totalEstimatedTaxEur: coreResult!.totalEstimatedTaxEur + cashInterestTaxEur,
      notes: [
        ...coreResult!.notes,
        cashBenchmarkMode === 'HISTORICAL_ECB_DFR_FLOOR_0'
          ? 'Cash del replay: facilidad de deposito del BCE por fecha, con suelo nominal 0% para el proxy minorista.'
          : `Cash del replay: TAE fija configurada de ${fixedAnnualPct.toFixed(2)}%.`,
        input.taxSettings?.contextConfirmed
          ? 'Intereses de cash: tributacion progresiva segun la base del ahorro configurada.'
          : 'Intereses de cash: se descuenta retencion del 19% al no existir contexto fiscal anual confirmado.'
      ]
    };
  }
}
