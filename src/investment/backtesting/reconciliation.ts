import { BacktestResult, BacktestTrade, PriceBar, BacktestConfig } from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { BacktestEngine } from './engine';
import {
  computeQuantEnvironmentFingerprint,
  QuantEnvironmentVersions
} from '../quant/environmentFingerprint';

export type ParityStatus =
  | 'IDENTICAL'
  | 'MATCH'
  | 'MINOR_DIVERGENCE'
  | 'MATERIAL_DIVERGENCE';

export type ConfirmedDifferenceType =
  | 'TRADE_COUNT_MISMATCH'
  | 'ENTRY_DATE_MISMATCH'
  | 'EXIT_DATE_MISMATCH'
  | 'ENTRY_PRICE_MISMATCH'
  | 'EXIT_PRICE_MISMATCH'
  | 'SIZE_MISMATCH'
  | 'EQUITY_MISMATCH';

export interface ConfirmedDifference {
  type: ConfirmedDifferenceType;
  details: string;
}

export interface DivergenceHypothesis {
  cause:
    | 'FRACTIONAL_SHARES_ROUNDING'
    | 'SLIPPAGE_CONVENTION'
    | 'COMMISSION_TIMING'
    | 'SIGNAL_ALIGNMENT'
    | 'CASH_PRECISION';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string[];
}

export interface TradeReconciliationItem {
  tradeIndex: number;
  tsEntryDate?: string;
  pyEntryDate?: string;
  tsExitDate?: string;
  pyExitDate?: string;
  tsEntryPrice?: number;
  pyEntryPrice?: number;
  entryPriceDiffPct: number | null;
  tsExitPrice?: number;
  pyExitPrice?: number;
  exitPriceDiffPct: number | null;
  tsShares?: number;
  pyShares?: number;
  sharesDiff?: number;
  sharesDiffPct?: number;
  tsCommission?: number;
  pyCommission?: number;
  tsSlippage?: number;
  pySlippage?: number;
  tsNetPnl?: number;
  pyNetPnl?: number;
  pnlDiffEur: number | null;
  status: 'IDENTICAL' | 'MATCH' | 'PRICE_DIFFERENCE' | 'SIZE_DIFFERENCE' | 'MISSING_TRADE';
}

export interface EquityReconciliationPoint {
  timestamp: string;
  tsEquity: number;
  pyEquity: number;
  diffEur: number;
  diffPct: number;
}

export interface PythonQuantBacktestLike {
  engine: string;
  engineVersion: string;
  quantEnvironmentFingerprint: string;
  inputDatasetFingerprint: string;
  outputDatasetFingerprint: string;
  metrics: {
    initialCapital: number;
    finalEquity: number;
    totalReturnPct: number;
    totalTrades: number;
    winRatePct?: number;
    maxDrawdownPct: number;
    totalCommissionEur?: number;
    totalSlippageEur?: number;
    totalTradingCostsEur?: number;
  };
  equityCurve: { timestamp: string; equity: number }[];
  trades: {
    id: string;
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    shares: number;
    amountInvested?: number;
    commissionEur?: number;
    slippageEur?: number;
    pnlEur: number;
    pnlPct: number;
  }[];
}

export interface ParityScenarioResult {
  scenario:
    | 'NO_FRICTION'
    | 'COMMISSION_ONLY'
    | 'SLIPPAGE_ONLY'
    | 'FULL_FRICTION';
  status: ParityStatus;
  finalEquityDiffPct: number;
  tradeCountMatch: boolean;
}

export interface EngineReconciliationReport {
  status: ParityStatus;
  datasetFingerprint: string;
  quantEnvironmentFingerprint: string;
  tsInitialCapital: number;
  tsFinalEquity: number;
  pyFinalEquity: number;
  finalEquityDiffPct: number;
  tsTotalReturnPct: number;
  pyTotalReturnPct: number;
  tsTotalTrades: number;
  pyTotalTrades: number;
  tradeCountMatch: boolean;
  tradeReconciliation: TradeReconciliationItem[];
  equityReconciliation: EquityReconciliationPoint[];
  firstDivergenceTimestamp: string | null;
  maxEquityDivergencePct: number;
  confirmedDifferences: ConfirmedDifference[];
  divergenceHypotheses: DivergenceHypothesis[];
  scenarioResults?: ParityScenarioResult[];
  explanation: string;
}

export class EngineReconciliationCalculator {
  public static computeEnvironmentFingerprint(versions: QuantEnvironmentVersions): string {
    return computeQuantEnvironmentFingerprint(versions);
  }

  public static reconcile(
    tsResult: BacktestResult,
    pyResult: PythonQuantBacktestLike,
    scenarioResults?: ParityScenarioResult[]
  ): EngineReconciliationReport {
    const tsTrades = tsResult.trades;
    const pyTrades = pyResult.trades;
    const maxTrades = Math.max(tsTrades.length, pyTrades.length);
    const tradeReconciliation: TradeReconciliationItem[] = [];
    const confirmedDifferences: ConfirmedDifference[] = [];
    const hypothesisMap: Map<DivergenceHypothesis['cause'], { confidence: 'LOW' | 'MEDIUM' | 'HIGH'; evidence: string[] }> = new Map();
    const tradeCountMatch = tsTrades.length === pyTrades.length;
    if (!tradeCountMatch) confirmedDifferences.push({ type: 'TRADE_COUNT_MISMATCH', details: `TypeScript generó ${tsTrades.length} operaciones mientras vectorbt generó ${pyTrades.length} operaciones.` });
    let allTradesIdentical = tradeCountMatch;

    for (let i = 0; i < maxTrades; i++) {
      const tsT = tsTrades[i];
      const pyT = pyTrades[i];
      if (!tsT || !pyT) {
        allTradesIdentical = false;
        tradeReconciliation.push({ tradeIndex: i + 1, tsEntryDate: tsT?.entryDate, pyEntryDate: pyT?.entryDate, tsExitDate: tsT?.exitDate, pyExitDate: pyT?.exitDate, tsEntryPrice: tsT?.entryPrice, pyEntryPrice: pyT?.entryPrice, entryPriceDiffPct: null, tsExitPrice: tsT?.exitPrice, pyExitPrice: pyT?.exitPrice, exitPriceDiffPct: null, tsShares: tsT?.shares, pyShares: pyT?.shares, sharesDiff: undefined, sharesDiffPct: null, tsCommission: tsT?.totalCommission, pyCommission: pyT?.commissionEur, tsSlippage: tsT?.totalSlippage, pySlippage: pyT?.slippageEur, tsNetPnl: tsT?.netPnlEur, pyNetPnl: pyT?.pnlEur, pnlDiffEur: null, status: 'MISSING_TRADE' });
        continue;
      }
      const rawEntryPriceDiff = pyT.entryPrice - tsT.entryPrice;
      const rawExitPriceDiff = pyT.exitPrice - tsT.exitPrice;
      const rawSharesDiff = pyT.shares - tsT.shares;
      const rawPnlDiff = pyT.pnlEur - tsT.netPnlEur;
      const entryPriceDiffPct = tsT.entryPrice > 0 ? (rawEntryPriceDiff / tsT.entryPrice) * 100 : 0;
      const exitPriceDiffPct = tsT.exitPrice > 0 ? (rawExitPriceDiff / tsT.exitPrice) * 100 : 0;
      const sharesDiffPct = tsT.shares > 0 ? (rawSharesDiff / tsT.shares) * 100 : 0;
      const datesMatch = tsT.entryDate === pyT.entryDate && tsT.exitDate === pyT.exitDate;
      if (!datesMatch) {
        allTradesIdentical = false;
        if (tsT.entryDate !== pyT.entryDate) confirmedDifferences.push({ type: 'ENTRY_DATE_MISMATCH', details: `Operación ${i + 1}: Entrada TS ${tsT.entryDate} vs VBT ${pyT.entryDate}` });
        if (tsT.exitDate !== pyT.exitDate) confirmedDifferences.push({ type: 'EXIT_DATE_MISMATCH', details: `Operación ${i + 1}: Salida TS ${tsT.exitDate} vs VBT ${pyT.exitDate}` });
      }
      const entryPriceIdentical = Math.abs(rawEntryPriceDiff) < 1e-7;
      const exitPriceIdentical = Math.abs(rawExitPriceDiff) < 1e-7;
      const sharesIdentical = Math.abs(rawSharesDiff) < 1e-7;
      const pnlIdentical = Math.abs(rawPnlDiff) < 1e-5;
      let status: TradeReconciliationItem['status'] = 'MATCH';
      if (datesMatch && entryPriceIdentical && exitPriceIdentical && sharesIdentical && pnlIdentical) status = 'IDENTICAL';
      else if (!entryPriceIdentical || !exitPriceIdentical) {
        status = 'PRICE_DIFFERENCE'; allTradesIdentical = false;
        confirmedDifferences.push({ type: 'ENTRY_PRICE_MISMATCH', details: `Operación ${i + 1}: Precio entrada TS ${tsT.entryPrice} vs VBT ${pyT.entryPrice}` });
        if (!hypothesisMap.has('SLIPPAGE_CONVENTION')) hypothesisMap.set('SLIPPAGE_CONVENTION', { confidence: 'MEDIUM', evidence: [`Diferencia en precio de ejecución de entrada/salida (${entryPriceDiffPct.toFixed(3)}%)`] });
      } else if (!sharesIdentical) {
        status = 'SIZE_DIFFERENCE'; allTradesIdentical = false;
        confirmedDifferences.push({ type: 'SIZE_MISMATCH', details: `Operación ${i + 1}: Títulos TS ${tsT.shares} vs VBT ${pyT.shares} (diff: ${rawSharesDiff})` });
        if (!hypothesisMap.has('FRACTIONAL_SHARES_ROUNDING')) hypothesisMap.set('FRACTIONAL_SHARES_ROUNDING', { confidence: 'MEDIUM', evidence: [`Discrepancia en volumen de títulos (${rawSharesDiff.toFixed(4)} títulos)`] });
      } else if (!pnlIdentical && !hypothesisMap.has('COMMISSION_TIMING')) hypothesisMap.set('COMMISSION_TIMING', { confidence: 'LOW', evidence: [`Diferencia en PnL neto de ${rawPnlDiff.toFixed(4)}€ con precios de entrada y salida idénticos`] });

      tradeReconciliation.push({ tradeIndex: i + 1, tsEntryDate: tsT.entryDate, pyEntryDate: pyT.entryDate, tsExitDate: tsT.exitDate, pyExitDate: pyT.exitDate, tsEntryPrice: tsT.entryPrice, pyEntryPrice: pyT.entryPrice, entryPriceDiffPct: Math.round(entryPriceDiffPct * 1000) / 1000, tsExitPrice: tsT.exitPrice, pyExitPrice: pyT.exitPrice, exitPriceDiffPct: Math.round(exitPriceDiffPct * 1000) / 1000, tsShares: tsT.shares, pyShares: pyT.shares, sharesDiff: Math.round(rawSharesDiff * 10000) / 10000, sharesDiffPct: Math.round(sharesDiffPct * 1000) / 1000, tsCommission: tsT.totalCommission, pyCommission: pyT.commissionEur, tsSlippage: tsT.totalSlippage, pySlippage: pyT.slippageEur, tsNetPnl: Math.round(tsT.netPnlEur * 100) / 100, pyNetPnl: Math.round(pyT.pnlEur * 100) / 100, pnlDiffEur: Math.round(rawPnlDiff * 100) / 100, status });
    }

    const tsCurve = tsResult.equityCurve;
    const pyCurve = pyResult.equityCurve;
    const equityReconciliation: EquityReconciliationPoint[] = [];
    let firstDivergenceTimestamp: string | null = null;
    let maxEquityDivergencePct = 0;
    const pyMap = new Map<string, number>();
    for (const pt of pyCurve) pyMap.set(pt.timestamp.substring(0, 10), pt.equity);
    for (const tsPt of tsCurve) {
      const pyEq = pyMap.get(tsPt.timestamp.substring(0, 10));
      if (pyEq !== undefined) {
        const diffEur = pyEq - tsPt.equity;
        const diffPct = tsPt.equity > 0 ? (Math.abs(diffEur) / tsPt.equity) * 100 : 0;
        if (diffPct > maxEquityDivergencePct) maxEquityDivergencePct = diffPct;
        if (diffPct > 0.001 && !firstDivergenceTimestamp) firstDivergenceTimestamp = tsPt.timestamp;
        equityReconciliation.push({ timestamp: tsPt.timestamp, tsEquity: Math.round(tsPt.equity * 100) / 100, pyEquity: Math.round(pyEq * 100) / 100, diffEur: Math.round(diffEur * 100) / 100, diffPct: Math.round(diffPct * 1000) / 1000 });
      }
    }

    const tsFinal = tsResult.metrics.finalEquity;
    const pyFinal = pyResult.metrics.finalEquity;
    const finalEquityDiffPct = tsFinal > 0 ? (Math.abs(pyFinal - tsFinal) / tsFinal) * 100 : 0;
    if (finalEquityDiffPct > 0.001) confirmedDifferences.push({ type: 'EQUITY_MISMATCH', details: `Capital final difiere en ${finalEquityDiffPct.toFixed(4)}% (TS: ${tsFinal.toFixed(2)}€ vs VBT: ${pyFinal.toFixed(2)}€)` });

    let status: ParityStatus = 'MATCH';
    if (allTradesIdentical && finalEquityDiffPct < 1e-5 && maxEquityDivergencePct < 1e-5) status = 'IDENTICAL';
    else if (finalEquityDiffPct > 0.50 || !tradeCountMatch) status = 'MATERIAL_DIVERGENCE';
    else if (finalEquityDiffPct > 0.10) status = 'MINOR_DIVERGENCE';

    if (scenarioResults && scenarioResults.length > 0) {
      const noFriction = scenarioResults.find(s => s.scenario === 'NO_FRICTION');
      const commOnly = scenarioResults.find(s => s.scenario === 'COMMISSION_ONLY');
      const slipOnly = scenarioResults.find(s => s.scenario === 'SLIPPAGE_ONLY');
      if (noFriction?.status === 'IDENTICAL') {
        if (slipOnly && slipOnly.status !== 'IDENTICAL') hypothesisMap.set('SLIPPAGE_CONVENTION', { confidence: 'HIGH', evidence: ['Escenario sin costes IDENTICAL y escenario solo slippage divergente.'] });
        if (commOnly && commOnly.status !== 'IDENTICAL') hypothesisMap.set('COMMISSION_TIMING', { confidence: 'HIGH', evidence: ['Escenario sin costes IDENTICAL y escenario solo comisiones divergente.'] });
      }
    }

    const divergenceHypotheses: DivergenceHypothesis[] = Array.from(hypothesisMap.entries()).map(([cause, data]) => ({ cause, confidence: data.confidence, evidence: data.evidence }));
    const explanation = status === 'IDENTICAL'
      ? 'Paridad idéntica bit a bit: operaciones y curva coinciden dentro del epsilon numérico.'
      : status === 'MATCH'
        ? 'Resultados dentro de la tolerancia de paridad definida (<= 0.10%).'
        : status === 'MINOR_DIVERGENCE'
          ? `Divergencia menor (${finalEquityDiffPct.toFixed(2)}%).`
          : `Divergencia material detectada (${finalEquityDiffPct.toFixed(2)}%).`;

    return {
      status,
      datasetFingerprint: tsResult.dataProvenance?.datasetFingerprint || pyResult.inputDatasetFingerprint,
      quantEnvironmentFingerprint: pyResult.quantEnvironmentFingerprint || 'qenv_unknown',
      tsInitialCapital: tsResult.metrics.initialCapital,
      tsFinalEquity: Math.round(tsFinal * 100) / 100,
      pyFinalEquity: Math.round(pyFinal * 100) / 100,
      finalEquityDiffPct: Math.round(finalEquityDiffPct * 1000) / 1000,
      tsTotalReturnPct: Math.round(tsResult.metrics.totalReturnPct * 100) / 100,
      pyTotalReturnPct: Math.round(pyResult.metrics.totalReturnPct * 100) / 100,
      tsTotalTrades: tsTrades.length,
      pyTotalTrades: pyTrades.length,
      tradeCountMatch,
      tradeReconciliation,
      equityReconciliation,
      firstDivergenceTimestamp,
      maxEquityDivergencePct: Math.round(maxEquityDivergencePct * 1000) / 1000,
      confirmedDifferences,
      divergenceHypotheses,
      scenarioResults,
      explanation
    };
  }

  public static runScenarioReconciliation(
    strategy: IStrategy,
    bars: PriceBar[],
    assetTicker: string,
    assetName: string,
    initialCapital: number = 10000,
    pySimulationRunner: (config: BacktestConfig) => PythonQuantBacktestLike
  ): { scenarioResults: ParityScenarioResult[]; fullReport: EngineReconciliationReport } {
    const scenarios: Array<{ scenario: ParityScenarioResult['scenario']; config: BacktestConfig }> = [
      { scenario: 'NO_FRICTION', config: { initialCapital, commissionPct: 0, slippagePct: 0, riskFreeRateAnnualPct: 3, positionSizingPct: 100, executionMode: 'NEXT_OPEN', intrabarConflictPolicy: 'CONSERVATIVE' } },
      { scenario: 'COMMISSION_ONLY', config: { initialCapital, commissionPct: 0.1, slippagePct: 0, riskFreeRateAnnualPct: 3, positionSizingPct: 100, executionMode: 'NEXT_OPEN', intrabarConflictPolicy: 'CONSERVATIVE' } },
      { scenario: 'SLIPPAGE_ONLY', config: { initialCapital, commissionPct: 0, slippagePct: 0.05, riskFreeRateAnnualPct: 3, positionSizingPct: 100, executionMode: 'NEXT_OPEN', intrabarConflictPolicy: 'CONSERVATIVE' } },
      { scenario: 'FULL_FRICTION', config: { initialCapital, commissionPct: 0.1, slippagePct: 0.05, riskFreeRateAnnualPct: 3, positionSizingPct: 100, executionMode: 'NEXT_OPEN', intrabarConflictPolicy: 'CONSERVATIVE' } }
    ];
    const scenarioResults: ParityScenarioResult[] = [];
    let fullReport: EngineReconciliationReport | null = null;
    for (const sc of scenarios) {
      const tsRes = BacktestEngine.runBacktest(strategy, bars, assetTicker, assetName, sc.config);
      const pyRes = pySimulationRunner(sc.config);
      const rep = EngineReconciliationCalculator.reconcile(tsRes, pyRes);
      scenarioResults.push({ scenario: sc.scenario, status: rep.status, finalEquityDiffPct: rep.finalEquityDiffPct, tradeCountMatch: rep.tradeCountMatch });
      if (sc.scenario === 'FULL_FRICTION') fullReport = EngineReconciliationCalculator.reconcile(tsRes, pyRes, scenarioResults);
    }
    return { scenarioResults, fullReport: fullReport! };
  }
}
