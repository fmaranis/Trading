export const PROFITABILITY_VALUE_FUTURE_FORWARD_V1 = Object.freeze({
  version: 'CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1',
  productionDefault: 'LEGACY',
  productionAuthority: false,
  researchOnly: true,
  descriptiveCheckpointsMonths: [3,6],
  primaryHorizonMonths: 12,
  benchmarks: ['SPY','URTH']
});

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function evaluateProfitabilityValueFutureForward(snapshot, input) {
  if (!snapshot || snapshot.study !== PROFITABILITY_VALUE_FUTURE_FORWARD_V1.version) {
    throw new Error('PROFITABILITY_VALUE_FF_SNAPSHOT_INVALID');
  }
  if (snapshot.outcome?.outcomeOpened !== false) {
    throw new Error('PROFITABILITY_VALUE_FF_ALREADY_OPENED');
  }
  const selected = snapshot.selected ?? [];
  if (!selected.length) return {
    version: PROFITABILITY_VALUE_FUTURE_FORWARD_V1.version,
    status: 'INCONCLUSIVE_EMPTY_INTERSECTION',
    productionDefault: 'LEGACY',
    productionAuthority: false
  };

  const start = input?.selectedStartAdjustedPrices ?? {};
  const end = input?.selectedEndAdjustedPrices ?? {};
  const missing = selected
    .filter(row => !positive(start[row.symbol]) || !positive(end[row.symbol]))
    .map(row => row.symbol);
  const b0 = input?.benchmarkStartAdjustedPrices ?? {};
  const b1 = input?.benchmarkEndAdjustedPrices ?? {};
  const missingBenchmarks = PROFITABILITY_VALUE_FUTURE_FORWARD_V1.benchmarks
    .filter(k => !positive(b0[k]) || !positive(b1[k]));
  if (missing.length || missingBenchmarks.length) return {
    version: PROFITABILITY_VALUE_FUTURE_FORWARD_V1.version,
    status: 'INCONCLUSIVE_OUTCOME_COVERAGE',
    missingSelectedSymbols: missing,
    missingBenchmarks,
    productionDefault: 'LEGACY',
    productionAuthority: false
  };

  const weightSum = selected.reduce((s,row)=>s+Number(row.weight),0);
  if (Math.abs(weightSum - 1) > 1e-9) throw new Error('PROFITABILITY_VALUE_FF_WEIGHT_SUM_INVALID');

  const basketReturnPct = selected.reduce((s,row) => {
    const r = (Number(end[row.symbol]) / Number(start[row.symbol]) - 1) * 100;
    return s + Number(row.weight) * r;
  },0);
  const spyReturnPct = (Number(b1.SPY) / Number(b0.SPY) - 1) * 100;
  const urthReturnPct = (Number(b1.URTH) / Number(b0.URTH) - 1) * 100;
  const months = Number(input.months);
  const primary = months === 12;
  if (!primary && ![3,6].includes(months)) {
    throw new Error(`PROFITABILITY_VALUE_FF_HORIZON_NOT_FROZEN:${months}`);
  }
  return {
    version: PROFITABILITY_VALUE_FUTURE_FORWARD_V1.version,
    months,
    status: primary
      ? basketReturnPct > spyReturnPct && basketReturnPct > urthReturnPct
        ? 'PASS_PRIMARY_12M_SIGNAL_ONLY'
        : 'FAIL_PRIMARY_12M'
      : 'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION',
    basketReturnPct,
    spyReturnPct,
    urthReturnPct,
    excessVsSpyPctPoints: basketReturnPct - spyReturnPct,
    excessVsUrthPctPoints: basketReturnPct - urthReturnPct,
    selectedCount: selected.length,
    concentrationBlockedForPromotion: selected.length < 10 || Number(snapshot.concentration?.effectiveNumberOfPositions ?? 0) < 10,
    productionDefault: 'LEGACY',
    productionAuthority: false
  };
}
