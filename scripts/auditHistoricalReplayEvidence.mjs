/**
 * Independent, read-only validation of an exported historical Custodia replay.
 * No network, broker, market data, policy/threshold optimization, or new replay.
 * This verifies recorded ledger consistency, NOT availability of past quotes
 * or profitability on an unopened holdout.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const close = (a, b, tolerance = 0.02) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;
function requireEvidence(holds, code) {
  if (!holds) throw new Error('HISTORICAL_EVIDENCE_INTEGRITY_FAIL:' + code);
}
function dateOk(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date + 'T00:00:00Z'));
}
function maxDrawdownPct(path) {
  let peak = 0, maxDrawdown = 0;
  for (const point of path) {
    peak = Math.max(peak, point.equityEur);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - point.equityEur) / peak * 100 : 0);
  }
  return maxDrawdown;
}

export function auditHistoricalReplayEvidence(document) {
  requireEvidence(document?.metadata?.format === 'TRADING_HISTORICAL_REPLAY_AUDIT', 'EXPORT_FORMAT');
  const session = document.session;
  requireEvidence(session && typeof session === 'object', 'SESSION_MISSING');
  requireEvidence(Array.isArray(session.path) && session.path.length >= 2, 'PATH_MISSING');
  requireEvidence(Array.isArray(session.executions) && Array.isArray(session.signals), 'DECISION_LEDGER_MISSING');
  requireEvidence(finite(session.initialCapitalEur) && session.initialCapitalEur > 0, 'INVALID_INITIAL_CAPITAL');

  const path = session.path;
  let previousDate = '';
  let largestEquityResidualEur = 0;
  let largestAssetResidualEur = 0;
  let minimumCashEur = Infinity;
  for (const point of path) {
    requireEvidence(dateOk(point.date) && point.date > previousDate, 'PATH_DATES_NOT_STRICTLY_ASCENDING');
    previousDate = point.date;
    for (const field of ['equityEur', 'cashEur', 'investedEur']) {
      requireEvidence(finite(point[field]), 'PATH_NONFINITE_' + field);
    }
    requireEvidence(point.equityEur > 0, 'NONPOSITIVE_EQUITY');
    requireEvidence(point.cashEur >= -0.01, 'NEGATIVE_CASH');
    requireEvidence(point.investedEur >= -0.01, 'NEGATIVE_INVESTED');
    const residual = Math.abs(point.equityEur - point.cashEur - point.investedEur);
    largestEquityResidualEur = Math.max(largestEquityResidualEur, residual);
    requireEvidence(residual <= 0.02, 'EQUITY_CASH_ASSETS_MISMATCH');
    requireEvidence(point.assetValuesEur && typeof point.assetValuesEur === 'object'
      && !Array.isArray(point.assetValuesEur), 'ASSET_VALUES_MISSING');
    const assetValues = Object.values(point.assetValuesEur);
    requireEvidence(assetValues.every(finite), 'ASSET_VALUES_NONFINITE');
    const assetResidual = Math.abs(point.investedEur - assetValues.reduce((a, b) => a + b, 0));
    largestAssetResidualEur = Math.max(largestAssetResidualEur, assetResidual);
    requireEvidence(assetResidual <= 0.02, 'INVESTED_ASSET_SUM_MISMATCH');
    minimumCashEur = Math.min(minimumCashEur, point.cashEur);
  }
  requireEvidence(close(path[0].equityEur, session.initialCapitalEur), 'INITIAL_WEALTH_MISMATCH');

  const signalsById = new Map();
  let previousSignalDate = '';
  for (const signal of session.signals) {
    requireEvidence(typeof signal.id === 'string' && !signalsById.has(signal.id), 'DUPLICATE_SIGNAL_ID');
    requireEvidence(dateOk(signal.signalDate) && signal.signalDate >= previousSignalDate, 'SIGNALS_OUT_OF_ORDER');
    signalsById.set(signal.id, signal);
    previousSignalDate = signal.signalDate;
  }
  const seenExecutions = new Set();
  let precedingExecutionDate = '';
  for (const trade of session.executions) {
    requireEvidence(typeof trade.id === 'string' && !seenExecutions.has(trade.id), 'DUPLICATE_EXECUTION_ID');
    seenExecutions.add(trade.id);
    requireEvidence(dateOk(trade.signalDate) && dateOk(trade.executionDate), 'EXECUTION_DATE_MISSING');
    requireEvidence(trade.signalDate < trade.executionDate, 'SAME_DAY_OR_LOOKAHEAD_EXECUTION');
    requireEvidence(trade.executionDate >= precedingExecutionDate, 'EXECUTION_DATES_OUT_OF_ORDER');
    requireEvidence(trade.executionDate <= path.at(-1).date && trade.executionDate >= path[0].date,
      'EXECUTION_OUTSIDE_PATH');
    requireEvidence(path.some(point => point.date === trade.executionDate), 'EXECUTION_DATE_NOT_VALUED');
    for (const key of ['unitsDelta','notionalEur','feeEur','estimatedTaxEur','executionPriceEur']) {
      requireEvidence(finite(trade[key]), 'EXECUTION_NONFINITE_' + key);
    }
    requireEvidence(trade.feeEur >= 0 && trade.estimatedTaxEur >= 0 &&
      trade.notionalEur >= 0 && trade.executionPriceEur > 0, 'INVALID_TRADE_VALUE');
    const signal = signalsById.get(trade.id);
    requireEvidence(signal && signal.executed === true && signal.assetId === trade.assetId &&
      signal.action === trade.action && signal.signalDate === trade.signalDate &&
      signal.executionDate === trade.executionDate, 'EXECUTION_WITHOUT_EXACT_SIGNAL');
    requireEvidence(close(signal.notionalEur, trade.notionalEur) &&
      close(signal.feeEur, trade.feeEur) && close(signal.estimatedTaxEur, trade.estimatedTaxEur) &&
      close(signal.unitsDelta, trade.unitsDelta, 1e-6), 'EXECUTION_SIGNAL_AMOUNT_MISMATCH');
    precedingExecutionDate = trade.executionDate;
  }
  requireEvidence(session.signals.filter(s => s.executed === true).length === seenExecutions.size,
    'EXECUTED_SIGNAL_COUNT_MISMATCH');

  const summary = session.summary;
  const final = path.at(-1);
  requireEvidence(summary && close(summary.engineFinalEur, final.equityEur), 'ENGINE_FINAL_MISMATCH');
  requireEvidence(close(summary.engineReturnPct, (final.equityEur / session.initialCapitalEur - 1) * 100),
    'RETURN_MISMATCH');
  const drawdown = maxDrawdownPct(path);
  requireEvidence(close(summary.engineMaxDrawdownPct, drawdown, 1e-6), 'DRAWDOWN_MISMATCH');
  requireEvidence(close(summary.engineFeesEur,
    session.executions.reduce((sum, t) => sum + t.feeEur, 0)), 'FEES_MISMATCH');
  requireEvidence(close(summary.engineTaxEur,
    session.executions.reduce((sum, t) => sum + t.estimatedTaxEur, 0)), 'TAX_MISMATCH');
  requireEvidence(Array.isArray(session.checkpoints) && session.checkpoints.length > 0,
    'CHECKPOINTS_MISSING');
  requireEvidence(close(session.checkpoints.at(-1).finalValueEur, final.equityEur),
    'FINAL_CHECKPOINT_MISMATCH');
  const core = summary.structuralCoreBenchmark;
  if (core?.available) {
    requireEvidence(finite(core.finalEur) && core.finalEur > 0, 'CORE_BENCHMARK_NOT_FINITE');
    requireEvidence(close(core.returnPct, (core.finalEur / session.initialCapitalEur - 1) * 100),
      'CORE_BENCHMARK_RETURN_MISMATCH');
    requireEvidence(close(core.excessFinalEur, summary.engineFinalEur - core.finalEur),
      'CORE_BENCHMARK_EXCESS_EUR_MISMATCH');
    requireEvidence(close(core.excessReturnPctPoints, summary.engineReturnPct - core.returnPct),
      'CORE_BENCHMARK_EXCESS_PPT_MISMATCH');
  }

  const cashHold = summary.exactHoldFinalEur;
  if (finite(cashHold) && finite(final.cashBenchmarkEur)) {
    requireEvidence(close(cashHold, final.cashBenchmarkEur), 'CASH_BENCHMARK_FINAL_MISMATCH');
  }
  const externalFlowsRecorded = Array.isArray(session.externalCashFlows) && session.externalCashFlows.length > 0;
  const years = [...new Set(path.map(p => p.date.slice(0, 4)))].map(year => {
    const rows = path.filter(p => p.date.startsWith(year));
    const prior = path.findLast(p => p.date < rows[0].date);
    const opening = prior?.equityEur ?? session.initialCapitalEur;
    return {
      year: Number(year),
      sessions: rows.length,
      finalEur: Number(rows.at(-1).equityEur.toFixed(2)),
      returnPct: !externalFlowsRecorded ? Number(((rows.at(-1).equityEur / opening - 1) * 100).toFixed(3)) : null,
      averageCashPct: Number((rows.reduce((a, p) => a + p.cashEur / p.equityEur, 0) / rows.length * 100).toFixed(2)),
      executedTrades: session.executions.filter(t => t.executionDate.startsWith(year)).length
    };
  });
  const executed = session.executions.length;
  const readyAvoid = session.signals.filter(s =>
    s.action === 'AVOID' && (s.timingState === 'ENTRY_READY' || s.timingState === 'ENTRY_STRONG'));
  const candidateDates = new Set(readyAvoid.map(s => s.signalDate));
  const lowCashDates = [...candidateDates].filter(date => {
    const point = path.find(p => p.date >= date);
    return point && point.cashEur / point.equityEur <= 0.05;
  }).length;

  return {
    format: 'CUSTODIA_INDEPENDENT_HISTORICAL_EVIDENCE_AUDIT_V1',
    sourceExportedAt: document.metadata.exportedAt ?? null,
    sample: { start: path[0].date, end: final.date, initialCapitalEur: session.initialCapitalEur,
      decisions: new Set(session.signals.map(s => s.signalDate)).size,
      pathSessions: path.length, executedTrades: executed },
    technical: { accounting: 'PASS', executionChronology: 'PASS', signalExecutionParity: 'PASS',
      benchmarkArithmetic: core?.available ? 'PASS_REPORTED_TOTALS_ONLY' : 'N_D',
      maxEquityResidualEur: largestEquityResidualEur,
      maxAssetResidualEur: largestAssetResidualEur,
      minimumCashEur },
    economic: { engineFinalEur: Number(final.equityEur.toFixed(2)),
      engineReturnPct: Number(((final.equityEur / session.initialCapitalEur - 1) * 100).toFixed(3)),
      engineMaxDrawdownPct: Number(drawdown.toFixed(3)),
      reportedCoreFinalEur: core?.available ? Number(core.finalEur.toFixed(2)) : null,
      reportedCoreReturnPct: core?.available ? Number(core.returnPct.toFixed(3)) : null,
      engineMinusCoreEur: core?.available ? Number((summary.engineFinalEur - core.finalEur).toFixed(2)) : null,
      beatsCore: core?.available ? summary.engineFinalEur > core.finalEur : null,
      feesEur: Number(summary.engineFeesEur.toFixed(2)),
      taxEur: Number(summary.engineTaxEur.toFixed(2)),
      readyButUnfundedSignals: readyAvoid.length,
      datesWithReadyButUnfundedSignals: candidateDates.size,
      suchDatesAtOrBelow5PctCash: lowCashDates,
      calendarYears: years
    },
    evidenceLimits: {
      marketBarsAndProviderPointInTimeNotContained: true,
      nextOpenExecutionPriceCannotBeIndependentlyChecked: true,
      benchmarkDailyPathNotContained: true,
      historicalUniverseSurvivorshipNotResolved: true,
      externalFlows: externalFlowsRecorded ? 'RETURN_N_D_UNTIL_FLOW_ADJUSTED_AUDIT' : 'NO_EXTERNAL_FLOWS_RECORDED_IN_EXPORT',
      sampleUsedForResearchAndNotFresh: true,
      productionPromotionAllowed: false
    },
    verdict: 'LEDGER_CONSISTENT_CORE_OUTPERFORMANCE_NOT_PROVEN'
  };
}

// CLI: audit an existing export, never fetch new data or launch a replay.
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('auditHistoricalReplayEvidence.mjs')) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('Uso: node scripts/auditHistoricalReplayEvidence.mjs <export.json>');
    const result = auditHistoricalReplayEvidence(JSON.parse(readFileSync(resolve(file), 'utf8')));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(String(error?.message ?? error));
    process.exitCode = 1;
  }
}
