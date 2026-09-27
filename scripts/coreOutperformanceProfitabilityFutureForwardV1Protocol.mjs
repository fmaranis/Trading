export const CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1 = Object.freeze({
  version: 'CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1',
  researchOnly: true,
  productionAuthority: false,
  productionDefault: 'LEGACY',
  snapshotPath: 'validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-snapshot.json',
  snapshotDate: '2026-09-27',
  startRule: 'FIRST_COMMON_TRADABLE_SESSION_AFTER_2026-09-27',
  descriptiveCheckpointsMonths: [3, 6],
  primaryHorizonMonths: 12,
  benchmarks: ['SPY', 'URTH'],
  missingSelectedOutcome: 'INCONCLUSIVE_NO_SURVIVOR_RENORMALIZATION'
});

function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function validateFrozenSnapshot(snapshot) {
  if (!snapshot || snapshot.study !== CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.version) {
    throw new Error('PROFITABILITY_FF_SNAPSHOT_VERSION_INVALID');
  }
  if (snapshot.productionDefault !== 'LEGACY' || snapshot.productionAuthority !== false) {
    throw new Error('PROFITABILITY_FF_SNAPSHOT_PRODUCTION_INVALID');
  }
  if (snapshot.outcome?.outcomeOpened !== false) {
    throw new Error('PROFITABILITY_FF_SNAPSHOT_ALREADY_OPENED');
  }
  const selected = Array.isArray(snapshot.selected) ? snapshot.selected : [];
  if (!selected.length) throw new Error('PROFITABILITY_FF_SELECTED_EMPTY');
  const sum = selected.reduce((s, row) => s + Number(row.selectedWeight || 0), 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`PROFITABILITY_FF_WEIGHTS_NOT_ONE:${sum}`);
  const symbols = new Set();
  for (const row of selected) {
    if (!row.symbol || symbols.has(row.symbol)) throw new Error('PROFITABILITY_FF_SELECTED_SYMBOL_INVALID');
    symbols.add(row.symbol);
    if (!finitePositive(row.selectedWeight)) throw new Error(`PROFITABILITY_FF_WEIGHT_INVALID:${row.symbol}`);
  }
  return selected;
}

export function totalReturnPct(start, end) {
  if (!finitePositive(start) || !finitePositive(end)) throw new Error('PROFITABILITY_FF_PRICE_INVALID');
  return (Number(end) / Number(start) - 1) * 100;
}

export function evaluateFutureForwardCheckpoint(snapshot, input) {
  const selected = validateFrozenSnapshot(snapshot);
  const startPrices = input?.startAdjustedPrices ?? {};
  const endPrices = input?.endAdjustedPrices ?? {};
  const missing = [];
  const rows = selected.map(row => {
    const start = startPrices[row.symbol];
    const end = endPrices[row.symbol];
    if (!finitePositive(start) || !finitePositive(end)) {
      missing.push(row.symbol);
      return null;
    }
    return {
      symbol: row.symbol,
      ticker: row.ticker,
      weight: Number(row.selectedWeight),
      returnPct: totalReturnPct(start, end)
    };
  }).filter(Boolean);

  const benchmarkMissing = CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.benchmarks
    .filter(symbol => !finitePositive(input?.benchmarkStartAdjustedPrices?.[symbol])
      || !finitePositive(input?.benchmarkEndAdjustedPrices?.[symbol]));

  if (missing.length || benchmarkMissing.length) {
    return {
      version: CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.version,
      status: 'INCONCLUSIVE_OUTCOME_COVERAGE',
      months: Number(input?.months),
      missingSelectedSymbols: missing,
      missingBenchmarks: benchmarkMissing,
      productionDefault: 'LEGACY',
      productionAuthority: false
    };
  }

  const basketReturnPct = rows.reduce((s, row) => s + row.weight * row.returnPct, 0);
  const spyReturnPct = totalReturnPct(
    input.benchmarkStartAdjustedPrices.SPY,
    input.benchmarkEndAdjustedPrices.SPY
  );
  const urthReturnPct = totalReturnPct(
    input.benchmarkStartAdjustedPrices.URTH,
    input.benchmarkEndAdjustedPrices.URTH
  );
  const months = Number(input.months);
  const primary = months === CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.primaryHorizonMonths;
  const passed = primary && basketReturnPct > spyReturnPct && basketReturnPct > urthReturnPct;
  const allowedDescriptive = CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.descriptiveCheckpointsMonths.includes(months);

  if (!primary && !allowedDescriptive) throw new Error(`PROFITABILITY_FF_HORIZON_NOT_FROZEN:${months}`);

  return {
    version: CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1.version,
    status: primary
      ? passed ? 'PASS_PRIMARY_12M_SIGNAL_ONLY' : 'FAIL_PRIMARY_12M'
      : 'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION',
    months,
    startDate: input.startDate,
    endDate: input.endDate,
    basketReturnPct,
    spyReturnPct,
    urthReturnPct,
    excessVsSpyPctPoints: basketReturnPct - spyReturnPct,
    excessVsUrthPctPoints: basketReturnPct - urthReturnPct,
    selectedCount: selected.length,
    outcomeCoveragePct: 100,
    productionDefault: 'LEGACY',
    productionAuthority: false
  };
}
