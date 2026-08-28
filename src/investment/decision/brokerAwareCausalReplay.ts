import { buildPortfolioProvenance } from '../portfolioBacktesting/multiAssetDataAligner';
import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { CausalUniverseBacktestResult } from './causalUniverseBacktestEngine';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import type { DecisionBacktestConfig, DecisionBacktestPoint } from './types';
import { MYINVESTOR_BROKER_PROFILE, type BrokerExecutionProfile } from './brokerExecution';
import {
  DEFAULT_COST_AWARE_EXECUTION_POLICY,
  rebalanceCostAware,
  type CostAwareExecutionPolicyConfig,
  type CostAwareOrder,
  type CostAwarePosition,
  type SuppressedCostAwareOrder
} from './costAwareExecutionPolicy';

export interface BrokerAwareReplayEvent {
  informationEndDate: string;
  executionDate: string;
  equityBeforeEur: number;
  targetEtfWeightPct: number;
  targetFundWeightHeldAsCashPct: number;
  executedOrders: CostAwareOrder[];
  suppressedOrders: SuppressedCostAwareOrder[];
  commissionEur: number;
}

export interface BrokerAwareCausalReplayResult {
  scope: 'BROKER_AWARE_ETF_EXECUTION_REPLAY_ON_CAUSAL_SELECTIONS';
  broker: string;
  initialCapitalEur: number;
  finalEquityEur: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  executedOrders: number;
  suppressedOrders: number;
  totalCommissionEur: number;
  rebalanceWindows: number;
  windowsWithTrades: number;
  windowsFullySuppressed: number;
  residualCashEur: number;
  equityCurve: DecisionBacktestPoint[];
  events: BrokerAwareReplayEvent[];
  policy: CostAwareExecutionPolicyConfig;
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
  return {
    timeframe: dataset.timeframe,
    assets: dataset.assets.filter(a => wanted.has(a.assetId)).map(a => ({ ...a, bars: a.bars.filter(b => b.timestamp.slice(0, 10) <= endDate) }))
  };
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

export class BrokerAwareCausalReplayEngine {
  static run(input: {
    universeDataset: MultiAssetDataset;
    catalog: AssetUniverseItem[];
    researchResult: CausalUniverseBacktestResult;
    config: DecisionBacktestConfig;
    broker?: BrokerExecutionProfile;
    policy?: Partial<CostAwareExecutionPolicyConfig>;
  }): BrokerAwareCausalReplayResult {
    const { universeDataset, catalog, researchResult, config } = input;
    if (!(config.initialCapital > 0)) throw new Error('initialCapital debe ser > 0.');
    const provenance = buildPortfolioProvenance(universeDataset);
    if (provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('El replay broker-aware exige universo REAL_ONLY.');
    const broker = input.broker ?? MYINVESTOR_BROKER_PROFILE;
    const policy = { ...DEFAULT_COST_AWARE_EXECUTION_POLICY, ...(input.policy ?? {}) };
    const catalogById = new Map(catalog.map(a => [a.assetId, a]));
    const dates = timelineDates(universeDataset);
    const bars = densePriceMaps(universeDataset, dates);
    const selectionByExecution = new Map(researchResult.selectionHistory.map(s => [s.executionDate, s]));
    const positions: Record<string, CostAwarePosition> = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, { assetId: a.assetId, ticker: a.ticker, shares: 0 }]));
    let cash = config.initialCapital;
    let method: DecisionBacktestPoint['method'] = 'WARMUP_CASH';
    let regime: DecisionBacktestPoint['regime'] = 'UNKNOWN';
    const equityCurve: DecisionBacktestPoint[] = [];
    const events: BrokerAwareReplayEvent[] = [];

    for (const executionDate of dates) {
      const selection = selectionByExecution.get(executionDate);
      if (selection) {
        const selectedDataset = sliceDataset(universeDataset, selection.selectedAssetIds, selection.informationEndDate);
        const previousEquity = cash + universeDataset.assets.reduce((sum, asset) => {
          const price = bars[asset.assetId]?.get(selection.informationEndDate)?.close ?? 0;
          return sum + positions[asset.assetId].shares * price;
        }, 0);
        const decision = InvestmentDecisionEngine.decide(
          selectedDataset,
          { capitalEur: Math.max(previousEquity, 1), riskProfile: config.riskProfile, horizonYears: config.horizonYears },
          new Date(`${executionDate}T12:00:00Z`)
        );
        method = decision.recommendedMethod;
        regime = decision.marketRegime;
        const targetWeights = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, 0]));
        let fundWeightHeldAsCash = 0;
        for (const allocation of decision.assets) {
          const item = catalogById.get(allocation.assetId);
          if (item?.instrumentType === 'MUTUAL_FUND') fundWeightHeldAsCash += allocation.weight;
          else targetWeights[allocation.assetId] = allocation.weight;
        }
        const prices = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, bars[a.assetId]?.get(executionDate)?.open ?? 0]));
        const result = rebalanceCostAware({ positions, cashEur: cash, pricesEur: prices, targetWeights, broker, policy });
        cash = result.cashEur;
        events.push({
          informationEndDate: selection.informationEndDate,
          executionDate,
          equityBeforeEur: result.equityBeforeEur,
          targetEtfWeightPct: Math.max(0, 100 - decision.cashWeight * 100 - fundWeightHeldAsCash * 100),
          targetFundWeightHeldAsCashPct: fundWeightHeldAsCash * 100,
          executedOrders: result.orders,
          suppressedOrders: result.suppressed,
          commissionEur: result.totalCommissionEur
        });
      }

      const positionsValue = universeDataset.assets.reduce((sum, asset) => {
        const close = bars[asset.assetId]?.get(executionDate)?.close ?? 0;
        return sum + positions[asset.assetId].shares * close;
      }, 0);
      const equity = cash + positionsValue;
      if (cash < -1e-8) throw new Error(`Cash negativo en replay broker-aware ${executionDate}.`);
      equityCurve.push({ timestamp: executionDate, equity, cash, regime, method });
    }

    const finalEquity = equityCurve.at(-1)?.equity ?? config.initialCapital;
    const executedOrders = events.reduce((s, e) => s + e.executedOrders.length, 0);
    const suppressedOrders = events.reduce((s, e) => s + e.suppressedOrders.length, 0);
    const totalCommission = events.reduce((s, e) => s + e.commissionEur, 0);
    const windowsWithTrades = events.filter(e => e.executedOrders.length > 0).length;
    return {
      scope: 'BROKER_AWARE_ETF_EXECUTION_REPLAY_ON_CAUSAL_SELECTIONS',
      broker: broker.name,
      initialCapitalEur: config.initialCapital,
      finalEquityEur: finalEquity,
      totalReturnPct: (finalEquity / config.initialCapital - 1) * 100,
      maxDrawdownPct: maxDrawdown(equityCurve),
      executedOrders,
      suppressedOrders,
      totalCommissionEur: totalCommission,
      rebalanceWindows: events.length,
      windowsWithTrades,
      windowsFullySuppressed: events.length - windowsWithTrades,
      residualCashEur: cash,
      equityCurve,
      events,
      policy,
      notes: [
        'La selección temporal y las fechas de decisión proceden del backtest causal de investigación; no se reoptimiza el shortlist con información futura.',
        'El replay aplica títulos enteros, comisión mínima/máxima del broker, umbral de deriva y presupuesto máximo de comisión por rebalanceo.',
        'Las recomendaciones de fondos no se simulan como ETFs: su peso objetivo se mantiene en efectivo por prudencia porque NAV, liquidación y traspasos requieren una semántica distinta.',
        'No modela spread, deslizamiento, cánones adicionales ni fiscalidad; es un replay de ejecutabilidad/costes mínimos, no una previsión de rentabilidad.'
      ]
    };
  }
}
