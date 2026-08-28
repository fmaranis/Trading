import { buildPortfolioProvenance } from '../portfolioBacktesting/multiAssetDataAligner';
import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { CausalUniverseBacktestResult } from './causalUniverseBacktestEngine';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import type { DecisionBacktestConfig, DecisionBacktestPoint } from './types';
import { MYINVESTOR_BROKER_PROFILE, type BrokerExecutionProfile } from './brokerExecution';
import { rebalanceCostAware, type CostAwarePosition, type CostAwareOrder, type SuppressedCostAwareOrder } from './costAwareExecutionPolicy';
import { executionPolicyForCapital, type AdaptiveExecutionPolicy } from './adaptiveExecutionPolicy';

export type FundOperationType = 'SUBSCRIBE' | 'REDEEM' | 'TRANSFER_REVIEW';

export interface FundReplayOperation {
  assetId: string;
  ticker: string;
  type: FundOperationType;
  amountEur: number;
  navEur: number;
  units: number;
  driftPctPointsBefore: number;
}

export interface MixedReplayEvent {
  informationEndDate: string;
  executionDate: string;
  equityBeforeEur: number;
  capitalBand: AdaptiveExecutionPolicy['capitalBand'];
  etfOrders: CostAwareOrder[];
  suppressedEtfOrders: SuppressedCostAwareOrder[];
  fundOperations: FundReplayOperation[];
  suppressedFundOperations: Array<{ assetId: string; ticker: string; reason: 'FUND_DRIFT_BELOW_THRESHOLD' | 'FUND_MOVEMENT_TOO_SMALL' | 'INSUFFICIENT_CASH'; amountEur: number }>;
  etfCommissionEur: number;
}

export interface MixedInstrumentCausalReplayResult {
  scope: 'MIXED_ETF_FUND_BROKER_AWARE_REPLAY_ON_CAUSAL_SELECTIONS';
  initialCapitalEur: number;
  finalEquityEur: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  etfOrders: number;
  fundOperations: number;
  transferReviewCandidates: number;
  suppressedEtfOrders: number;
  suppressedFundOperations: number;
  totalEtfCommissionEur: number;
  commissionDragPctOfInitial: number;
  rebalanceWindows: number;
  windowsWithAnyOperation: number;
  residualCashEur: number;
  equityCurve: DecisionBacktestPoint[];
  events: MixedReplayEvent[];
  notes: string[];
}

interface PriceBar { open: number; close: number; }

function timelineDates(dataset: MultiAssetDataset): string[] {
  const dates = new Set<string>();
  for (const asset of dataset.assets) for (const bar of asset.bars) dates.add(bar.timestamp.slice(0, 10));
  return [...dates].sort();
}

function densePriceMaps(dataset: MultiAssetDataset, dates: string[]): Record<string, Map<string, PriceBar>> {
  const result: Record<string, Map<string, PriceBar>> = {};
  for (const asset of dataset.assets) {
    const raw = new Map<string, PriceBar>();
    for (const b of asset.bars) raw.set(b.timestamp.slice(0, 10), { open: b.open, close: b.close });
    const dense = new Map<string, PriceBar>();
    let last: PriceBar | null = null;
    for (const date of dates) {
      const row = raw.get(date);
      if (row) { last = row; dense.set(date, row); }
      else if (last) dense.set(date, { open: last.close, close: last.close });
    }
    result[asset.assetId] = dense;
  }
  return result;
}

function sliceDataset(dataset: MultiAssetDataset, assetIds: string[], endDate: string): MultiAssetDataset {
  const wanted = new Set(assetIds);
  return { timeframe: dataset.timeframe, assets: dataset.assets.filter(a => wanted.has(a.assetId)).map(a => ({ ...a, bars: a.bars.filter(b => b.timestamp.slice(0, 10) <= endDate) })) };
}

function maxDrawdown(points: DecisionBacktestPoint[]): number {
  let peak = 0;
  let max = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) max = Math.max(max, (peak - point.equity) / peak * 100);
  }
  return max;
}

export class MixedInstrumentCausalReplayEngine {
  static run(input: {
    universeDataset: MultiAssetDataset;
    catalog: AssetUniverseItem[];
    researchResult: CausalUniverseBacktestResult;
    config: DecisionBacktestConfig;
    broker?: BrokerExecutionProfile;
  }): MixedInstrumentCausalReplayResult {
    const { universeDataset, catalog, researchResult, config } = input;
    if (!(config.initialCapital > 0)) throw new Error('initialCapital debe ser > 0.');
    const provenance = buildPortfolioProvenance(universeDataset);
    if (provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('El replay mixto exige universo REAL_ONLY.');

    const broker = input.broker ?? MYINVESTOR_BROKER_PROFILE;
    const catalogById = new Map(catalog.map(a => [a.assetId, a]));
    const dates = timelineDates(universeDataset);
    const bars = densePriceMaps(universeDataset, dates);
    const selectionByExecution = new Map(researchResult.selectionHistory.map(s => [s.executionDate, s]));
    const etfPositions: Record<string, CostAwarePosition> = {};
    const fundUnits: Record<string, number> = {};
    for (const asset of universeDataset.assets) {
      const item = catalogById.get(asset.assetId);
      if (item?.instrumentType === 'MUTUAL_FUND') fundUnits[asset.assetId] = 0;
      else etfPositions[asset.assetId] = { assetId: asset.assetId, ticker: asset.ticker, shares: 0 };
    }

    let cash = config.initialCapital;
    let method: DecisionBacktestPoint['method'] = 'WARMUP_CASH';
    let regime: DecisionBacktestPoint['regime'] = 'UNKNOWN';
    const equityCurve: DecisionBacktestPoint[] = [];
    const events: MixedReplayEvent[] = [];

    const valueAt = (date: string, useOpen = false) => {
      const etf = Object.entries(etfPositions).reduce((sum, [id, p]) => sum + p.shares * ((bars[id]?.get(date)?.[useOpen ? 'open' : 'close']) ?? 0), 0);
      const funds = Object.entries(fundUnits).reduce((sum, [id, units]) => sum + units * ((bars[id]?.get(date)?.[useOpen ? 'open' : 'close']) ?? 0), 0);
      return { etf, funds, equity: cash + etf + funds };
    };

    for (const executionDate of dates) {
      const selection = selectionByExecution.get(executionDate);
      if (selection) {
        const selectedDataset = sliceDataset(universeDataset, selection.selectedAssetIds, selection.informationEndDate);
        const prior = valueAt(selection.informationEndDate, false);
        const decision = InvestmentDecisionEngine.decide(selectedDataset, { capitalEur: Math.max(prior.equity, 1), riskProfile: config.riskProfile, horizonYears: config.horizonYears }, new Date(`${executionDate}T12:00:00Z`));
        method = decision.recommendedMethod;
        regime = decision.marketRegime;
        const policy = executionPolicyForCapital(prior.equity);

        const prices = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, bars[a.assetId]?.get(executionDate)?.open ?? 0]));
        const targetEtfWeights: Record<string, number> = Object.fromEntries(Object.keys(etfPositions).map(id => [id, 0]));
        const targetFundWeights: Record<string, number> = Object.fromEntries(Object.keys(fundUnits).map(id => [id, 0]));
        for (const allocation of decision.assets) {
          const item = catalogById.get(allocation.assetId);
          if (item?.instrumentType === 'MUTUAL_FUND') targetFundWeights[allocation.assetId] = allocation.weight;
          else if (allocation.assetId in targetEtfWeights) targetEtfWeights[allocation.assetId] = allocation.weight;
        }

        // First release fund cash for material overweights. Fund operations are modeled by EUR amount/NAV,
        // with fractional units and no explicit subscription/redemption fee. This is intentionally a
        // valuation/execution diagnostic, not a settlement/tax simulation.
        const fundOperations: FundReplayOperation[] = [];
        const suppressedFundOperations: MixedReplayEvent['suppressedFundOperations'] = [];
        const fundThresholdPp = Math.max(3, policy.minimumDriftPctPoints);
        const minimumFundMovement = Math.max(25, Math.min(100, prior.equity * 0.025));

        const fundRows = Object.keys(fundUnits).map(id => {
          const nav = prices[id];
          const currentValue = fundUnits[id] * nav;
          const currentWeight = prior.equity > 0 ? currentValue / prior.equity : 0;
          const targetWeight = targetFundWeights[id] ?? 0;
          return { id, nav, currentValue, currentWeight, targetWeight, driftPp: (currentWeight - targetWeight) * 100 };
        }).filter(x => x.nav > 0);

        for (const row of fundRows.filter(x => x.driftPp > 0).sort((a, b) => b.driftPp - a.driftPp)) {
          const amount = Math.max(0, row.currentValue - prior.equity * row.targetWeight);
          if (row.driftPp < fundThresholdPp) { suppressedFundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, reason: 'FUND_DRIFT_BELOW_THRESHOLD', amountEur: amount }); continue; }
          if (amount < minimumFundMovement) { suppressedFundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, reason: 'FUND_MOVEMENT_TOO_SMALL', amountEur: amount }); continue; }
          const units = Math.min(fundUnits[row.id], amount / row.nav);
          const actual = units * row.nav;
          fundUnits[row.id] -= units;
          cash += actual;
          const hasFundDeficit = fundRows.some(x => x.driftPp < -fundThresholdPp);
          fundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, type: hasFundDeficit ? 'TRANSFER_REVIEW' : 'REDEEM', amountEur: actual, navEur: row.nav, units, driftPctPointsBefore: row.driftPp });
        }

        // Then execute ETF sells/buys under the adaptive broker policy.
        const etfResult = rebalanceCostAware({ positions: etfPositions, cashEur: cash, pricesEur: prices, targetWeights: targetEtfWeights, broker, policy });
        cash = etfResult.cashEur;

        // Finally direct remaining cash to materially underweight funds.
        for (const row of fundRows.filter(x => x.driftPp < 0).sort((a, b) => a.driftPp - b.driftPp)) {
          const currentValue = fundUnits[row.id] * row.nav;
          const deficit = Math.max(0, prior.equity * row.targetWeight - currentValue);
          if (Math.abs(row.driftPp) < fundThresholdPp) { suppressedFundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, reason: 'FUND_DRIFT_BELOW_THRESHOLD', amountEur: deficit }); continue; }
          if (deficit < minimumFundMovement) { suppressedFundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, reason: 'FUND_MOVEMENT_TOO_SMALL', amountEur: deficit }); continue; }
          const amount = Math.min(deficit, cash);
          if (amount < minimumFundMovement) { suppressedFundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, reason: 'INSUFFICIENT_CASH', amountEur: deficit }); continue; }
          const units = amount / row.nav;
          fundUnits[row.id] += units;
          cash -= amount;
          fundOperations.push({ assetId: row.id, ticker: catalogById.get(row.id)?.ticker ?? row.id, type: 'SUBSCRIBE', amountEur: amount, navEur: row.nav, units, driftPctPointsBefore: row.driftPp });
        }

        events.push({
          informationEndDate: selection.informationEndDate,
          executionDate,
          equityBeforeEur: prior.equity,
          capitalBand: policy.capitalBand,
          etfOrders: etfResult.orders,
          suppressedEtfOrders: etfResult.suppressed,
          fundOperations,
          suppressedFundOperations,
          etfCommissionEur: etfResult.totalCommissionEur
        });
      }

      const now = valueAt(executionDate, false);
      if (cash < -1e-8) throw new Error(`Cash negativo en replay mixto ${executionDate}.`);
      equityCurve.push({ timestamp: executionDate, equity: now.equity, cash, regime, method });
    }

    const finalEquity = equityCurve.at(-1)?.equity ?? config.initialCapital;
    const etfOrders = events.reduce((s, e) => s + e.etfOrders.length, 0);
    const fundOperations = events.reduce((s, e) => s + e.fundOperations.length, 0);
    const transferReviewCandidates = events.reduce((s, e) => s + e.fundOperations.filter(x => x.type === 'TRANSFER_REVIEW').length, 0);
    const suppressedEtfOrders = events.reduce((s, e) => s + e.suppressedEtfOrders.length, 0);
    const suppressedFundOperations = events.reduce((s, e) => s + e.suppressedFundOperations.length, 0);
    const totalEtfCommissionEur = events.reduce((s, e) => s + e.etfCommissionEur, 0);
    const windowsWithAnyOperation = events.filter(e => e.etfOrders.length + e.fundOperations.length > 0).length;

    return {
      scope: 'MIXED_ETF_FUND_BROKER_AWARE_REPLAY_ON_CAUSAL_SELECTIONS',
      initialCapitalEur: config.initialCapital,
      finalEquityEur: finalEquity,
      totalReturnPct: (finalEquity / config.initialCapital - 1) * 100,
      maxDrawdownPct: maxDrawdown(equityCurve),
      etfOrders,
      fundOperations,
      transferReviewCandidates,
      suppressedEtfOrders,
      suppressedFundOperations,
      totalEtfCommissionEur,
      commissionDragPctOfInitial: totalEtfCommissionEur / config.initialCapital * 100,
      rebalanceWindows: events.length,
      windowsWithAnyOperation,
      residualCashEur: cash,
      equityCurve,
      events,
      notes: [
        'La selección y fechas proceden del backtest causal; la capa adaptativa solo altera ejecución, nunca la señal de investigación.',
        'ETFs/ETCs: títulos enteros y comisión MyInvestor modelada; umbrales de deriva/coste cambian por banda de capital.',
        'Fondos: se modelan por importe y NAV con participaciones fraccionarias, sin comisión explícita de suscripción/reembolso en este diagnóstico.',
        'TRANSFER_REVIEW identifica un posible origen/destino de traspaso, pero no afirma elegibilidad fiscal ni simula días de liquidación.',
        'No se modelan fiscalidad, spread, cánones adicionales ni retrasos de settlement; el resultado sigue siendo diagnóstico histórico, no previsión.'
      ]
    };
  }
}
