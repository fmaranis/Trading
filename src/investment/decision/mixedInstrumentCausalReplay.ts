import { buildPortfolioProvenance } from '../portfolioBacktesting/multiAssetDataAligner';
import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { CausalUniverseBacktestResult } from './causalUniverseBacktestEngine';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import type { DecisionBacktestConfig, DecisionBacktestPoint } from './types';
import { MYINVESTOR_BROKER_PROFILE, type BrokerExecutionProfile } from './brokerExecution';
import { rebalanceCostAware, type CostAwarePosition, type CostAwareOrder, type SuppressedCostAwareOrder } from './costAwareExecutionPolicy';
import { executionPolicyForCapital, type AdaptiveExecutionPolicy } from './adaptiveExecutionPolicy';
import { DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';
import { accrueRemuneratedCash, allCashBenchmark } from './remuneratedCash';

export type FundOperationType = 'SUBSCRIBE' | 'REDEEM' | 'TRANSFER_REVIEW';
export interface FundReplayOperation { assetId: string; ticker: string; type: FundOperationType; amountEur: number; navEur: number; units: number; driftPctPointsBefore: number; }
export interface MixedReplayEvent {
  informationEndDate: string; executionDate: string; equityBeforeEur: number; capitalBand: AdaptiveExecutionPolicy['capitalBand'];
  etfOrders: CostAwareOrder[]; suppressedEtfOrders: SuppressedCostAwareOrder[]; fundOperations: FundReplayOperation[];
  suppressedFundOperations: Array<{ assetId: string; ticker: string; reason: 'FUND_DRIFT_BELOW_THRESHOLD' | 'FUND_MOVEMENT_TOO_SMALL' | 'INSUFFICIENT_CASH'; amountEur: number }>;
  etfCommissionEur: number;
}
export interface MixedInstrumentCausalReplayResult {
  scope: 'MIXED_ETF_FUND_BROKER_AWARE_REPLAY_ON_CAUSAL_SELECTIONS'; initialCapitalEur: number; finalEquityEur: number; totalReturnPct: number; maxDrawdownPct: number;
  etfOrders: number; fundOperations: number; transferReviewCandidates: number; suppressedEtfOrders: number; suppressedFundOperations: number;
  totalEtfCommissionEur: number; commissionDragPctOfInitial: number; rebalanceWindows: number; windowsWithAnyOperation: number; residualCashEur: number;
  cashBenchmarkAnnualPct: number; cashInterestEarnedEur: number; allCashFinalEur: number; allCashReturnPct: number; excessReturnVsCashPctPoints: number; excessFinalEurVsCash: number; beatsAllCashBenchmark: boolean;
  equityCurve: DecisionBacktestPoint[]; events: MixedReplayEvent[]; notes: string[];
}
interface PriceBar { open: number; close: number; }

function datesOf(dataset: MultiAssetDataset): string[] { const s = new Set<string>(); for (const a of dataset.assets) for (const b of a.bars) s.add(b.timestamp.slice(0, 10)); return [...s].sort(); }
function mapsOf(dataset: MultiAssetDataset, dates: string[]): Record<string, Map<string, PriceBar>> {
  const out: Record<string, Map<string, PriceBar>> = {};
  for (const a of dataset.assets) {
    const raw = new Map(a.bars.map(b => [b.timestamp.slice(0, 10), { open: b.open, close: b.close }] as const));
    const dense = new Map<string, PriceBar>(); let last: PriceBar | null = null;
    for (const d of dates) { const row = raw.get(d); if (row) { last = row; dense.set(d, row); } else if (last) dense.set(d, { open: last.close, close: last.close }); }
    out[a.assetId] = dense;
  }
  return out;
}
function slice(dataset: MultiAssetDataset, ids: string[], end: string): MultiAssetDataset { const wanted = new Set(ids); return { timeframe: dataset.timeframe, assets: dataset.assets.filter(a => wanted.has(a.assetId)).map(a => ({ ...a, bars: a.bars.filter(b => b.timestamp.slice(0, 10) <= end) })) }; }
function drawdown(points: DecisionBacktestPoint[]): number { let peak = 0, max = 0; for (const p of points) { peak = Math.max(peak, p.equity); if (peak > 0) max = Math.max(max, (peak - p.equity) / peak * 100); } return max; }

export class MixedInstrumentCausalReplayEngine {
  static run(input: { universeDataset: MultiAssetDataset; catalog: AssetUniverseItem[]; researchResult: CausalUniverseBacktestResult; config: DecisionBacktestConfig; broker?: BrokerExecutionProfile; cashBenchmarkAnnualPct?: number }): MixedInstrumentCausalReplayResult {
    const { universeDataset, catalog, researchResult, config } = input;
    if (!(config.initialCapital > 0)) throw new Error('initialCapital debe ser > 0.');
    if (buildPortfolioProvenance(universeDataset).portfolioEvidence !== 'REAL_ONLY') throw new Error('El replay mixto exige universo REAL_ONLY.');
    const broker = input.broker ?? MYINVESTOR_BROKER_PROFILE;
    const cashBenchmarkAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    const catalogById = new Map(catalog.map(a => [a.assetId, a]));
    const dates = datesOf(universeDataset), bars = mapsOf(universeDataset, dates);
    if (!dates.length) throw new Error('El replay mixto necesita fechas de mercado.');
    const selections = new Map(researchResult.selectionHistory.map(s => [s.executionDate, s]));
    const etfPositions: Record<string, CostAwarePosition> = {}, fundUnits: Record<string, number> = {};
    for (const a of universeDataset.assets) (catalogById.get(a.assetId)?.instrumentType === 'MUTUAL_FUND' ? fundUnits : etfPositions)[a.assetId] = catalogById.get(a.assetId)?.instrumentType === 'MUTUAL_FUND' ? 0 as never : { assetId: a.assetId, ticker: a.ticker, shares: 0 } as never;
    let cash = config.initialCapital, cashInterestEarnedEur = 0, previousDate = dates[0];
    let method: DecisionBacktestPoint['method'] = 'WARMUP_CASH', regime: DecisionBacktestPoint['regime'] = 'UNKNOWN';
    const equityCurve: DecisionBacktestPoint[] = [], events: MixedReplayEvent[] = [];
    const valueAt = (date: string, open = false) => {
      const key = open ? 'open' : 'close';
      const etf = Object.entries(etfPositions).reduce((s, [id, p]) => s + p.shares * (bars[id]?.get(date)?.[key] ?? 0), 0);
      const funds = Object.entries(fundUnits).reduce((s, [id, u]) => s + u * (bars[id]?.get(date)?.[key] ?? 0), 0);
      return { etf, funds, equity: cash + etf + funds };
    };

    for (const executionDate of dates) {
      if (executionDate !== previousDate) {
        const accrued = accrueRemuneratedCash(cash, cashBenchmarkAnnualPct, previousDate, executionDate);
        cash = accrued.cashEur; cashInterestEarnedEur += accrued.interestEur; previousDate = executionDate;
      }
      const selection = selections.get(executionDate);
      if (selection) {
        const prior = valueAt(selection.informationEndDate);
        const decision = InvestmentDecisionEngine.decide(slice(universeDataset, selection.selectedAssetIds, selection.informationEndDate), { capitalEur: Math.max(prior.equity, 1), riskProfile: config.riskProfile, horizonYears: config.horizonYears }, new Date(`${executionDate}T12:00:00Z`));
        method = decision.recommendedMethod; regime = decision.marketRegime;
        const policy = executionPolicyForCapital(prior.equity);
        const prices = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, bars[a.assetId]?.get(executionDate)?.open ?? 0]));
        const targetEtf = Object.fromEntries(Object.keys(etfPositions).map(id => [id, 0]));
        const targetFund = Object.fromEntries(Object.keys(fundUnits).map(id => [id, 0]));
        for (const a of decision.assets) (catalogById.get(a.assetId)?.instrumentType === 'MUTUAL_FUND' ? targetFund : targetEtf)[a.assetId] = a.weight;

        const fundOperations: FundReplayOperation[] = [], suppressedFundOperations: MixedReplayEvent['suppressedFundOperations'] = [];
        const fundThreshold = Math.max(3, policy.minimumDriftPctPoints), minFundMove = Math.max(25, Math.min(100, prior.equity * 0.025));
        const fundRows = Object.keys(fundUnits).map(id => { const nav = prices[id], currentValue = fundUnits[id] * nav, targetWeight = targetFund[id] ?? 0; return { id, nav, currentValue, targetWeight, drift: (currentValue / prior.equity - targetWeight) * 100 }; }).filter(x => x.nav > 0);

        for (const r of fundRows.filter(x => x.drift > 0).sort((a, b) => b.drift - a.drift)) {
          const amount = Math.max(0, r.currentValue - prior.equity * r.targetWeight), ticker = catalogById.get(r.id)?.ticker ?? r.id;
          if (r.drift < fundThreshold) { suppressedFundOperations.push({ assetId: r.id, ticker, reason: 'FUND_DRIFT_BELOW_THRESHOLD', amountEur: amount }); continue; }
          if (amount < minFundMove) { suppressedFundOperations.push({ assetId: r.id, ticker, reason: 'FUND_MOVEMENT_TOO_SMALL', amountEur: amount }); continue; }
          const units = Math.min(fundUnits[r.id], amount / r.nav), actual = units * r.nav; fundUnits[r.id] -= units; cash += actual;
          fundOperations.push({ assetId: r.id, ticker, type: fundRows.some(x => x.drift < -fundThreshold) ? 'TRANSFER_REVIEW' : 'REDEEM', amountEur: actual, navEur: r.nav, units, driftPctPointsBefore: r.drift });
        }

        const etfResult = rebalanceCostAware({ positions: etfPositions, cashEur: cash, pricesEur: prices, targetWeights: targetEtf, broker, policy, referenceEquityEur: prior.equity });
        cash = etfResult.cashEur;

        for (const r of fundRows.filter(x => x.drift < 0).sort((a, b) => a.drift - b.drift)) {
          const ticker = catalogById.get(r.id)?.ticker ?? r.id, current = fundUnits[r.id] * r.nav, deficit = Math.max(0, prior.equity * r.targetWeight - current);
          if (Math.abs(r.drift) < fundThreshold) { suppressedFundOperations.push({ assetId: r.id, ticker, reason: 'FUND_DRIFT_BELOW_THRESHOLD', amountEur: deficit }); continue; }
          if (deficit < minFundMove) { suppressedFundOperations.push({ assetId: r.id, ticker, reason: 'FUND_MOVEMENT_TOO_SMALL', amountEur: deficit }); continue; }
          const amount = Math.min(deficit, cash);
          if (amount < minFundMove) { suppressedFundOperations.push({ assetId: r.id, ticker, reason: 'INSUFFICIENT_CASH', amountEur: deficit }); continue; }
          const units = amount / r.nav; fundUnits[r.id] += units; cash -= amount;
          fundOperations.push({ assetId: r.id, ticker, type: 'SUBSCRIBE', amountEur: amount, navEur: r.nav, units, driftPctPointsBefore: r.drift });
        }
        events.push({ informationEndDate: selection.informationEndDate, executionDate, equityBeforeEur: prior.equity, capitalBand: policy.capitalBand, etfOrders: etfResult.orders, suppressedEtfOrders: etfResult.suppressed, fundOperations, suppressedFundOperations, etfCommissionEur: etfResult.totalCommissionEur });
      }
      const now = valueAt(executionDate); if (cash < -1e-8) throw new Error(`Cash negativo en replay mixto ${executionDate}.`); equityCurve.push({ timestamp: executionDate, equity: now.equity, cash, regime, method });
    }

    const finalEquityEur = equityCurve.at(-1)?.equity ?? config.initialCapital;
    const totalReturnPct = (finalEquityEur / config.initialCapital - 1) * 100;
    const cashOnly = allCashBenchmark(config.initialCapital, cashBenchmarkAnnualPct, dates[0], dates[dates.length - 1]);
    const etfOrders = events.reduce((s, e) => s + e.etfOrders.length, 0), fundOperations = events.reduce((s, e) => s + e.fundOperations.length, 0);
    const totalEtfCommissionEur = events.reduce((s, e) => s + e.etfCommissionEur, 0);
    return {
      scope: 'MIXED_ETF_FUND_BROKER_AWARE_REPLAY_ON_CAUSAL_SELECTIONS', initialCapitalEur: config.initialCapital, finalEquityEur, totalReturnPct,
      maxDrawdownPct: drawdown(equityCurve), etfOrders, fundOperations,
      transferReviewCandidates: events.reduce((s, e) => s + e.fundOperations.filter(x => x.type === 'TRANSFER_REVIEW').length, 0),
      suppressedEtfOrders: events.reduce((s, e) => s + e.suppressedEtfOrders.length, 0), suppressedFundOperations: events.reduce((s, e) => s + e.suppressedFundOperations.length, 0),
      totalEtfCommissionEur, commissionDragPctOfInitial: totalEtfCommissionEur / config.initialCapital * 100, rebalanceWindows: events.length,
      windowsWithAnyOperation: events.filter(e => e.etfOrders.length + e.fundOperations.length > 0).length, residualCashEur: cash,
      cashBenchmarkAnnualPct, cashInterestEarnedEur, allCashFinalEur: cashOnly.finalEur, allCashReturnPct: cashOnly.returnPct,
      excessReturnVsCashPctPoints: totalReturnPct - cashOnly.returnPct, excessFinalEurVsCash: finalEquityEur - cashOnly.finalEur, beatsAllCashBenchmark: finalEquityEur > cashOnly.finalEur,
      equityCurve, events,
      notes: [
        'La selección y fechas proceden del backtest causal; la capa adaptativa solo altera ejecución, nunca la señal.',
        'El efectivo residual se remunera con la referencia anual configurada usando días naturales/365; no se remunera el capital ya invertido.',
        'La comparación all-cash mantiene el capital inicial completo en esa misma cuenta durante exactamente las mismas fechas del replay.',
        'ETFs/ETCs usan títulos enteros y comisión MyInvestor; sus pesos se calculan contra el patrimonio total, incluidos los fondos.',
        'Fondos se modelan por importe/NAV con participaciones fraccionarias y sin comisión explícita de suscripción/reembolso.',
        'TRANSFER_REVIEW es solo candidato a revisión; no afirma elegibilidad fiscal ni simula liquidación.',
        'No se modelan fiscalidad, spread, cánones adicionales ni settlement; es diagnóstico histórico, no previsión.'
      ]
    };
  }
}
